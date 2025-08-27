
import React, { useState } from "react";

export default function RecruiterDashboard({ transcript }) {
  const [loading, setLoading] = useState(false);
  const [rubric, setRubric] = useState(null);
  const [error, setError] = useState("");

  const generateRubric = async () => {
    if (!transcript || !transcript.trim()) {
      setError("No transcript yet. Start the interview first.");
      setTimeout(() => setError(""), 2000);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/rubric/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ transcript }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();
      setRubric(data);
    } catch (e) {
      setError(e.message || "Failed to generate rubric.");
    } finally {
      setLoading(false);
    }
  };

  const exportJSON = () => {
    const content = JSON.stringify({
      transcript,
      rubric: rubric || {}
    }, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `hiresense-summary-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scores = rubric?.scores || {};
  const rationale = rubric?.rationale || {};
  const categories = [
    ["Communication", scores.Communication ?? 0, rationale.Communication || ""],
    ["TechnicalDepth", scores.TechnicalDepth ?? 0, rationale.TechnicalDepth || ""],
    ["ProblemSolving", scores.ProblemSolving ?? 0, rationale.ProblemSolving || ""],
    ["ProductThinking", scores.ProductThinking ?? 0, rationale.ProductThinking || ""],
    ["CultureAdd", scores.CultureAdd ?? 0, rationale.CultureAdd || ""],
  ];

  return (
    <div style={{
      border: "1px solid var(--ring)", borderRadius: 12, padding: 16, marginTop: 16,
      background: "linear-gradient(180deg, #ffffff, #fbfdff)"
    }}>
      <h3 style={{ fontWeight: 900, marginBottom: 8 }}>Recruiter Dashboard</h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          onClick={generateRubric}
          disabled={loading}
          style={{
            background: loading ? "#c7d2fe" : "linear-gradient(90deg,#1d4ed8,#7c3aed)",
            color: "white", border: 0, borderRadius: 10, padding: "10px 12px", fontWeight: 800
          }}
        >
          {loading ? "Scoring…" : "Generate Rubric"}
        </button>
        <button
          onClick={exportJSON}
          disabled={!rubric}
          style={{
            background: "#fff", color: "#334155", border: "1px solid #e5e7eb",
            borderRadius: 10, padding: "10px 12px", fontWeight: 800, cursor: rubric ? "pointer" : "not-allowed"
          }}
        >
          Export JSON
        </button>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 6 }}>{error}</div>}

      {!rubric ? (
        <div style={{ color: "#94a3b8", fontSize: 14 }}>
          Generate a rubric to see category scores and rationale.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            {categories.map(([label, val, why]) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  <span>{label.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span>{val}/5</span>
                </div>
                <div style={{
                  height: 10, borderRadius: 999,
                  background: "linear-gradient(90deg,#e5e7eb,#e5e7eb)"
                }}>
                  <div style={{
                    width: `${(val/5)*100}%`, height: "100%", borderRadius: 999,
                    background: "linear-gradient(90deg,#1d4ed8,#7c3aed,#22c55e)"
                  }}/>
                </div>
                {why && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{why}</div>}
              </div>
            ))}
          </div>
          {rubric.overallSummary && (
            <div style={{ marginTop: 10, fontSize: 14 }}>
              <strong>Overall:</strong> {rubric.overallSummary}
            </div>
          )}
        </>
      )}
    </div>
  );
}
