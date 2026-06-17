import React from "react";
import VideoFeed from "./VideoFeed.jsx";
import ChatWindow from "./ChatWindow.jsx";
import FeedbackPanel from "./FeedbackPanel.jsx";
import EndInterviewModal from "./EndInterviewModal.jsx";

export default function InterviewView({
  roomUrl, isVideoOn, setIsVideoOn, isAudioOn, setIsAudioOn,
  pending, onEnd, onLocalStream,
  avatarMessage, health,
  messages, sendMessage, lastTurn,
  modalOpen, setModalOpen, onConfirmEnd,
}) {
  return (
    <div>
      <div className="interview-page animate-in" style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
        gap: 16, padding: 16,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <VideoFeed
            roomUrl={roomUrl}
            isVideoOn={isVideoOn}
            toggleVideo={() => setIsVideoOn(!isVideoOn)}
            isAudioOn={isAudioOn}
            toggleAudio={() => setIsAudioOn(!isAudioOn)}
            status="interview"
            pending={pending}
            onEnd={onEnd}
            onLocalStream={onLocalStream}
          />
          {avatarMessage && (
            <div style={{
              fontSize: 12, padding: "6px 10px",
              background: "rgba(245, 158, 11, 0.12)", color: "#92400e",
              border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: 6,
            }}>⚠ {avatarMessage}</div>
          )}
          {!health.openai && (
            <div style={{
              fontSize: 12, padding: "8px 12px",
              background: "rgba(198, 68, 40, 0.10)", color: "var(--red-600)",
              border: "1px solid rgba(198, 68, 40, 0.30)", borderRadius: 6,
              lineHeight: 1.4,
            }}>
              ⚠ <strong>OpenAI key invalid or missing.</strong> Voice (Whisper STT + AI TTS) is using browser fallback,
              and scores/follow-ups are using rule-based heuristics — not the LLM. Update <code>backend/.env</code>
              and restart to enable real AI responses.
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatWindow messages={messages} onSend={sendMessage} pending={pending} feedback={lastTurn?.feedback || ""} />
          </div>
          <FeedbackPanel turn={lastTurn} />
        </div>
      </div>
      <EndInterviewModal open={modalOpen} onClose={() => setModalOpen(false)} onMarkEnded={onConfirmEnd} />
    </div>
  );
}
