
import React from "react";

const TAGS = ["Hire Signal", "Culture Fit", "Ownership", "Communication", "Technical Depth"];

export default function TagBar({ tags, setTags }) {
  const toggle = (t) => {
    setTags((prev)=> prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);
  };
  return (
    <div className="card" style={{ padding:16 }}>
      <h3 style={{ margin:0, marginBottom:10, fontWeight:900 }}>Signals</h3>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
        {TAGS.map(t=>(
          <button
            key={t}
            className="pill"
            onClick={()=>toggle(t)}
            style={{
              borderColor: tags.includes(t) ? "var(--brandA)" : "var(--ring)",
              background: tags.includes(t) ? "rgba(29,78,216,.10)" : "#fff"
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
