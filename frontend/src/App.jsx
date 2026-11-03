import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, ArrowDownToLine, Check, CheckCircle2, ChevronRight,
  CircleHelp, Clapperboard, CloudDownload, File, FileText, FolderOpen,
  HardDrive, LayoutDashboard, LoaderCircle, RefreshCw, Search, Settings2,
  ShieldCheck, Sparkles, Video, X
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function formatBytes(value = 0) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function chatKind(chat) {
  if (chat.is_channel) return "Channel";
  if (chat.is_group) return "Group";
  return "Chat";
}
function isVideo(item) {
  return item.is_video || (item.mime_type || "").startsWith("video/");
}

export default function App() {
  const [health, setHealth] = useState("checking");
  const [chats, setChats] = useState([]);
  const [chatSearch, setChatSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState(null);
  // Video intelligence
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [transcriptionJobs, setTranscriptionJobs] = useState({});
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedTranscript, setSelectedTranscript] = useState("");
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState("");
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const [media, setMedia] = useState([]);
  const [mediaSearch, setMediaSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedMediaIds, setSelectedMediaIds] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [limit, setLimit] = useState(100);
  const [jobs, setJobs] = useState([]);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueView, setQueueView] = useState(false);
  const [cancellingJobIds, setCancellingJobIds] = useState([]);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try { const body = await response.json(); detail = body.detail || detail; } catch {}
      throw new Error(detail);
    }
    return response.json();
  }, []);

  const loadChats = useCallback(async () => {
    setLoadingChats(true); setError("");
    try {
      const [healthResult, result] = await Promise.all([
        api("/api/health").catch(() => null),
        api("/api/chats")
      ]);
      setHealth(healthResult ? "connected" : "unknown");
      const rows = Array.isArray(result) ? result : (result.chats || []);
      setChats(rows);
      if (!selectedChat && rows.length) setSelectedChat(rows[0]);
    } catch (e) {
      setHealth("offline"); setError(e.message || "Could not load Telegram chats.");
    } finally { setLoadingChats(false); }
  }, [api, selectedChat]);

  const loadMedia = useCallback(async (chat, requestedLimit = limit) => {
    if (!chat) return;
    setLoadingMedia(true); setError(""); setNotice(""); setSelectedMediaIds([]);
    try {
      const result = await api(`/api/chats/${encodeURIComponent(chat.id)}/media?limit=${requestedLimit}`);
      setMedia(Array.isArray(result.items) ? result.items : []);
      if (!result.items?.length) setNotice(`No supported media found in the ${requestedLimit} messages inspected. Try a larger limit or another chat.`);
    } catch (e) {
      setMedia([]); setError(e.message || "Could not inspect this chat.");
    } finally { setLoadingMedia(false); }
  }, [api, limit]);

  useEffect(() => { loadChats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedChat) loadMedia(selectedChat, limit); }, [selectedChat?.id, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredChats = useMemo(() => chats.filter((chat) =>
    (chat.name || "Unnamed chat").toLowerCase().includes(chatSearch.toLowerCase())
  ), [chats, chatSearch]);

  const filteredMedia = useMemo(() => media.filter((item) => {
    const query = mediaSearch.toLowerCase();
    const matchesText = (item.filename || "").toLowerCase().includes(query) || (item.caption || "").toLowerCase().includes(query);
    const matchesType = typeFilter === "all" || (typeFilter === "videos" ? isVideo(item) : !isVideo(item));
    return matchesText && matchesType;
  }), [media, mediaSearch, typeFilter]);

  const totalBytes = media.reduce((sum, item) => sum + (Number(item.size_bytes) || 0), 0);
  const videoCount = media.filter(isVideo).length;
  const docCount = media.length - videoCount;
  const chosenBytes = media.filter((item) => selectedMediaIds.includes(item.message_id)).reduce((sum, item) => sum + (Number(item.size_bytes) || 0), 0);

  function toggleChatSelection(id) {
    setSelectedChatIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }
  function toggleMediaSelection(id) {
    setSelectedMediaIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }
  function selectVisibleMedia() {
    const ids = filteredMedia.map((item) => item.message_id);
    setSelectedMediaIds((current) => ids.every((id) => current.includes(id))
      ? current.filter((id) => !ids.includes(id))
      : [...new Set([...current, ...ids])]);
  }
  const refreshJobs = useCallback(async () => {
    try {
      const result = await api("/api/downloads");
      setJobs(Array.isArray(result.jobs) ? result.jobs : []);
    } catch (e) {
      setError(`Could not refresh download queue: ${e.message}`);
    }
  }, [api]);

// ==================================
// VIDEO LIBRARY FUNCTIONS
// ==================================

const loadVideos = useCallback(async () => {
  setLoadingVideos(true);
  setTranscriptionError("");

  try {
    const result = await api("/api/videos");
    setVideos(result.videos || []);
  } catch (e) {
    setTranscriptionError(e.message || "Could not load videos.");
  } finally {
    setLoadingVideos(false);
  }
}, [api]);

useEffect(() => {
  loadVideos();
}, [loadVideos]);

  async function startTranscription(video) {
    setTranscriptionError("");
    try {
      const result = await api("/api/videos/transcribe", {
        method: "POST",
        body: JSON.stringify({ video_path: video.path }),
      });
      setTranscriptionJobs((current) => ({
        ...current,
        [video.path]: { jobId: result.job_id, status: result.status || "queued" },
      }));

      let status = result.status || "queued";
      let latestJob = null;
      while (status === "queued" || status === "processing") {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        latestJob = await api(
          `/api/videos/transcriptions/${encodeURIComponent(result.job_id)}`
        );
        status = latestJob.status;
        setTranscriptionJobs((current) => ({
          ...current,
          [video.path]: { ...latestJob, jobId: result.job_id },
        }));
      }

      if (status === "completed") {
        await loadVideos();
      } else if (status === "failed") {
        setTranscriptionError(`Transcription failed: ${latestJob?.error || "Unknown error"}`);
      }
    } catch (e) {
      setTranscriptionJobs((current) => ({
        ...current,
        [video.path]: { ...(current[video.path] || {}), status: "failed", error: e.message },
      }));
      setTranscriptionError(e.message || "Transcription failed.");
    }
  }

  async function openTranscript(video) {
    setSelectedVideo(video);
    setSelectedTranscript("");
    setLoadingTranscript(true);
    setTranscriptionError("");
    try {
      const result = await api(
        `/api/videos/transcripts?video_path=${encodeURIComponent(video.path)}`
      );
      setSelectedTranscript(result.transcript || "");
    } catch (e) {
      setTranscriptionError(e.message || "Could not load transcript.");
    } finally {
      setLoadingTranscript(false);
    }
  }


// Continue with your existing download queue useEffect below

  useEffect(() => {
    refreshJobs();
    const timer = window.setInterval(refreshJobs, 1500);
    return () => window.clearInterval(timer);
  }, [refreshJobs]);

  async function queueMedia(messageIds, label = "selected files") {
    if (!selectedChat) { setError("Choose a Telegram chat first."); return; }
    if (!messageIds.length) { setNotice("Select at least one file first."); return; }
    setQueueBusy(true); setError(""); setNotice("");
    try {
      const result = await api("/api/downloads", {
        method: "POST",
        body: JSON.stringify({ chat_id: Number(selectedChat.id), message_ids: messageIds.slice(0, 100) }),
      });
      await refreshJobs();
      setQueueView(true);
      setNotice(`Added ${result.count ?? result.jobs?.length ?? messageIds.length} ${label} to the download queue.`);
    } catch (e) {
      setError(`Could not queue downloads: ${e.message}`);
    } finally { setQueueBusy(false); }
  }

  function queueSelected() { return queueMedia(selectedMediaIds, "selected file(s)"); }

  function queueAllVideosInScan() {
    const ids = filteredMedia.filter(isVideo).map((item) => item.message_id);
    if (ids.length > 100) setNotice(`This scan contains ${ids.length} videos. The API accepts up to 100 files per request; queueing the first 100 only.`);
    return queueMedia(ids.slice(0, 100), "video(s) from the current scan");
  }

  async function cancelJob(jobId) {
    setCancellingJobIds((current) => [...current, jobId]); setError("");
    try {
      await api(`/api/downloads/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
      await refreshJobs();
    } catch (e) { setError(`Could not cancel download: ${e.message}`); }
    finally { setCancellingJobIds((current) => current.filter((id) => id !== jobId)); }
  }

  function downloadNotReady() { setQueueView(true); refreshJobs(); }

  const jobCounts = useMemo(() => ({
    queued: jobs.filter((job) => job.status === "queued").length,
    downloading: jobs.filter((job) => job.status === "downloading").length,
    completed: jobs.filter((job) => job.status === "completed").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    cancelled: jobs.filter((job) => job.status === "cancelled").length,
  }), [jobs]);

  function jobStatusLabel(status) {
    return ({ queued: "Queued", downloading: "Downloading", completed: "Completed", failed: "Failed", cancelled: "Cancelled" })[status] || status;
  }

  async function sendAIMessage(event) {
    event?.preventDefault();

    const text = aiInput.trim();

    if (!text || aiLoading) {
      return;
    }

    const updatedMessages = [
      ...aiMessages,
      { role: "user", content: text },
    ];

    setAiMessages(updatedMessages);
    setAiInput("");
    setAiLoading(true);
    setAiError("");

    try {
      const result = await api("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            ...(selectedTranscript
              ? [{
                  role: "user",
                  content:
                    "Use this video transcript as reference material. Answer questions based on it. " +
                    "If information is missing, say so. The transcript may contain speech recognition errors.\\n\\n" +
                    selectedTranscript.slice(0, 30000),
                }]
              : []),
            ...updatedMessages.slice(-10),
          ],
        }),
      });

      setAiMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.answer,
        },
      ]);
    } catch (error) {
      setAiError(
        error.message || "Could not generate an AI response."
      );
    } finally {
      setAiLoading(false);
    }
  }

  // Run a prepared video task immediately instead of only filling the chat box.
  async function runVideoPrompt(prompt) {
    if (!selectedTranscript || aiLoading) return;

    const userMessage = { role: "user", content: prompt };
    setAiMessages((current) => [...current, userMessage]);
    setAiInput("");
    setAiLoading(true);
    setAiError("");

    try {
      const result = await api("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "Use the following video transcript as the source. Base the response on it. " +
                "If a detail is not present, say so. The transcript may contain speech-recognition errors.\\n\\n" +
                selectedTranscript.slice(0, 30000),
            },
            ...aiMessages.slice(-8),
            userMessage,
          ],
        }),
      });

      setAiMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer },
      ]);
    } catch (error) {
      setAiError(error.message || "Could not generate the requested video content.");
    } finally {
      setAiLoading(false);
    }
  }



  return (
 
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Clapperboard size={21} strokeWidth={2.2} /></div>
          <div><div className="brand-name">VideoVault</div><div className="brand-sub">TELEGRAM LIBRARY</div></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <button className="nav-item active"><LayoutDashboard size={17} /> Dashboard</button>
        <button className="nav-item" onClick={() => setNotice("Choose a chat on the left to inspect its media.")}><FolderOpen size={17} /> Media library <span className="nav-count">{media.length}</span></button>
        <button className={`nav-item ${queueView ? "active" : ""}`} onClick={downloadNotReady}><CloudDownload size={17} /> Download queue <span className="nav-count">{jobs.filter((job) => ["queued", "downloading"].includes(job.status)).length}</span></button>
        <div className="sidebar-bottom">
          <div className="local-card">
            <div className="local-icon"><ShieldCheck size={17} /></div>
            <div><strong>Local-first privacy</strong><p>Your session and media stay on this device.</p></div>
          </div>
          <div className="sidebar-foot"><span className={`status-dot ${health === "connected" ? "online" : health === "checking" ? "checking" : ""}`} /> API {health === "connected" ? "connected" : health === "checking" ? "checking…" : health === "unknown" ? "reachable" : "offline"}</div>
          <div className="sidebar-version">VIDEOVAULT · LOCAL BUILD</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>Dashboard</strong></div>
          <div className="topbar-right"><span className="local-badge"><span /> Local app</span><button className="icon-button" title="Refresh chats" onClick={loadChats}><RefreshCw size={17} /></button></div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div><div className="eyebrow"><Sparkles size={14} /> YOUR MEDIA, ORGANIZED</div><h1>Telegram media <span>workspace</span></h1><p className="page-description">Find, review, and organize media from your Telegram chats in one place.</p></div>
            <button className="primary-button" onClick={queueSelected} disabled={queueBusy || !selectedMediaIds.length || !selectedChat}><ArrowDownToLine size={17} /> {queueBusy ? "Adding to queue…" : "Download selected"} <span className="button-count">{selectedMediaIds.length}</span></button>
          </section>

          {error && <div className="alert error-alert"><AlertCircle size={18} /><div><strong>Something needs attention</strong><p>{error}</p>{health === "offline" && <span>Start the FastAPI backend in your project terminal, then refresh.</span>}</div><button onClick={() => setError("")}><X size={16} /></button></div>}
          {notice && <div className="alert notice-alert"><CircleHelp size={18} /><p>{notice}</p><button onClick={() => setNotice("")}><X size={16} /></button></div>}

          <section className="stats-grid">
            <StatCard icon={<FolderOpen size={18} />} label="Telegram chats" value={chats.length} detail="Available to explore" />
            <StatCard icon={<Video size={18} />} label="Videos found" value={videoCount} detail="In selected chat scan" accent />
            <StatCard icon={<FileText size={18} />} label="Other media" value={docCount} detail="Documents and files" />
            <StatCard icon={<HardDrive size={18} />} label="Inspected size" value={formatBytes(totalBytes)} detail="Metadata only · not downloaded" />
          </section>
          <section
            className="panel"
            style={{
              marginBottom: "24px",
              padding: "24px",
              borderRadius: "16px",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "18px",
              }}
            >
              <div className="brand-mark">
                <Sparkles size={21} />
              </div>

              <div>
                <h2 style={{ margin: 0 }}>VideoVault AI</h2>

                <p style={{ margin: "5px 0 0", opacity: 0.7 }}>
                  Ask questions about your videos, generate summaries and create study notes locally.
                </p>
              </div>

              <span
                style={{
                  marginLeft: "auto",
                  padding: "6px 10px",
                  borderRadius: "20px",
                  background: "rgba(34, 197, 94, 0.12)",
                  fontSize: "12px",
                }}
              >
                ● Local AI
              </span>
            </div>

            {/* Conversation */}
            <div
              style={{
                minHeight: "100px",
                maxHeight: "320px",
                overflowY: "auto",
                marginBottom: "16px",
                padding: "14px",
                borderRadius: "12px",
                background: "rgba(127, 127, 127, 0.06)",
              }}
            >
              {aiMessages.length === 0 && (
                <div style={{ opacity: 0.7 }}>
                  <p>Hi! I'm your local VideoVault AI assistant.</p>

                  <p>Try asking:</p>

                  <ul>
                    <li>Explain machine learning in simple language.</li>
                    <li>How can I organize my video lectures?</li>
                    <li>Suggest a revision plan for a technical course.</li>
                  </ul>
                </div>
              )}

              {aiMessages.map((message, index) => (
                <div
                  key={`${index}-${message.role}`}
                  style={{
                    marginBottom: "14px",
                    padding: "12px",
                    borderRadius: "10px",
                    background:
                      message.role === "user"
                        ? "rgba(99, 102, 241, 0.12)"
                        : "rgba(127, 127, 127, 0.08)",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    lineHeight: 1.6,
                  }}
                >
                  <strong>
                    {message.role === "user" ? "You" : "VideoVault AI"}
                  </strong>

                  <div style={{ marginTop: "6px" }}>
                    {message.content}
                  </div>
                </div>
              ))}

              {aiLoading && (
                <p style={{ opacity: 0.7 }}>
                  <LoaderCircle
                    size={15}
                    style={{
                      verticalAlign: "middle",
                      marginRight: "8px",
                    }}
                  />
                  AI is generating a response...
                </p>
              )}

              <div aria-live="polite">
                {aiError && (
                  <p style={{ color: "#ef4444" }}>
                    {aiError}
                  </p>
                )}
              </div>
            </div>

            {/* Message input */}
            <form
              onSubmit={sendAIMessage}
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: "10px",
              }}
            >
              <textarea
                value={aiInput}
                onChange={(event) => setAiInput(event.target.value)}
                placeholder="Ask VideoVault AI something..."
                rows={2}
                maxLength={2000}
                disabled={aiLoading}
                style={{
                  flex: 1,
                  minWidth: 0,
                  resize: "vertical",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(127, 127, 127, 0.3)",
                  font: "inherit",
                }}
              />

              <button
                type="submit"
                className="primary-button"
                disabled={aiLoading || !aiInput.trim()}
                style={{ alignSelf: "flex-end" }}
              >
                <Sparkles size={16} />

                {aiLoading ? "Thinking..." : "Ask AI"}
              </button>
            </form>

            <p
              style={{
                marginBottom: 0,
                marginTop: "10px",
                fontSize: "12px",
                opacity: 0.65,
              }}
            >
              Powered by Llama 3.2 1B through Ollama.
              Responses are generated locally.
            </p>
          </section>
          

          <section className="panel" style={{ marginBottom: "24px", padding: "24px" }}>
            <div className="panel-heading">
              <div>
                <div className="section-kicker">LOCAL VIDEO INTELLIGENCE</div>
                <h2>My Video Library</h2>
                <p>Transcribe downloaded videos and explore their content with local AI.</p>
              </div>
              <button className="icon-button bordered" onClick={loadVideos} disabled={loadingVideos} title="Refresh video library">
                <RefreshCw size={16} className={loadingVideos ? "spin" : ""} />
              </button>
            </div>
            {transcriptionError && (
              <div className="alert error-alert">
                <AlertCircle size={18} /><p>{transcriptionError}</p>
                <button onClick={() => setTranscriptionError("")} aria-label="Dismiss error"><X size={16} /></button>
              </div>
            )}
            {loadingVideos ? (
              <div className="empty-state"><LoaderCircle className="spin" size={22} /><p>Loading downloaded videos...</p></div>
            ) : videos.length === 0 ? (
              <div className="empty-state"><Video size={24} /><strong>No downloaded videos found</strong><p>Download a video from Telegram to see it here.</p></div>
            ) : (
              <div className="queue-list">
                {videos.map((video) => {
                  const job = transcriptionJobs[video.path];
                  const status = job?.status;
                  const ready = video.transcript_exists || status === "completed";
                  const busy = status === "queued" || status === "processing";
                  return (
                    <div className="queue-row" key={video.path}>
                      <div className="queue-file-icon"><Video size={18} /></div>
                      <div className="queue-job-main">
                        <div className="queue-job-top">
                          <strong title={video.name}>{video.name}</strong>
                          <span className={`job-status ${
                            ready ? "status-completed" : status === "failed" ? "status-failed" : busy ? "status-downloading" : "status-queued"
                          }`}>
                            {ready ? "Transcript ready" : status === "processing" ? "Transcribing" : status === "queued" ? "Queued" : status === "failed" ? "Failed" : "Not transcribed"}
                          </span>
                        </div>
                        <div className="queue-job-meta">
                          <span>{formatBytes(video.size_bytes)}</span><span title={video.path}>{video.path}</span>
                        </div>
                        {job?.error && <div className="queue-error">{job.error}</div>}
                      </div>
                      {ready ? (
                        <button className="text-button" onClick={() => openTranscript(video)}><FileText size={15} /> View transcript</button>
                      ) : (
                        <button className="primary-button" disabled={busy} onClick={() => startTranscription(video)}>
                          {busy ? "Processing..." : status === "failed" ? "Retry" : "Transcribe"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {selectedVideo && (
              <div style={{ marginTop: "24px" }}>
                <div className="panel-heading">
                  <div><div className="section-kicker">VIDEO TRANSCRIPT</div><h2>{selectedVideo.name}</h2>
                    <p>{selectedTranscript.length.toLocaleString()} characters</p></div>
                  <button className="icon-button bordered" onClick={() => { setSelectedVideo(null); setSelectedTranscript(""); }} title="Close transcript"><X size={16} /></button>
                </div>
                {loadingTranscript ? (
                  <div className="empty-state"><LoaderCircle className="spin" size={20} /><p>Loading transcript...</p></div>
                ) : (
                  <>
                    <div style={{
                      maxHeight: "350px", overflowY: "auto", padding: "16px",
                      borderRadius: "12px", background: "rgba(127,127,127,0.08)",
                      whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7,
                    }}>{selectedTranscript || "No transcript content found."}</div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                      <button className="primary-button" disabled={!selectedTranscript || aiLoading}
                        onClick={() => runVideoPrompt("Summarize this video transcript in beginner-friendly Hinglish. Include the main topics, important facts, and a concise conclusion.")}>
                        <Sparkles size={15} /> Prepare summary prompt
                      </button>
                      <button className="text-button" disabled={!selectedTranscript || aiLoading}
                        onClick={() => runVideoPrompt("Create detailed, structured study notes from this video transcript in beginner-friendly Hinglish. Use clear headings, explanations, and bullet points.")}>
                        Prepare study notes prompt
                      </button>
                      <button className="text-button" disabled={!selectedTranscript || aiLoading}
                        onClick={() => runVideoPrompt("Create 10 important revision questions and their answers based only on this video transcript. Include a mix of conceptual and factual questions.")}>
                        Prepare revision questions
                      </button>
                    </div>
                    <p style={{ fontSize: "12px", opacity: 0.65, marginBottom: 0 }}>
                      Click any action to generate its result directly with your local AI. Keep this video transcript open while generating.
                    </p>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="library-layout">
            <div className="panel chats-panel">
              <div className="panel-heading"><div><h2>Telegram chats</h2><p>Select a chat to inspect its media</p></div><span className="count-pill">{chats.length}</span></div>
              <div className="search-box"><Search size={16} /><input value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} placeholder="Search chats…" /><kbd>⌕</kbd></div>
              <div className="chat-list">
                {loadingChats && <div className="empty-state"><LoaderCircle className="spin" size={22} /><p>Loading Telegram chats…</p></div>}
                {!loadingChats && filteredChats.map((chat) => {
                  const active = selectedChat?.id === chat.id;
                  return <div className={`chat-row ${active ? "selected" : ""}`} key={chat.id}>
                    <button className="chat-main" onClick={() => setSelectedChat(chat)}>
                      <div className={`chat-avatar avatar-${Math.abs(Number(chat.id) || 0) % 5}`}>{(chat.name || "?").trim().charAt(0).toUpperCase()}</div>
                      <div className="chat-copy"><strong title={chat.name}>{chat.name || "Unnamed chat"}</strong><span>{chatKind(chat)} · {String(chat.id)}</span></div>
                    </button>
                    <input aria-label={`Select ${chat.name} for batch`} className="check-input" type="checkbox" checked={selectedChatIds.includes(chat.id)} onChange={() => toggleChatSelection(chat.id)} title="Select for batch" />
                  </div>;
                })}
                {!loadingChats && !filteredChats.length && <div className="empty-state"><Search size={22} /><p>No chats match your search.</p></div>}
              </div>
              <div className="panel-footer"><span>{selectedChatIds.length} selected for batch</span><button className="text-button" onClick={() => setNotice(selectedChatIds.length ? `${selectedChatIds.length} chats selected. Multi-chat scanning will be connected with the download queue in the next build.` : "Tick the checkboxes beside chats to select multiple.")}>Batch options <ChevronRight size={14} /></button></div>
            </div>

            <div className="panel media-panel">
              <div className="panel-heading media-heading"><div><div className="section-kicker">MEDIA EXPLORER</div><h2>{selectedChat?.name || "Choose a chat"}</h2><p>{selectedChat ? `${chatKind(selectedChat)} · ${media.length} discovered items` : "Select a Telegram chat to get started"}</p></div><button className="icon-button bordered" onClick={() => selectedChat && loadMedia(selectedChat, limit)} title="Refresh media" disabled={!selectedChat || loadingMedia}><RefreshCw size={16} className={loadingMedia ? "spin" : ""} /></button></div>
              <div className="media-toolbar">
                <div className="search-box media-search"><Search size={16} /><input value={mediaSearch} onChange={(e) => setMediaSearch(e.target.value)} placeholder="Search filenames or captions…" /></div>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter media type"><option value="all">All media</option><option value="videos">Videos only</option><option value="documents">Documents & other</option></select>
                <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} aria-label="Messages to inspect"><option value={10}>Last 10</option><option value={100}>Last 100</option><option value={500}>Last 500</option><option value={1000}>Last 1,000</option></select>
              </div>
              <div className="table-wrap">
                <table className="media-table">
                  <thead><tr><th><input type="checkbox" className="check-input" aria-label="Select all visible media" checked={filteredMedia.length > 0 && filteredMedia.every((item) => selectedMediaIds.includes(item.message_id))} onChange={selectVisibleMedia} /></th><th>FILE</th><th>TYPE</th><th>SIZE</th><th>MESSAGE DATE</th></tr></thead>
                  <tbody>
                    {loadingMedia && <tr><td colSpan="5"><div className="empty-state"><LoaderCircle className="spin" size={22} /><p>Inspecting messages… no files are being downloaded.</p></div></td></tr>}
                    {!loadingMedia && filteredMedia.map((item) => {
                      const video = isVideo(item);
                      return <tr key={`${item.chat_id}-${item.message_id}`}>
                        <td><input className="check-input" type="checkbox" checked={selectedMediaIds.includes(item.message_id)} onChange={() => toggleMediaSelection(item.message_id)} aria-label={`Select ${item.filename}`} /></td>
                        <td><div className="file-cell"><div className={`file-icon ${video ? "video-file" : "doc-file"}`}>{video ? <Video size={17} /> : <FileText size={17} />}</div><div className="file-info"><strong title={item.filename}>{item.filename || `Telegram media ${item.message_id}`}</strong><span>{item.caption ? item.caption.replace(/\s+/g, " ").slice(0, 86) : `Message #${item.message_id}`}</span></div></div></td>
                        <td><span className={`type-badge ${video ? "video-type" : "doc-type"}`}>{video ? "Video" : (item.mime_type || "File").split("/").pop().toUpperCase()}</span></td>
                        <td className="size-cell">{formatBytes(item.size_bytes)}</td>
                        <td className="date-cell">{formatDate(item.date)}</td>
                      </tr>;
                    })}
                    {!loadingMedia && !filteredMedia.length && <tr><td colSpan="5"><div className="empty-state"><File size={24} /><strong>{media.length ? "No matching files" : "No media to show yet"}</strong><p>{media.length ? "Try changing your search or filters." : "Choose a chat, or increase the message scan limit."}</p></div></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="panel-footer media-footer"><span>Showing {filteredMedia.length} of {media.length} discovered items</span><div><span className="selection-total">{selectedMediaIds.length} selected · {formatBytes(chosenBytes)}</span><button className="text-button" onClick={queueSelected} disabled={queueBusy || !selectedMediaIds.length}>{queueBusy ? "Adding…" : "Add to queue"} <ChevronRight size={14} /></button></div></div>
            </div>
          </section>
          <section className="panel queue-panel">
            <div className="panel-heading">
              <div><div className="section-kicker">DOWNLOAD MANAGER</div><h2>Download queue</h2><p>Updates automatically · maximum two simultaneous downloads</p></div>
              <button className="icon-button bordered" onClick={refreshJobs} title="Refresh download queue"><RefreshCw size={16} /></button>
            </div>
            <div className="queue-summary">
              <span>Queued <strong>{jobCounts.queued}</strong></span><span>Downloading <strong>{jobCounts.downloading}</strong></span><span>Completed <strong>{jobCounts.completed}</strong></span><span>Failed <strong>{jobCounts.failed}</strong></span><span>Cancelled <strong>{jobCounts.cancelled}</strong></span>
              <button className="text-button" onClick={queueAllVideosInScan} disabled={queueBusy || !selectedChat || !filteredMedia.some(isVideo)}><CloudDownload size={14} /> Queue videos in current scan</button>
            </div>
            {!jobs.length ? <div className="empty-state"><CloudDownload size={23} /><strong>No downloads queued</strong><p>Select files above and choose Download selected.</p></div> : (
              <div className="queue-list">
                {[...jobs].reverse().map((job) => (
                  <div className="queue-row" key={job.id}>
                    <div className="queue-file-icon">{job.status === "completed" ? <CheckCircle2 size={17} /> : job.status === "failed" ? <AlertCircle size={17} /> : <Video size={17} />}</div>
                    <div className="queue-job-main">
                      <div className="queue-job-top"><strong title={job.filename}>{job.filename}</strong><span className={`job-status status-${job.status}`}>{jobStatusLabel(job.status)}</span></div>
                      <div className="queue-progress-track"><div className={`queue-progress-fill ${job.status === "failed" ? "progress-failed" : ""}`} style={{ width: `${Math.max(0, Math.min(100, Number(job.progress) || 0))}%` }} /></div>
                      <div className="queue-job-meta"><span>{formatBytes(job.downloaded_bytes)} / {formatBytes(job.size_bytes)} · {(Number(job.progress) || 0).toFixed(1)}%</span><span>{job.status === "downloading" ? `${formatBytes(job.speed_bytes_per_second)}/s` : job.path || ""}</span></div>
                      {job.error && <div className="queue-error">{job.error}</div>}
                    </div>
                    {["queued", "downloading"].includes(job.status) && <button className="cancel-button" onClick={() => cancelJob(job.id)} disabled={cancellingJobIds.includes(job.id)}>{cancellingJobIds.includes(job.id) ? "Stopping…" : "Cancel"}</button>}
                  </div>
                ))}
              </div>
            )}
          </section>
          <footer className="page-footer"><span><ShieldCheck size={14} /> Local-first by design</span><span><Activity size={14} /> Telegram downloads enabled · local storage</span><span>VideoVault v0.2</span></footer>
        </div>
      </main>
    </div>
  );
}


function StatCard({ icon, label, value, detail, accent }) {
  return <div className="stat-card"><div className={`stat-icon ${accent ? "accent" : ""}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}