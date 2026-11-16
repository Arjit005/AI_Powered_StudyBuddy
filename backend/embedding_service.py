import os
import time
import math
import random
from typing import List, Optional
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv("backend/.env")
load_dotenv(".env")


class EmbeddingProviderError(Exception):
    """Custom exception raised when embedding generation encounters an unrecoverable failure."""
    pass


class EmbeddingService:
    """
    Enterprise-grade Neural Embedding Service.
    Generates genuine semantic vector embeddings with dimension validation,
    task-type optimization, exponential backoff with jitter, and strict fail-fast contracts.
    """

    MODEL_NAME = "models/gemini-embedding-001"
    TARGET_DIMENSION = 1536
    MAX_RETRIES = 3
    RETRY_BASE_DELAY = 1.0  # seconds
    VALID_TASK_TYPES = {"retrieval_query", "retrieval_document"}

    _configured = False

    @classmethod
    def _ensure_configured(cls):
        if not cls._configured:
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise EmbeddingProviderError(
                    "CRITICAL: GEMINI_API_KEY or GOOGLE_API_KEY is not configured in environment."
                )
            genai.configure(api_key=api_key)
            cls._configured = True

    @classmethod
    def _validate_task_type(cls, task_type: str):
        if task_type not in cls.VALID_TASK_TYPES:
            raise ValueError(
                f"Unsupported embedding task type: '{task_type}'. "
                f"Valid options are: {sorted(list(cls.VALID_TASK_TYPES))}."
            )

    @classmethod
    def _l2_normalize(cls, vec: List[float]) -> List[float]:
        norm = math.sqrt(sum(v * v for v in vec))
        if norm <= 0:
            return vec
        return [float(v / norm) for v in vec]

    @classmethod
    def embed_text(cls, text: str, task_type: str = "retrieval_document", _retry_count: Optional[int] = None) -> List[float]:
        """
        Embeds a single string into a 1536-dimensional L2-normalized vector.
        task_type must be 'retrieval_document' or 'retrieval_query'.
        """
        if not text or not str(text).strip():
            raise ValueError("Cannot generate embedding for empty or whitespace-only text.")

        cls._validate_task_type(task_type)
        cls._ensure_configured()

        max_attempts = _retry_count if _retry_count is not None else cls.MAX_RETRIES
        last_error = None
        for attempt in range(max_attempts):
            try:
                kwargs = {
                    "model": cls.MODEL_NAME,
                    "content": text.strip(),
                    "output_dimensionality": cls.TARGET_DIMENSION,
                    "task_type": task_type,
                }

                result = genai.embed_content(**kwargs)
                vec = result.get("embedding", [])

                if len(vec) != cls.TARGET_DIMENSION:
                    raise EmbeddingProviderError(
                        f"Dimension mismatch: expected {cls.TARGET_DIMENSION}, got {len(vec)}"
                    )

                return cls._l2_normalize(vec)

            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                is_transient = any(code in err_str for code in ["429", "rate limit", "quota", "503", "500", "timeout", "deadline", "temporarily unavailable"])
                if attempt < max_attempts - 1 and is_transient:
                    # Bounded exponential backoff with jitter
                    backoff = cls.RETRY_BASE_DELAY * (2 ** attempt)
                    jitter = random.uniform(0.1, 0.5)
                    delay = min(10.0, backoff + jitter)
                    print(f"EmbeddingService: Transient error ({e}). Retrying in {delay:.2f}s...")
                    time.sleep(delay)
                else:
                    break

        raise EmbeddingProviderError(
            f"Failed to generate neural embedding after {max_attempts} attempts. Error: {last_error}"
        )

    @classmethod
    def embed_batch(cls, texts: List[str], task_type: str = "retrieval_document") -> List[List[float]]:
        """
        Embeds a batch of texts into 1536-dimensional L2-normalized vectors.
        Eliminates nested retry multiplication by executing fallback per-item embedding
        without secondary full retry loops.
        """
        if not texts:
            return []

        cls._validate_task_type(task_type)
        cls._ensure_configured()

        cleaned_texts = []
        for i, t in enumerate(texts):
            if not t or not str(t).strip():
                raise ValueError(f"Cannot embed empty or blank text at batch index {i}.")
            cleaned_texts.append(str(t).strip())

        # Attempt batch embedding via SDK first
        last_error = None
        batch_failed_unsupported = False

        for attempt in range(cls.MAX_RETRIES):
            try:
                raw_embeddings = []
                try:
                    kwargs = {
                        "model": cls.MODEL_NAME,
                        "content": cleaned_texts,
                        "output_dimensionality": cls.TARGET_DIMENSION,
                        "task_type": task_type,
                    }
                    res = genai.embed_content(**kwargs)
                    batch_res = res.get("embedding", [])
                    if len(cleaned_texts) == 1 and isinstance(batch_res, list) and batch_res and isinstance(batch_res[0], (int, float)):
                        raw_embeddings = [batch_res]
                    elif isinstance(batch_res, list) and batch_res and len(batch_res) == len(cleaned_texts) and isinstance(batch_res[0], list):
                        raw_embeddings = batch_res
                except (TypeError, ValueError) as sdk_batch_err:
                    batch_failed_unsupported = True
                    break
                except Exception as sdk_batch_err:
                    err_msg = str(sdk_batch_err).lower()
                    if any(phrase in err_msg for phrase in ["not supported", "unsupported", "expected string", "must be a string", "invalid argument"]):
                        batch_failed_unsupported = True
                        break
                    raise

                if len(raw_embeddings) != len(cleaned_texts):
                    raise EmbeddingProviderError(
                        f"Batch size mismatch: sent {len(cleaned_texts)}, received {len(raw_embeddings)}"
                    )

                normalized = []
                for idx, vec in enumerate(raw_embeddings):
                    if len(vec) != cls.TARGET_DIMENSION:
                        raise EmbeddingProviderError(
                            f"Dimension mismatch at item {idx}: expected {cls.TARGET_DIMENSION}, got {len(vec)}"
                        )
                    normalized.append(cls._l2_normalize(vec))

                return normalized

            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                is_transient = any(code in err_str for code in ["429", "rate limit", "quota", "503", "500", "timeout", "deadline", "temporarily unavailable"])
                if attempt < cls.MAX_RETRIES - 1 and is_transient:
                    backoff = cls.RETRY_BASE_DELAY * (2 ** attempt)
                    jitter = random.uniform(0.1, 0.5)
                    delay = min(10.0, backoff + jitter)
                    print(f"EmbeddingService (batch): Transient error ({e}). Retrying in {delay:.2f}s...")
                    time.sleep(delay)
                else:
                    break

        # If batch API is unsupported by the provider/SDK version, fallback to sequential per-item embedding
        # Notice: _retry_count=1 prevents nested exponential multiplication (no retry loop inside retry loop)
        if batch_failed_unsupported:
            results = []
            for idx, t in enumerate(cleaned_texts):
                try:
                    item_vec = cls.embed_text(t, task_type=task_type, _retry_count=1)
                    results.append(item_vec)
                except Exception as item_err:
                    raise EmbeddingProviderError(
                        f"Batch item failed at index {idx} during sequential embedding: {item_err}"
                    )
            return results

        raise EmbeddingProviderError(
            f"Failed to generate batch neural embeddings after {cls.MAX_RETRIES} attempts. Error: {last_error}"
        )
