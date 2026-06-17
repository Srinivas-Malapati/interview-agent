import React, { useEffect, useRef, useState } from "react";
import DailyIframe from "@daily-co/daily-js";

export default function VideoFeed({
  roomUrl,
  isVideoOn, toggleVideo,
  isAudioOn, toggleAudio,
  status, pending, onEnd,
  onLocalStream,
}) {
  const candidateVideoRef = useRef(null);
  const avatarVideoRef = useRef(null);
  const avatarAudioRef = useRef(null);
  const callRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [avatarConnected, setAvatarConnected] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);

  useEffect(() => {
    let localStream = null;
    async function setupCamera() {
      try {
        // Video only — Tavus or the ChatWindow mic-button handles audio
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        });
        localStream = mediaStream;
        setStream(mediaStream);
        if (candidateVideoRef.current) candidateVideoRef.current.srcObject = mediaStream;
        onLocalStream?.(mediaStream);
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
    if (status === "interview") setupCamera();
    return () => { if (localStream) localStream.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (stream) stream.getVideoTracks().forEach((t) => { t.enabled = isVideoOn; });
  }, [isVideoOn, stream]);

  useEffect(() => {
    if (status !== "interview" || !roomUrl) return;
    const call = DailyIframe.createCallObject({ audioSource: true, videoSource: false });
    callRef.current = call;
    const onTrack = (ev) => {
      const { track, participant } = ev;
      if (!track || !participant || participant.local) return;
      if (track.kind === "video" && avatarVideoRef.current) {
        avatarVideoRef.current.srcObject = new MediaStream([track]);
        setAvatarConnected(true);
      }
      if (track.kind === "audio" && avatarAudioRef.current) {
        avatarAudioRef.current.srcObject = new MediaStream([track]);
      }
    };
    const onPart = (ev) => {
      const p = ev?.participant;
      if (p && !p.local) setAvatarSpeaking(!!p.audio && p?.tracks?.audio?.state === "playable");
    };
    const onLeft = () => setAvatarConnected(false);
    call.on("track-started", onTrack);
    call.on("participant-updated", onPart);
    call.on("left-meeting", onLeft);
    call.join({ url: roomUrl, userName: "candidate" }).catch((e) => console.error("Tavus join error:", e));
    return () => {
      try { call.leave(); } catch {}
      try { call.destroy(); } catch {}
      callRef.current = null;
    };
  }, [status, roomUrl]);

  useEffect(() => {
    if (callRef.current) {
      try { callRef.current.setLocalAudio(isAudioOn); } catch {}
    }
  }, [isAudioOn]);

  useEffect(() => {
    if (status !== "interview") return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="interview-video" style={{ background: "#0b0a08" }}>
      <video ref={candidateVideoRef} autoPlay playsInline muted
        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: isVideoOn ? 1 : 0, transition: "opacity 0.25s" }}
      />
      {!isVideoOn && (
        <div className="video-placeholder">
          <div className="video-placeholder-icon" style={{ fontSize: 56 }}>📷</div>
          <h3>Camera is off</h3>
          <p>Turn it back on to keep the session natural.</p>
        </div>
      )}

      <div style={{
        position: "absolute", left: 16, bottom: 88,
        background: "rgba(0,0,0,0.55)", color: "#fff",
        padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
        backdropFilter: "blur(8px)",
      }}>You</div>

      <div className="rec-indicator">
        <div className="rec-dot" />
        LIVE {formatTime(elapsed)}
      </div>

      <div style={{
        position: "absolute", top: 16, right: 16,
        width: 220, height: 280,
        borderRadius: 14, overflow: "hidden",
        background: "linear-gradient(135deg, #2a261f 0%, #1a1812 100%)",
        border: "2px solid rgba(232, 90, 79, 0.5)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
        display: "flex", flexDirection: "column",
      }}>
        {roomUrl ? (
          <>
            <video ref={avatarVideoRef} autoPlay playsInline
              style={{ width: "100%", flex: 1, objectFit: "cover", background: "#000" }} />
            <audio ref={avatarAudioRef} autoPlay />
            {!avatarConnected && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "#fff", gap: 6, padding: 16, textAlign: "center",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "linear-gradient(135deg, #e85a4f, #c89b5b)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: 18,
                }}>G</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Connecting…</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>your interviewer is joining</div>
              </div>
            )}
          </>
        ) : (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            color: "#fff", gap: 8, padding: 16, textAlign: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, #e85a4f, #c89b5b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 22,
            }}>G</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Greenroom</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
              avatar disabled — add Tavus keys
            </div>
          </div>
        )}

        <div style={{
          padding: "6px 10px", background: "rgba(0,0,0,0.55)",
          color: "#fff", fontSize: 11, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: pending ? "#c89b5b" : avatarSpeaking ? "#e85a4f" : "#7c9e69",
            }} />
            {pending ? "Thinking…" : avatarSpeaking ? "Speaking" : avatarConnected ? "Listening" : roomUrl ? "Connecting" : "Idle"}
          </span>
          <span style={{ opacity: 0.65 }}>Greenroom</span>
        </div>
      </div>

      <div className="video-bar">
        <button className={`video-bar-btn ${!isAudioOn ? "off" : ""}`} onClick={toggleAudio} title={isAudioOn ? "Mute" : "Unmute"}>
          {isAudioOn ? "🎙️" : "🔇"}
        </button>
        <button className={`video-bar-btn ${!isVideoOn ? "off" : ""}`} onClick={toggleVideo} title={isVideoOn ? "Camera off" : "Camera on"}>
          {isVideoOn ? "📷" : "🚫"}
        </button>
        <button className="video-bar-end" onClick={onEnd}>End Interview</button>
      </div>
    </div>
  );
}
