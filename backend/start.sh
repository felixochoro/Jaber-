#!/usr/bin/env bash
set -e

# ── Normalize DB URLs for Railway ─────────────────────────────────────────────
# Railway injects DATABASE_URL as postgres:// or postgresql://
# We need:
#   SYNC_DATABASE_URL  = postgresql://...          (psycopg2 / migrations)
#   DATABASE_URL       = postgresql+asyncpg://...  (asyncpg / SQLAlchemy)

RAW_DB="${DATABASE_URL:-$SYNC_DATABASE_URL}"
if [ -z "$RAW_DB" ]; then
    echo "ERROR: DATABASE_URL must be set" >&2
    exit 1
fi

# Normalize to plain postgresql://
RAW_DB="${RAW_DB/postgres:\/\//postgresql://}"
RAW_DB="${RAW_DB/postgresql+asyncpg:\/\//postgresql://}"

export SYNC_DATABASE_URL="$RAW_DB"
export DATABASE_URL="${RAW_DB/postgresql:\/\//postgresql+asyncpg://}"

echo "DB scheme (sync):  $(echo "$SYNC_DATABASE_URL" | cut -d: -f1)"
echo "DB scheme (async): $(echo "$DATABASE_URL" | cut -d: -f1)"

# ── Wait for Postgres ─────────────────────────────────────────────────────────
echo "Waiting for database to be ready..."
python - <<'PYEOF'
import os, sys, time
import psycopg2

url = os.environ["SYNC_DATABASE_URL"]
for i in range(30):
    try:
        conn = psycopg2.connect(url, connect_timeout=3)
        conn.close()
        print("Database is ready.")
        sys.exit(0)
    except Exception as e:
        print(f"  [{i+1}/30] not ready yet ({e})")
        time.sleep(2)

print("Database not ready after 60 s — aborting.")
sys.exit(1)
PYEOF

# ── Run SQL migrations ────────────────────────────────────────────────────────
echo "Applying SQL migrations..."
python - <<'PYEOF'
import os, sys, pathlib
import psycopg2

url = os.environ["SYNC_DATABASE_URL"]
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()

mig_dir = pathlib.Path("/app/migrations")
if not mig_dir.exists():
    print("No migrations directory — skipping.")
    sys.exit(0)

for f in sorted(mig_dir.glob("*.sql")):
    print(f"  → {f.name}")
    try:
        cur.execute(f.read_text())
    except Exception as e:
        print(f"    warning: {e}")

cur.close()
conn.close()
print("Migrations complete.")
PYEOF

# ── Start the API ─────────────────────────────────────────────────────────────
echo "Starting SchoolConnect Atlas API on port ${PORT:-8000}..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WORKERS:-2}" \
    --log-level "${LOG_LEVEL:-info}"
