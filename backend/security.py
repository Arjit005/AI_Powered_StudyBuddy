import re
import time
import html
from typing import Dict, List, Tuple, Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

# ============================================================================
# 1. HTTP SECURITY HEADERS MIDDLEWARE
# ============================================================================
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # Legacy XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Referrer privacy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Feature isolation
        response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=()"
        # Safety Shield Header
        response.headers["X-Safety-Shield"] = "Protected-by-AI-Study-Buddy-Guard"
        # Mask server implementation details
        response.headers["Server"] = "StudyBuddy-Gateway"
        return response


# ============================================================================
# 2. IN-MEMORY RATE LIMITER & BRUTE-FORCE PROTECTION
# ============================================================================
class RateLimiter:
    def __init__(self):
        # Maps "category:client_ip" -> list of epoch timestamps
        self.history: Dict[str, List[float]] = {}
        # Maps "client_ip" -> lockout until epoch
        self.lockouts: Dict[str, float] = {}

    def _clean_old_requests(self, key: str, window_seconds: int, current_time: float):
        if key in self.history:
            cutoff = current_time - window_seconds
            self.history[key] = [t for t in self.history[key] if t > cutoff]

    def check_rate_limit(self, request: Request, category: str, max_requests: int, window_seconds: int):
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()

        # Check if IP is currently under lockout (e.g. from repeated login failures)
        if client_ip in self.lockouts:
            remaining_lock = self.lockouts[client_ip] - current_time
            if remaining_lock > 0:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Security Alert: Too many failed attempts. Temporary lockout for {int(remaining_lock)} more seconds.",
                    headers={"Retry-After": str(int(remaining_lock))}
                )
            else:
                del self.lockouts[client_ip]

        key = f"{category}:{client_ip}"
        self._clean_old_requests(key, window_seconds, current_time)

        if len(self.history.get(key, [])) >= max_requests:
            # If auth abuse, trigger a 60 second cooling-off lockout
            if category == "auth":
                self.lockouts[client_ip] = current_time + 60

            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: Maximum {max_requests} requests per {window_seconds}s for {category}. Please slow down.",
                headers={"Retry-After": str(window_seconds)}
            )

        if key not in self.history:
            self.history[key] = []
        self.history[key].append(current_time)

    def record_failed_login(self, client_ip: str):
        key = f"auth_fail:{client_ip}"
        current_time = time.time()
        self._clean_old_requests(key, 300, current_time)
        if key not in self.history:
            self.history[key] = []
        self.history[key].append(current_time)

        # 5 consecutive failures within 5 minutes = 3-minute lockout
        if len(self.history[key]) >= 5:
            self.lockouts[client_ip] = current_time + 180

    def reset_failed_logins(self, client_ip: str):
        key = f"auth_fail:{client_ip}"
        if key in self.history:
            del self.history[key]


# Global rate limiter instance
limiter = RateLimiter()


# ============================================================================
# 3. INPUT SANITIZATION & VALIDATION
# ============================================================================
class InputSanitizer:
    @staticmethod
    def sanitize_text(text: str, max_length: int = 3000) -> str:
        if not text:
            return ""
        # Strip excessive length
        text = text[:max_length].strip()
        # Remove null bytes or non-printable controls (Preserve valid code & math characters)
        text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
        return text

    @staticmethod
    def validate_topic(topic: str, max_length: int = 250) -> str:
        cleaned = InputSanitizer.sanitize_text(topic, max_length=max_length)
        if len(cleaned.strip()) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Study topic is too short. Please provide a valid topic (at least 2 characters)."
            )
        return cleaned


# ============================================================================
# 4. PROMPT INJECTION & JAILBREAK DEFENSE
# ============================================================================
class PromptGuard:
    # Heuristic signature list for prompt manipulation/jailbreak attempts
    INJECTION_PATTERNS = [
        r"(?i)\bignore\s+(all\s+)?(previous|prior|above)\s+instructions\b",
        r"(?i)\bdisregard\s+(all\s+)?(previous|prior)\s+rules\b",
        r"(?i)\byou\s+are\s+now\s+(in\s+)?(DAN|developer|jailbreak|unrestricted)\s+mode\b",
        r"(?i)\bpretend\s+you\s+have\s+no\s+(rules|restrictions|ethics|guidelines)\b",
        r"(?i)\breveal\s+(your\s+)?(system\s+prompt|secret\s+instructions|hidden\s+rules)\b",
        r"(?i)\bprint\s+(your\s+)?initial\s+prompt\b",
        r"(?i)\bbypass\s+all\s+(filters|guardrails|safety)\b",
        r"(?i)\bdo\s+anything\s+now\b"
    ]

    @classmethod
    def check_prompt_safety(cls, prompt: str) -> Tuple[bool, Optional[str]]:
        """
        Returns (is_safe, violation_reason)
        """
        if not prompt:
            return True, None

        for pattern in cls.INJECTION_PATTERNS:
            if re.search(pattern, prompt):
                return False, "Prompt injection / jailbreak pattern detected. Request safely intercepted."

        return True, None


# ============================================================================
# 5. AI CONTENT SAFETY & MODERATION FILTER
# ============================================================================
class ContentSafetyFilter:
    # Flagged words/concepts strictly inappropriate for an academic study buddy
    HARMFUL_PATTERNS = [
        r"(?i)\b(how\s+to\s+(make|build|synthesize)\s+(a\s+)?(bomb|explosive|poison|weapon))\b",
        r"(?i)\b(commit\s+suicide|self[\s-]harm\s+methods)\b",
        r"(?i)\b(hack\s+into\s+someone|ddos\s+attack\s+script)\b",
    ]

    @classmethod
    def evaluate_content(cls, text: str) -> Tuple[bool, Optional[str]]:
        for pattern in cls.HARMFUL_PATTERNS:
            if re.search(pattern, text):
                return False, "This request involves restricted/harmful content outside our educational scope."
        return True, None


# ============================================================================
# 6. PASSWORD STRENGTH VALIDATOR
# ============================================================================
class PasswordValidator:
    COMMON_PASSWORDS = {
        "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234",
        "admin", "welcome", "studybuddy", "student123", "password123"
    }

    @classmethod
    def validate_strength(cls, password: str) -> Tuple[bool, str]:
        if len(password) < 8:
            return False, "Password must be at least 8 characters long."

        if password.lower() in cls.COMMON_PASSWORDS:
            return False, "Password is too common. Please choose a more secure password."

        if not re.search(r"[A-Z]", password):
            return False, "Password must contain at least one uppercase letter (A-Z)."

        if not re.search(r"[a-z]", password):
            return False, "Password must contain at least one lowercase letter (a-z)."

        if not re.search(r"[0-9]", password):
            return False, "Password must contain at least one number (0-9)."

        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+/\\\[\]]", password):
            return False, "Password must contain at least one special character (!@#$%^&*...)."

        return True, "Strong password."
