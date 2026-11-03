<div align="center">

# 🎬 VideoVault

### Your Telegram media library, powered by local AI.

**Download · Organize · Transcribe · Understand**

VideoVault is a local-first media workspace that brings Telegram media discovery and downloading together with AI-powered video transcription and transcript-based assistance.

Run speech-to-text with Whisper and interact with your video transcripts through Ollama—without depending on a paid hosted AI API for these local AI workflows.

</div>

---

## ✨ What is VideoVault?

Videos often contain useful information, but finding, revisiting, and extracting that information can be difficult. VideoVault helps turn downloaded Telegram videos into searchable, readable learning material.

It combines three workflows in one application:

1. **Telegram media management** — browse chats, inspect shared media, and manage downloads.
2. **Video transcription** — convert the audio of downloaded videos into text using Whisper.
3. **Local AI assistance** — use a locally running Ollama model to summarize transcripts, create study notes, generate revision questions, and answer transcript-based questions.

VideoVault is currently designed as a local development application for Windows.

## 🚀 Features

### 1. Telegram media workspace

- Connect to Telegram using your own Telegram API credentials.
- Browse available chats, groups, and channels.
- Inspect media shared in a selected chat.
- Search filenames and captions.
- Filter discovered items by media type.
- Select individual files or videos for download.

### 2. Download manager

- Add selected Telegram media to a download queue.
- Monitor queued, downloading, completed, failed, and cancelled jobs.
- View download progress and transfer speed.
- Cancel eligible downloads.
- Refresh the queue to see updated job states.

### 3. Local video library

- Browse videos downloaded to the configured local downloads directory.
- Start transcription for a downloaded video.
- Monitor transcription job status.
- Retry a failed transcription.
- Open and read the generated transcript.

### 4. Whisper-powered transcription

- Convert video speech into text using OpenAI Whisper.
- Process media locally on your machine.
- Save transcript text alongside its source video, according to the current backend implementation.

Transcription speed depends on video duration, selected Whisper model, CPU/GPU availability, and system resources.

### 5. Local AI assistant

With Ollama running locally, VideoVault can use transcript context to help you:

- Generate video summaries.
- Create structured study notes.
- Generate revision questions and answers.
- Ask questions about the currently opened transcript.
- Explore concepts covered in a lecture or video.

The current development setup uses `llama3.2:1b`. You can change the model in the backend configuration if the application is configured to support it.

> **Important:** AI responses depend on transcript quality and the capabilities of the selected local model. Speech recognition mistakes can affect generated answers. Verify important information against the original video.

---

## 🧰 Technology stack

| Area | Technology |
|---|---|
| Frontend | React, Vite, JavaScript |
| UI icons | Lucide React |
| Backend | Python, FastAPI, Uvicorn |
| Telegram integration | Telethon |
| Speech-to-text | OpenAI Whisper |
| Local LLM runtime | Ollama |
| Current local model | Llama 3.2 1B (`llama3.2:1b`) |
| Media decoding | FFmpeg |
| Frontend/backend communication | REST API, JSON |

## 🏗️ High-level architecture

```text
                    ┌──────────────────────────┐
                    │       React + Vite       │
                    │       VideoVault UI      │
                    └────────────┬─────────────┘
                                 │ HTTP / JSON
                                 ▼
                    ┌──────────────────────────┐
                    │       FastAPI API        │
                    │       Python backend     │
                    └──────┬─────────┬─────────┘
                           │         │
                ┌──────────┘         └──────────────┐
                ▼                                   ▼
      ┌──────────────────┐                ┌──────────────────┐
      │ Telegram service │                │ Download manager │
      │     Telethon     │                │                  │
      └────────┬─────────┘                └────────┬─────────┘
               │                                   │
               └─────────────────┬─────────────────┘
                                 ▼
                       ┌─────────────────┐
                       │ Local downloads │
                       │  videos / media │
                       └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Whisper + FFmpeg│
                       │  Transcription │
                       └────────┬────────┘
                                │ transcript
                                ▼
                       ┌─────────────────┐
                       │ FastAPI AI route│
                       └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Ollama + LLM    │
                       │ Local inference │
                       └─────────────────┘
```

## 📁 Project structure

