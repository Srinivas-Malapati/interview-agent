
import React from "react";

export default function ComposerHelpers({ value, setValue }) {
  const insertSTAR = () => {
    const star = `Situation: 
Task: 
Action: 
Result (with metrics): `;
    setValue((v) => (v ? v + "\n\n" + star : star));
  };

  const addMetricHint = () => {
    const hint = " (e.g., improved latency by 35%, saved $120k/year, scaled to 3M MAU in 6 months)";
    setValue((v) => v + hint);
  };

  const tighten = () => {
    const words = (value || "").replace(/\s+/g, " ").trim().split(" ");
    const clipped = words.slice(0, 120).join(" ");
    setValue(clipped);
  };

  const BTN = {
    base: {
      border: "1px solid #e5e7eb", background: "#fff", padding: "6px 10px",
      borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12, color: "#334155"
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button style={BTN.base} onClick={insertSTAR}>Insert STAR</button>
      <button style={BTN.base} onClick={addMetricHint}>Add metric hint</button>
      <button style={BTN.base} onClick={tighten}>Tighten to ~120 words</button>
    </div>
  );
}
