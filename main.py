import os
import asyncio
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.tl.types import DocumentAttributeVideo


# ==========================================
# CONFIGURATION
# ==========================================

load_dotenv()

API_ID = int(os.environ["TELEGRAM_API_ID"])
API_HASH = os.environ["TELEGRAM_API_HASH"]

BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"

DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

client = TelegramClient(
    str(BASE_DIR / "videovault_session"),
    API_ID,
    API_HASH,
)


# ==========================================
# VIDEO DETECTION
# ==========================================

def is_video(message):
    """Identify videos in Telegram messages."""

    if not message.media or not message.document:
        return False

    mime_type = message.document.mime_type or ""

    if mime_type.startswith("video/"):
        return True

    # Some videos are stored as documents.
    for attribute in message.document.attributes:
        if isinstance(attribute, DocumentAttributeVideo):
            return True

    return False


def get_video_name(message):
    """Generate a safe filename for a video."""

    if message.file and message.file.name:
        name = Path(message.file.name).name

        if name not in ("", ".", ".."):
            return name

    extension = ".mp4"

    if message.document:
        mime_type = message.document.mime_type or ""

        if mime_type == "video/webm":
            extension = ".webm"
        elif mime_type == "video/x-matroska":
            extension = ".mkv"
        elif mime_type == "video/quicktime":
            extension = ".mov"

    return f"video_{message.id}{extension}"


# ==========================================
# FETCH CHATS
# ==========================================

async def get_chats():
    """Return accessible Telegram dialogs."""

    chats = []

    async for dialog in client.iter_dialogs():
        chats.append(dialog)

    return chats


# ==========================================
# DISPLAY CHATS
# ==========================================

async def show_chats(chats):
    print("\n" + "=" * 65)
    print("             VIDEOVAULT - YOUR CHATS")
    print("=" * 65)

    for index, dialog in enumerate(chats, start=1):
        print(f"{index:3}. {dialog.name}")

    print("=" * 65)


# ==========================================
# SCAN CHAT FOR VIDEOS
# ==========================================

async def scan_videos(entity):
    """Find eligible videos in the selected chat."""

    videos = []

    print("\nScanning message history...")
    print("This may take some time for large chats.\n")

    async for message in client.iter_messages(entity):
        if is_video(message):
            videos.append(message)

    return videos


# ==========================================
# DOWNLOAD VIDEOS
# ==========================================

async def download_videos(entity, videos):
    """Download discovered videos into a chat folder."""

    chat_name = getattr(entity, "title", None)

    if not chat_name:
        chat_name = getattr(entity, "first_name", None)

    if not chat_name:
        chat_name = str(getattr(entity, "id", "telegram_chat"))

    # Create a filesystem-safe folder name.
    safe_name = "".join(
        char if char.isalnum() or char in " -_()" else "_"
        for char in chat_name
    ).strip()

    if not safe_name:
        safe_name = "telegram_chat"

    folder = DOWNLOAD_DIR / safe_name
    folder.mkdir(parents=True, exist_ok=True)

    total = len(videos)

    if total == 0:
        print("No videos found in this chat.")
        return

    print(f"\nFound {total} videos.")
    print(f"Destination: {folder}\n")

    downloaded = 0
    skipped = 0
    failed = 0

    for index, message in enumerate(videos, start=1):
        filename = get_video_name(message)
        destination = folder / filename

        # Avoid overwriting an existing file.
        if destination.exists() and destination.stat().st_size > 0:
            skipped += 1
            print(
                f"[{index}/{total}] SKIPPED: {filename}"
            )
            continue

        try:
            print(
                f"[{index}/{total}] Downloading: {filename}"
            )

            path = await client.download_media(
                message,
                file=str(destination),
            )

            if path:
                downloaded += 1
                print(f"      Saved successfully.")
            else:
                failed += 1
                print("      Download returned no file.")

        except Exception as error:
            failed += 1
            print(f"      Failed: {error}")

    print("\n" + "=" * 50)
    print("           DOWNLOAD SUMMARY")
    print("=" * 50)
    print(f"Videos found:       {total}")
    print(f"Downloaded:         {downloaded}")
    print(f"Skipped:            {skipped}")
    print(f"Failed:             {failed}")
    print(f"Saved to:           {folder}")
    print("=" * 50)


# ==========================================
# MAIN APPLICATION
# ==========================================

async def main():
    print("\n" + "=" * 50)
    print("         VIDEOVAULT DOWNLOADER")
    print("=" * 50)

    await client.start()

    me = await client.get_me()
    print(f"\nConnected as: {me.first_name}")

    chats = await get_chats()

    if not chats:
        print("No accessible chats found.")
        return

    while True:
        await show_chats(chats)

        choice = input(
            "\nEnter a chat number, or Q to quit: "
        ).strip()

        if choice.lower() == "q":
            print("Exiting VideoVault.")
            break

        if not choice.isdigit():
            print("Please enter a valid number.")
            continue

        index = int(choice)

        if index < 1 or index > len(chats):
            print("Chat number out of range.")
            continue

        selected = chats[index - 1]

        print(f"\nSelected: {selected.name}")

        confirm = input(
            "Scan this chat for videos? (y/n): "
        ).strip().lower()

        if confirm != "y":
            continue

        try:
            videos = await scan_videos(selected.entity)

            print(f"\nVideos found: {len(videos)}")

            if not videos:
                continue

            action = input(
                "Download all found videos? (y/n): "
            ).strip().lower()

            if action == "y":
                await download_videos(
                    selected.entity,
                    videos,
                )

        except Exception as error:
            print(f"\nCould not process this chat: {error}")

        again = input(
            "\nProcess another chat? (y/n): "
        ).strip().lower()

        if again != "y":
            break

    print("\nVideoVault closed.")


if __name__ == "__main__":
    with client:
        client.loop.run_until_complete(main())