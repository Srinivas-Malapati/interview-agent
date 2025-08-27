
import React from "react";

const ROLES = ["Software Engineer", "Data Scientist", "Product Manager", "Product Designer"];
const SENIORITY = ["Junior", "Mid", "Senior", "Staff", "Lead"];
const TONES = ["Professional", "Friendly", "Direct", "Supportive"];
const FOCUS_TAGS = ["System Design", "Algorithms", "Product Sense", "Culture"];

export default function JobConfig({
  role, setRole,
  seniority, setSeniority,
  tone, setTone,
  focus, setFocus,
  jdText, setJdText
}) {

  const toggleFocus = (tag) => {
    setFocus((cur) => cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag]);
  };

  return (
    <div className="card">
      <div className="card-title">Job Description</div>

      {/* Role pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {ROLES.map((r) => (
          <button
            key={r}
            className={`chip ${role === r ? "chip-active" : ""}`}
            onClick={() => setRole(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Seniority + Tone */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div className="form-field">
          <label>Seniority</label>
          <select value={seniority} onChange={(e) => setSeniority(e.target.value)}>
            {SENIORITY.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Interviewer Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)}>
            {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Focus tags */}
      <div style={{ marginBottom: 8 }}>
        <label className="field-label">Focus Areas</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FOCUS_TAGS.map((tag) => (
            <button
              key={tag}
              className={`chip ${focus.includes(tag) ? "chip-active" : ""}`}
              onClick={() => toggleFocus(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* JD text */}
      <div className="form-field" style={{ marginTop: 10 }}>
        <label>Job Description</label>
        <textarea
          rows={6}
          placeholder="Paste a short JD or notes (tech stack, responsibilities, must-haves)…"
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
        />
      </div>
    </div>
  );
}
