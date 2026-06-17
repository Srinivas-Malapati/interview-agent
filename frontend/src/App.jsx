import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoginScreen from "./components/LoginScreen.jsx";
import PrecheckScreen from "./components/PrecheckScreen.jsx";
import PublicResults from "./components/PublicResults.jsx";
import SetupView from "./components/SetupView.jsx";
import InterviewView from "./components/InterviewView.jsx";
import ResultsView from "./components/ResultsView.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { authedFetch, signOut } from "./lib/supabase.js";
import { createBodyLanguageAnalyzer } from "./utils/bodyLanguage.js";
import { computeSpeechMetrics } from "./utils/speechMetrics.js";
import { exportSessionPDF } from "./utils/pdfExport.js";
import "./styles/theme.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  // Public /s/<token> route runs before useAuth so visitors aren't bounced to login.
  const shareToken = typeof window !== "undefined"
    && window.location.pathname.match(/^\/s\/([\w-]+)\/?$/)?.[1];
  if (shareToken) return <PublicResults token={shareToken} />;

  const { user, loading: authLoading, isRequired: authRequired } = useAuth();

  const [candidateName, setCandidateName] = useState("");
  const [status, setStatus] = useState("setup"); // setup | precheck | interview | results
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

  // Pre-fill candidate name from Supabase profile (Google sign-in).
  // Magic-link users have no profile name — leave blank rather than fall back
  // to the email username, which isn't a real name.
  useEffect(() => {
    if (user && !candidateName) {
      const name = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
      if (name) setCandidateName(name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Pre-fill the entire setup form from the user's last interview (if any).
  useEffect(() => {
    if (!user) return;
    authedFetch(`${API}/profile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        if (p.name && !candidateName) setCandidateName(p.name);
        if (p.role)      setRole(p.role);
        if (p.seniority) setSeniority(p.seniority);
        if (p.tone)      setTone(p.tone);
        if (Array.isArray(p.focus) && p.focus.length) setFocus(p.focus);
        if (p.jd_text)   setJdText(p.jd_text);
        if (p.resume_text) {
          setResumeStatus("uploaded");
          setResumeFileName("(saved from last session)");
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const durationSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
  const speech = useMemo(() => {
    const texts = messages.filter((m) => m.role === "Candidate").map((m) => m.text);
    return computeSpeechMetrics(texts, durationSeconds);
  }, [messages, durationSeconds]);

  const speakViaBrowser = useCallback((text) => {
    if (!("speechSynthesis" in window)) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02; utter.pitch = 1.0; utter.volume = 1.0;
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
    try { streamAbortRef.current?.abort(); } catch {}
    streamAbortRef.current = new AbortController();
    const signal = streamAbortRef.current.signal;

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
        speakAi(streamedText);
      }
    } catch (e) {
      if (e?.name === "AbortError") {
        setMessages((m) => {
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

  const shareSession = async () => {
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
  };

  const endInterview = async () => {
    if (!confirm("End the interview and see your results?")) return;
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

  const scores = lastTurn?.scores || { structure: 0, clarity: 0, relevance: 0, impact: 0 };
  const overall = Math.round(
    (scores.structure + scores.clarity + scores.relevance + scores.impact) / 4
  );
  const duration = startTime ? Math.round((Date.now() - startTime) / 60000) : 0;

  const downloadPdf = () => exportSessionPDF({
    candidateName, role, seniority, durationMin: duration,
    overall, scores, bodyLanguage, speech, messages, lastTurn,
  });

  const clearPastSessions = async () => {
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
  };

  const newInterview = () => {
    setStatus("setup");
    setMessages([]);
    setLastTurn(null);
    setRoomUrl("");
    setBodyLanguage(null);
    setSessionId(null);
  };

  const pickPastSession = (s) => {
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (authRequired && authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--gray-500)" }}>
        Loading…
      </div>
    );
  }
  if (authRequired && !user) return <LoginScreen />;

  if (status === "precheck") {
    return <PrecheckScreen onBack={() => setStatus("setup")} onPass={startInterview} />;
  }

  if (status === "setup") {
    return (
      <SetupView
        candidateName={candidateName} setCandidateName={setCandidateName}
        role={role} setRole={setRole}
        seniority={seniority} setSeniority={setSeniority}
        tone={tone} setTone={setTone}
        focus={focus} toggleFocus={toggleFocus}
        jdText={jdText} setJdText={setJdText}
        resumeStatus={resumeStatus} resumeFileName={resumeFileName} uploadResume={uploadResume}
        onStart={goToPrecheck}
        authRequired={authRequired} user={user} onSignOut={signOut}
      />
    );
  }

  if (status === "interview") {
    return (
      <InterviewView
        roomUrl={roomUrl}
        isVideoOn={isVideoOn} setIsVideoOn={setIsVideoOn}
        isAudioOn={isAudioOn} setIsAudioOn={setIsAudioOn}
        pending={pending}
        onEnd={endInterview}
        onLocalStream={handleLocalStream}
        avatarMessage={avatarMessage}
        health={health}
        messages={messages}
        sendMessage={sendMessage}
        lastTurn={lastTurn}
        modalOpen={modalOpen} setModalOpen={setModalOpen}
        onConfirmEnd={confirmEnd}
      />
    );
  }

  return (
    <ResultsView
      candidateName={candidateName} role={role} seniority={seniority}
      duration={duration} scores={scores} overall={overall}
      bodyLanguage={bodyLanguage} speech={speech}
      messages={messages} lastTurn={lastTurn}
      sessionId={sessionId} historyKey={historyKey}
      apiBase={API}
      authRequired={authRequired} user={user} onSignOut={signOut}
      onDownloadPdf={downloadPdf}
      onShare={shareSession}
      onClearPast={clearPastSessions}
      onNewInterview={newInterview}
      onPickPastSession={pickPastSession}
    />
  );
}
