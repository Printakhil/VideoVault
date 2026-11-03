
import asyncio
import re
import time
import uuid
from pathlib import Path
from typing import Any

from telethon.errors import FloodWaitError

from backend.telegram_service import (
    BASE_DIR,
    client,
    connect_telegram,
    is_downloadable_document,
)


DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_CONCURRENT_DOWNLOADS = 2

_jobs: dict[str, dict[str, Any]] = {}
_job_tasks: dict[str, asyncio.Task] = {}
_download_semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)


def safe_name(value: str) -> str:
    """Remove characters that are unsafe in Windows filenames."""
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value)
    value = value.strip(" .")
    return value[:150] or "Telegram chat"


def get_jobs() -> list[dict]:
    """Return a snapshot of download jobs."""
    return [dict(job) for job in _jobs.values()]


def get_job(job_id: str) -> dict | None:
    job = _jobs.get(job_id)
    return dict(job) if job else None


async def enqueue_downloads(
    chat_id: int,
    message_ids: list[int],
) -> list[dict]:
    """Validate selected Telegram messages and queue their downloads."""
    await connect_telegram()

    # Remove repeated IDs while preserving the supplied order.
    message_ids = list(dict.fromkeys(message_ids))

    if not message_ids:
        raise ValueError("Select at least one file.")

    if len(message_ids) > 100:
        raise ValueError("Queue at most 100 files per request.")

    # Resolve the chat from Telegram's existing dialog list.
    entity = None
    async for dialog in client.iter_dialogs():
        if dialog.id == chat_id:
            entity = dialog.entity
            break

    if entity is None:
        raise ValueError("Chat not found in your Telegram dialog list.")

    created = []

    for message_id in message_ids:
        message = await client.get_messages(entity, ids=message_id)

        if not message or not is_downloadable_document(message):
            raise ValueError(
                f"Message {message_id} does not contain a downloadable document."
            )

        filename = (
            message.file.name
            if message.file and message.file.name
            else f"telegram_file_{message_id}"
        )
        filename = safe_name(filename)

        # Use a separate folder for each chat.
        chat_name = safe_name(getattr(entity, "title", None) or str(chat_id))
        target_dir = DOWNLOAD_DIR / chat_name
        target_path = target_dir / filename

        # Avoid scheduling the same chat/message twice.
        existing = next(
            (
                job for job in _jobs.values()
                if job["chat_id"] == str(chat_id)
                and job["message_id"] == message_id
                and job["status"] in {
                    "queued", "downloading", "completed"
                }
            ),
            None,
        )

        if existing:
            created.append(dict(existing))
            continue

        job_id = uuid.uuid4().hex
        job = {
            "id": job_id,
            "chat_id": str(chat_id),
            "message_id": message_id,
            "filename": filename,
            "size_bytes": int(message.document.size or 0),
            "downloaded_bytes": 0,
            "progress": 0.0,
            "speed_bytes_per_second": 0.0,
            "status": "queued",
            "path": str(target_path),
            "error": None,
            "created_at": time.time(),
        }

        _jobs[job_id] = job
        created.append(dict(job))

        task = asyncio.create_task(_run_download(job_id, entity))
        _job_tasks[job_id] = task

    return created


async def _run_download(job_id: str, entity: Any) -> None:
    job = _jobs[job_id]

    try:
        async with _download_semaphore:
            if job["status"] == "cancelled":
                return

            await connect_telegram()

            job["status"] = "downloading"
            target = Path(job["path"])
            target.parent.mkdir(parents=True, exist_ok=True)

            message = await client.get_messages(
                entity,
                ids=job["message_id"],
            )

            if not message or not is_downloadable_document(message):
                raise ValueError("The Telegram media message is no longer available.")

            start_time = time.monotonic()
            latest_bytes = 0

            def progress_callback(current: int, total: int) -> None:
                nonlocal latest_bytes
                elapsed = max(time.monotonic() - start_time, 0.001)

                job["downloaded_bytes"] = current
                job["size_bytes"] = total
                job["progress"] = round(current / total * 100, 2) if total else 0
                job["speed_bytes_per_second"] = round(
                    max(current - latest_bytes, 0) / max(elapsed, 0.001),
                    2,
                )
                latest_bytes = current

            # Do not overwrite a file that already exists.
            if target.exists():
                target = target.with_name(
                    f"{target.stem}_{job['message_id']}{target.suffix}"
                )
                job["path"] = str(target)

            await client.download_media(
                message,
                file=str(target),
                progress_callback=progress_callback,
            )

            job["downloaded_bytes"] = target.stat().st_size
            job["size_bytes"] = target.stat().st_size
            job["progress"] = 100.0
            job["speed_bytes_per_second"] = 0.0
            job["status"] = "completed"

    except asyncio.CancelledError:
        job["status"] = "cancelled"
        # Remove incomplete output when cancelling a transfer.
        path = Path(job["path"])
        if path.exists():
            try:
                path.unlink()
            except OSError:
                pass
        raise

    except FloodWaitError as exc:
        job["status"] = "failed"
        job["error"] = (
            f"Telegram requested a wait of {exc.seconds} seconds. "
            "Retry this download later."
        )

    except Exception as exc:
        job["status"] = "failed"
        job["error"] = str(exc)

    finally:
        _job_tasks.pop(job_id, None)


async def cancel_download(job_id: str) -> dict | None:
    """Cancel a queued or active download."""
    job = _jobs.get(job_id)

    if not job:
        return None

    if job["status"] in {"completed", "failed", "cancelled"}:
        return dict(job)

    task = _job_tasks.get(job_id)

    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    else:
        job["status"] = "cancelled"

    return dict(job)