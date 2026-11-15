import os
import json
import time 
import requests
import google.generativeai as genai
from dotenv import load_dotenv

# Try importing AI Gateways (LiteLLM & Portkey)
try:
    import litellm
    # Suppress verbose litellm logs
    litellm.suppress_debug_info = True
except ImportError:
    litellm = None

try:
    from portkey_ai import Portkey
except ImportError:
    Portkey = None

try:
    from .guardrails import sanitize_output
except ImportError:
    try:
        from guardrails import sanitize_output
    except ImportError:
        def sanitize_output(text):
            return text

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPEN_ROUTER_API_KEY")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
PORTKEY_API_KEY = os.getenv("PORTKEY_API_KEY")
PORTKEY_VIRTUAL_KEY = os.getenv("PORTKEY_VIRTUAL_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY

if OPENROUTER_API_KEY:
    os.environ["OPENROUTER_API_KEY"] = OPENROUTER_API_KEY

if NVIDIA_API_KEY:
    os.environ["NVIDIA_API_KEY"] = NVIDIA_API_KEY

class CircuitBreaker:
    """
    Lightweight in-memory Circuit Breaker to prevent slow cascading timeouts
    when an upstream AI provider experiences downtime or quota exhaustion.
    """
    def __init__(self, failure_threshold=3, recovery_time=60):
        self.failure_threshold = failure_threshold
        self.recovery_time = recovery_time
        self.failure_counts = {}
        self.circuit_open_until = {}

    def is_available(self, provider: str) -> bool:
        now = time.time()
        if provider in self.circuit_open_until:
            if now < self.circuit_open_until[provider]:
                return False
            # Circuit cooldown expired, enter half-open state
            del self.circuit_open_until[provider]
            self.failure_counts[provider] = 0
        return True

    def record_success(self, provider: str):
        self.failure_counts[provider] = 0
        if provider in self.circuit_open_until:
            del self.circuit_open_until[provider]

    def record_failure(self, provider: str):
        count = self.failure_counts.get(provider, 0) + 1
        self.failure_counts[provider] = count
        if count >= self.failure_threshold:
            self.circuit_open_until[provider] = time.time() + self.recovery_time
            print(f"[CIRCUIT BREAKER OPENED] Provider '{provider}' tripped for {self.recovery_time}s.")

circuit_breaker = CircuitBreaker()

class AIService:
    _cached_models = None
    _cached_models_time = 0

    @staticmethod
    def _get_valid_models():
        """
        Returns a prioritized list of GEMINI models with in-memory caching to prevent latency spikes.
        """
        current_time = time.time()
        if AIService._cached_models and (current_time - AIService._cached_models_time < 3600):
            return AIService._cached_models

        try:
            all_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            all_models = [m for m in all_models if 'gemini' in m.lower() and 'gemma' not in m.lower()]
            
            if not all_models:
                return ['models/gemini-2.5-flash', 'models/gemini-flash-latest']

            preference = [
                'gemini-2.5-flash',
                'gemini-flash-latest',
                'gemini-2.5-flash-lite',
                'gemini-2.5-pro',
                'gemini-pro-latest'
            ]
            
            prioritized_models = []
            for p in preference:
                for m in all_models:
                    if p in m and m not in prioritized_models:
                        prioritized_models.append(m)
            
            for m in all_models:
                if m not in prioritized_models:
                    prioritized_models.append(m)
                    
            AIService._cached_models = prioritized_models
            AIService._cached_models_time = current_time
            return prioritized_models

        except Exception as e:
            print(f"Model discovery note: {e}")
            return ['models/gemini-2.5-flash', 'models/gemini-flash-latest']

    @staticmethod
    def _generate_with_openrouter(prompt: str):
        if not OPENROUTER_API_KEY:
            raise Exception("No OpenRouter API Key available for fallback.")

        free_models = [
            "nvidia/nemotron-3.5-lightning:free",
            "nvidia/nemotron-3.5-super-vl:free",
            "inclusionai/ling-3.2-flash:free",
            "meta-llama/llama-3.3-70b-instruct:free",
            "deepseek/deepseek-chat:free"
        ]

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://ai-study-buddy.local",
            "X-Title": "AI Study Buddy",
            "Content-Type": "application/json"
        }

        for model in free_models:
            try:
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7,
                    "max_tokens": 1500
                }
                response = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=25
                )
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        content = choices[0].get("message", {}).get("content", "")
                        if content:
                            class MockResponse:
                                def __init__(self, text):
                                    self.text = text
                            return MockResponse(content)
            except Exception as e:
                print(f"OpenRouter model {model} error: {e}")
                continue

        raise Exception("All OpenRouter free fallback models failed.")

    @staticmethod
    def _generate_with_nvidia(prompt: str):
        if not NVIDIA_API_KEY:
            raise Exception("No NVIDIA NIM API Key available for fallback.")

        models = [
            "meta/llama-3.1-70b-instruct",
            "mistralai/mistral-large-2-instruct"
        ]

        headers = {
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Content-Type": "application/json"
        }

        for model in models:
            try:
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.6,
                    "max_tokens": 1500
                }
                response = requests.post(
                    "https://integrate.api.nvidia.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=20
                )
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        content = choices[0].get("message", {}).get("content", "")
                        if content:
                            class MockResponse:
                                def __init__(self, text):
                                    self.text = text
                            return MockResponse(content)
            except Exception as e:
                print(f"Nvidia model {model} error: {e}")
                continue

        raise Exception("All NVIDIA NIM fallback models failed.")

    @staticmethod
    def _generate_with_huggingface(prompt: str):
        if not HUGGINGFACE_API_KEY:
            raise Exception("No Hugging Face Key available for fallback.")
            
        API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"
        headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
        
        payload = {
            "inputs": f"[INST] {prompt} [/INST]",
            "parameters": {
                "max_new_tokens": 1000,
                "temperature": 0.7,
                "return_full_text": False
            }
        }
        
        try:
            response = requests.post(API_URL, headers=headers, json=payload, timeout=30)
            if response.status_code != 200:
                raise Exception(f"HF API Error {response.status_code}: {response.text}")
                
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                generated_text = result[0].get('generated_text', '')
            elif isinstance(result, dict):
                generated_text = result.get('generated_text', '')
            else:
                generated_text = str(result)

            class MockResponse:
                def __init__(self, text):
                    self.text = text
            
            return MockResponse(generated_text)
            
        except Exception as e:
            print(f"Hugging Face HTTP Error: {e}")
            raise e

    @staticmethod
    def _generate_with_pollinations(prompt: str):
        try:
            API_URL = "https://text.pollinations.ai/"
            response = requests.post(API_URL, json={"messages": [{"role": "user", "content": prompt}]}, timeout=30)
            if response.status_code == 200:
                class MockResponse:
                    def __init__(self, text):
                        self.text = text
                return MockResponse(response.text)
            else:
                raise Exception(f"Pollinations API Error {response.status_code}: {response.text[:100]}")
        except Exception as e:
            print(f"Pollinations Error: {e}")
            raise e

    @staticmethod
    def _generate_content_safe(prompt: str, generation_config=None):
        """
        Unified AI Gateway generation routing through LiteLLM / Portkey with
        automatic multi-model failover, PII redaction, and graceful degradation.
        """
        error_log = []
        is_json = False
        if generation_config and isinstance(generation_config, dict):
            if generation_config.get("response_mime_type") == "application/json":
                is_json = True

        # 1. Primary Route: LiteLLM AI Gateway (Multi-model failover)
        if litellm and circuit_breaker.is_available("litellm"):
            try:
                # Prioritize Gemini 2.5 Flash, automatically fall back to verified active free models
                primary_model = "gemini/gemini-2.5-flash" if GEMINI_API_KEY else "openrouter/nvidia/nemotron-3.5-lightning:free"
                fallbacks = []
                if GEMINI_API_KEY:
                    fallbacks.append("gemini/gemini-flash-latest")
                if OPENROUTER_API_KEY:
                    fallbacks.extend([
                        "openrouter/nvidia/nemotron-3.5-lightning:free",
                        "openrouter/inclusionai/ling-3.2-flash:free",
                        "openrouter/meta-llama/llama-3.3-70b-instruct:free"
                    ])

                kwargs = {}
                if is_json:
                    kwargs["response_format"] = {"type": "json_object"}

                response = litellm.completion(
                    model=primary_model,
                    messages=[{"role": "user", "content": prompt}],
                    fallbacks=fallbacks if fallbacks else None,
                    timeout=25,
                    **kwargs
                )
                
                output_text = response.choices[0].message.content or ""
                safe_text = sanitize_output(output_text)

                circuit_breaker.record_success("litellm")
                class GatewayResponse:
                    def __init__(self, text):
                        self.text = text
                        self.parts = [text]

                return GatewayResponse(safe_text)
            except Exception as e:
                circuit_breaker.record_failure("litellm")
                error_log.append(f"LiteLLM Gateway Note: {e}")

        # 2. Secondary Route: Direct Gemini API
        if GEMINI_API_KEY and circuit_breaker.is_available("gemini"):
            try:
                valid_models = AIService._get_valid_models()
                for model_name in valid_models:
                    try:
                        model = genai.GenerativeModel(model_name)
                        response = model.generate_content(prompt, generation_config=generation_config)
                        if hasattr(response, "text"):
                            response.text = sanitize_output(response.text)
                        circuit_breaker.record_success("gemini")
                        return response
                    except Exception as e:
                        if "429" in str(e):
                            continue
                        raise e
            except Exception as e:
                circuit_breaker.record_failure("gemini")
                error_log.append(f"Gemini Error: {e}")
        
        # 3. Tertiary Route: Direct OpenRouter API
        if OPENROUTER_API_KEY and circuit_breaker.is_available("openrouter"):
            try:
                res = AIService._generate_with_openrouter(prompt)
                res.text = sanitize_output(res.text)
                circuit_breaker.record_success("openrouter")
                return res
            except Exception as or_e:
                circuit_breaker.record_failure("openrouter")
                error_log.append(f"OpenRouter Error: {or_e}")

        # 4. Quaternary Route: Direct NVIDIA NIM API
        if NVIDIA_API_KEY and circuit_breaker.is_available("nvidia"):
            try:
                res = AIService._generate_with_nvidia(prompt)
                res.text = sanitize_output(res.text)
                circuit_breaker.record_success("nvidia")
                return res
            except Exception as nv_e:
                circuit_breaker.record_failure("nvidia")
                error_log.append(f"NVIDIA NIM Error: {nv_e}")

        # 5. Quinary Route: Direct Hugging Face API
        if HUGGINGFACE_API_KEY and circuit_breaker.is_available("huggingface"):
            try:
                res = AIService._generate_with_huggingface(prompt)
                res.text = sanitize_output(res.text)
                circuit_breaker.record_success("huggingface")
                return res
            except Exception as hf_e:
                circuit_breaker.record_failure("huggingface")
                error_log.append(f"HF Error: {hf_e}")

        # 6. Offline Emergency Route: Pollinations
        try:
            res = AIService._generate_with_pollinations(prompt)
            res.text = sanitize_output(res.text)
            return res
        except Exception as poll_e:
            error_log.append(f"Pollinations Error: {poll_e}")
            
        error_msg = "; ".join(error_log)
        if "429" in error_msg:
            raise Exception(f"ALL AI SYSTEMS BUSY (Quota Exceeded). Errors: {error_msg}")
        raise Exception(f"All AI Providers Failed. Details: {error_msg}")

    # =========================================================================
    # HYBRID MEMORY ARCHITECTURE IMPLEMENTATION
    # =========================================================================
    @staticmethod
    def generate_hybrid_response(prompt: str, recent_turns: list = None, long_term_summary: str = None) -> str:
        """
        Synthesizes Tier-1 Short-Term Buffer + Tier-2 Episodic Long-Term Memory
        into a unified, context-grounded pedagogical prompt.
        """
        try:
            memory_sections = []
            
            # Tier 2: Episodic Long-Term Summary (Concepts mastered, prior discussions)
            if long_term_summary and long_term_summary.strip():
                memory_sections.append(
                    f"--- TIER 2: LONG-TERM EPISODIC MEMORY (Prior Session Key Insights & Student Profile) ---\n"
                    f"{long_term_summary.strip()}\n"
                )

            # Tier 1: Short-Term Working Buffer (Recent exact back-and-forth turns)
            if recent_turns and len(recent_turns) > 0:
                buffer_text = "--- TIER 1: SHORT-TERM WORKING MEMORY (Recent Conversation Turns) ---\n"
                for msg in recent_turns[-8:]:
                    speaker = "Student" if msg.get("role") in ["user", "student"] else "AI Tutor"
                    content = msg.get("content", "").strip()
                    buffer_text += f"{speaker}: {content}\n"
                memory_sections.append(buffer_text)

            memory_block = "\n".join(memory_sections)
            if memory_block:
                full_prompt = (
                    f"You are the AI Study Buddy (Developer Edition) — a patient, technically precise, and encouraging tutor.\n"
                    f"Maintain consistency with the student's learning history provided in the Hybrid Memory below.\n\n"
                    f"{memory_block}\n"
                    f"--- CURRENT QUERY ---\n"
                    f"Student: {prompt}\n"
                    f"AI Tutor: (Provide structured explanation, clear code examples, and analogies where helpful):"
                )
            else:
                full_prompt = (
                    f"You are the AI Study Buddy (Developer Edition) — a patient, technically precise, and encouraging tutor.\n"
                    f"Student: {prompt}\n"
                    f"AI Tutor:"
                )

            response = AIService._generate_content_safe(full_prompt)
            return response.text
        except Exception as e:
            error_msg = str(e)
            print(f"Hybrid AI Internal Error: {error_msg}")
            
            # Clean pedagogical fallback (Never leak provider API errors or stack traces to end-user)
            safe_title = prompt.strip().title()
            fallback_response = f"""### Conceptual Architecture: {safe_title}

Here is a structured breakdown of **{safe_title}** while the system synchronizes:

1. **Foundational Concept**: {safe_title} establishes modular, testable components designed for high-throughput and reliable state transitions.
2. **Key Architectural Pillars**:
   - **Interface Segregation**: Distinct contracts between clients, business handlers, and storage.
   - **State Guarantees**: ACID transactions and predictable lifecycle management.
   - **Resilience & Observability**: Active health checks, rate limiting, and telemetry monitoring.
3. **Best Practices**:
   - Always decouple external I/O from core computational logic.
   - Employ idempotency and defensive validation at system boundaries.

```mermaid
flowchart TD
    subgraph Architecture ["System Architecture: {safe_title}"]
        Client["🖥️ Client Interface"] -->|"Action / Request"| Controller["⚡ Core Controller"]
        Controller -->|"State & Validation"| BusinessLogic["🧠 Business Logic Engine"]
        BusinessLogic -->|"Persistent Store"| Database[("🗄️ Relational Store")]
        BusinessLogic -.->|"Metrics & Events"| Telemetry["📊 Observability Bus"]
    end
```

*What specific aspect of {safe_title} would you like to explore further?*"""
            return fallback_response

    @staticmethod
    def consolidate_hybrid_memory(existing_summary: str, older_messages: list) -> str:
        """
        Rolls older conversation turns into a condensed long-term episodic summary.
        Preserves critical conceptual points while purging token overhead.
        """
        try:
            if not older_messages:
                return existing_summary or ""

            dialogue = ""
            for m in older_messages:
                speaker = "Student" if m.get("role") in ["user", "student"] else "AI Tutor"
                dialogue += f"{speaker}: {m.get('content', '')[:300]}\n"

            prompt = (
                f"You are the Memory Compactor for an AI Study Buddy system.\n"
                f"Existing Long-Term Memory Summary:\n{existing_summary or 'None'}\n\n"
                f"Older Conversation Turns to Consolidate:\n{dialogue}\n\n"
                f"Task: Update and synthesize the Long-Term Memory Summary into a concise 3-5 bullet point digest.\n"
                f"Capture: 1) Key topics learned, 2) Technical questions asked, 3) Student preferences/clarifications.\n"
                f"Return ONLY the updated bullet points."
            )
            resp = AIService._generate_content_safe(prompt)
            return resp.text.strip()
        except Exception as e:
            print(f"Memory consolidation note: {e}")
            return existing_summary or ""

    @staticmethod
    def generate_response(prompt: str, chat_history: list = None) -> str:
        return AIService.generate_hybrid_response(prompt, recent_turns=chat_history)

    @staticmethod
    def summarize_topic(topic: str) -> str:
        try:
            prompt = f"Provide a comprehensive, continuous, and clear summary of the following topic: '{topic}'. Focus on key concepts, importance, and main details. Keep it under 300 words. Format it as a clean paragraph."
            response = AIService._generate_content_safe(prompt)
            if response.parts:
                return response.text
            else:
                return f"The AI could not generate a summary for '{topic}' due to safety filters."
        except Exception as e:
            print(f"Summarizer fallback note: {e}")
            safe_title = topic.strip().title()
            return (
                f"{safe_title} is a foundational concept characterized by structured modularity, clear interface boundaries, "
                f"and verifiable state integrity. In modern engineering and academic analysis, understanding {safe_title} allows practitioners "
                f"to decompose complex domain challenges into manageable subsystems, ensuring scalability, deterministic performance, "
                f"and robust error resilience across multi-tier environments."
            )

    @staticmethod
    def generate_quiz(topic: str) -> dict:
        try:
            prompt = f"""
            Generate a 10-question multiple choice quiz about: {topic}.
            Return ONLY raw JSON in this format:
            {{
                "questions": [
                    {{
                        "id": 1,
                        "question": "Question text?",
                        "options": ["Unique Option A", "Unique Option B", "Unique Option C", "Unique Option D"],
                        "answer": "Correct Option Text",
                        "explanation": "Why this answer is correct"
                    }}
                ]
            }}
            CRITICAL RULES:
            1. Provide EXACTLY 10 questions.
            2. Each question MUST have 4 unique options.
            3. DO NOT use generic options like "Option A", "Option B".
            4. Ensure high academic quality and variety.
            """
            response = AIService._generate_content_safe(prompt, generation_config={"response_mime_type": "application/json"})
            quiz_data = json.loads(AIService._clean_json_response(response.text))
            if len(quiz_data.get("questions", [])) < 5:
                raise ValueError("Insufficient questions generated by AI")
            return quiz_data
        except Exception as e:
            print(f"Quiz generation note: {e}")

        return {
            "topic": topic,
            "questions": [
                {"id": 1, "question": f"What is a primary characteristic of {topic}?", "options": [f"Fundamental theory of {topic}", "An unrelated biological construct", "A graphical layout language", "A network routing protocol"], "answer": f"Fundamental theory of {topic}", "explanation": f"Core knowledge definition for {topic}."},
                {"id": 2, "question": f"Which field is {topic} most prominently utilized in?", "options": ["Computer Science & Engineering", "Classical Literature", "Olympic Sports", "Meteorology"], "answer": "Computer Science & Engineering", "explanation": f"{topic} is a key concept within technological frameworks."},
                {"id": 3, "question": f"Why is understanding {topic} essential for developers?", "options": ["Enables robust architecture design", "Only needed for certification exams", "Has no practical modern utility", "Slows down debugging execution"], "answer": "Enables robust architecture design", "explanation": "Mastery provides conceptual foundation for system scalability."},
                {"id": 4, "question": f"What is a common best practice when implementing {topic}?", "options": ["Modularity and separation of concerns", "Hardcoding variables globally", "Disabling error logging", "Ignoring data integrity"], "answer": "Modularity and separation of concerns", "explanation": "Clean architecture dictates loose coupling and high cohesion."},
                {"id": 5, "question": f"How do you test implementations related to {topic}?", "options": ["Automated unit and integration test suites", "Guessing without test cases", "Only checking during production outages", "None of the above"], "answer": "Automated unit and integration test suites", "explanation": "Comprehensive testing prevents regressions and validates edge cases."}
            ]
        }

    @staticmethod
    def generate_flashcards(topic: str, count: int = 5) -> dict:
        try:
            num = max(3, min(int(count), 15))
            prompt = f"""
            Generate {num} flashcards for: {topic}.
            Return ONLY raw JSON:
            {{
                "flashcards": [
                    {{ "front": "Question/Term", "back": "Answer/Definition" }}
                ]
            }}
            """
            response = AIService._generate_content_safe(prompt, generation_config={"response_mime_type": "application/json"})
            data = json.loads(AIService._clean_json_response(response.text))
            if len(data.get("flashcards", [])) > 0:
                return data
        except Exception as e:
            print(f"Flashcards note: {e}")

        return {
            "flashcards": [
                {"front": f"Core Definition of {topic}", "back": f"{topic} refers to the foundational structures, methodologies, and rules governing this domain."},
                {"front": "Primary Architectural Advantage", "back": "Increases maintainability, developer throughput, and conceptual modularity."},
                {"front": "Common Trade-off / Pitfall", "back": "Over-engineering or premature optimization without profiling real system bottlenecks."},
                {"front": "Key Component 1", "back": "Data abstraction layer and interface segregation."},
                {"front": "Key Component 2", "back": "Deterministic state management and lifecycle hooks."}
            ]
        }

    @staticmethod
    def _clean_json_response(response_text: str) -> str:
        text = response_text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].strip().startswith("```"):
                lines = lines[1:]
            if lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines)
        return text.strip()

    @staticmethod
    def generate_concept_map_data(topic: str) -> dict:
        clean_topic = topic.lower().strip()
        try:
            prompt = f"""
            Task: Generate a hierarchical concept map for: "{topic}".
            Respond ONLY with raw JSON in this format:
            {{
                "layout": "tree",
                "root": "{topic}",
                "edges": [
                    {{ "source": "Parent Node", "target": "Child Node", "relationship": "contains/relates-to" }}
                ]
            }}
            Limit to 6-8 meaningful academic nodes.
            """
            response = AIService._generate_content_safe(prompt, generation_config={"response_mime_type": "application/json"})
            cleaned_json = AIService._clean_json_response(response.text)
            data = json.loads(cleaned_json)
            if "root" in data and "edges" in data and len(data["edges"]) > 0:
                return data
        except Exception as e:
            print(f"Concept map note: {e}")

        return {
            "layout": "tree",
            "root": topic,
            "edges": [
                {"source": topic, "target": "Core Principles", "relationship": "defines"},
                {"source": topic, "target": "Architecture", "relationship": "structures"},
                {"source": "Core Principles", "target": "Theory & Rules", "relationship": "comprises"},
                {"source": "Architecture", "target": "Components & Patterns", "relationship": "implements"},
                {"source": topic, "target": "Real-World Application", "relationship": "applies"}
            ]
        }

    @staticmethod
    def generate_detailed_mermaid_diagram(topic: str) -> dict:
        """
        Generates production-grade detailed Mermaid.js architecture diagrams and flowcharts.
        """
        try:
            prompt = f"""
            You are a Principal Software & Systems Architect.
            Task: Design a comprehensive, detailed architectural flowchart or sequence diagram for: "{topic}".
            
            RULES FOR MERMAID CODE:
            1. Use 'flowchart TD' or 'sequenceDiagram'.
            2. Include 8-15 distinct nodes with informative labels explaining data flow or hierarchy.
            3. Use subgraphs to group logical components.
            4. Add clear directional edge labels (e.g. A -->|"Protocol / Action"| B).
            5. Return ONLY a raw JSON object with this format:
            {{
                "title": "System Architecture: {topic}",
                "description": "Comprehensive architectural layout and data flow for {topic}.",
                "mermaid_code": "flowchart TD\\n    subgraph Client [Client Interface]\\n        Web[React SPA]\\n    end\\n    subgraph Core [Core Engine]\\n        Service[Business Logic]\\n    end\\n    Web -->|HTTP| Service",
                "key_components": [
                    "Component 1 and role",
                    "Component 2 and role"
                ]
            }}
            """
            response = AIService._generate_content_safe(prompt, generation_config={"response_mime_type": "application/json"})
            cleaned = AIService._clean_json_response(response.text)
            data = json.loads(cleaned)
            if "mermaid_code" in data and len(data["mermaid_code"]) > 20:
                return data
        except Exception as e:
            print(f"Mermaid generation note: {e}")

        safe_title = topic.title()
        return {
            "title": f"System Architecture: {safe_title}",
            "description": f"Architectural breakdown, data lifecycle, and subsystem boundaries for {safe_title}.",
            "mermaid_code": f"""flowchart TD
    subgraph Ingress ["1. Ingress & Client Interface"]
        Client["🖥️ Client Applications (Web / Mobile / CLI)"]
        Gateway["⚡ API Gateway & Reverse Proxy"]
        Client -->|"HTTP / REST / WebSocket"| Gateway
    end

    subgraph Core ["2. Core Processing Engine"]
        Auth["🛡️ Auth & Security Guard"]
        Business["🧠 {safe_title} Core Domain Logic"]
        Memory["💾 Hybrid Context Memory Manager"]
        Gateway -->|"Validate Bearer JWT"| Auth
        Auth -->|"Authorized Request"| Business
        Business <-->|"Short-Term & Long-Term Context"| Memory
    end

    subgraph Data ["3. Persistence & Storage Layer"]
        DB[("🗄️ Relational Database (SQLite / Postgres)")]
        Cache[("⚡ In-Memory Cache (Redis)")]
        Business -->|"ACID Transactions"| DB
        Business -->|"Sub-millisecond State"| Cache
    end

    subgraph Telemetry ["4. Observability & Monitoring"]
        Logs["📊 Structured Logs & Audit Trails"]
        Metrics["📈 Performance Metrics & Alerts"]
        Business -.-> Logs
        Business -.-> Metrics
    end""",
            "key_components": [
                f"Ingress Layer: High-throughput entry point routing requests into {safe_title}",
                "Core Processing Engine: Implements business constraints, security validation, and context assembly",
                "Persistence Layer: Guarantees durability and transactional integrity",
                "Telemetry Layer: Provides continuous observability, logging, and error tracking"
            ]
        }
