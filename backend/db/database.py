"""DB session bootstrap.

Local dev → SQLite at ./interview_agent.db (the default)
Production → Postgres via DATABASE_URL env var, e.g.
    DATABASE_URL=postgresql+psycopg2://USER:PASS@HOST:5432/dbname
"""
import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./interview_agent.db")

# psycopg2 prefers ``postgresql://``; Supabase + Heroku style ``postgres://``
# urls need a small rewrite.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

_engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Sensible defaults for Postgres in production
    _engine_kwargs["pool_size"] = int(os.getenv("DB_POOL_SIZE", "5"))
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_recycle"] = 1800

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    from . import models  # noqa: F401  register models on Base
    Base.metadata.create_all(bind=engine)
    _autoadd_columns()


def _autoadd_columns():
    """Lightweight migrations: add columns added in later versions if missing.
    Idempotent. Works on both SQLite and Postgres.

    Postgres aborts the whole transaction on any failed statement, so each
    column gets its own connection — a failed probe never poisons the ALTER.
    """
    from sqlalchemy import text
    is_pg = DATABASE_URL.startswith("postgres")
    statements = [
        ("candidates", "last_role",      "TEXT DEFAULT ''"),
        ("candidates", "last_seniority", "TEXT DEFAULT ''"),
        ("candidates", "last_tone",      "TEXT DEFAULT ''"),
        ("candidates", "last_focus",     ("JSONB DEFAULT '[]'::jsonb" if is_pg else "TEXT DEFAULT '[]'")),
        ("candidates", "last_jd_text",   "TEXT DEFAULT ''"),
        ("sessions",   "share_token",    "TEXT"),
    ]

    def _exists(table: str, col: str) -> bool:
        try:
            with engine.connect() as conn:
                if is_pg:
                    row = conn.execute(
                        text(
                            "SELECT 1 FROM information_schema.columns "
                            "WHERE table_name = :t AND column_name = :c"
                        ),
                        {"t": table, "c": col},
                    ).fetchone()
                    return row is not None
                # SQLite
                rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
                return col in [r[1] for r in rows]
        except Exception as e:
            print(f"_exists probe failed for {table}.{col}: {e}")
            return True  # don't try to ALTER if we can't even probe

    for table, col, ddl in statements:
        if _exists(table, col):
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))
            print(f"migrated: + {table}.{col}")
        except Exception as e:
            print(f"migration failed for {table}.{col}: {e}")


@contextmanager
def db_session():
    s = SessionLocal()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()
