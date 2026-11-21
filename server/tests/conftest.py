import os

# config.py refuses to import without a real-looking SECRET_KEY
os.environ.setdefault("SECRET_KEY", "unit-test-secret-key-" + "x" * 32)
