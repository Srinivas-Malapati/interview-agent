import React, { useEffect, useState } from "react";
import { authedFetch } from "../lib/supabase.js";

export default function PastSessionsList({ candidate, apiBase, onPick, refreshKey, currentSessionId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Cache-bust the GET so Safari can't show stale data after Clear
    authedFetch(`${apiBase}/sessions/${encodeURIComponent(candidate)}?_=${refreshKey}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((j) => {
        if (alive) {
          const list = (j.sessions || [])
            .slice()
            .reverse()
            // Hide the session currently displayed on the results view —
            // the user is looking at it above, no need to show it twice.
            .filter((s) => s.id !== currentSessionId);
          setSessions(list);
        }
      })
      .catch(() => { if (alive) setSessions([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [candidate, apiBase, refreshKey, currentSessionId]);

  if (loading) {
    return (
      <div style={{ color: "var(--gray-500)", fontSize: 13, padding: 12 }}>Loading past sessions…</div>
    );
  }
  if (!sessions.length) {
    return (
      <div style={{ color: "var(--gray-500)", fontSize: 13, padding: 12, fontStyle: "italic" }}>
        No past sessions yet. Run a few more to build a history.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sessions.map((s) => {
        const date = s.started_at ? new Date(s.started_at) : null;
        const turns = s.turns?.length || 0;
        return (
          <button
            key={s.id}
            onClick={() => onPick?.(s)}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "12px 14px",
              background: "var(--white)",
              border: "1px solid var(--gray-200)",
              borderRadius: 12,
              textAlign: "left",
              cursor: "pointer",
              transition: "transform 0.1s ease, box-shadow 0.1s ease, border-color 0.1s ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--blue-500)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "var(--shadow-sm)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--gray-200)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <ScoreBubble score={s.overall_score || 0} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--gray-900)" }}>
                {s.role} <span style={{ color: "var(--gray-500)", fontWeight: 500 }}>· {s.seniority}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 2 }}>
                {date ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                {" · "}
                {turns} turn{turns === 1 ? "" : "s"}
              </div>
            </div>
            <span style={{ color: "var(--gray-400)", fontSize: 18 }}>›</span>
          </button>
        );
      })}
    </div>
  );
}

function ScoreBubble({ score }) {
  const safe = Math.max(0, Math.min(100, score || 0));
  const color = safe >= 70 ? "var(--green-500)" : safe >= 50 ? "var(--blue-500)" : "var(--gray-400)";
  return (
    <div style={{
      width: 44, height: 44, borderRadius: "50%",
      background: `conic-gradient(${color} ${safe * 3.6}deg, var(--gray-100) ${safe * 3.6}deg)`,
      display: "grid", placeItems: "center", flexShrink: 0, position: "relative",
    }}>
      <div style={{
        position: "absolute", inset: 4, borderRadius: "50%", background: "var(--white)",
        display: "grid", placeItems: "center",
        fontSize: 13, fontWeight: 800, color: "var(--gray-900)",
      }}>
        {safe}
      </div>
    </div>
  );
}
