
import React from "react";

const BANK = {
  general: [
    "What trade-offs did you evaluate and why?",
    "How did you validate impact? Any A/B or telemetry?",
    "Tell me about a failure and what changed after.",
  ],
  system: [
    "Sketch the high-level architecture and main bottlenecks.",
    "How would you scale read-heavy traffic 10x?",
    "What was your caching and invalidation strategy?",
  ],
  ml: [
    "What objective and offline metrics did you optimize?",
    "How did you mitigate data drift and label noise?",
    "Explain your evaluation protocol and guardrails.",
  ],
};

export default function QuestionBank({ onAsk, focus="general" }) {
  const items = [...BANK.general, ...(BANK[focus] || [])];
  return (
    <div className="card" style={{ padding:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <h3 style={{ margin:0, fontWeight:900 }}>Question Bank</h3>
        <span className="pill" style={{ fontSize:11 }}>Focus: {focus}</span>
      </div>
      <div style={{ display:"grid", gap:8 }}>
        {items.map((q,i)=>(
          <button key={i} onClick={()=>onAsk(q)} className="btn secondary" style={{ textAlign:"left" }}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
