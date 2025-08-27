import React, { useMemo } from "react";

export default function Timeline({ messages }) {
  const turns = useMemo(() => {
    const items = [];
    let turn = 1;
    messages.forEach((m) => {
      items.push({ id: items.length + 1, turn, role: m.role, text: m.text });
      if (m.role === "Candidate") turn += 1;
    });
    return items;
  }, [messages]);

  return (
    <div style={{
      border: "1px solid var(--ring)", borderRadius: 12, padding: 16,
      background: "linear-gradient(180deg, #ffffff, #fbfdff)"
    }}>
      <h3 style={{ fontWeight: 900, marginBottom: 10 }}>Interview Timeline</h3>
      {turns.length === 0 ? (
        <div style={{ color: "#94a3b8" }}>No turns yet — once the interview starts, they’ll appear here.</div>
      ) : (
        <div style={{ display:"grid", gap:10, maxHeight:240, overflowY:"auto" }}>
          {turns.map((t) => (
            <div key={t.id} style={{
              display:"grid", gridTemplateColumns:"44px 1fr", gap:10,
              border:"1px solid #eef2f7", borderRadius:12, padding:"8px 10px", background:"#fff"
            }}>
              <div style={{
                width:44, height:44, borderRadius:12, display:"grid", placeItems:"center",
                background: t.role === "Agent"
                  ? "linear-gradient(135deg,#dbeafe,#a78bfa)"
                  : "linear-gradient(135deg,#bbf7d0,#60a5fa)",
                color:"#0f172a", fontWeight:900
              }}>
                {t.turn}
              </div>
              <div>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:2 }}>
                  {t.role === "Agent" ? "Question" : "Candidate answer"}
                </div>
                <div style={{ fontSize:14, lineHeight:1.45 }}>{t.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
