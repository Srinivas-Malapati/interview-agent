
import React from "react";

const Item = ({ label, emoji, active=false }) => (
  <div
    className="card"
    style={{
      padding: 10, borderRadius: 12,
      background: active ? "linear-gradient(180deg, rgba(29,78,216,.10), #fff)" : "var(--card)",
      display: "flex", alignItems: "center", gap: 10,
      cursor: "pointer"
    }}
    title={label}
  >
    <span style={{ fontSize: 18 }}>{emoji}</span>
    <span style={{ fontWeight: 700 }}>{label}</span>
  </div>
);

export default function Sidebar() {
  return (
    <aside style={{ width: 210, display:"grid", gap: 10 }}>
      <Item label="Candidates" emoji="👤" />
      <Item label="Interviews" emoji="💬" active />
      <Item label="Reports" emoji="📈" />
      <Item label="Settings" emoji="⚙️" />
    </aside>
  );
}
