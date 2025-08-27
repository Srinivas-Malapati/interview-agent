import React, { useMemo, useState } from "react";
import TopNav from "./components/TopNav.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import FeedbackPanel from "./components/FeedbackPanel.jsx";
import ScoreCard from "./components/ScoreCard.jsx";
import Timeline from "./components/Timeline.jsx";
import RecruiterDashboard from "./components/RecruiterDashboard.jsx";
import UnifiedProfile from "./components/UnifiedProfile.jsx";
import JobConfig from "./components/JobConfig.jsx";
import EndInterviewModal from "./components/EndInterviewModal.jsx";
import "./styles/theme.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function scoreAnswer(text) {
  const t = text || "";
  const words = t.trim().split(/\s+/).filter(Boolean).length;
  const hasMetric = /\b\d+(\.\d+)?%?|\b(\$|k|m|million|billion)\b/i.test(t);
  const hasStar = /(situation|task|action|result|impact|metric|outcome)/i.test(t);
  const hasTech = /(python|react|sql|fastapi|aws|gcp|docker|kubernetes|llm|rag)/i.test(t);

  let score = 40;
  if (words > 30) score += 10;
  if (words > 60) score += 10;
  if (hasMetric) score += 15;
  if (hasStar) score += 15;
  if (hasTech) score += 10;
  score = Math.max(0, Math.min(100, score));

  const strengths = [];
  const improvements = [];
  hasMetric ? strengths.push("Uses metrics/impact") : improvements.push("Add %/$/time saved/scale.");
  hasStar ? strengths.push("Structured (STAR)") : improvements.push("Use STAR.");
  hasTech ? strengths.push("Relevant technologies") : improvements.push("Mention tools/tech.");
  if (words < 30) improvements.push("Add more detail.");
  if (words > 120) improvements.push("Tighten to ~60–120 words.");

  return { score, strengths, improvements };
}

export default function App() {
  // Candidate profile & status
  const [candidateName, setCandidateName] = useState("Srinivas");
  const [status, setStatus] = useState("Not started"); // Not started → In progress → Ended

  // Interview messages & coaching
  const [messages, setMessages] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);

  // Scoring
  const [scoreData, setScoreData] = useState({
    score: 72,
    strengths: ["Clarity"],
    improvements: ["Add metrics"],
  });

  // End modal
  const [modalOpen, setModalOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  // JD / role config (left panel)
  const [role, setRole] = useState("Software Engineer");
  const [seniority, setSeniority] = useState("Mid");
  const [tone, setTone] = useState("Professional");
  const [focus, setFocus] = useState(["System Design"]);
  const [jdText, setJdText] = useState("");

  const transcript = useMemo(
    () => messages.map((m) => `${m.role}: ${m.text}`).join("\n"),
    [messages]
  );

  const startInterview = async () => {
    setStatus("In progress");
    setMessages([]);
    try {
      const res = await fetch(`${API}/start_interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: candidateName,
          role,
          seniority,
          tone,
          focus,
          description: jdText,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const q =
        json.first_question ||
        "Could you walk me through a project you’re proud of and your specific impact?";
      setMessages([{ role: "Agent", text: q }]);
    } catch (e) {
      setMessages([{ role: "Agent", text: `Error starting interview: ${e?.message || "Failed to fetch"}` }]);
    }
  };

  const sendMessage = async (msg) => {
    setMessages((m) => [...m, { role: "Candidate", text: msg }]);
    setScoreData(scoreAnswer(msg));
    setPending(true);
    try {
      const res = await fetch(`${API}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ candidate: candidateName, response: msg }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const followup =
        data?.followup ||
        "Thanks — can you share the measurable result (e.g., % improvement, time saved, scale handled)?";
      const coaching = data?.feedback || "Try STAR and include a concrete metric.";
      setMessages((m) => [...m, { role: "Agent", text: followup }]);
      setFeedback(coaching);
    } catch (e) {
      setMessages((m) => [...m, { role: "Agent", text: `Agent error: ${e?.message || "network"}` }]);
    } finally {
      setPending(false);
    }
  };

  const openEnd = () => setModalOpen(true);
  const markEnded = () => {
    setStatus("Ended");
    setModalOpen(false);
  };

  return (
    <>
      <TopNav
        onStart={startInterview}
        onEnd={openEnd}
        darkToggle
      />

      <div style={{ maxWidth: 1180, margin: "24px auto 56px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr 360px", gap: 20 }}>
          {/* LEFT COLUMN: Candidate + JD config */}
          <div style={{ display: "grid", gap: 16 }}>
            <div className="card">
              <div className="card-title">Candidate Profile</div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div className="avatar">{candidateName?.[0]?.toUpperCase() || "U"}</div>
                <div>
                  <div className="name-row">
                    <div className="name">{candidateName}</div>
                    <span className={`pill ${status === "In progress" ? "green" : status === "Ended" ? "red" : ""}`}>
                      {status}
                    </span>
                  </div>
                  <div className="subtle">Software Engineer • {seniority}</div>
                </div>
              </div>
            </div>

            <UnifiedProfile
              candidateName={candidateName}
              setCandidateName={setCandidateName}
              apiBase={API}
            />

            <JobConfig
              role={role}
              setRole={setRole}
              seniority={seniority}
              setSeniority={setSeniority}
              tone={tone}
              setTone={setTone}
              focus={focus}
              setFocus={setFocus}
              jdText={jdText}
              setJdText={setJdText}
            />
          </div>

          {/* CENTER COLUMN: Chat */}
          <ChatWindow
            title="Interview"
            subtitle="Answer by typing or speaking — the agent adapts."
            messages={messages}
            onSend={sendMessage}
            pending={pending}
          />

          {/* RIGHT COLUMN: Timeline + coaching + score + recruiter tools */}
          <div style={{ display: "grid", gap: 16 }}>
            <Timeline messages={messages} />
            <FeedbackPanel feedback={feedback} />
            <ScoreCard
              score={scoreData.score}
              strengths={scoreData.strengths}
              improvements={scoreData.improvements}
            />
            <RecruiterDashboard transcript={messages.length ? transcript : ""} />
          </div>
        </div>
      </div>

      <EndInterviewModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onMarkEnded={markEnded}
        summaryText={summaryText}
        setSummaryText={setSummaryText}
      />
    </>
  );
}
