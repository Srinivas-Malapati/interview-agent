import React from "react";

function statusPill(status) {
  const palette = {
    "Not started": { bg: "#f1f5f9", color: "#0f172a", border: "#e2e8f0" },
    "In progress": { bg: "#ecfdf5", color: "#064e3b", border: "#86efac" },
    "Ended": { bg: "#fef2f2", color: "#7f1d1d", border: "#fecaca" },
  };
  const s = palette[status] || palette["Not started"];
  return (
    <span
      style={{
        fontSize: 12,
        padding: "6px 10px",
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        display: "inline-block",
      }}
    >
      {status}
    </span>
  );
}

export default function CandidateCard({ name="Candidate", role="Software Engineer", level="Mid", status="Not started" }) {
  const initials = name.split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase();
  return (
    <div className="card" style={{ padding:16 }}>
      <h3 style={{ margin:0, marginBottom:12, fontWeight:900 }}>Candidate Profile</h3>
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
        <div style={{
          width:56,height:56,borderRadius:"50%",
          background:"linear-gradient(135deg,#dbeafe,#a78bfa)",
          color:"#0f172a", display:"grid", placeItems:"center",fontWeight:900
        }}>{initials}</div>
        <div>
          <div style={{ fontWeight:800 }}>{name}</div>
          <div style={{ fontSize:13, color:"var(--muted)" }}>{role} • {level}</div>
        </div>
      </div>
      <div style={{ fontSize:13, color:"var(--muted)", marginBottom:6 }}>Status</div>
      {statusPill(status)}
    </div>
  );
}
