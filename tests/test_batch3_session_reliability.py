import pytest
import uuid
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from backend.main import app

client = TestClient(app)

# ============================================================================
# 1. CONVERSATION CLEAR & ISOLATION BACKEND INTEGRATION
# ============================================================================
def test_clear_conversation_messages_endpoint():
    """
    Tests clearing messages for a specific conversation session.
    Verifies that deleting conversation messages succeeds and leaves conversation
    ready for new messages without returning 500 or deleting the parent conversation entity.
    """
    from backend.database import SessionLocal
    from backend.models import User, Conversation, ChatHistory
    db = SessionLocal()
    uniq = uuid.uuid4().hex[:8]
    try:
        user = User(username=f"clear_user_{uniq}", email=f"clear_{uniq}@example.com", hashed_password="pw")
        db.add(user)
        db.commit()
        db.refresh(user)

        conv = Conversation(user_id=user.id, title="Session to Clear")
        db.add(conv)
        db.commit()
        db.refresh(conv)

        msg1 = ChatHistory(user_id=user.id, conversation_id=conv.id, role="user", content="Hello")
        msg2 = ChatHistory(user_id=user.id, conversation_id=conv.id, role="ai", content="Hi there!")
        db.add_all([msg1, msg2])
        db.commit()

        from backend.auth import create_access_token
        token = create_access_token({"sub": str(user.id), "email": user.email})
        headers = {"Authorization": f"Bearer {token}"}

        # Clear the chat messages for this conversation
        resp = client.delete(f"/api/chat?conversation_id={conv.id}", headers=headers)
        assert resp.status_code == 200

        # Remaining messages for this conversation must be 0
        remaining = db.query(ChatHistory).filter(ChatHistory.conversation_id == conv.id).count()
        assert remaining == 0

        # Parent conversation still exists and is ready for next turn
        assert db.query(Conversation).filter(Conversation.id == conv.id).first() is not None
    finally:
        db.close()


def test_clear_conversation_unauthorized_user_cannot_delete_other_user_messages():
    """
    Negative authorization test: User B cannot delete messages in User A's conversation.
    """
    from backend.database import SessionLocal
    from backend.models import User, Conversation, ChatHistory
    from backend.auth import create_access_token
    db = SessionLocal()
    uniq = uuid.uuid4().hex[:8]
    try:
        user_a = User(username=f"user_a_{uniq}", email=f"usera_{uniq}@example.com", hashed_password="pw")
        user_b = User(username=f"user_b_{uniq}", email=f"userb_{uniq}@example.com", hashed_password="pw")
        db.add_all([user_a, user_b])
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)

        conv_a = Conversation(user_id=user_a.id, title="User A Confidential")
        db.add(conv_a)
        db.commit()
        db.refresh(conv_a)

        msg_a = ChatHistory(user_id=user_a.id, conversation_id=conv_a.id, role="user", content="Secret note")
        db.add(msg_a)
        db.commit()

        token_b = create_access_token({"sub": str(user_b.id), "email": user_b.email})
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # User B attempts to clear User A's conversation messages
        resp = client.delete(f"/api/chat?conversation_id={conv_a.id}", headers=headers_b)
        
        # User A's message must still remain intact
        assert db.query(ChatHistory).filter(ChatHistory.conversation_id == conv_a.id).count() == 1
    finally:
        db.close()
