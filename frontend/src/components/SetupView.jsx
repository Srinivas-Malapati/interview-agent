import React from "react";
import OnboardingTutorial from "./OnboardingTutorial.jsx";

const ROLES = ["Software Engineer", "AI Engineer", "Data Scientist", "Product Manager", "Product Designer"];
const SENIORITY = ["Junior", "Mid", "Senior", "Staff", "Lead"];
const TONES = ["Professional", "Friendly", "Direct", "Supportive"];
const FOCUS_TAGS = ["System Design", "Algorithms", "Product Sense", "Culture"];

const HERO_PILLS = [
  ["🎥", "Live video interviewer"],
  ["🎙️", "Voice-first, Whisper STT"],
  ["📊", "Per-answer sub-scores"],
  ["✨", "“Say this instead” rewrites"],
];

export default function SetupView({
  candidateName, setCandidateName,
  role, setRole,
  seniority, setSeniority,
  tone, setTone,
  focus, toggleFocus,
  jdText, setJdText,
  resumeStatus, resumeFileName, uploadResume,
  onStart,
  authRequired, user, onSignOut,
}) {
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
            <span style={{ fontSize: 13, color: "var(--gray-600)" }}>{user.email}</span>
            <button className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
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
            {HERO_PILLS.map(([icon, label]) => (
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
              <input
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Srinivas Malapati"
              />
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
              <input
                id="resume-input" type="file" accept=".pdf,.txt,.md" style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])}
              />
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
              <textarea
                rows={5}
                placeholder="Paste the job description or key responsibilities here…"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 32 }}>
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            Start Interview →
          </button>
        </div>
      </div>
    </div>
  );
}
