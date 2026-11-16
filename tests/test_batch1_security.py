import pytest
import os
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from backend.main import app, _verify_google_token
from backend.security import RateLimiter
from backend.rag_service import RAGService
from backend.ai_service import AIService


client = TestClient(app)


# ============================================================================
# 1. GOOGLE OAUTH AUDIENCE & ISSUER VALIDATION TESTS
# ============================================================================
def test_oauth_audience_validation_fails_on_unauthorized_client_id(monkeypatch):
    """
    Ensure token with arbitrary / third-party audience is rejected when
    it does not match the configured application GOOGLE_CLIENT_ID or FIREBASE_PROJECT_ID.
    """
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "study-buddy-web-client-12345.apps.googleusercontent.com")
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "study-buddy-firebase-proj")

    with patch("google.oauth2.id_token.verify_firebase_token", side_effect=Exception("Not a Firebase cert token")), \
         patch("google.oauth2.id_token.verify_oauth2_token", side_effect=ValueError("Token has wrong audience")):

        with pytest.raises(ValueError, match="Google ID token verification failed"):
            _verify_google_token("fake.jwt.token", "study-buddy-firebase-proj")


def test_oauth_fails_closed_when_no_audience_configured(monkeypatch):
    """
    Ensure fail-closed behavior: If both GOOGLE_CLIENT_ID and project_id are empty,
    token verification must fail closed immediately.
    """
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)

    with patch("google.oauth2.id_token.verify_firebase_token", side_effect=Exception("No Firebase project")):
        with pytest.raises(ValueError, match="Google OAuth configuration error"):
            _verify_google_token("fake.jwt.token", "")


# ============================================================================
# 2. ANONYMOUS RAG TENANT ISOLATION TESTS
# ============================================================================
def test_anonymous_chat_does_not_leak_private_sources():
    """
    Ensure anonymous chat queries cannot access private user sources.
    """
    import uuid
    from backend.database import SessionLocal
    from backend.models import User, Source
    db = SessionLocal()
    uniq = uuid.uuid4().hex[:8]
    try:
        # Create private user source with unique credentials
        private_user = User(username=f"student_{uniq}", email=f"private_{uniq}@example.com", hashed_password="pw")
        db.add(private_user)
        db.commit()
        db.refresh(private_user)

        private_src = Source(
            user_id=private_user.id,
            title="Confidential Exam Questions",
            raw_text="The secret question is quantum mechanics."
        )
        db.add(private_src)
        db.commit()

        # Send unauthenticated chat request
        resp = client.post("/api/chat", json={"message": "quantum mechanics"})
        assert resp.status_code == 200
        data = resp.json()

        # Citations must be empty for anonymous query against private source
        citations = data.get("citations", [])
        for c in citations:
            assert c["source_id"] != private_src.id
    finally:
        db.close()


# ============================================================================
# 3. SSRF PRE-CONNECT & PEER IP REBINDING DEFENSE TESTS
# ============================================================================
def test_ssrf_rejects_loopback_and_private_ips():
    """
    Verifies that IP sanitizer strictly rejects loopback, RFC1918, link-local and cloud metadata.
    """
    disallowed_ips = [
        "127.0.0.1",
        "127.0.0.2",
        "::1",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.169.254", # AWS / GCP metadata
        "0.0.0.0"
    ]
    for ip in disallowed_ips:
        assert RAGService._is_safe_ip(ip) is False, f"Failed to block unsafe IP: {ip}"

    # Legitimate public IP must be permitted
    assert RAGService._is_safe_ip("8.8.8.8") is True
    assert RAGService._is_safe_ip("93.184.216.34") is True


