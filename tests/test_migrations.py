from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.models import Base, ChatHistory, Conversation, User, run_migrations


def _migration_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def test_fresh_database_is_created_and_migration_is_idempotent():
    engine = _migration_engine()
    try:
        run_migrations(engine)
        expected_tables = set(Base.metadata.tables) | {"alembic_version"}
        assert expected_tables.issubset(set(inspect(engine).get_table_names()))

        with engine.connect() as connection:
            revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        run_migrations(engine)
        assert revision
        assert set(inspect(engine).get_table_names()) == expected_tables
    finally:
        engine.dispose()


def test_legacy_database_adds_known_columns_and_preserves_records():
    engine = _migration_engine()
    try:
        for table in Base.metadata.sorted_tables:
            if table.name not in {"chat_history", "message_source_links"}:
                table.create(engine)

        with engine.begin() as connection:
            connection.execute(text(
                "CREATE TABLE chat_history ("
                "id INTEGER PRIMARY KEY, "
                "user_id INTEGER REFERENCES users(id), "
                "role VARCHAR, content TEXT, "
                "timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)"
            ))
            connection.execute(text(
                "INSERT INTO users (id, username, email, hashed_password) "
                "VALUES (1, 'legacy_student', 'legacy@example.com', 'hash')"
            ))
            connection.execute(text(
                "INSERT INTO conversations (id, user_id, title) "
                "VALUES (1, 1, 'Legacy session')"
            ))
            connection.execute(text(
                "INSERT INTO chat_history (id, user_id, role, content) "
                "VALUES (1, 1, 'user', 'preserve this message')"
            ))
        Base.metadata.tables["message_source_links"].create(engine)

        run_migrations(engine)

        with Session(engine) as session:
            user = session.get(User, 1)
            conversation = session.get(Conversation, 1)
            assert user.username == "legacy_student"
            assert conversation.title == "Legacy session"
            assert session.query(ChatHistory).one().content == "preserve this message"

        columns = {column["name"] for column in inspect(engine).get_columns("chat_history")}
        assert {"conversation_id", "citations_json"}.issubset(columns)
        assert "alembic_version" in inspect(engine).get_table_names()
    finally:
        engine.dispose()
