import os
from sqlalchemy import create_engine, text
import traceback

# Simple .env loader
env_path = os.path.join(os.getcwd(), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

url = os.getenv('DATABASE_URL')
print('Using DATABASE_URL:', url)
try:
    engine = create_engine(url)
    with engine.connect() as conn:
        r = conn.execute(text('SELECT 1'))
        print('Test query result:', r.scalar())
    print('Connection test: SUCCESS')
except Exception as e:
    print('Connection test: FAILED')
    traceback.print_exc()
