from pydantic import BaseModel, Field
import asyncio
import json
from pathlib import Path
from backend.services.transcription_service import DOWNLOAD_DIR
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from fastapi import BackgroundTasks
from backend.services.transcription_service import (
    list_videos,
    create_transcription_job,
    get_transcription_job,
    run_transcription,
)
from backend.download_manager import (
    enqueue_downloads,
    get_jobs,
    get_job,
    cancel_download,

)
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.telegram_service import (
    connect_telegram,
    disconnect_telegram,
    list_chats,
    get_media_messages,
)

class DownloadRequest(BaseModel):
    chat_id: int
    message_ids: list[int] = Field(min_length=1, max_length=100)

class AIChatRequest(BaseModel):
    messages: list[dict[str, str]] = Field(min_length=1, max_length=20)

class TranscriptionRequest(BaseModel):
    video_path: str

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await connect_telegram()
        print("VideoVault: Telegram connected.")
        yield
    finally:
        await disconnect_telegram()
        print("VideoVault: Telegram disconnected.")


app = FastAPI(
    title="VideoVault API",
    description="Local Telegram media management API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "application": "VideoVault",
    }


@app.get("/api/chats")
async def chats():
    try:
        return {"chats": await list_chats()}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve Telegram chats: {exc}",
        ) from exc


@app.get("/api/chats/{chat_id}/media")
async def chat_media(
    chat_id: int,
    limit: int = Query(default=5000, ge=1, le=10000),
):
    try:
        media = await get_media_messages(
            chat_id=chat_id,
            limit=limit,
        )

        return {
            "chat_id": str(chat_id),
            "count": len(media),
            "items": media,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not inspect Telegram media: {exc}",
        ) from exc


@app.post("/api/downloads")
async def create_downloads(request: DownloadRequest):
    try:
        jobs = await enqueue_downloads(
            chat_id=request.chat_id,
            message_ids=request.message_ids,
        )
        return {
            "count": len(jobs),
            "jobs": jobs,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not queue downloads: {exc}",
        ) from exc


@app.get("/api/downloads")
async def downloads():
    return {"jobs": get_jobs()}


@app.get("/api/downloads/{job_id}")
async def download_status(job_id: str):
    job = get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Download job not found.")

    return job


@app.post("/api/downloads/{job_id}/cancel")
async def cancel_download_job(job_id: str):
    job = await cancel_download(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Download job not found.")

    return job


@app.get("/api/downloads/stats")
async def download_stats():
    jobs = get_jobs()

    return {
        "total": len(jobs),
        "queued": sum(job["status"] == "queued" for job in jobs),
        "downloading": sum(
            job["status"] == "downloading" for job in jobs
        ),
        "completed": sum(job["status"] == "completed" for job in jobs),
        "failed": sum(job["status"] == "failed" for job in jobs),
        "cancelled": sum(job["status"] == "cancelled" for job in jobs),
    }

async def generate_local_ai_response(messages: list[dict[str, str]]) -> str:
    """Generate a response using the local Ollama model."""

    conversation = []

    for message in messages[-10:]:
        role = message.get("role", "")
        content = message.get("content", "").strip()

        if role not in {"user", "assistant"} or not content:
            continue

        conversation.append(f"{role.capitalize()}: {content}")

    if not conversation or conversation[-1].startswith("Assistant:"):
        raise ValueError("The latest message must be from the user.")

    prompt = (
        "You are VideoVault AI, a helpful assistant inside a local media "
        "management application. Give clear, practical answers. "
        "Do not claim to have watched videos or read files unless their "
        "contents have actually been provided. "
        "The user may ask about VideoVault, technology, or general topics.\n\n"
        + "\n".join(conversation)
        + "\nAssistant:"
    )

    payload = json.dumps({
        "model": "llama3.2:1b",
        "prompt": prompt,
        "stream": False,
    }).encode("utf-8")

    request = Request(
        "http://127.0.0.1:11434/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    def call_ollama():
        with urlopen(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))

    try:
        result = await asyncio.to_thread(call_ollama)
        answer = result.get("response", "").strip()

        if not answer:
            raise HTTPException(
                status_code=502,
                detail="The local AI returned an empty response.",
            )

        return answer

    except HTTPException:
        raise
    except (URLError, HTTPError, TimeoutError, OSError) as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not reach local Ollama. Make sure Ollama is running "
                "and the llama3.2:1b model is installed."
            ),
        ) from exc
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not process the response from local AI.",
        ) from exc


@app.post("/api/ai/chat")
async def ai_chat(request: AIChatRequest):
    try:
        answer = await generate_local_ai_response(request.messages)
        return {
            "answer": answer,
            "model": "llama3.2:1b",
            "provider": "local",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/videos")
async def videos():
    return {"videos": list_videos()}


@app.post("/api/videos/transcribe")
async def transcribe_video(
    request: TranscriptionRequest,
    background_tasks: BackgroundTasks,
):
    try:
        job_id, video_path = create_transcription_job(
            request.video_path
        )

        background_tasks.add_task(
            run_transcription,
            job_id,
            video_path,
        )

        return {
            "job_id": job_id,
            "status": "queued",
            "message": "Transcription started.",
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/videos/transcriptions/{job_id}")
async def transcription_status(job_id: str):
    job = get_transcription_job(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Transcription job not found.",
        )

    return job


@app.get("/api/videos/transcripts")
async def read_transcript(video_path: str):
    video = (DOWNLOAD_DIR / video_path).resolve()

    try:
        video.relative_to(DOWNLOAD_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid video path.")

    transcript_path = video.with_suffix(".txt")

    if not transcript_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Transcript not found. Transcribe this video first.",
        )

    try:
        content = await asyncio.to_thread(
            transcript_path.read_text,
            encoding="utf-8",
        )
        return {
            "video": video.name,
            "transcript": content,
            "characters": len(content),
        }
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Could not read transcript.",
        ) from exc