# VideoVault

**VideoVault** is a local-first Telegram media downloader and AI-powered video workspace. Browse media shared in Telegram chats, queue downloads, transcribe downloaded videos, and explore transcript content with a locally running language model.

> **Status:** Local development build. Features and API contracts may evolve.

## Features

### Telegram media workspace
- Browse Telegram chats, groups, and channels.
- Inspect media shared in a selected chat.
- Search filenames and captions; filter by media type.
- Select individual files or videos for download.

### Download manager
- Queue media downloads.
- Monitor queued, downloading, completed, failed, and cancelled jobs.
- View download progress and transfer speed.
- Cancel queued or active jobs.

### Local video intelligence
- Browse videos in the local `downloads/` directory.
- Transcribe video audio with Whisper.
- Save transcripts alongside source videos as `.txt` files.
- Read transcripts in the frontend.

### Local AI assistant
- Ask questions using the currently opened video's transcript as reference material.
- Generate summaries, structured study notes, and revision questions.
- Run text generation locally through Ollama (configured in this project with `llama3.2:1b`).

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript |
| Backend | Python, FastAPI, Uvicorn |
| Telegram integration | Telethon |
| Speech-to-text | OpenAI Whisper |
| Local language model | Ollama, Llama 3.2 1B |
| Media processing | FFmpeg |
| API communication | HTTP / JSON |

## Architecture

```text
VideoVault/
├── backend/
│   ├── main.py
│   ├── telegram_service.py
│   ├── download_manager.py
│   └── services/
├── frontend/
│   └── src/
│       └── App.jsx
├── downloads/                 # Downloaded media (keep private)
├── tools/                     # Local tools such as ffmpeg.exe
├── .env                       # Local credentials (never commit)
└── videovault_session.session # Telegram session (never commit)
```

The exact files under `backend/services/` and the frontend may change as the project develops.

## Requirements

- Windows 10/11 (the development instructions below use PowerShell).
- Python 3.12.
- Node.js and npm.
- Ollama installed and running locally.
- FFmpeg available on `PATH` for Whisper transcription.
- Telegram API credentials for your own Telegram account.

## Setup on Windows

### 1. Clone the repository

```powershell
git clone https://github.com/YOUR_GITHUB_USERNAME/VideoVault.git
cd VideoVault
```

Replace `YOUR_GITHUB_USERNAME` with the GitHub account that owns the repository.

### 2. Create and activate a Python virtual environment

```powershell
py -3.12 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

### 3. Install backend dependencies

If the repository contains `requirements.txt`, install its dependencies:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If `requirements.txt` does not exist yet, create and test one from the working environment before publishing. Do not rely on a developer's existing virtual environment as the dependency manifest.

### 4. Configure Telegram credentials

Create a local `.env` file using the variable names expected by `backend/telegram_service.py`. Obtain your API ID and API hash from:

https://my.telegram.org/

Do not commit `.env`, Telegram session files, API hashes, phone numbers, or other credentials. The first Telegram connection may require an interactive login and verification code.

### 5. Install and start Ollama

Install Ollama from https://ollama.com/ and pull the model used by this project:

```powershell
ollama pull llama3.2:1b
```

Make sure Ollama is running locally. Its default local API endpoint is:

```text
http://127.0.0.1:11434
```

The backend's model and endpoint configuration must match your local Ollama setup.

### 6. Configure FFmpeg

Whisper requires FFmpeg to read audio from video files. Install FFmpeg and make sure `ffmpeg` is available in your terminal's `PATH`.

For the current Windows setup, the executable can be placed at:

```text
VideoVault/tools/ffmpeg.exe
```

From the project root, add that folder to the current PowerShell session's PATH:

```powershell
$env:PATH = "$PWD\tools;" + $env:PATH
```

This PATH change applies only to the current terminal session.

### 7. Start the backend

Open a PowerShell terminal at the project root:

```powershell
cd D:\Project\VideoVault
.\.venv\Scripts\Activate.ps1
$env:PATH = "$PWD\tools;" + $env:PATH
python -m uvicorn backend.main:app --reload
```

The API should be available at:

- API base: http://127.0.0.1:8000
- Interactive API documentation: http://127.0.0.1:8000/docs

Keep this terminal running.

### 8. Start the frontend

Open a second terminal:

```powershell
cd D:\Project\VideoVault\frontend
npm install
npm run dev
```

Open the local Vite URL printed in the terminal. In the current development setup, it is usually:

http://127.0.0.1:5173

If the frontend uses a different backend URL, configure `VITE_API_BASE_URL` in a local frontend environment file. Do not put credentials in frontend environment files.

## Typical workflow

1. Start the backend and frontend.
2. Open VideoVault in your browser.
3. Browse Telegram chats and inspect media in a chat.
4. Select media and add it to the download queue.
5. Wait for downloads to complete.
6. Open **My Video Library** and select **Transcribe** for a downloaded video.
7. Open the transcript.
8. Use the AI assistant to ask questions or generate a summary, study notes, or revision questions.

## Privacy and security

**Never commit:**
- `.env` files or API credentials.
- Telegram `.session` files.
- Downloaded videos, documents, or other private media.
- Generated transcripts containing private or copyrighted material.
- Virtual environments such as `.venv/`.
- Local caches, logs, or machine-specific configuration.

Review `.gitignore` before every push. If a secret was committed, deleting it in a later commit is not enough: revoke or rotate the credential and remove the secret from Git history.

Only download and process media that you have the right to access and use. Follow Telegram's terms and applicable copyright and privacy laws.

## Troubleshooting

### PowerShell blocks virtual-environment activation

Run these commands in the current PowerShell process:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

Do not add an extra closing parenthesis to the command.

### Backend cannot find FFmpeg

Check:

```powershell
ffmpeg -version
```

If the executable is in `tools/`, run this from the project root before starting Uvicorn:

```powershell
$env:PATH = "$PWD\tools;" + $env:PATH
```

### Ollama does not respond

Check that Ollama is running and that the model is available:

```powershell
ollama list
```

If needed:

```powershell
ollama pull llama3.2:1b
```

### Frontend cannot reach the backend

- Confirm the backend is running.
- Open http://127.0.0.1:8000/docs to check the API.
- Confirm the frontend's `VITE_API_BASE_URL` points to the backend.
- Check the browser console and backend terminal for the actual error.

## API overview

The backend includes endpoints for health checks, Telegram chat and media discovery, download creation and management, local AI chat, video listing, transcription jobs, transcription status, and transcript retrieval.

For exact request and response schemas, run the backend and use the generated API documentation at `/docs`. This README avoids duplicating endpoint schemas that may change.

