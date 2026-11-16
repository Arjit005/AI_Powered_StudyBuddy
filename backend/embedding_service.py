import os
import time
import math
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
    task-type optimization, exponential backoff retries, and strict fail-fast contracts.
    """

    MODEL_NAME = "models/gemini-embedding-001"
    TARGET_DIMENSION = 1536
    MAX_RETRIES = 3
    RETRY_BASE_DELAY = 1.0  # seconds

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
    def _l2_normalize(cls, vec: List[float]) -> List[float]:
        norm = math.sqrt(sum(v * v for v in vec))
        if norm <= 0:
            return vec
        return [float(v / norm) for v in vec]

    @classmethod
    def embed_text(cls, text: str, task_type: str = "retrieval_document") -> List[float]:
        """
        Embeds a single string into a 1536-dimensional L2-normalized vector.
        task_type can be 'retrieval_document' or 'retrieval_query'.
        """
        if not text or not text.strip():
            raise ValueError("Cannot generate embedding for empty or whitespace-only text.")

        cls._ensure_configured()

        last_error = None
        for attempt in range(cls.MAX_RETRIES):
            try:
                # Task type mapping
                kwargs = {
                    "model": cls.MODEL_NAME,
                    "content": text.strip(),
                    "output_dimensionality": cls.TARGET_DIMENSION,
                }
                if task_type in ["retrieval_query", "retrieval_document"]:
                    kwargs["task_type"] = task_type

                result = genai.embed_content(**kwargs)
                vec = result.get("embedding", [])

                if len(vec) != cls.TARGET_DIMENSION:
                    raise EmbeddingProviderError(
                        f"Dimension mismatch: expected {cls.TARGET_DIMENSION}, got {len(vec)}"
                    )

                return cls._l2_normalize(vec)

            except Exception as e:
                last_error = e
                # Check for rate limit / quota or transient network error
                err_str = str(e).lower()
                is_transient = any(code in err_str for code in ["429", "rate limit", "quota", "503", "500", "timeout", "deadline"])
                if attempt < cls.MAX_RETRIES - 1 and is_transient:
                    delay = cls.RETRY_BASE_DELAY * (2 ** attempt)
                    print(f"EmbeddingService: Transient error ({e}). Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    break

        raise EmbeddingProviderError(
            f"Failed to generate neural embedding after {cls.MAX_RETRIES} attempts. Error: {last_error}"
        )

    @classmethod
    def embed_batch(cls, texts: List[str], task_type: str = "retrieval_document") -> List[List[float]]:
        """
        Embeds a batch of texts into 1536-dimensional L2-normalized vectors.
        """
        if not texts:
            return []

        cls._ensure_configured()

        cleaned_texts = []
        for i, t in enumerate(texts):
            if not t or not str(t).strip():
                raise ValueError(f"Cannot embed empty or blank text at batch index {i}.")
            cleaned_texts.append(str(t).strip())

        # Use batch processing or robust per-item fallback with correct validation
        last_error = None
        for attempt in range(cls.MAX_RETRIES):
            try:
                # The Google Generative AI SDK supports list of contents directly in newer versions,
                # but to guarantee rock-solid compatibility across all versions, we embed items reliably:
                raw_embeddings = []
                try:
                    kwargs = {
                        "model": cls.MODEL_NAME,
                        "content": cleaned_texts,
                        "output_dimensionality": cls.TARGET_DIMENSION,
                    }
                    if task_type in ["retrieval_query", "retrieval_document"]:
                        kwargs["task_type"] = task_type
                    res = genai.embed_content(**kwargs)
                    batch_res = res.get("embedding", [])
                    if isinstance(batch_res, list) and batch_res and len(batch_res) == len(cleaned_texts) and isinstance(batch_res[0], list):
                        raw_embeddings = batch_res
                except (TypeError, ValueError) as sdk_batch_err:
                    # SDK doesn't support batch list input or invalid argument shape
                    raw_embeddings = []
                    for t in cleaned_texts:
                        item_vec = cls.embed_text(t, task_type=task_type)
                        raw_embeddings.append(item_vec)
                    return raw_embeddings
                except Exception as sdk_batch_err:
                    err_msg = str(sdk_batch_err).lower()
                    if any(phrase in err_msg for phrase in ["not supported", "unsupported", "expected string", "must be a string", "invalid argument"]):
                        raw_embeddings = []
                        for t in cleaned_texts:
                            item_vec = cls.embed_text(t, task_type=task_type)
                            raw_embeddings.append(item_vec)
                        return raw_embeddings
                    raise  # Re-raise transient/network/auth errors so outer retry logic handles them

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
                is_transient = any(code in err_str for code in ["429", "rate limit", "quota", "503", "500", "timeout", "deadline"])
                if attempt < cls.MAX_RETRIES - 1 and is_transient:
                    delay = cls.RETRY_BASE_DELAY * (2 ** attempt)
                    print(f"EmbeddingService (batch): Transient error ({e}). Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    break

        raise EmbeddingProviderError(
            f"Failed to generate batch neural embeddings after {cls.MAX_RETRIES} attempts. Error: {last_error}"
        )
