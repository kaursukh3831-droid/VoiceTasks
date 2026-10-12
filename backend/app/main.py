import json
import uuid
from datetime import datetime, timezone
from typing import List
from dotenv import load_dotenv
load_dotenv()  # Load local .env before reading configuration values.
import boto3
import requests
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from .config import AWS_REGION, TASKS_BUCKET, TASKS_KEY, ELEVENLABS_API_KEY, CORS_ORIGINS
from .schemas import TaskCreate, TaskUpdate
from .task_parser import parse_task

app = FastAPI(title="VoiceTasks API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
s3 = boto3.client("s3", region_name=AWS_REGION)

def _read_tasks() -> list:
    if not TASKS_BUCKET:
        return []
    try:
        obj = s3.get_object(Bucket=TASKS_BUCKET, Key=TASKS_KEY)
        data = json.loads(obj["Body"].read().decode("utf-8"))
        return data if isinstance(data, list) else []
    except s3.exceptions.NoSuchKey:
        return []
    except Exception as exc:
        # A missing object is normal on first run; report other errors clearly.
        if "NoSuchKey" in str(exc) or "404" in str(exc):
            return []
        raise HTTPException(status_code=500, detail=f"Could not read tasks from S3: {exc}")

def _write_tasks(tasks: list) -> None:
    if not TASKS_BUCKET:
        raise HTTPException(status_code=500, detail="Set TASKS_BUCKET in the backend environment.")
    try:
        s3.put_object(
            Bucket=TASKS_BUCKET,
            Key=TASKS_KEY,
            Body=json.dumps(tasks, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save tasks to S3: {exc}")

def _now():
    return datetime.now(timezone.utc).isoformat()

@app.get("/api/health")
def health():
    return {"ok": True, "service": "VoiceTasks API"}

@app.get("/api/tasks")
def get_tasks():
    return sorted(_read_tasks(), key=lambda t: (t.get("completed", False), t.get("date") or "9999", t.get("time") or "99:99"))

@app.post("/api/tasks")
def create_task(payload: TaskCreate):
    tasks = _read_tasks()
    task = payload.model_dump()
    task.update({"id": str(uuid.uuid4()), "created_at": _now()})
    tasks.append(task)
    _write_tasks(tasks)
    return task

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: str, payload: TaskUpdate):
    tasks = _read_tasks()
    for index, task in enumerate(tasks):
        if task["id"] == task_id:
            for key, value in payload.model_dump(exclude_unset=True).items():
                task[key] = value
            task["updated_at"] = _now()
            tasks[index] = task
            _write_tasks(tasks)
            return task
    raise HTTPException(status_code=404, detail="Task not found")

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    tasks = _read_tasks()
    filtered = [task for task in tasks if task["id"] != task_id]
    if len(filtered) == len(tasks):
        raise HTTPException(status_code=404, detail="Task not found")
    _write_tasks(filtered)
    return {"deleted": True}

@app.post("/api/voice-command")
async def voice_command(audio: UploadFile = File(...)):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key is missing. Check backend/.env and restart the backend")
    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="Audio recording was empty.")
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Please record a shorter voice command (under 8 MB).")
    try:
        response = requests.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": ELEVENLABS_API_KEY},
            data={"model_id": "scribe_v1"},
            files={"file": (audio.filename or "voice.webm", content, audio.content_type or "audio/webm")},
            timeout=45,
        )
        response.raise_for_status()
        payload = response.json()
        transcript = payload.get("text", "").strip()
        if not transcript:
            raise HTTPException(status_code=422, detail="ElevenLabs did not return a transcript. Try speaking again.")
        parsed = parse_task(transcript)
        return {"transcript": transcript, "task": parsed}
    except HTTPException:
        raise
    except requests.RequestException as exc:
        detail = "ElevenLabs speech recognition failed."
        if getattr(exc, "response", None) is not None:
            detail += f" HTTP {exc.response.status_code}: {exc.response.text[:400]}"
        raise HTTPException(status_code=502, detail=detail)

handler = Mangum(app)
