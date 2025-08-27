import React from "react";

export default function ScoreCard({ score = 72, strengths = [], improvements = [] }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div style={{
      border: "1px solid var(--ring)", borderRadius: 12, padding: 16,
      background: "linear-gradient(180deg, #ffffff, #fbfdff)"
    }}>
      <h3 style={{ fontWeight: 900, marginBottom: 8 }}>Answer Quality Score</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 70, height: 70, borderRadius: "50%", border: "6px solid #e5e7eb", position: "relative" }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: `conic-gradient(#2563eb ${pct * 3.6}deg, #e5e7eb ${pct * 3.6}deg)`
          }}/>
          <div style={{
            position: "absolute", inset: 6, background: "white",
            borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 900
          }}>{pct}</div>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 14 }}>
          <div>0 = vague, 100 = metric-driven & well-structured.</div>
          <div>Auto-scored locally from your latest answer.</div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {strengths.length>0 && (<div>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Strengths</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{strengths.map((s,i)=><li key={i}>{s}</li>)}</ul>
        </div>)}
        {improvements.length>0 && (<div>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Areas for Improvement</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{improvements.map((s,i)=><li key={i}>{s}</li>)}</ul>
        </div>)}
      </div>
    </div>
  );
}
