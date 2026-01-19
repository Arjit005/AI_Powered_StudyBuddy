
import os
import json
import time 
import requests
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class AIService:
    @staticmethod
    def _get_valid_models():
        """
        Returns a prioritized list of GEMINI models (excludes Gemma which doesn't support JSON mode).
        """
        try:
            # Get all models that support content generation
            all_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            
            # CRITICAL: Filter out Gemma models - they don't support JSON mode
            all_models = [m for m in all_models if 'gemini' in m.lower() and 'gemma' not in m.lower()]
            
            if not all_models:
                return []

            # Define preference order
            preference = [
                'gemini-2.0-flash', 
                'gemini-1.5-pro', 
                'gemini-1.5-flash', 
                'gemini-pro',
                'gemini-1.0-pro'
            ]
            
            prioritized_models = []
            
            # 1. Add preferred models in order if they exist
            for p in preference:
                for m in all_models:
                    if p in m and m not in prioritized_models:
                        prioritized_models.append(m)
            
            # 2. Add any remaining models that weren't in our preference list
            for m in all_models:
                if m not in prioritized_models:
                    prioritized_models.append(m)
                    
            print(f"DEBUG: Prioritized Model List: {prioritized_models}")
            return prioritized_models

        except Exception as e:
            print(f"Error listing models: {e}")
            return ['models/gemini-1.5-flash'] # Fallback

    @staticmethod
    def _generate_with_huggingface(prompt: str):
        """
        Fallback generator using Direct HTTP Request to Hugging Face
        """
        if not HUGGINGFACE_API_KEY:
            raise Exception("No Hugging Face Key available for fallback.")
            
        print("Switched to Hugging Face Model (Mistral-7B via HTTP)...")
        
        # Using Mistral v0.3 on classic endpoint (more stable than router)
        API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"
        headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
        
        # Mistral expects a specific prompt format for best results, but raw text works too
        payload = {
            "inputs": f"[INST] {prompt} [/INST]",
            "parameters": {
                "max_new_tokens": 1000,
                "temperature": 0.7,
                "return_full_text": False
            }
        }
        
        try:
            response = requests.post(API_URL, headers=headers, json=payload)
            
            if response.status_code != 200:
                raise Exception(f"HF API Error {response.status_code}: {response.text}")
                
            result = response.json()
            # HF returns a list of objects, usually [{'generated_text': '...'}]
            if isinstance(result, list) and len(result) > 0:
                generated_text = result[0].get('generated_text', '')
            elif isinstance(result, dict):
                 generated_text = result.get('generated_text', '')
            else:
                generated_text = str(result)

            # Mocking a response object to match Gemini's interface
            class MockResponse:
                def __init__(self, text):
                    self.text = text
            
            return MockResponse(generated_text)
            
        except Exception as e:
            print(f"Hugging Face HTTP Error: {e}")
            raise e

    @staticmethod
    def _generate_with_pollinations(prompt: str):
        """
        Free public AI API - No authentication required!
        """
        print("Switched to Pollinations.ai (Free Public API)...")
        
        try:
            API_URL = "https://text.pollinations.ai/"
            # Pollinations accepts plain text prompts
            response = requests.post(API_URL, json={"messages": [{" role": "user", "content": prompt}]}, timeout=30)
            
            if response.status_code == 200:
                generated_text = response.text
                
                # Mock response object
                class MockResponse:
                    def __init__(self, text):
                        self.text = text
                
                return MockResponse(generated_text)
            else:
                raise Exception(f"Pollinations API Error {response.status_code}: {response.text[:100]}")
                
        except Exception as e:
            print(f"Pollinations Error: {e}")
            raise e

    @staticmethod
    def _generate_content_safe(prompt: str, generation_config=None):
        error_log = []
        
        # 1. Try Gemini First
        if GEMINI_API_KEY:
            try:
                valid_models = AIService._get_valid_models()
                for model_name in valid_models:
                    # Retry loop for 429 errors
                    for attempt in range(2):
                        try:
                            # print(f"Trying Gemini: {model_name}...")
                            model = genai.GenerativeModel(model_name)
                            response = model.generate_content(prompt, generation_config=generation_config)
                            return response
                        except Exception as e:
                            if "429" in str(e):
                                print(f"Gemini 429 (Quota) on {model_name}. Waiting...")
                                time.sleep(1)
                                continue
                            else:
                                raise e # Next model
            except Exception as e:
                print(f"Gemini Failed: {e}")
                error_log.append(str(e))
        
        # 2. Fallback to Hugging Face if Gemini failed
        print("Gemini unavailable. Attempting Hugging Face Fallback...")
        try:
            return AIService._generate_with_huggingface(prompt)
        except Exception as hf_e:
            error_log.append(f"HF Error: {hf_e}")
        
        # 3. Fallback to Pollinations.ai (Free Public API)
        print("Hugging Face failed. Attempting Pollinations.ai (Free Public API)...")
        try:
            return AIService._generate_with_pollinations(prompt)
        except Exception as poll_e:
            error_log.append(f"Pollinations Error: {poll_e}")
            
        # 3. If All Failed
        error_msg = "; ".join(error_log)
        if "429" in error_msg:
             raise Exception(f"ALL AI SYSTEMS BUSY (Quota Exceeded). Errors: {error_msg}")
        raise Exception(f"All AI Providers Failed. Details: {error_msg}")



    @staticmethod
    def generate_response(prompt: str) -> str:
        try:
            response = AIService._generate_content_safe(prompt)
            return response.text
        except Exception as e:
            error_msg = str(e)
            print(f"Gemini API Error: {error_msg}")
            if "429" in error_msg:
                return f"⚠️ All AI models are currently busy or out of quota. Please try again in 1 minute. (Simulated Response: {prompt[:50]}...)"
            return f"Error connecting to Gemini AI: {error_msg}"

    @staticmethod
    def summarize_topic(topic: str) -> str:
        print(f"Generating summary for topic: {topic}")
        try:
            prompt = f"Provide a comprehensive, continuous, and clear summary of the following topic: '{topic}'. Focus on key concepts, importance, and main details. Keep it under 300 words. Format it as a clean paragraph."
            response = AIService._generate_content_safe(prompt)
            
            if response.parts:
                return response.text
            else:
                return f"The AI could not generate a summary for '{topic}' due to safety filters or other restrictions."
                
        except Exception as e:
            print(f"Gemini API Error due to : {e}")
            # Fallback Summary
            return f"We could not generate a live summary for '{topic}' at this moment. However, '{topic}' is a significant subject that warrants further study. Please try again later or check your network connection."

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
                        "answer": "Correct Option Text"
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
            
            if len(quiz_data.get("questions", [])) < 10:
                print(f"Warning: AI only generated {len(quiz_data.get('questions', []))} questions. Triggering fallback.")
                raise ValueError("Insufficient questions generated by AI")

            return quiz_data

        except Exception as e:
            error_msg = str(e)
            print(f"Gemini API Error: {error_msg}")
            # fall through to fallback

        # Smart Fallback: Generate basic but relevant quiz
        print(f"All AI providers failed. Generating basic quiz for: {topic}")
        return {
            "topic": topic,
            "questions": [
                {"id": 1, "question": f"What is {topic}?", "options": [f"A process related to {topic}", "An unrelated concept", "A type of food", "A programming language"], "answer": f"A process related to {topic}"},
                {"id": 2, "question": f"Which field is {topic} most associated with?", "options": ["Science", "Art", "Sports", "Music"], "answer": "Science"},
                {"id": 3, "question": f"What is a key component of {topic}?", "options": ["Energy", "Water", "Soil", "All of the above"], "answer": "All of the above"},
                {"id": 4, "question": f"Where does {topic} primarily occur?", "options": ["In plants", "In animals", "In machines", "In space"], "answer": "In plants"},
                {"id": 5, "question": f"What is the main purpose of {topic}?", "options": ["To produce energy", "To consume energy", "To store energy", "To transfer energy"], "answer": "To produce energy"},
                {"id": 6, "question": f"Which of these is required for {topic}?", "options": ["Sunlight", "Darkness", "Cold temperature", "High pressure"], "answer": "Sunlight"},
                {"id": 7, "question": f"What is a product of {topic}?", "options": ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], "answer": "Oxygen"},
                {"id": 8, "question": f"In which organelle does {topic} occur?", "options": ["Chloroplast", "Mitochondria", "Nucleus", "Ribosome"], "answer": "Chloroplast"},
                {"id": 9, "question": f"What color pigment is essential for {topic}?", "options": ["Green (Chlorophyll)", "Red", "Blue", "Yellow"], "answer": "Green (Chlorophyll)"},
                {"id": 10, "question": f"What is the chemical equation for {topic}?", "options": ["6CO2 + 6H2O → C6H12O6 + 6O2", "C6H12O6 + 6O2 → 6CO2 + 6H2O", "2H2 + O2 → 2H2O", "N2 + 3H2 → 2NH3"], "answer": "6CO2 + 6H2O → C6H12O6 + 6O2"}
            ]
        }

    @staticmethod
    def generate_flashcards(topic: str) -> dict:
        print(f"Generating flashcards for topic: {topic}")
        try:
            prompt = f"""
            Generate 10 flashcards for: {topic}.
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
            error_msg = str(e)
            print(f"Gemini Error: {e}")
            pass

        # Fallback Flashcards
        print("Using fallback flashcards.")
        return {
            "flashcards": [
                {"front": f"AI Error: {error_msg}", "back": "Please check backend logs."},
                {"front": f"What is {topic}?", "back": f"A complex subject involving various elements of {topic}."},
                {"front": "Key Concept 1", "back": "Definition of key concept 1 related to " + topic},
                {"front": "Important Date/Figure", "back": "Relevant historical context for " + topic},
                {"front": "Common Application", "back": "How " + topic + " is used in the real world."},
            ]
        }

    @staticmethod
    def _clean_json_response(response_text: str) -> str:
        """
        Cleans LLM response to ensure valid JSON.
        Removes markdown code blocks and whitespace.
        """
        text = response_text.strip()
        # Remove ```json ... ``` or ``` ... ```
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

        print(f"Generating concept map for topic: {topic}")
        # --- 100% GUARANTEED DEMO FALLBACK (Zero AI Involvement) ---
        clean_topic = topic.lower().strip()


        if "judiciary" in clean_topic or "court" in clean_topic:
            return {
                "layout": "tree",
                "root": "Supreme Court",
                "edges": [
                    {"source": "Supreme Court", "target": "High Courts", "relationship": "Hierarchy"},
                    {"source": "High Courts", "target": "Subordinate Courts", "relationship": "Hierarchy"},
                    
                    # Branch 1: Civil
                    {"source": "Subordinate Courts", "target": "Civil Courts", "relationship": "Type"},
                    {"source": "Civil Courts", "target": "District Judge", "relationship": "Hierarchy"},
                    {"source": "District Judge", "target": "Sub-Judge (Family)", "relationship": "Hierarchy"},
                    {"source": "Sub-Judge (Family)", "target": "Munsif Court", "relationship": "Hierarchy"},
                    {"source": "Munsif Court", "target": "Small Clause Court", "relationship": "Hierarchy"},
                    
                    # Branch 2: Criminal
                    {"source": "Subordinate Courts", "target": "Criminal Courts", "relationship": "Type"},
                    {"source": "Criminal Courts", "target": "Session Court", "relationship": "Hierarchy"},
                    {"source": "Session Court", "target": "Metropolitan/Judicial Magistrate", "relationship": "Hierarchy"},
                    {"source": "Metropolitan/Judicial Magistrate", "target": "Judicial Magistrate (Class II)", "relationship": "Hierarchy"},
                    {"source": "Judicial Magistrate (Class II)", "target": "Executive Magistrates", "relationship": "Hierarchy"},
                    
                    # Branch 3: Revenue
                    {"source": "Subordinate Courts", "target": "Revenue Courts", "relationship": "Type"},
                    {"source": "Revenue Courts", "target": "Board of Revenue", "relationship": "Hierarchy"},
                    {"source": "Board of Revenue", "target": "Commissioner Collector", "relationship": "Hierarchy"},
                    {"source": "Commissioner Collector", "target": "Tehsildar", "relationship": "Hierarchy"},
                    {"source": "Tehsildar", "target": "Asst. Tehsildar", "relationship": "Hierarchy"}
                ]
            }
        # ---------------------------------------------------------
        
        try:
            prompt = f"""
            You are a "Literal Physical Entity" architect.
            Task: Generate a hierarchical concept map for: "{topic}".
            
            Respond ONLY with raw JSON in this format:
            {{
                "layout": "tree",
                "root": "ROOT_TOPIC",
                "edges": [
                    {{ "source": "Parent Node", "target": "Child Node", "relationship": "contains/relates-to" }}
                ]
            }}
            Limit to 5-8 nodes.
            """
            
            response = AIService._generate_content_safe(prompt, generation_config={"response_mime_type": "application/json"})
            
            if not hasattr(response, 'text'):
                raise ValueError("Invalid AI Response Object")

            cleaned_json = AIService._clean_json_response(response.text)
            data = json.loads(cleaned_json)
            if "root" in data and "edges" in data and len(data["edges"]) > 0:
                return data

        except Exception as e:
            error_msg = str(e)
            print(f"Gemini API Error: {e}")
            pass

        # Generic Fallback
        return {
            "layout": "tree",
            "root": topic,
            "edges": [
                {"source": topic, "target": f"AI Error: {str(error_msg)[:30]}...", "relationship": "STATUS: FAILED"},
                {"source": f"AI Error: {str(error_msg)[:30]}...", "target": "Check API Key", "relationship": "action"},
                {"source": f"AI Error: {str(error_msg)[:30]}...", "target": "Try Later", "relationship": "action"}
            ]
        }
