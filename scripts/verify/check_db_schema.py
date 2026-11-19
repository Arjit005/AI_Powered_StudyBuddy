import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import create_engine, text
from backend.database import engine

with engine.connect() as conn:
    print('COLUMNS:')
    cols = conn.execute(text(
        "SELECT column_name, data_type, is_nullable, column_default "
        "FROM information_schema.columns "
        "WHERE table_name = 'session_artifacts' "
        "ORDER BY ordinal_position;"
    )).fetchall()
    for col in cols:
        print(' ', col)

    print('\nINDEXES & CONSTRAINTS:')
    indexes = conn.execute(text(
        "SELECT indexname, indexdef "
        "FROM pg_indexes "
        "WHERE tablename = 'session_artifacts';"
    )).fetchall()
    for idx in indexes:
        print(' ', idx)
