import React from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
} from "chart.js";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const LABELS = ["Structure", "Clarity", "Relevance", "Impact"];
const KEYS = ["structure", "clarity", "relevance", "impact"];

export default function FeedbackPanel({ turn, hideTitle = false, compact = false }) {
  const scores = turn?.scores || { structure: 0, clarity: 0, relevance: 0, impact: 0 };
  const data = {
    labels: LABELS,
    datasets: [{
      label: "This answer",
      data: KEYS.map((k) => scores[k] || 0),
      backgroundColor: "rgba(59,130,246,0.18)",
      borderColor: "rgba(59,130,246,1)",
      borderWidth: 2,
      pointBackgroundColor: "rgba(59,130,246,1)",
    }],
  };
  const opts = {
    scales: {
      r: {
        suggestedMin: 0, suggestedMax: 100,
        ticks: { display: false, stepSize: 25 },
        grid: { color: "rgba(0,0,0,0.06)" },
        angleLines: { color: "rgba(0,0,0,0.08)" },
        pointLabels: { font: { size: 11, weight: "600" } },
      },
    },
    plugins: { legend: { display: false } },
    maintainAspectRatio: false,
  };

  const avg =
    Math.round(KEYS.reduce((a, k) => a + (scores[k] || 0), 0) / KEYS.length);

  return (
    <div className={compact ? "" : "card"} style={{ padding: compact ? 0 : 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {!hideTitle && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0, fontWeight: 900 }}>Live Coaching</h3>
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: avg >= 70 ? "var(--green-600, #15803d)" : avg >= 50 ? "var(--blue-600, #2563eb)" : "var(--gray-500)",
          }}>
            {turn ? `${avg}/100` : "—"}
          </div>
        </div>
      )}

      {turn && (
        <div style={{ height: 180, position: "relative" }}>
          <Radar data={data} options={opts} />
        </div>
      )}

      {turn?.feedback && (
        <div style={{
          background: "var(--blue-50, #eff6ff)",
          border: "1px solid var(--blue-100, #dbeafe)",
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: "0.8125rem",
          color: "var(--blue-700, #1d4ed8)",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
            textTransform: "uppercase", marginBottom: 4, color: "var(--blue-500, #3b82f6)",
          }}>💡 Coaching Tip</div>
          {turn.feedback}
        </div>
      )}

      {turn?.rewrite && (
        <div style={{
          position: "relative",
          background: "linear-gradient(135deg, rgba(232,90,79,0.06) 0%, rgba(200,155,91,0.08) 100%)",
          border: "1.5px solid",
          borderImage: "linear-gradient(135deg, var(--blue-500), var(--gold-500)) 1",
          borderRadius: 12,
          padding: "14px 16px",
          boxShadow: "0 4px 16px rgba(232, 90, 79, 0.08)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
            textTransform: "uppercase", marginBottom: 8,
            color: "var(--blue-600)",
          }}>
            <span style={{
              display: "inline-grid", placeItems: "center",
              width: 22, height: 22, borderRadius: 6,
              background: "linear-gradient(135deg, var(--blue-500), var(--gold-500))",
              color: "white", fontSize: 12,
              boxShadow: "0 2px 6px rgba(232, 90, 79, 0.4)",
            }}>✨</span>
            Say this instead
          </div>
          <div style={{
            fontSize: "0.875rem", lineHeight: 1.6,
            color: "var(--gray-900)", fontWeight: 500,
          }}>
            {turn.rewrite}
          </div>
        </div>
      )}

      {!turn && (
        <div style={{
          color: "var(--gray-500)", fontSize: 13,
          padding: "18px 4px", textAlign: "center",
          background: "var(--gray-50)", borderRadius: 8,
          border: "1px dashed var(--gray-200)",
        }}>
          No answers were given during this session.
          <div style={{ fontSize: 11, marginTop: 6, color: "var(--gray-400)" }}>
            Sub-scores, a coaching tip, and a rewrite appear here after each answer.
          </div>
        </div>
      )}
    </div>
  );
}
