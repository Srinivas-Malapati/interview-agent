import React, { useEffect, useRef } from "react";
import ComposerHelpers from "./ComposerHelpers.jsx";

/** One chat bubble, aligned by role */
const Bubble = ({ role, text }) => {
  const isAgent = role === "Agent";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isAgent ? "flex-start" : "flex-end",
        margin: "12px 0",
      }}
    >
      {/* Left avatar only for agent to keep visual hierarchy clean */}
      {isAgent && (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            marginRight: 10,
            background:
              "linear-gradient(135deg, rgba(219,234,254,1), rgba(167,139,250,1))",
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            color: "#0f172a",
            flexShrink: 0,
          }}
          aria-label="Agent avatar"
        >
          A
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: "74%",
          background: isAgent ? "rgba(29,78,216,.08)" : "#fff",
          border: "1px solid #e5e7eb",
          padding: "10px 12px",
          borderRadius: 14,
          borderTopLeftRadius: isAgent ? 4 : 14,
          borderTopRightRadius: isAgent ? 14 : 4,
          boxShadow: isAgent
            ? "0 2px 6px rgba(29,78,216,0.06)"
            : "0 2px 6px rgba(15,23,42,0.06)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            marginBottom: 4,
            textAlign: isAgent ? "left" : "right",
          }}
        >
          {isAgent ? "Agent" : "You"}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5, color: "#0f172a" }}>
          {text}
        </div>
      </div>
    </div>
  );
};

/** Typing indicator for the agent */
const Typing = () => (
  <div style={{ display: "flex", justifyContent: "flex-start", margin: "8px 0" }}>
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        marginRight: 10,
        background:
          "linear-gradient(135deg, rgba(219,234,254,1), rgba(167,139,250,1))",
        display: "grid",
        placeItems: "center",
        fontWeight: 900,
        color: "#0f172a",
        flexShrink: 0,
      }}
    >
      A
    </div>
    <div
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 14,
        background: "rgba(29,78,216,.08)",
        border: "1px solid #e5e7eb",
      }}
    >
      <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
    </div>
  </div>
);

const Dot = ({ delay = "0ms" }) => (
  <span
    style={{
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "#1d4ed8",
      display: "inline-block",
      animation: "blink 1s infinite",
      animationDelay: delay,
    }}
  />
);

export default function ChatWindow({ title, subtitle, messages, onSend, pending }) {
  const [input, setInput] = React.useState("");
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef(null);
  const listRef = useRef(null);

  // Voice setup
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal)
          setInput((prev) => (prev ? prev + " " + transcript : transcript));
      }
    };
    recognitionRef.current = rec;
  }, []);

  // Auto-scroll
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const startStopVoice = () => {
    const rec = recognitionRef.current;
    if (!rec) return alert("Voice input not supported here. Try Chrome/Edge.");
    listening ? rec.stop() : rec.start();
  };

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || pending) return;
    onSend(msg);
    setInput("");
  };

  return (
    <div
      style={{
        border: "1px solid var(--ring)",
        borderRadius: 16,
        padding: 16,
        minHeight: 560,
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.88)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)",
      }}
    >
      <style>{`
        @keyframes blink { 0% {opacity:.2} 50% {opacity:1} 100% {opacity:.2} }
      `}</style>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h3 style={{ fontWeight: 900, margin: 0 }}>{title || "Interview"}</h3>
          {subtitle && (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>{subtitle}</span>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        style={{ flex: 1, overflowY: "auto", marginBottom: 12, paddingRight: 4 }}
      >
        {messages.length === 0 && (
          <div style={{ color: "#9CA3AF", fontStyle: "italic" }}>
            Upload a resume (left) or start from JD. The agent will open with a question.
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.text} />
        ))}

        {pending && <Typing />}
      </div>

      <ComposerHelpers value={input} setValue={setInput} />

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Listening… speak now" : "Type your answer…"}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          style={{
            flex: 1,
            border: "1px solid var(--ring)",
            borderRadius: 12,
            padding: "12px 14px",
            background: "#fff",
          }}
          disabled={pending}
        />
        <button
          onClick={startStopVoice}
          title="Voice input"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: "0",
            background: listening
              ? "radial-gradient(circle at 50% 40%, #fecaca, #ef4444)"
              : "radial-gradient(circle at 50% 40%, #e0e7ff, #1d4ed8)",
            color: "#fff",
            fontSize: 18,
            boxShadow: listening
              ? "0 0 0 6px rgba(239,68,68,0.15)"
              : "0 0 0 6px rgba(29,78,216,0.12)",
          }}
        >
          {listening ? "■" : "🎙️"}
        </button>
        <button
          onClick={handleSend}
          disabled={pending}
          style={{
            background: pending
              ? "linear-gradient(90deg,#94a3b8,#cbd5e1)"
              : "linear-gradient(90deg,#1d4ed8,#7c3aed)",
            color: "white",
            borderRadius: 12,
            padding: "12px 18px",
            border: 0,
            fontWeight: 800,
            opacity: pending ? 0.8 : 1,
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
