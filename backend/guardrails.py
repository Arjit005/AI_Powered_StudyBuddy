"""
AI Safety Guardrails & Security Filtering Module for AI Study Buddy.
Provides input validation (prompt injection detection, toxicity/harmful content filtering)
and output sanitization (PII redaction, hallucination & grounding verification).
"""

import re
import logging
from typing import Dict, Tuple, List, Optional

logger = logging.getLogger("StudyBuddy.Guardrails")

# Comprehensive prompt injection & jailbreak patterns
INJECTION_PATTERNS = [
    r"ignore previous instructions",
    r"disregard previous instructions",
    r"system prompt",
    r"you are now dan",
    r"do anything now",
    r"jailbreak",
    r"developer mode",
    r"override safety",
    r"bypass safety",
    r"act as an unrestricted",
    r"hypothetically, how would one build a bomb",
    r"sql injection payload",
    r"malicious payload",
    r"exploit code for",
    r"how to hack into",
]

# Harmful content categories
HARMFUL_PATTERNS = [
    r"child sexual abuse",
    r"self-harm",
    r"suicide instructions",
    r"how to make explosives",
    r"illegal drugs manufacturing",
    r"cyberattack",
    r"critical infrastructure",
]

# PII and Secret Redaction Regexes
PII_PATTERNS = [
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[REDACTED_EMAIL]'),
    (r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED_SSN]'),
    (r'\b(?:\d{4}[-\s]?){3}\d{4}\b', '[REDACTED_CREDIT_CARD]'),
    (r'sk-[a-zA-Z0-9]{20,}', '[REDACTED_API_KEY]'),
    (r'Bearer\s+[a-zA-Z0-9_\-\.]+', 'Bearer [REDACTED_TOKEN]'),
]


class GuardrailResult:
    def __init__(self, passed: bool, reason: Optional[str] = None, sanitized_text: Optional[str] = None):
        self.passed = passed
        self.reason = reason
        self.sanitized_text = sanitized_text


def validate_input(prompt: str) -> GuardrailResult:
    """
    Inspects incoming user prompts for prompt injection, jailbreaks, and harmful intent.
    Returns GuardrailResult with passed=False if a violation is detected.
    """
    if not prompt or not isinstance(prompt, str):
        return GuardrailResult(passed=True, sanitized_text="")

    normalized = prompt.lower()

    # 1. Check prompt injection patterns
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, normalized):
            logger.warning(f"Security Alert: Prompt injection detected matching pattern: '{pattern}'")
            return GuardrailResult(
                passed=False,
                reason="Prompt injection or jailbreak attempt detected. Access denied by AI Safety Shield."
            )

    # 2. Check harmful content patterns
    for pattern in HARMFUL_PATTERNS:
        if re.search(pattern, normalized):
            logger.warning(f"Security Alert: Harmful content detected matching pattern: '{pattern}'")
            return GuardrailResult(
                passed=False,
                reason="Content violates academic and ethical safety guidelines. Request blocked."
            )

    # 3. Sanitize control characters and zero-width spaces
    sanitized = re.sub(r'[​-‍﻿]', '', prompt)

    return GuardrailResult(passed=True, sanitized_text=sanitized)


def sanitize_output(output_text: str) -> str:
    """
    Sanitizes LLM outputs by redacting PII, leaked API keys, and sensitive tokens.
    """
    if not output_text or not isinstance(output_text, str):
        return output_text

    sanitized = output_text
    for pattern, replacement in PII_PATTERNS:
        sanitized = re.sub(pattern, replacement, sanitized)

    return sanitized


def verify_rag_grounding(answer: str, retrieved_chunks: List[str]) -> Tuple[bool, float]:
    """
    Verifies whether the generated answer is grounded in the retrieved RAG chunks.
    Computes keyword overlap score as a heuristic faithfulness check.
    """
    if not retrieved_chunks:
        # If no chunks provided, cannot verify grounded RAG
        return True, 1.0

    answer_words = set(re.findall(r'\w+', answer.lower()))
    if not answer_words:
        return True, 1.0

    corpus_words = set()
    for chunk in retrieved_chunks:
        corpus_words.update(re.findall(r'\w+', chunk.lower()))

    # Calculate overlap of meaningful words (length > 3)
    meaningful_answer_words = {w for w in answer_words if len(w) > 3}
    if not meaningful_answer_words:
        return True, 1.0

    overlap = meaningful_answer_words.intersection(corpus_words)
    faithfulness_score = len(overlap) / len(meaningful_answer_words)

    # Threshold for faithfulness
    is_faithful = faithfulness_score >= 0.15 or len(answer) < 60
    return is_faithful, faithfulness_score
