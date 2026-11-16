import os
import re
import time
import html
import threading
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
        self._last_global_cleanup: float = time.time()
        self._lock = threading.Lock()

    def _clean_old_requests(self, key: str, window_seconds: int, current_time: float):
        if key in self.history:
            cutoff = current_time - window_seconds
            valid_timestamps = [t for t in self.history[key] if t > cutoff]
            if valid_timestamps:
                self.history[key] = valid_timestamps
            else:
                del self.history[key]

        # Bounded periodic global sweep to prevent memory leak from dormant client IPs
        if current_time - self._last_global_cleanup > 300:
            self._last_global_cleanup = current_time
            keys_to_delete = [
                k for k, v in self.history.items()
                if not v or v[-1] < (current_time - 3600)
            ]
            for k in keys_to_delete:
                del self.history[k]
            # Safety ceiling: evict only inactive entries whose last request is older than active window (15 minutes)
            if len(self.history) > 10000:
                inactive_keys = [
                    k for k, v in self.history.items()
                    if not v or (current_time - v[-1] > 900)
                ]
                for k in inactive_keys:
                    del self.history[k]

            # Periodic cleanup of expired lockouts only (never evict active lockouts)
            expired_locks = [ip for ip, exp in self.lockouts.items() if exp < current_time]
            for ip in expired_locks:
                del self.lockouts[ip]

    def _get_client_ip(self, request: Request) -> str:
        immediate_host = request.client.host if request.client else "unknown"
        trust_proxy = os.getenv("TRUST_PROXY", "false").lower() == "true"
        
        # Verify that immediate connecting client is in trusted proxy list or private/loopback network
        trusted_proxies_cfg = os.getenv("TRUSTED_PROXIES", "127.0.0.1,::1")
        trusted_proxy_set = {p.strip() for p in trusted_proxies_cfg.split(",") if p.strip()}
        
        is_trusted_peer = (
            immediate_host in trusted_proxy_set or
            immediate_host in ("127.0.0.1", "::1", "localhost")
        )
        if trust_proxy and is_trusted_peer:
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                ips = [p.strip() for p in forwarded.split(",") if p.strip()]
                # Traverse right-to-left: pick the first IP before the trusted proxy hops
                for candidate in reversed(ips):
                    if candidate not in trusted_proxy_set and candidate not in ("127.0.0.1", "::1", "localhost"):
                        try:
                            import ipaddress
                            return str(ipaddress.ip_address(candidate))
                        except ValueError:
                            continue
            real_ip = request.headers.get("X-Real-IP")
            if real_ip:
                try:
                    import ipaddress
                    return str(ipaddress.ip_address(real_ip.strip()))
                except ValueError:
                    pass
        return immediate_host

    def check_rate_limit(self, request: Request, category: str, max_requests: int, window_seconds: int):
        client_ip = self._get_client_ip(request)
        current_time = time.time()

        with self._lock:
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
        current_time = time.time()
        with self._lock:
            key = f"auth_fail:{client_ip}"
            self._clean_old_requests(key, 300, current_time)
            if key not in self.history:
                self.history[key] = []
            self.history[key].append(current_time)

            # 5 consecutive failures within 5 minutes = 3-minute lockout (set on threshold crossing)
            if len(self.history[key]) >= 5 and client_ip not in self.lockouts:
                self.lockouts[client_ip] = current_time + 180

    def reset_failed_logins(self, client_ip: str):
        with self._lock:
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
