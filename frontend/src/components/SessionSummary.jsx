
import React from "react";

export default function SessionSummary({ transcript, tags, durationMin }) {
  const words = transcript.split(/\s+/).filter(Boolean).length;
  const turns = (transcript.match(/\n/g) || []).length + 1;
  const bullets = [
    `${turns} turns • ${words} words`,
    `Duration ~ ${durationMin} min`,
    tags.length ? `Signals: ${tags.join(", ")}` : "Signals: –",
  ];
  return (
    <div className="card" style={{ padding:16 }}>
      <h3 style={{ margin:0, marginBottom:8, fontWeight:900 }}>Session Summary</h3>
      <ul style={{ margin:0, paddingLeft:18, color:"var(--muted)" }}>
        {bullets.map((b,i)=><li key={i} style={{ margin:"6px 0" }}>{b}</li>)}
      </ul>
    </div>
  );
}
