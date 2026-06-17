import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function SessionSummary({ candidate, apiBase, refreshKey }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${apiBase}/sessions/${encodeURIComponent(candidate)}`)
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((j) => { if (alive) setSessions(j.sessions || []); })
      .catch(() => { if (alive) setSessions([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [candidate, apiBase, refreshKey]);

  if (loading) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ margin: 0, fontWeight: 900 }}>Progress</h3>
        <div style={{ color: "var(--gray-500)", fontSize: 13, marginTop: 8 }}>Loading…</div>
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ margin: 0, fontWeight: 900 }}>Progress</h3>
        <div style={{ color: "var(--gray-500)", fontSize: 13, marginTop: 8 }}>
          Your first session — practice a few more and we'll plot how you improve.
        </div>
      </div>
    );
  }

  const labels = sessions.map((s, i) => `#${i + 1}`);
  const overall = sessions.map((s) => s.overall_score || 0);
  const avgTurn = (s, k) =>
    s.turns?.length ? Math.round(s.turns.reduce((a, t) => a + (t.scores?.[k] || 0), 0) / s.turns.length) : 0;
  const struct = sessions.map((s) => avgTurn(s, "structure"));
  const clarity = sessions.map((s) => avgTurn(s, "clarity"));
  const impact = sessions.map((s) => avgTurn(s, "impact"));

  const data = {
    labels,
    datasets: [
      { label: "Overall",   data: overall,  borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.15)", tension: 0.3 },
      { label: "Structure", data: struct,   borderColor: "#10b981", backgroundColor: "transparent", tension: 0.3, borderDash: [4, 4] },
      { label: "Clarity",   data: clarity,  borderColor: "#f59e0b", backgroundColor: "transparent", tension: 0.3, borderDash: [4, 4] },
      { label: "Impact",    data: impact,   borderColor: "#ef4444", backgroundColor: "transparent", tension: 0.3, borderDash: [4, 4] },
    ],
  };
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { suggestedMin: 0, suggestedMax: 100 } },
    plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontWeight: 900 }}>Progress across sessions</h3>
        <div style={{ fontSize: 12, color: "var(--gray-500)" }}>{sessions.length} session{sessions.length === 1 ? "" : "s"}</div>
      </div>
      <div style={{ height: 200 }}>
        <Line data={data} options={opts} />
      </div>
    </div>
  );
}
