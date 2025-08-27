import React, { useState } from "react";

export default function TopNav({ onStart, onEnd, darkToggle = true }) {
  const [dark, setDark] = useState(false);
  return (
    <div className="topnav">
      <div className="brand">
        <span className="sparkle">✨</span> <span className="logo">HireSense</span>
        <span className="sub">Interview Pilot</span>
      </div>
      <div className="actions">
        {darkToggle && (
          <button
            className="btn ghost"
            onClick={() => {
              setDark((d) => !d);
              document.documentElement.classList.toggle("dark", !dark);
            }}
          >
            {dark ? "Light" : "Dark"}
          </button>
        )}
        <button className="btn primary" onClick={onStart}>🚀 Start Interview</button>
        <button className="btn danger" onClick={onEnd}>End Interview</button>
      </div>
    </div>
  );
}
