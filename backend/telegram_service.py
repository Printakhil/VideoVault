
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.types import DocumentAttributeVideo


BASE_DIR = Path(__file__).resolve().parent.parent
SESSION_PATH = BASE_DIR / "videovault_session"

load_dotenv(BASE_DIR / ".env")

api_id = os.getenv("TELEGRAM_API_ID")
api_hash = os.getenv("TELEGRAM_API_HASH")

if not api_id or not api_hash:
    raise RuntimeError(
        "Telegram credentials are missing. "
        "Check that TELEGRAM_API_ID and TELEGRAM_API_HASH "
        "are configured in the project .env file."
    )

client = TelegramClient(
    str(SESSION_PATH),
    int(api_id),
    api_hash,
)


def is_video(message: Any) -> bool:
    """Identify video messages, including videos sent as documents."""
    if not message.document:
        return False

    mime_type = message.document.mime_type or ""

    if mime_type.startswith("video/"):
        return True

    return any(
        isinstance(attribute, DocumentAttributeVideo)
        for attribute in message.document.attributes
    )


def is_downloadable_document(message: Any) -> bool:
    """Identify messages containing documents or videos."""
    if not message.document:
        return False

    return True


async def connect_telegram() -> None:
    """Connect to Telegram and verify the saved session."""
    if not client.is_connected():
        await client.connect()

    if not await client.is_user_authorized():
        raise RuntimeError(
            "The Telegram session is not authorized. "
            "Run your existing login workflow before continuing."
        )


async def disconnect_telegram() -> None:
    """Disconnect cleanly from Telegram."""
    if client.is_connected():
        await client.disconnect()


async def list_chats() -> list[dict]:
    """Return accessible chats without downloading their media."""
    await connect_telegram()

    chats = []

    async for dialog in client.iter_dialogs():
        entity = dialog.entity

        chats.append(
            {
                "id": str(dialog.id),
                "name": dialog.name or "Unnamed chat",
                "unread_count": dialog.unread_count,
                "is_group": bool(getattr(entity, "megagroup", False))
                or bool(getattr(entity, "gigagroup", False)),
                "is_channel": bool(getattr(entity, "broadcast", False)),
            }
        )

    return chats


async def get_media_messages(
    chat_id: int,
    limit: int = 5000,
) -> list[dict]:
    """
    Inspect recent messages in a chat.

    Videos and documents are returned in Telegram message order.
    No media files are downloaded.
    """
    await connect_telegram()

    results = []

    async for message in client.iter_messages(
        chat_id,
        limit=limit,
        reverse=True,
    ):
        if not is_downloadable_document(message):
            continue

        document = message.document
        filename = (
            message.file.name
            if message.file and message.file.name
            else f"telegram_file_{message.id}"
        )

        results.append(
            {
                "message_id": message.id,
                "chat_id": str(chat_id),
                "filename": Path(filename).name,
                "mime_type": document.mime_type or "application/octet-stream",
                "size_bytes": document.size,
                "is_video": is_video(message),
                "date": (
                    message.date.isoformat()
                    if message.date
                    else None
                ),
                "caption": message.message or "",
            }
        )

    return results