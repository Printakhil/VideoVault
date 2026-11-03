
import asyncio
import uuid
import os
from pathlib import Path

import whisper

# Project directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
TOOLS_DIR = BASE_DIR / "tools"

# Make our local ffmpeg.exe available to Whisper
os.environ["PATH"] = str(TOOLS_DIR) + os.pathsep + os.environ.get("PATH", "")

# In-memory transcription jobs
_transcription_jobs = {}
_model = None

VIDEO_EXTENSIONS = {
    ".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v"
}


def get_model():
    global _model

    if _model is None:
        _model = whisper.load_model("tiny")

    return _model


def list_videos():
    videos = []

    for video in DOWNLOAD_DIR.rglob("*"):
        if video.is_file() and video.suffix.lower() in VIDEO_EXTENSIONS:
            videos.append({
                "name": video.name,
                "path": str(video.relative_to(DOWNLOAD_DIR)),
                "size_bytes": video.stat().st_size,
                "transcript_exists": video.with_suffix(".txt").exists(),
            })

    return videos


def get_transcription_job(job_id: str):
    return _transcription_jobs.get(job_id)


def _transcribe_sync(video_path: Path):
    model = get_model()

    result = model.transcribe(
        str(video_path),
        fp16=False,
        verbose=False,
    )

    transcript = result["text"].strip()
    output_path = video_path.with_suffix(".txt")
    output_path.write_text(transcript, encoding="utf-8")

    return {
        "transcript": transcript,
        "transcript_path": str(output_path),
        "language": result.get("language", "unknown"),
    }


async def run_transcription(job_id: str, video_path: Path):
    _transcription_jobs[job_id]["status"] = "processing"

    try:
        result = await asyncio.to_thread(_transcribe_sync, video_path)

        _transcription_jobs[job_id].update({
            "status": "completed",
            "language": result["language"],
            "transcript_path": result["transcript_path"],
            "preview": result["transcript"][:1000],
            "error": None,
        })

    except Exception as exc:
        _transcription_jobs[job_id].update({
            "status": "failed",
            "error": str(exc),
        })


def create_transcription_job(relative_path: str):
    # Resolve the requested file inside downloads only
    video_path = (DOWNLOAD_DIR / relative_path).resolve()

    try:
        video_path.relative_to(DOWNLOAD_DIR.resolve())
    except ValueError:
        raise ValueError("Invalid video path.")

    if not video_path.is_file():
        raise FileNotFoundError("Video not found.")

    if video_path.suffix.lower() not in VIDEO_EXTENSIONS:
        raise ValueError("Unsupported video format.")

    job_id = str(uuid.uuid4())

    _transcription_jobs[job_id] = {
        "job_id": job_id,
        "video": video_path.name,
        "status": "queued",
        "language": None,
        "transcript_path": None,
        "preview": None,
        "error": None,
    }

    return job_id, video_path
