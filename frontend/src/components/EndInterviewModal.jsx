import React from "react";

export default function EndInterviewModal({
  open, onClose,
  onMarkEnded,
  summaryText, setSummaryText
}) {
  if (!open) return null;
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.35)",
      display:"grid", placeItems:"center", zIndex:50
    }}>
      <div className="card" style={{ width:700, padding:20 }}>
        <h2 style={{ marginTop:0 }}>End Interview</h2>
        <p style={{ color:"var(--muted)", marginTop:0 }}>
          Write a brief decision note (2–5 bullets). You can export from the Recruiter Dashboard.
        </p>
        <textarea
          value={summaryText}
          onChange={(e)=>setSummaryText(e.target.value)}
          placeholder={"• Strong system design, clear trade-offs\n• Improved SLA by 35%, led rollout\n• Good ownership & collaboration"}
          style={{
            width:"100%", minHeight:170, resize:"vertical",
            border:"1px solid var(--ring)", borderRadius:10, padding:12, background:"#fff", color:"var(--ink)"
          }}
        />
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:12 }}>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn" onClick={onMarkEnded}>Mark as Ended</button>
          </div>
        </div>
      </div>
    </div>
  );
}
