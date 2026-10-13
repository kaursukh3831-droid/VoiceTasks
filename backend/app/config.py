
import os
from pathlib import Path

from dotenv import load_dotenv


# Locate the backend folder.
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env.
load_dotenv(BACKEND_DIR / ".env")


# AWS configuration.
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")

# Amazon S3 task storage.
TASKS_BUCKET = os.getenv("TASKS_BUCKET", "")
TASKS_KEY = "tasks.json"


# ElevenLabs speech recognition.
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")


# Allowed frontend addresses.
DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173,"
    "http://127.0.0.1:5173,"
    "http://localhost:5174,"
    "http://127.0.0.1:5174"
)

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        DEFAULT_CORS_ORIGINS,
    ).split(",")
    if origin.strip()
]