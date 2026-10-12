# VoiceTasks — Avanta Edition

A simple voice-enabled task manager built with:
- React + Vite frontend
- FastAPI backend packaged for AWS Lambda with Mangum
- API Gateway HTTP API
- Amazon S3 for private task JSON storage and static frontend hosting
- ElevenLabs Speech-to-Text (Scribe) for voice transcription

No Docker and no local PostgreSQL are required.

## Architecture

Browser → S3 static website → API Gateway → Lambda/FastAPI → private S3 task-data bucket
                                                     ↘ ElevenLabs Speech-to-Text

Use **two S3 buckets**: one for public frontend files, one private bucket for task data.
Do not put task data in the public website bucket.

## 1. Run the frontend locally

Install Node.js LTS if needed. In `frontend/`:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The UI opens at the Vite URL. It can be viewed before the API is configured, but task loading and voice features need the API URL.

## 2. Configure the backend locally (optional)

Python 3.11 is recommended for the simplest AWS Lambda compatibility.

In `backend/`:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Fill in `AWS_REGION`, `TASKS_BUCKET`, and `ELEVENLABS_API_KEY`. Configure AWS credentials using `aws configure` or an IAM role in AWS. Then:

```powershell
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`; API docs at `/docs`.
Set `VITE_API_URL=http://127.0.0.1:8000` in `frontend/.env`, then restart Vite.

## 3. AWS setup

1. Create a **private** S3 bucket for task data (example: `voicetasks-data-unique-name`).
2. Create a separate S3 bucket for frontend hosting (example: `voicetasks-web-unique-name`).
3. Enable static website hosting on the frontend bucket. Upload the built files from `frontend/dist/`.
4. Create an IAM role for Lambda with basic Lambda logging and permission to `s3:GetObject` and `s3:PutObject` only on `arn:aws:s3:::YOUR_PRIVATE_DATA_BUCKET/tasks.json`.
5. Create a Lambda function using Python 3.11 and set environment variables:
   - `AWS_REGION`
   - `TASKS_BUCKET`
   - `ELEVENLABS_API_KEY`
   - `CORS_ORIGINS` (your frontend website URL)
6. Package the FastAPI app and dependencies for the Lambda Linux runtime. For Windows users without Docker, build the deployment package in **AWS CloudShell** or another Linux environment. See the AWS Lambda Python deployment-package documentation.
7. Set Lambda handler to `app.main.handler`.
8. Create an API Gateway **HTTP API** with a Lambda proxy integration and a `$default` route (or `ANY /{proxy+}` plus `/`). Deploy and copy its invoke URL.
9. Set `VITE_API_URL` in `frontend/.env` to the API Gateway invoke URL, then rebuild:
   ```powershell
   npm run build
   ```
   Upload the contents of `frontend/dist/` to the frontend bucket.

Keep the ElevenLabs API key only in Lambda environment variables. Never put it in React or upload it to S3.

## Voice flow

The browser records a short clip, sends it to FastAPI, and the Lambda calls ElevenLabs Scribe for transcription. The backend then parses a task title, date/time, priority, and category with lightweight rules. Automatic language detection is left to Scribe; the user does not choose a language manually.

## Important scope note

This starter stores task data as one JSON object in a private S3 bucket to keep the first deployment simple and avoid an additional database service. It is suitable for a single-user demo/prototype, not simultaneous multi-user production use. If the app later needs multiple users or concurrent writes, move task records to a database.

## API endpoints

- `GET /api/health`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/{task_id}`
- `DELETE /api/tasks/{task_id}`
- `POST /api/voice-command` (multipart field `audio`)
