import React from "react";
import FeedbackPanel from "./FeedbackPanel.jsx";
import SessionSummary from "./SessionSummary.jsx";
import PastSessionsList from "./PastSessionsList.jsx";

export default function ResultsView({
  candidateName, role, seniority,
  duration, scores, overall,
  bodyLanguage, speech,
  messages, lastTurn,
  sessionId, historyKey,
  apiBase,
  authRequired, user, onSignOut,
  onDownloadPdf, onShare, onClearPast, onNewInterview,
  onPickPastSession,
}) {
  return (
    <div>
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-brand-icon">G</div>
          Greenroom
        </div>
        <div className="navbar-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {authRequired && user && (
            <>
              <span style={{ fontSize: 13, color: "var(--gray-600)", marginRight: 4 }}>{user.email}</span>
              <button className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
            </>
          )}
          <button
            className="btn btn-ghost"
            onClick={onDownloadPdf}
            title="Download a PDF of this interview session"
          >
            ⬇ Download PDF
          </button>
          <button
            className="btn btn-ghost"
            disabled={!sessionId}
            onClick={onShare}
            title="Create a public link to this session's score (no transcript, no email)"
          >
            🔗 Share
          </button>
          <button
            className="btn btn-ghost"
            onClick={onClearPast}
            title="Wipe past sessions from the progress chart"
          >
            Clear Past Sessions
          </button>
          <button className="btn btn-primary" onClick={onNewInterview}>New Interview</button>
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
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--gray-900)" }}>
                      {speech.wpm} <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-500)" }}>wpm</span>
                    </div>
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
            <SessionSummary candidate={candidateName} apiBase={apiBase} refreshKey={historyKey} />
          </div>

          <div className="results-card results-card-full">
            <div className="results-card-label">Past sessions</div>
            <PastSessionsList
              candidate={candidateName}
              apiBase={apiBase}
              refreshKey={historyKey}
              currentSessionId={sessionId}
              onPick={onPickPastSession}
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
