import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VideoFeed from "./components/VideoFeed.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import EndInterviewModal from "./components/EndInterviewModal.jsx";
import FeedbackPanel from "./components/FeedbackPanel.jsx";
import SessionSummary from "./components/SessionSummary.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import PrecheckScreen from "./components/PrecheckScreen.jsx";
import OnboardingTutorial from "./components/OnboardingTutorial.jsx";
import PastSessionsList from "./components/PastSessionsList.jsx";
import PublicResults from "./components/PublicResults.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { authedFetch, signOut } from "./lib/supabase.js";
import { createBodyLanguageAnalyzer } from "./utils/bodyLanguage.js";
import { computeSpeechMetrics } from "./utils/speechMetrics.js";
import { exportSessionPDF } from "./utils/pdfExport.js";
import "./styles/theme.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const ROLES = ["Software Engineer", "AI Engineer", "Data Scientist", "Product Manager", "Product Designer"];
const SENIORITY = ["Junior", "Mid", "Senior", "Staff", "Lead"];
const TONES = ["Professional", "Friendly", "Direct", "Supportive"];
const FOCUS_TAGS = ["System Design", "Algorithms", "Product Sense", "Culture"];

export default function App() {
  // Public share route: /s/<token> renders a sanitized, no-auth results page.
  // Has to run before useAuth so visitors don't get bounced to the login screen.
  const shareToken = (() => {
    const m = typeof window !== "undefined" && window.location.pathname.match(/^\/s\/([\w-]+)\/?$/);
    return m ? m[1] : null;
  })();
  if (shareToken) {
    return <PublicResults token={shareToken} />;
  }

  const { user, loading: authLoading, isRequired: authRequired } = useAuth();
  const [candidateName, setCandidateName] = useState("");
  const [status, setStatus] = useState("setup"); // setup | precheck | interview | results
  const [viewingPastSession, setViewingPastSession] = useState(null); // a session object
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [lastTurn, setLastTurn] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [role, setRole] = useState("Software Engineer");
  const [seniority, setSeniority] = useState("Mid");
  const [tone, setTone] = useState("Professional");
  const [focus, setFocus] = useState(["System Design"]);
  const [jdText, setJdText] = useState("");
  const [resumeStatus, setResumeStatus] = useState("idle");
  const [resumeFileName, setResumeFileName] = useState("");

  const [roomUrl, setRoomUrl] = useState("");
  const [avatarMessage, setAvatarMessage] = useState("");
  const [health, setHealth] = useState({ openai: true, tavus: true });
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [startTime, setStartTime] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [bodyLanguage, setBodyLanguage] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);

  const analyzerRef = useRef(null);
  const ttsAudioRef = useRef(null);
  const streamAbortRef = useRef(null);

  useEffect(() => {
    authedFetch(`${API}/health`)
      .then((r) => r.json())
      .then((j) => setHealth({ openai: !!j.openai, tavus: !!j.tavus }))
      .catch(() => setHealth({ openai: false, tavus: false }));
  }, []);

  // Pre-fill the candidate's name from their Supabase profile (when signed in
  // with Google etc). Magic-link users have no profile name → leave the field
  // blank so they type a real one. We deliberately don't fall back to the
  // email username — "sirilsrinivas1014" is not a name.
  useEffect(() => {
    if (user && !candidateName) {
      const name =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        "";
      if (name) setCandidateName(name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Pre-fill the entire setup form from the user's last interview (if any)
  useEffect(() => {
    if (!user) return;
    authedFetch(`${API}/profile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        if (p.name && !candidateName) setCandidateName(p.name);
        if (p.role)       setRole(p.role);
        if (p.seniority)  setSeniority(p.seniority);
        if (p.tone)       setTone(p.tone);
        if (Array.isArray(p.focus) && p.focus.length) setFocus(p.focus);
        if (p.jd_text)    setJdText(p.jd_text);
        if (p.resume_text) {
          setResumeStatus("uploaded");
          setResumeFileName("(saved from last session)");
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const transcript = useMemo(
    () => messages.map((m) => `${m.role}: ${m.text}`).join("\n"),
    [messages]
  );

  // Speech metrics — computed every render so it's stable across status changes
  const durationSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
  const speech = useMemo(() => {
    const texts = messages.filter((m) => m.role === "Candidate").map((m) => m.text);
    return computeSpeechMetrics(texts, durationSeconds);
  }, [messages, durationSeconds]);

  const speakViaBrowser = useCallback((text) => {
    if (!("speechSynthesis" in window)) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /Samantha|Karen|Serena|Google US English/i.test(v.name)) ||
        voices.find((v) => /en[-_]US/i.test(v.lang));
      if (preferred) utter.voice = preferred;
      window.speechSynthesis.speak(utter);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = pick;
    } else {
      pick();
    }
  }, []);

  const speakAi = useCallback(async (text) => {
    if (!text || roomUrl) return;
    try { if (ttsAudioRef.current) ttsAudioRef.current.pause(); } catch {}
    try {
      const r = await authedFetch(`${API}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "alloy" }),
      });
      if (r.ok && r.status !== 204) {
        const blob = await r.blob();
        if (blob.size >= 200) {
          const url = URL.createObjectURL(blob);
          const a = new Audio(url);
          ttsAudioRef.current = a;
          a.onended = () => URL.revokeObjectURL(url);
          await a.play();
          return;
        }
      }
    } catch (e) {
      console.warn("OpenAI TTS failed, falling back to browser voice:", e);
    }
    speakViaBrowser(text);
  }, [roomUrl, speakViaBrowser]);

  const uploadResume = async (file) => {
    try {
      const fd = new FormData();
      fd.append("candidate", candidateName || "Candidate");
      fd.append("file", file);
      const res = await authedFetch(`${API}/upload_resume`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResumeStatus("uploaded");
      setResumeFileName(file.name);
    } catch (e) {
      console.error(e);
      setResumeStatus("error");
    }
  };

  const goToPrecheck = () => {
    if (!candidateName.trim()) { alert("Please enter your name before starting."); return; }
    setStatus("precheck");
  };

  const startInterview = async () => {
    setStatus("interview");
    setStartTime(Date.now());
    setMessages([]);
    setLastTurn(null);
    setBodyLanguage(null);

    try {
      const res = await authedFetch(`${API}/start_interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: candidateName, role, seniority, tone, focus, description: jdText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const q = json.first_question || `Hi ${candidateName.split(" ")[0] || "there"}! Could you walk me through a project you're proud of?`;
      setMessages([{ role: "Agent", text: q }]);
      setSessionId(json.session_id);
      speakAi(q);
    } catch (e) {
      setMessages([{ role: "Agent", text: `Error starting: ${e?.message}` }]);
    }

    try {
      const r2 = await authedFetch(`${API}/avatar/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: candidateName }),
      });
      const j2 = await r2.json();
      setRoomUrl(j2?.room_url || "");
      if (j2?.mocked) setAvatarMessage(j2?.message || "Avatar disabled.");
    } catch (e) {
      console.warn("Avatar start failed:", e);
    }
  };

  const sendMessage = async (msg) => {
    // Cancel any in-flight stream from a previous turn that hasn't finished
    try { streamAbortRef.current?.abort(); } catch {}
    streamAbortRef.current = new AbortController();
    const signal = streamAbortRef.current.signal;

    // Push the candidate's turn + an empty agent bubble we'll stream into
    setMessages((m) => [...m, { role: "Candidate", text: msg }, { role: "Agent", text: "", streaming: true }]);
    setPending(true);

    let streamedText = "";
    let finalPayload = null;

    try {
      const res = await authedFetch(`${API}/answer_stream`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ candidate: candidateName, response: msg }),
        signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const updateLastAgent = (text, streaming) => {
        setMessages((m) => {
          const copy = [...m];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "Agent") {
              copy[i] = { ...copy[i], text, streaming };
              break;
            }
          }
          return copy;
        });
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let payload;
          try { payload = JSON.parse(line.slice(6)); } catch { continue; }

          if (payload.chunk) {
            streamedText += payload.chunk;
            updateLastAgent(streamedText, true);
          } else if (payload.complete) {
            finalPayload = payload;
            updateLastAgent(payload.followup || streamedText, false);
          } else if (payload.error) {
            updateLastAgent(`Error: ${payload.error}`, false);
          }
        }
      }

      if (finalPayload) {
        setLastTurn({
          followup: finalPayload.followup,
          feedback: finalPayload.feedback,
          rewrite: finalPayload.rewrite,
          scores: finalPayload.scores,
        });
        speakAi(finalPayload.followup);
      } else if (streamedText) {
        // Stream ended without a complete event — still try to speak what we got
        speakAi(streamedText);
      }
    } catch (e) {
      // User intentionally aborted (e.g. clicked End Interview) — silent drop
      if (e?.name === "AbortError") {
        setMessages((m) => {
          // Strip the empty streaming agent bubble so the transcript stays clean
          const copy = [...m];
          if (copy.length && copy[copy.length - 1].role === "Agent" && !copy[copy.length - 1].text) {
            copy.pop();
          }
          return copy;
        });
        return;
      }
      setMessages((m) => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "Agent") {
            copy[i] = { ...copy[i], text: `Error: ${e?.message}`, streaming: false };
            break;
          }
        }
        return copy;
      });
    } finally {
      setPending(false);
    }
  };

  const handleLocalStream = async (stream) => {
    if (!stream || analyzerRef.current) return;
    const analyzer = await createBodyLanguageAnalyzer();
    analyzerRef.current = analyzer;
    const v = document.createElement("video");
    v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;
    await v.play().catch(() => {});
    analyzer.start(v);
  };

  const endInterview = async () => {
    if (!confirm("End the interview and see your results?")) return;
    // Kill any in-flight LLM stream + speech so no more tokens appear
    try { streamAbortRef.current?.abort(); } catch {}
    try { ttsAudioRef.current?.pause(); } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
    setPending(false);
    await confirmEnd();
  };

  const confirmEnd = async () => {
    let bl = null;
    try { bl = analyzerRef.current?.stop?.() || null; } catch {}
    analyzerRef.current = null;
    setBodyLanguage(bl);
    try {
      await authedFetch(`${API}/end_interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: candidateName, body_language: bl || {} }),
      });
    } catch {}
    setStatus("results");
    setModalOpen(false);
    setHistoryKey((k) => k + 1);
  };

  const toggleFocus = (tag) =>
    setFocus((f) => (f.includes(tag) ? f.filter((t) => t !== tag) : [...f, tag]));

  // ─── AUTH GATE (prod only) ───
  if (authRequired && authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--gray-500)" }}>
        Loading…
      </div>
    );
  }
  if (authRequired && !user) {
    return <LoginScreen />;
  }

  // ─── PRECHECK SCREEN ───
  if (status === "precheck") {
    return (
      <PrecheckScreen
        onBack={() => setStatus("setup")}
        onPass={() => startInterview()}
      />
    );
  }

  // ─── PAST SESSION VIEWER ───
  // (Renders inline; lets the user inspect any prior session in full)
  // — Handled later inside the results view via setLastTurn + setMessages overrides.

  // ─── SETUP VIEW ───
  if (status === "setup") {
    return (
      <div>
        <OnboardingTutorial />
        <nav className="navbar">
          <div className="navbar-brand">
            <div className="navbar-brand-icon">G</div>
            Greenroom
          </div>
          {authRequired && user && (
            <div className="navbar-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--gray-600)" }}>
                {user.email}
              </span>
              <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
            </div>
          )}
        </nav>

        <div className="setup-page animate-in">
          <div className="setup-header" style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 999,
              background: "rgba(232, 90, 79, 0.10)", color: "var(--blue-600)",
              fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
              textTransform: "uppercase", marginBottom: 18,
              border: "1px solid rgba(232, 90, 79, 0.20)",
            }}>
              <span>✦</span> Practice like the real thing
            </div>
            <h1 style={{
              fontSize: "3rem",
              background: "linear-gradient(135deg, var(--gray-900), var(--blue-600))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text", marginBottom: 14,
            }}>
              Step into the Greenroom.
            </h1>
            <p style={{ fontSize: "1.0625rem", color: "var(--gray-500)", maxWidth: 560, margin: "0 auto", lineHeight: 1.55 }}>
              Performers warm up in the greenroom before they go onstage. Practice with a face-to-face AI interviewer that asks tough follow-ups, scores your answers in real time, and shows you the exact words to use next time.
            </p>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 18,
              justifyContent: "center", marginTop: 28,
              fontSize: 13, color: "var(--gray-600)",
            }}>
              {[
                ["🎥", "Live video interviewer"],
                ["🎙️", "Voice-first, Whisper STT"],
                ["📊", "Per-answer sub-scores"],
                ["✨", "“Say this instead” rewrites"],
              ].map(([icon, label]) => (
                <span key={label} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "8px 14px", background: "var(--white)",
                  borderRadius: 999, border: "1px solid var(--gray-200)",
                  boxShadow: "var(--shadow-sm)", fontWeight: 600,
                }}>
                  <span>{icon}</span> {label}
                </span>
              ))}
            </div>
          </div>

          <div className="setup-grid">
            <div className="setup-card">
              <div className="setup-card-title">Your Details</div>
              <div className="field">
                <label>Full Name</label>
                <input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="e.g. Srinivas Malapati" />
              </div>
              <div className="field">
                <label>Resume (PDF or text)</label>
                <div
                  className={`dropzone ${resumeStatus === "uploaded" ? "success" : resumeStatus === "error" ? "error" : ""}`}
                  onClick={() => document.getElementById("resume-input").click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); e.dataTransfer.files?.[0] && uploadResume(e.dataTransfer.files[0]); }}
                >
                  {resumeStatus === "uploaded" ? `✓ ${resumeFileName} uploaded`
                    : resumeStatus === "error" ? "Upload failed — click to retry"
                    : "Drop your resume here, or click to browse"}
                </div>
                <input id="resume-input" type="file" accept=".pdf,.txt,.md" style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
              </div>
            </div>

            <div className="setup-card">
              <div className="setup-card-title">Interview Config</div>
              <div className="field">
                <label>Role</label>
                <div className="chip-group">
                  {ROLES.map((r) => (
                    <button key={r} className={`chip ${role === r ? "chip-active" : ""}`} onClick={() => setRole(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Seniority</label>
                  <select value={seniority} onChange={(e) => setSeniority(e.target.value)}>
                    {SENIORITY.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Tone</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)}>
                    {TONES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Focus Areas</label>
                <div className="chip-group">
                  {FOCUS_TAGS.map((tag) => (
                    <button key={tag} className={`chip ${focus.includes(tag) ? "chip-active" : ""}`} onClick={() => toggleFocus(tag)}>{tag}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="setup-card setup-card-full">
              <div className="setup-card-title">Job Description</div>
              <div className="field">
                <textarea rows={5} placeholder="Paste the job description or key responsibilities here…"
                  value={jdText} onChange={(e) => setJdText(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <button className="btn btn-primary btn-lg" onClick={goToPrecheck}>
              Start Interview →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── INTERVIEW VIEW ───
  if (status === "interview") {
    return (
      <div>
        <div className="interview-page animate-in" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
          gap: 16, padding: 16,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <VideoFeed
              roomUrl={roomUrl}
              isVideoOn={isVideoOn}
              toggleVideo={() => setIsVideoOn(!isVideoOn)}
              isAudioOn={isAudioOn}
              toggleAudio={() => setIsAudioOn(!isAudioOn)}
              status={status}
              pending={pending}
              onEnd={endInterview}
              onLocalStream={handleLocalStream}
            />
            {avatarMessage && (
              <div style={{
                fontSize: 12, padding: "6px 10px",
                background: "rgba(245, 158, 11, 0.12)", color: "#92400e",
                border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: 6,
              }}>⚠ {avatarMessage}</div>
            )}
            {!health.openai && (
              <div style={{
                fontSize: 12, padding: "8px 12px",
                background: "rgba(198, 68, 40, 0.10)", color: "var(--red-600)",
                border: "1px solid rgba(198, 68, 40, 0.30)", borderRadius: 6,
                lineHeight: 1.4,
              }}>
                ⚠ <strong>OpenAI key invalid or missing.</strong> Voice (Whisper STT + AI TTS) is using browser fallback,
                and scores/follow-ups are using rule-based heuristics — not the LLM. Update <code>backend/.env</code>
                and restart to enable real AI responses.
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ChatWindow messages={messages} onSend={sendMessage} pending={pending} feedback={lastTurn?.feedback || ""} />
            </div>
            <FeedbackPanel turn={lastTurn} />
          </div>
        </div>
        <EndInterviewModal open={modalOpen} onClose={() => setModalOpen(false)} onMarkEnded={confirmEnd} />
      </div>
    );
  }

  // ─── RESULTS VIEW ───
  const scores = lastTurn?.scores || { structure: 0, clarity: 0, relevance: 0, impact: 0 };
  const overall = Math.round(
    (scores.structure + scores.clarity + scores.relevance + scores.impact) / 4
  );
  const duration = startTime ? Math.round((Date.now() - startTime) / 60000) : 0;

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-brand-icon">G</div>
          Greenroom
        </div>
        <div className="navbar-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {authRequired && user && (
            <span style={{ fontSize: 13, color: "var(--gray-600)", marginRight: 4 }}>
              {user.email}
            </span>
          )}
          {authRequired && user && (
            <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => {
              exportSessionPDF({
                candidateName,
                role,
                seniority,
                durationMin: duration,
                overall,
                scores,
                bodyLanguage,
                speech,
                messages,
                lastTurn,
              });
            }}
            title="Download a PDF of this interview session"
          >
            ⬇ Download PDF
          </button>
          <button
            className="btn btn-ghost"
            disabled={!sessionId}
            onClick={async () => {
              if (!sessionId) return;
              try {
                const r = await authedFetch(`${API}/sessions/${sessionId}/share`, { method: "POST" });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const { token } = await r.json();
                const url = `${window.location.origin}/s/${token}`;
                try {
                  await navigator.clipboard.writeText(url);
                  alert(`Share link copied!\n\n${url}`);
                } catch {
                  prompt("Copy your share link:", url);
                }
              } catch (e) {
                alert(`Could not create share link: ${e?.message || e}`);
              }
            }}
            title="Create a public link to this session's score (no transcript, no email)"
          >
            🔗 Share
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              if (!candidateName) return;
              if (!confirm(`Delete all past interview sessions for ${candidateName}? Your current results stay.`)) return;
              let deleted = 0;
              try {
                const url = `${API}/sessions/${encodeURIComponent(candidateName)}${sessionId ? `?keep=${sessionId}` : ""}`;
                const r = await authedFetch(url, { method: "DELETE" });
                if (r.ok) { const j = await r.json(); deleted = j?.deleted ?? 0; }
              } catch (e) { console.warn("clear history failed:", e); }
              alert(deleted > 0 ? `Cleared ${deleted} past session${deleted === 1 ? "" : "s"}.` : "No past sessions to clear.");
              setHistoryKey((k) => k + 1);
            }}
            title="Wipe past sessions from the progress chart"
          >
            Clear Past Sessions
          </button>
          <button className="btn btn-primary" onClick={() => {
            setStatus("setup"); setMessages([]); setLastTurn(null);
            setRoomUrl(""); setBodyLanguage(null); setSessionId(null);
          }}>New Interview</button>
        </div>
      </nav>

      <div className="results-page animate-in">
        <div className="results-header">
          <h1>Interview Complete</h1>
          <p>{candidateName} · {role} ({seniority}) · {duration} min</p>
        </div>

        <div className="results-grid">
          <div className="results-card" style={{ textAlign: "center" }}>
            <div className="results-card-label">Overall Score</div>
            <div className="score-ring" style={{
              background: `conic-gradient(var(--blue-500) ${overall * 3.6}deg, var(--gray-200) ${overall * 3.6}deg)`,
            }}>
              <div className="score-ring-value">{overall}</div>
            </div>
            <p style={{ fontSize: "0.8125rem", margin: 0 }}>
              {overall >= 70 ? "Strong performance" : overall >= 50 ? "Room for improvement" : "Needs more practice"}
            </p>
          </div>

          <div className="results-card">
            <div className="results-card-label">Body Language</div>
            {bodyLanguage ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                <BarStat label="Engagement" pct={bodyLanguage.engagement} />
                <BarStat label="Warmth"     pct={bodyLanguage.warmth} />
                <BarStat label="Composure"  pct={bodyLanguage.composure} />
                <BarStat label="Energy"     pct={bodyLanguage.energy} />
                <div style={{ fontSize: 11, color: "var(--gray-500)", marginTop: 4 }}>
                  {bodyLanguage.samples?.engagement || 0} samples collected.
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--gray-500)", fontSize: 13, fontStyle: "italic" }}>
                Not analyzed (camera off or session too short).
              </div>
            )}
          </div>

          <div className="results-card">
            <div className="results-card-label">Delivery</div>
            {speech.totalWords > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Pace</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--gray-900)" }}>{speech.wpm} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-500)" }}>wpm</span></div>
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px",
                    borderRadius: 999, color: "white",
                    background: speech.paceLabel === "On pace" ? "var(--green-500)"
                              : speech.paceLabel === "Not enough words" ? "var(--gray-400)"
                              : "var(--blue-500)",
                  }}>{speech.paceLabel}</div>
                </div>
                <BarStat label="Clarity (filler-free)" pct={speech.clarityScore} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--gray-700)" }}>
                  <span>Filler words used</span>
                  <strong>{speech.fillerCount} ({Math.round(speech.fillerRatio * 100)}%)</strong>
                </div>
                {speech.topFiller && (
                  <div style={{ fontSize: 12, color: "var(--gray-500)" }}>
                    Most-used filler: <code style={{ background: "var(--gray-100)", padding: "1px 6px", borderRadius: 4 }}>{speech.topFiller}</code>
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--gray-500)" }}>
                  {speech.totalWords} words across {duration} min
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--gray-500)", fontSize: 13, fontStyle: "italic" }}>
                No spoken answers in this session.
              </div>
            )}
          </div>

          <div className="results-card">
            <div className="results-card-label">Final Feedback</div>
            <FeedbackPanel turn={lastTurn} hideTitle compact />
          </div>

          <div className="results-card results-card-full">
            <SessionSummary candidate={candidateName} apiBase={API} refreshKey={historyKey} />
          </div>

          <div className="results-card results-card-full">
            <div className="results-card-label">Past sessions</div>
            <PastSessionsList
              candidate={candidateName}
              apiBase={API}
              refreshKey={historyKey}
              currentSessionId={sessionId}
              onPick={(s) => {
                // Replay this session's data in the same results view
                setMessages(
                  (s.turns || []).flatMap((t) => {
                    const out = [];
                    if (t.question) out.push({ role: "Agent", text: t.question });
                    if (t.answer)   out.push({ role: "Candidate", text: t.answer });
                    return out;
                  })
                );
                const lastTurnObj = s.turns?.length
                  ? {
                      followup: s.turns[s.turns.length - 1].followup,
                      feedback: s.turns[s.turns.length - 1].feedback,
                      rewrite:  s.turns[s.turns.length - 1].rewrite,
                      scores:   s.turns[s.turns.length - 1].scores || {},
                    }
                  : null;
                setLastTurn(lastTurnObj);
                setBodyLanguage(s.body_language || null);
                setSessionId(s.id);
                setViewingPastSession(s);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>

          <div className="results-card results-card-full">
            <div className="results-card-label">Interview Transcript</div>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {messages.map((m, i) => (
                <div key={i} className="transcript-item">
                  <div className={`transcript-turn ${m.role === "Agent" ? "agent" : "user"}`}>
                    {m.role === "Agent" ? "AI" : "You"}
                  </div>
                  <div>
                    <div className="transcript-label">{m.role === "Agent" ? "Interviewer" : "Your Answer"}</div>
                    <div className="transcript-text">{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarStat({ label, pct }) {
  const safe = Math.max(0, Math.min(100, pct || 0));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "var(--gray-700)" }}>{label}</span>
        <span style={{ fontWeight: 700 }}>{safe}%</span>
      </div>
      <div style={{ height: 6, background: "var(--gray-100, #f3f4f6)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          width: `${safe}%`, height: "100%",
          background: safe >= 70 ? "#10b981" : safe >= 40 ? "#3b82f6" : "#ef4444",
        }} />
      </div>
    </div>
  );
}
