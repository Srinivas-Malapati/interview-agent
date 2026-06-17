import React, { useEffect, useState } from "react";

const STORAGE_KEY = "greenroom.onboarded.v1";

const STEPS = [
  {
    emoji: "🎯",
    title: "Real interview, real feedback",
    body: "Greenroom asks you a question the way an actual interviewer would — grounded in your resume and the job description.",
  },
  {
    emoji: "🎙️",
    title: "Speak, don't just type",
    body: "Hit the mic and answer out loud. Whisper transcribes you in seconds. The AI asks follow-ups based on what you actually said.",
  },
  {
    emoji: "✨",
    title: "Coaching that's specific",
    body: "After each answer you'll see sub-scores, a coaching tip, and the exact sentence you should have said — so you improve every session.",
  },
];

export default function OnboardingTutorial({ onDone }) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch { setOpen(false); }
  }, []);

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setOpen(false);
    onDone?.();
  };

  if (!open) return null;
  const s = STEPS[step];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(13, 11, 7, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={finish}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--white)",
          borderRadius: 20,
          padding: 36,
          width: "100%", maxWidth: 460,
          boxShadow: "0 24px 64px rgba(0,0,0,0.30)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 14 }}>{s.emoji}</div>
        <h2 style={{ fontSize: "1.375rem", marginBottom: 10 }}>{s.title}</h2>
        <p style={{ color: "var(--gray-600)", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
          {s.body}
        </p>

        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "22px 0 18px" }}>
          {STEPS.map((_, i) => (
            <span key={i} style={{
              width: 7, height: 7, borderRadius: "50%",
              background: i === step ? "var(--blue-500)" : "var(--gray-200)",
              transition: "background 0.2s",
            }} />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button className="btn btn-ghost" onClick={finish}>Skip</button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
              Next →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={finish}>
              Let's go →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
