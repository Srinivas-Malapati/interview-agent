import React, { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const Bubble = ({ role, text, streaming }) => {
  const isAgent = role === "Agent";
  return (
    <div className={`bubble ${isAgent ? "bubble-agent" : "bubble-user"}`}>
      <div className="bubble-avatar">{isAgent ? "G" : "You"}</div>
      <div className="bubble-content">
        {text}
        {streaming && (
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 8, height: 14, marginLeft: 4,
              background: "currentColor", opacity: 0.65,
              borderRadius: 1, verticalAlign: "middle",
              animation: "blink 1s steps(2) infinite",
            }}
          />
        )}
      </div>
    </div>
  );
};

const TypingIndicator = () => (
  <div className="bubble bubble-agent">
    <div className="bubble-avatar">G</div>
    <div className="typing-dots">
      <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
    </div>
  </div>
);

export default function ChatWindow({ messages, onSend, pending, feedback }) {
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [notice, setNotice] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recStreamRef = useRef(null);
  const listRef = useRef(null);
  const recognitionRef = useRef(null);
  const webSpeechTextRef = useRef("");

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const startWebSpeech = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    webSpeechTextRef.current = "";
    let finalTranscript = "";
    let lastInterim = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += " " + t;
        else interim += t;
      }
      lastInterim = interim.trim();
      webSpeechTextRef.current = (finalTranscript + " " + lastInterim).trim();
    };
    rec.onerror = (e) => console.warn("SpeechRecognition error:", e.error, e);
    rec.onend = () => {
      if (!finalTranscript.trim() && lastInterim) webSpeechTextRef.current = lastInterim;
    };
    try { rec.start(); } catch (err) {
      console.warn("SpeechRecognition start failed:", err);
      return null;
    }
    return rec;
  };

  const startRecording = async () => {
    setNotice("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        recStreamRef.current?.getTracks().forEach((t) => t.stop());
        recStreamRef.current = null;
        try { recognitionRef.current?.stop(); } catch {}
        await new Promise((r) => setTimeout(r, 350));
        const browserText = webSpeechTextRef.current || "";

        if (blob.size < 1500) {
          if (browserText) setInput((p) => (p ? `${p} ${browserText}` : browserText));
          else setNotice("Too short — hold a bit longer.");
          return;
        }

        setTranscribing(true);
        let whisperText = "";
        let whisperOk = false;
        try {
          const fd = new FormData();
          fd.append("file", blob, "answer.webm");
          const res = await fetch(`${API}/transcribe`, { method: "POST", body: fd });
          const data = await res.json();
          whisperText = (data?.text || "").trim();
          whisperOk = !data?.error && whisperText.length > 0;
        } catch (e) { console.warn("Whisper failed:", e); }

        const finalText = whisperOk ? whisperText : browserText;
        if (finalText) {
          setInput((p) => (p ? `${p} ${finalText}` : finalText));
          if (!whisperOk && browserText) setNotice("Using browser speech (Whisper unavailable).");
        } else {
          setNotice("Could not transcribe — try again or type instead.");
        }
        setTranscribing(false);
      };
      rec.start();
      mediaRecorderRef.current = rec;
      recognitionRef.current = startWebSpeech();
      setRecording(true);
    } catch (e) {
      setNotice(`Mic access denied: ${e?.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const toggleVoice = () => (recording ? stopRecording() : startRecording());

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || pending) return;
    onSend(msg);
    setInput("");
    setNotice("");
  };

  return (
    <div className="interview-chat">
      <div className="chat-header">
        <h3>Live Transcript</h3>
        <p>Tap the mic to answer — Whisper first, browser voice as backup.</p>
      </div>

      <div ref={listRef} className="chat-body">
        {messages.length === 0 && !pending && (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <p>The interview will begin shortly…</p>
          </div>
        )}

        {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} streaming={m.streaming} />)}
        {pending && !messages.some((m) => m.streaming) && <TypingIndicator />}

        {feedback && messages.length > 1 && !pending && (
          <div style={{
            background: "var(--blue-50)", border: "1px solid var(--blue-100)",
            borderRadius: "var(--radius-md)", padding: "10px 14px",
            fontSize: "0.8125rem", color: "var(--blue-700)",
            alignSelf: "flex-start", maxWidth: "90%",
          }}>
            <strong style={{
              display: "block", marginBottom: 4, fontSize: "0.6875rem",
              textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--blue-500)",
            }}>💡 Coaching Tip</strong>
            {feedback}
          </div>
        )}

        {notice && (
          <div style={{
            fontSize: 12, padding: "6px 10px",
            background: "rgba(122, 110, 93, 0.08)", color: "var(--gray-600)",
            border: "1px solid rgba(122, 110, 93, 0.20)",
            borderRadius: 8, marginTop: 4,
          }}>{notice}</div>
        )}
      </div>

      <div className="chat-composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            recording ? "Recording… tap mic to finish"
            : transcribing ? "Transcribing…"
            : "Tap mic or type your answer"
          }
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={pending || transcribing}
        />
        <button
          className={`composer-btn composer-mic ${recording ? "active" : ""}`}
          onClick={toggleVoice}
          disabled={transcribing || pending}
          title={recording ? "Stop recording" : "Tap to record"}
        >
          {recording ? "■" : transcribing ? "…" : "🎙️"}
        </button>
        <button className="composer-btn composer-send" onClick={handleSend} disabled={pending || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}
