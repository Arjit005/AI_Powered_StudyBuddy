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
    Returns GuardrailResult with passed=False if a violation is detected or input is invalid.
    """
    if prompt is None or not isinstance(prompt, str):
        return GuardrailResult(passed=False, reason="Invalid input: prompt must be a non-null string.")
    
    if not prompt.strip():
        return GuardrailResult(passed=False, reason="Invalid input: prompt cannot be empty.")

    # 1. Strip zero-width, non-printing, and invisible characters before security inspection
    sanitized = re.sub(r'[\u200B-\u200D\uFEFF\u00A0\x00-\x08\x0B\x0C\x0E-\x1F]', '', prompt)

    # 2. Multi-tier normalization to defeat punctuation-insertion and delimiter evasion
    normalized = sanitized.lower()
    clean_normalized = re.sub(r'[\s\-_,\.;:!?/\\]+', ' ', normalized).strip()
    # Punctuation-stripped version (e.g., 'ig.nore' -> 'ignore')
    alpha_only_normalized = re.sub(r'[^a-z0-9\s]', '', normalized)
    alpha_collapsed = re.sub(r'\s+', ' ', alpha_only_normalized).strip()

    # 3. Check prompt injection patterns against raw, separator-collapsed, and de-punctuated forms
    for pattern in INJECTION_PATTERNS:
        if (re.search(pattern, normalized) or 
            re.search(pattern, clean_normalized) or 
            re.search(pattern, alpha_collapsed)):
            logger.warning(f"Security Alert: Prompt injection detected matching pattern: '{pattern}'")
            return GuardrailResult(
                passed=False,
                reason="Prompt injection or jailbreak attempt detected. Access denied by AI Safety Shield."
            )

    # 4. Check harmful content patterns
    for pattern in HARMFUL_PATTERNS:
        if (re.search(pattern, normalized) or 
            re.search(pattern, clean_normalized) or 
            re.search(pattern, alpha_collapsed)):
            logger.warning(f"Security Alert: Harmful content detected matching pattern: '{pattern}'")
            return GuardrailResult(
                passed=False,
                reason="Content violates academic and ethical safety guidelines. Request blocked."
            )

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


STOP_WORDS = {
    'this', 'that', 'with', 'from', 'have', 'were', 'which', 'there', 'their', 'about',
    'would', 'these', 'other', 'could', 'after', 'first', 'should', 'where', 'while',
    'being', 'under', 'between', 'through', 'during', 'before', 'above', 'below'
}

def verify_rag_grounding(answer: str, retrieved_chunks: List[str]) -> Tuple[bool, float]:
    """
    Verifies whether the generated answer is grounded in the retrieved RAG chunks.
    Uses sentence-level claim alignment combined with salient token coverage.
    """
    if not retrieved_chunks or not answer:
        return False, 0.0

    corpus_text = " ".join(retrieved_chunks).lower()
    corpus_tokens = set(re.findall(r'\b[a-z]{4,}\b', corpus_text)) - STOP_WORDS
    if not corpus_tokens:
        return False, 0.0

    # Clean citations e.g. [1], [2] before sentence parsing
    clean_answer = re.sub(r'\[\d+\]', '', answer)
    sentences = [s.strip() for s in re.split(r'[.!?\n]+', clean_answer) if len(s.strip()) > 15]

    if not sentences:
        # Fall back to token overlap if no full sentences
        answer_tokens = set(re.findall(r'\b[a-z]{4,}\b', clean_answer.lower())) - STOP_WORDS
        if not answer_tokens:
            return False, 0.0
        score = len(answer_tokens.intersection(corpus_tokens)) / len(answer_tokens)
        return score >= 0.25, round(score, 3)

    supported_sentences = 0
    total_sentence_scores = 0.0

    for sent in sentences:
        sent_tokens = set(re.findall(r'\b[a-z]{4,}\b', sent.lower())) - STOP_WORDS
        if not sent_tokens:
            continue
        overlap = sent_tokens.intersection(corpus_tokens)
        sent_ratio = len(overlap) / len(sent_tokens)
        total_sentence_scores += sent_ratio
        if sent_ratio >= 0.30:  # At least 30% of content words exist in corpus
            supported_sentences += 1

    sentence_grounding_ratio = supported_sentences / max(len(sentences), 1)
    avg_sentence_support = total_sentence_scores / max(len(sentences), 1)
    
    # Composite calibrated faithfulness score
    faithfulness_score = round((0.6 * sentence_grounding_ratio) + (0.4 * avg_sentence_support), 3)
    is_faithful = faithfulness_score >= 0.25

    return is_faithful, faithfulness_score
