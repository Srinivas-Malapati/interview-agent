import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function PublicResults({ token }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/public/results/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { if (!cancelled) { setData(j); setStatus("ready"); } })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [token]);

  if (status === "loading") {
    return (
      <div style={pageStyle}>
        <div style={{ color: "var(--gray-500)" }}>Loading results…</div>
      </div>
    );
  }
  if (status === "error" || !data) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ marginBottom: 8 }}>Results not found</h1>
          <p style={{ color: "var(--gray-500)" }}>
            This share link may have expired or never existed.
          </p>
          <a href="/" className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>
            Try Greenroom →
          </a>
        </div>
      </div>
    );
  }

  const overall = data.overall_score || 0;
  const bl = data.body_language || {};
  const scores = data.scores || {};

  return (
    <div style={pageStyle}>
      <nav style={navStyle}>
        <div style={brandStyle}>
          <div style={brandIconStyle}>G</div>
          <span style={{ fontWeight: 700, fontSize: "1.0625rem" }}>Greenroom</span>
        </div>
        <a href="/" className="btn btn-primary">Practice your own →</a>
      </nav>

      <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-block",
            padding: "6px 14px",
            background: "var(--gray-100)",
            borderRadius: 999,
            fontSize: 12, fontWeight: 600,
            color: "var(--gray-600)",
            marginBottom: 14,
          }}>SHARED INTERVIEW RESULTS</div>
          <h1 style={{ margin: "0 0 8px", fontSize: "2rem" }}>
            {data.first_name}'s mock interview
          </h1>
          <p style={{ color: "var(--gray-500)", margin: 0, fontSize: "0.9375rem" }}>
            {data.role} · {data.seniority} · {data.duration_min || 0} min · {data.questions_answered || 0} questions
          </p>
        </div>

        <div style={gridStyle}>
          <div style={cardStyle}>
            <div style={cardLabelStyle}>Overall Score</div>
            <div style={{
              width: 140, height: 140, borderRadius: "50%",
              margin: "20px auto 14px",
              background: `conic-gradient(var(--blue-500) ${overall * 3.6}deg, var(--gray-200) ${overall * 3.6}deg)`,
              display: "grid", placeItems: "center",
            }}>
              <div style={{
                width: 110, height: 110, borderRadius: "50%",
                background: "var(--white)",
                display: "grid", placeItems: "center",
                fontSize: "2.25rem", fontWeight: 800,
              }}>{overall}</div>
            </div>
            <p style={{ fontSize: "0.875rem", margin: 0, color: "var(--gray-600)" }}>
              {overall >= 70 ? "Strong performance" : overall >= 50 ? "Room to grow" : "Early practice"}
            </p>
          </div>

          <div style={cardStyle}>
            <div style={cardLabelStyle}>Body Language</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              <Bar label="Engagement" pct={bl.engagement} />
              <Bar label="Warmth"     pct={bl.warmth} />
              <Bar label="Composure"  pct={bl.composure} />
              <Bar label="Energy"     pct={bl.energy} />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardLabelStyle}>Answer Quality</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              <Bar label="Structure" pct={scores.structure * 10} />
              <Bar label="Clarity"   pct={scores.clarity * 10} />
              <Bar label="Relevance" pct={scores.relevance * 10} />
              <Bar label="Impact"    pct={scores.impact * 10} />
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 40 }}>
          <p style={{ color: "var(--gray-500)", marginBottom: 16 }}>
            Want to see what your interview score looks like?
          </p>
          <a href="/" className="btn btn-primary" style={{ padding: "12px 28px", fontSize: "1rem" }}>
            Try Greenroom free →
          </a>
        </div>
      </div>
    </div>
  );
}

function Bar({ label, pct }) {
  const v = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "var(--gray-700)" }}>{label}</span>
        <span style={{ color: "var(--gray-500)", fontVariantNumeric: "tabular-nums" }}>{v}%</span>
      </div>
      <div style={{ height: 8, background: "var(--gray-100)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          width: `${v}%`, height: "100%",
          background: "linear-gradient(90deg, var(--blue-500), var(--gold-500))",
          borderRadius: 4,
        }} />
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "var(--gray-50)",
};

const navStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "16px 24px",
  background: "var(--white)",
  borderBottom: "1px solid var(--gray-200)",
};

const brandStyle = {
  display: "flex", alignItems: "center", gap: 10,
};

const brandIconStyle = {
  width: 32, height: 32, borderRadius: 8,
  background: "linear-gradient(135deg, var(--blue-500) 0%, var(--gold-500) 100%)",
  color: "white",
  display: "grid", placeItems: "center",
  fontWeight: 800, fontSize: 14,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 20,
};

const cardStyle = {
  background: "var(--white)",
  border: "1px solid var(--gray-200)",
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
  boxShadow: "var(--shadow-sm)",
};

const cardLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--gray-500)",
};