The following is a conceptual view of the project. Some service files may vary as development continues.

```text
VideoVault/
│
├── backend/
│   ├── main.py
│   ├── telegram_service.py
│   ├── download_manager.py
│   └── services/
│       └── ...                  # Transcription and supporting services
│
├── frontend/
│   ├── src/
│   │   └── App.jsx
│   ├── package.json
│   └── ...
│
├── downloads/                   # Local downloaded media; not committed
├── tools/                       # Local tools such as FFmpeg; not committed
├── .env                         # Local credentials; not committed
├── .gitignore
└── README.md
```

---

## 💻 Getting started (Windows)

### Prerequisites

Install the following before setting up the project:

- **Git** — [Download Git](https://git-scm.com/downloads)
- **Python 3.12** — [Download Python](https://www.python.org/downloads/)
- **Node.js (LTS)** — [Download Node.js](https://nodejs.org/)
- **Ollama** — [Download Ollama](https://ollama.com/)
- **FFmpeg** — [FFmpeg download page](https://ffmpeg.org/download.html)
- A Telegram account and your own Telegram API credentials from [my.telegram.org](https://my.telegram.org/)

The commands below use Windows PowerShell.

### 1. Clone the repository

```powershell
git clone https://github.com/Printakhil/VideoVault.git
cd VideoVault
```

If you fork or clone the project under another account, use your repository URL instead.

### 2. Create a Python virtual environment

From the project root:

```powershell
py -3.12 -m venv .venv
```

Activate it:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

The terminal prompt should now begin with `(.venv)`.

### 3. Install backend dependencies

If a `requirements.txt` is included in the repository:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If the repository does not contain `requirements.txt`, install the backend dependencies specified by the project before starting the API. A reproducible dependency file should be committed with the project.

### 4. Install frontend dependencies

Open a terminal in the frontend directory:

```powershell
cd frontend
npm install
```

Return to the project root when finished:

```powershell
cd ..
```

### 5. Configure Telegram

Create a local `.env` file in the project root and add the Telegram configuration variables expected by `backend/telegram_service.py`.

Get your own API ID and API hash from:

**https://my.telegram.org/**

Use the exact variable names read by the backend source code. Do not guess variable names or paste credentials into source files.

On the first connection, Telegram may require your phone number, login code, or additional verification.

### 6. Install the local Ollama model

Install and launch Ollama, then pull the model used in the current development setup:

```powershell
ollama pull llama3.2:1b
```

Ollama normally exposes its local API at:

```text
http://127.0.0.1:11434
```

Ensure the model name and Ollama endpoint in the backend configuration match your local installation.

### 7. Configure FFmpeg

Whisper uses FFmpeg to read audio from video files.

Install FFmpeg and ensure `ffmpeg` is available from PowerShell. If the project uses a local executable at `tools\ffmpeg.exe`, add that folder to the current terminal's PATH from the project root:

```powershell
$env:PATH = "$PWD\tools;" + $env:PATH
```

Verify FFmpeg:

```powershell
ffmpeg -version
```

This PATH update applies to the current PowerShell session only.

### 8. Start the backend

Open the first PowerShell terminal at the project root:

```powershell
cd path\to\VideoVault
.\.venv\Scripts\Activate.ps1
$env:PATH = "$PWD\tools;" + $env:PATH
python -m uvicorn backend.main:app --reload
```

The backend should be available at:

- API: http://127.0.0.1:8000
- Interactive API documentation: http://127.0.0.1:8000/docs

Keep this terminal open.

### 9. Start the frontend

Open a **second** PowerShell terminal:

```powershell
cd path\to\VideoVault\frontend
npm run dev
```

Open the local URL printed by Vite. In the current development setup, it is:

**http://127.0.0.1:5173**

Keep both terminals running while using VideoVault.

---

## 🧭 How to use VideoVault

### Download media from Telegram

1. Start the backend and frontend.
2. Open VideoVault in your browser.
3. Wait for Telegram chats to load.
4. Select a chat to inspect its media.
5. Search or filter the discovered items.
6. Select the files you want.
7. Add them to the download queue.
8. Follow their progress in the Download Manager.

### Transcribe a downloaded video

1. Open **My Video Library**.
2. Find the downloaded video.
3. Select **Transcribe**.
4. Wait for the transcription job to finish.
5. Select **View transcript** to read the generated text.

### Use the local AI assistant

1. Open a video's transcript.
2. Choose a supported action, such as generating a summary, study notes, or revision questions.
3. VideoVault sends the transcript context and request to the backend AI endpoint.
4. The backend communicates with your local Ollama model.
5. Review the response in the AI assistant.

You can also type your own question about the currently opened transcript.

---

## 🔌 Backend API

The FastAPI application currently provides API groups for:

| Area | Purpose |
|---|---|
| Health | Check backend availability |
| Telegram chats | Retrieve available chats |
| Telegram media | Inspect media in a selected chat |
| Downloads | Create and inspect download jobs, cancel jobs, and view queue statistics |
| AI chat | Send messages to the locally configured Ollama model |
| Video library | List locally downloaded videos |
| Transcription | Start transcription and inspect job status |
| Transcripts | Retrieve generated transcript text |

For the exact routes, request schemas, and response examples, start the backend and open:

**http://127.0.0.1:8000/docs**

The interactive API documentation is the source of truth for the current implementation.

---

## 🔐 Privacy and security

VideoVault is designed for local-first workflows. However, **local-first does not mean that every file is safe to publish**.

Never commit or publicly share:

- `.env` files.
- Telegram API credentials or login codes.
- Telegram `.session` files.
- Downloaded private videos, documents, or other media.
- Transcripts containing private or copyrighted content.
- `.venv/` or `node_modules/`.
- Local executables, caches, logs, or machine-specific files unless intentionally licensed and required.

Before every Git commit, inspect the staged changes:

```powershell
git status
git diff --cached --stat
```

If a credential is accidentally pushed, revoke or rotate it immediately. Removing it in a later commit does not remove it from Git history.

Only access, download, and process content you are authorized to use. Follow Telegram's terms and applicable copyright and privacy laws.

---

## 🛠️ Troubleshooting

### PowerShell does not allow virtual environment activation

Run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

Do not add an extra closing parenthesis to the command.

### `ffmpeg` is not recognized

Check that FFmpeg is installed and available on PATH:

```powershell
ffmpeg -version
```

If using the project's local `tools` directory, run this from the project root:

```powershell
$env:PATH = "$PWD\tools;" + $env:PATH
```

### Ollama is unavailable or the model is missing

Check the installed models:

```powershell
ollama list
```

Pull the current model if needed:

```powershell
ollama pull llama3.2:1b
```

Confirm Ollama is running before testing the AI assistant.

### Frontend cannot connect to the backend

- Confirm the backend terminal is still running.
- Open http://127.0.0.1:8000/docs.
- Confirm the frontend API base URL points to the backend.
- Inspect the browser developer console and backend terminal for the actual error.

### Transcription fails

- Confirm the source video exists in the configured downloads directory.
- Confirm FFmpeg works from the backend terminal.
- Confirm the Python environment has the required Whisper and PyTorch packages.
- Check the transcription job's error message and backend logs.
- Allow enough time for long videos; CPU transcription can take a while.

---

## 🗺️ Roadmap

Potential future improvements:

- Semantic search across video transcripts.
- Automatic chapter detection with timestamps.
- Searchable transcript knowledge base.
- Question answering across multiple videos.
- Export summaries and study notes to PDF or Markdown.
- Improved transcription progress and job recovery.
- More model and language options.
- Better transcript organization and metadata.

These are planned directions, not claims that the features are already implemented.

## 🤝 Contributing

Suggestions, bug reports, and improvements are welcome.

Before opening a pull request:

1. Test the backend locally.
2. Test the frontend locally.
3. Verify Telegram chat and media browsing.
4. Verify download queue operations.
5. Verify video transcription.
6. Verify the local AI workflow.
7. Check that no credentials, sessions, private media, or generated personal data are included.

## License

VideoVault is licensed under the MIT License.

Copyright (c) 2026 Akhil.

See the [LICENSE](LICENSE) file for details.
---

<div align="center">

**VideoVault — Make your media library useful.**

Built with React, FastAPI, Whisper, and Ollama.

</div>
