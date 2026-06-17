import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/theme.css";

// ─── Sentry (env-gated, only active in prod) ───
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  import("@sentry/react").then(({ init, browserTracingIntegration, replayIntegration }) => {
    init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      integrations: [browserTracingIntegration(), replayIntegration()],
      tracesSampleRate: 0.1,        // 10% of transactions
      replaysSessionSampleRate: 0.0, // 0% normal sessions
      replaysOnErrorSampleRate: 1.0, // 100% of errored sessions get replay
      sendDefaultPii: false,
    });
    console.log("Sentry initialized");
  }).catch((e) => console.warn("Sentry failed to load:", e));
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", saved || (prefersDark ? "dark" : "light"));
}
initTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
