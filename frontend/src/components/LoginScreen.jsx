import React, { useState } from "react";
import { signInWithGoogle, signInWithEmail } from "../lib/supabase.js";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  const sendMagicLink = async (e) => {
    e?.preventDefault();
    if (!email) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const { error } = await signInWithEmail(email);
      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err?.message || "Could not send magic link");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 440,
        background: "var(--white)",
        border: "1px solid var(--gray-200)",
        borderRadius: 20,
        padding: 36,
        boxShadow: "var(--shadow-lg)",
        textAlign: "center",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          margin: "0 auto 18px",
          background: "linear-gradient(135deg, var(--blue-500) 0%, var(--gold-500) 100%)",
          display: "grid", placeItems: "center",
          color: "white", fontWeight: 800, fontSize: 22,
          boxShadow: "0 10px 24px rgba(232, 90, 79, 0.30)",
        }}>G</div>

        <h1 style={{ fontSize: "1.625rem", marginBottom: 8 }}>Welcome to Greenroom</h1>
        <p style={{ color: "var(--gray-500)", marginBottom: 28, fontSize: "0.9375rem", lineHeight: 1.5 }}>
          Sign in to practice with your face-to-face AI interviewer.
        </p>

        <button
          onClick={signInWithGoogle}
          className="btn btn-primary"
          style={{ width: "100%", padding: "12px 16px", marginBottom: 16 }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <GoogleIcon /> Continue with Google
          </span>
        </button>

        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          color: "var(--gray-400)", fontSize: 12, margin: "20px 0",
        }}>
          <div style={{ flex: 1, height: 1, background: "var(--gray-200)" }} />
          or use email
          <div style={{ flex: 1, height: 1, background: "var(--gray-200)" }} />
        </div>

        {status === "sent" ? (
          <div style={{
            padding: "14px 16px",
            background: "var(--green-50)",
            border: "1px solid var(--green-100)",
            color: "var(--green-700)",
            borderRadius: 10, fontSize: 14, lineHeight: 1.5,
          }}>
            ✓ Magic link sent to <strong>{email}</strong>. Check your inbox.
          </div>
        ) : (
          <form onSubmit={sendMagicLink}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === "sending"}
              style={{
                width: "100%", padding: "12px 14px",
                border: "1px solid var(--gray-200)",
                borderRadius: 10, fontSize: 14,
                marginBottom: 10,
              }}
            />
            <button
              type="submit"
              className="btn btn-ghost"
              disabled={status === "sending" || !email}
              style={{ width: "100%", padding: "12px 16px" }}
            >
              {status === "sending" ? "Sending…" : "Email me a magic link →"}
            </button>
            {errorMsg && (
              <div style={{
                marginTop: 10, padding: "8px 12px",
                background: "var(--red-50)", color: "var(--red-600)",
                border: "1px solid rgba(198, 68, 40, 0.25)",
                borderRadius: 8, fontSize: 12,
              }}>
                {errorMsg}
              </div>
            )}
          </form>
        )}

        <p style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 24, lineHeight: 1.5 }}>
          By signing in you agree to practice answering questions, not give us your social security number.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#fff" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#fff" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" opacity="0.95"/>
      <path fill="#fff" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" opacity="0.85"/>
      <path fill="#fff" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" opacity="0.75"/>
    </svg>
  );
}
