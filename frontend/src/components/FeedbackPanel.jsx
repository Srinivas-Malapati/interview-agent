import React from "react";

export default function FeedbackPanel({ feedback }) {
  const tips = (feedback || "")
    .split(/[.\n]/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div className="card" style={{ padding:16 }}>
      <h3 style={{ marginTop:0, marginBottom:8, fontWeight:900 }}>Real-time Coaching</h3>
      {tips.length === 0 ? (
        <div style={{ color:"var(--muted)", fontStyle:"italic" }}>
          After each answer, concise coaching tips will appear here.
        </div>
      ) : (
        <ul style={{ margin:0, paddingLeft:18 }}>
          {tips.map((t,i)=> <li key={i} style={{ margin:"6px 0" }}>{t}</li>)}
        </ul>
      )}
    </div>
  );
}