def test_ssrf_fails_closed_when_peer_socket_unverifiable(monkeypatch):
    """
    Ensures that extract_text_from_url aborts request when peer IP cannot be verified.
    """
    with patch("backend.rag_service.RAGService._is_safe_url", return_value=True), \
         patch("requests.Session.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raw = MagicMock()
        # Simulate connection where socket returns unsafe internal address
        mock_sock = MagicMock()
        mock_sock.getpeername.return_value = ("127.0.0.1", 80)
        mock_resp.raw._connection.sock = mock_sock

        mock_get.return_value = mock_resp
        text = RAGService.extract_text_from_url("https://example.com/notes")
        assert text == ""


# ============================================================================
# 4. TRUSTED PROXY CIDR RESOLUTION & LOCKOUT RESET TESTS
# ============================================================================
def test_trusted_proxy_cidr_resolution(monkeypatch):
    """
    Tests that proxy evaluation recognizes CIDR blocks and extracts the rightmost untrusted peer IP.
    """
    monkeypatch.setenv("TRUST_PROXY", "true")
    monkeypatch.setenv("TRUSTED_PROXIES", "10.0.0.0/8,172.16.0.0/12,127.0.0.1")

    limiter = RateLimiter()

    # Request passing through two proxies (10.0.0.1 -> 172.16.0.2)
    mock_req = MagicMock()
    mock_req.client.host = "10.0.0.1"
    mock_req.headers = {
        "X-Forwarded-For": "203.0.113.195, 172.16.0.2"
    }

    client_ip = limiter._get_client_ip(mock_req)
    # The client IP must be 203.0.113.195, not the internal proxy IP
    assert client_ip == "203.0.113.195"


def test_lockout_resets_upon_successful_login():
    """
    Ensures that reset_failed_logins cleans both failure history and temporary lockout.
    """
    limiter = RateLimiter()
    test_ip = "198.51.100.5"

    # Simulate 5 failures triggering lockout
    for _ in range(5):
        limiter.record_failed_login(test_ip)

    assert test_ip in limiter.lockouts

    # Successful login resets the lockout
    limiter.reset_failed_logins(test_ip)
    assert test_ip not in limiter.lockouts
    assert f"auth_fail:{test_ip}" not in limiter.history


# ============================================================================
# 5. SEMANTIC CACHE TENANT ISOLATION TESTS
# ============================================================================
def test_semantic_cache_headers_partitioned_by_user_id(monkeypatch):
    """
    Ensures that LiteLLM/Portkey gateway headers are explicitly partitioned by user_id
    and bypassed when user_id is None to prevent cross-tenant cache hits.
    """
    monkeypatch.setenv("PORTKEY_API_KEY", "pk-test-key-12345")
    # Bypass Gemini route so call reaches LiteLLM gateway route directly
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    with patch("backend.ai_service.GEMINI_API_KEY", None):
        captured_kwargs = {}
        mock_gateway = MagicMock()
        def mock_completion(**kwargs):
            captured_kwargs.update(kwargs)
            mock_choice = MagicMock()
            mock_choice.message.content = "Safe Tutor Answer"
            mock_resp = MagicMock()
            mock_resp.choices = [mock_choice]
            return mock_resp
        mock_gateway.completion = mock_completion

        with patch("backend.ai_service._get_litellm", return_value=mock_gateway):
            # 1. Authenticated user request: must set tenant-specific cache namespace
            AIService._generate_content_safe("Explain B-Trees", user_id=42)
            extra_headers = captured_kwargs.get("extra_headers", {})
            assert extra_headers.get("x-portkey-cache") == "semantic"
            assert extra_headers.get("x-portkey-user") == "user_42"
            assert extra_headers.get("x-portkey-cache-namespace") == "tenant_42"

            # 2. Anonymous request: must bypass cache to avoid sharing / poisoning
            captured_kwargs.clear()
            AIService._generate_content_safe("Explain B-Trees", user_id=None)
            extra_headers_anon = captured_kwargs.get("extra_headers", {})
            assert extra_headers_anon.get("x-portkey-cache") == "bypass"
            assert "x-portkey-cache-namespace" not in extra_headers_anon
