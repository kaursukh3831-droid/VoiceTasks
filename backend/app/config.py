
import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env without exposing secrets in source code.
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
TASKS_BUCKET = os.getenv("TASKS_BUCKET", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
TASKS_KEY = "tasks.json"


CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://10.208.138.184:5173"
    ).split(",")
    if origin.strip()
]