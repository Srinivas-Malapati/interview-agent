import React, { useEffect, useRef, useState } from "react";

/**
 * Pre-interview check: camera preview + live mic level meter + permissions.
 * The user must confirm "Looks good" before the real interview starts.
 *
 * Props:
 *   onPass:  () => void    called when user clicks "Looks good"
 *   onBack:  () => void    return to setup
 */
export default function PrecheckScreen({ onPass, onBack }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState("");

  // Audio analysis refs
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    let active = true;
    let localStream = null;

    async function setup() {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true,
        });
        if (!active) { ms.getTracks().forEach((t) => t.stop()); return; }
        localStream = ms;
        setStream(ms);
        if (videoRef.current) videoRef.current.srcObject = ms;

        // Mic level meter
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(ms);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (let i = 0; i < data.length; i++) {
            const v = Math.abs(data[i] - 128);
            if (v > peak) peak = v;
          }
          setMicLevel(Math.min(100, Math.round((peak / 128) * 200)));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        console.warn("Precheck media error:", e);
        setError(
          e?.name === "NotAllowedError"
            ? "You denied camera/mic access. Click the camera icon in the address bar to allow, then refresh."
            : e?.name === "NotFoundError"
            ? "No camera or microphone found on this device."
            : `Could not access camera/mic: ${e?.message}`
        );
      }
    }
    setup();

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      try { audioCtxRef.current?.close(); } catch {}
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const cameraOk = stream && stream.getVideoTracks().some((t) => t.readyState === "live");
  const micOk = micLevel > 4;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 720,
        background: "var(--white)",
        border: "1px solid var(--gray-200)",
        borderRadius: 20,
        padding: 28,
        boxShadow: "var(--shadow-lg)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: 6 }}>Camera & mic check</h1>
          <p style={{ color: "var(--gray-500)", fontSize: 14 }}>
            Make sure you're framed well and speak — the bar below moves with your voice.
          </p>
        </div>

        <div style={{
          position: "relative",
          aspectRatio: "16/9",
          borderRadius: 14,
          overflow: "hidden",
          background: "#0b0a08",
          marginBottom: 16,
        }}>
          <video
            ref={videoRef}
            autoPlay playsInline muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {error && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.75)", color: "#fff",
              padding: 24, textAlign: "center", fontSize: 14,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Status row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <StatusPill label="Camera" ok={cameraOk} />
          <StatusPill label="Microphone" ok={micOk} />
        </div>

        {/* Mic level meter */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--gray-600)", marginBottom: 6 }}>
            <span>Mic level</span>
            <span>{micOk ? "Hearing you ✓" : "Try saying something"}</span>
          </div>
          <div style={{ height: 8, background: "var(--gray-100)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{
              width: `${micLevel}%`, height: "100%",
              background: micOk ? "var(--green-500)" : "var(--gray-300)",
              transition: "width 80ms linear, background 200ms",
            }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <button
            className="btn btn-primary"
            disabled={!cameraOk}
            onClick={() => {
              // Release the precheck stream before handing off
              stream?.getTracks().forEach((t) => t.stop());
              try { audioCtxRef.current?.close(); } catch {}
              onPass();
            }}
          >
            Looks good — Start Interview →
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, ok }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 12px", borderRadius: 999,
      background: ok ? "var(--green-50)" : "var(--gray-100)",
      border: `1px solid ${ok ? "var(--green-100)" : "var(--gray-200)"}`,
      fontSize: 13, fontWeight: 600,
      color: ok ? "var(--green-700)" : "var(--gray-600)",
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: ok ? "var(--green-500)" : "var(--gray-400)",
      }} />
      {label} {ok ? "ready" : "checking…"}
    </div>
  );
}
