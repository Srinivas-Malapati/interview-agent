from __future__ import annotations
import os
import re
from typing import Dict, List, Optional, Tuple

# Optional OpenAI (keep soft dependency)
_OPENAI_OK = False
try:
    from openai import OpenAI
    _OPENAI_OK = bool(os.getenv("OPENAI_API_KEY"))
except Exception:
    _OPENAI_OK = False


TECH_REGEX = re.compile(
    r"\b(python|typescript|javascript|react|vue|node|fastapi|flask|django|"
    r"sql|postgres|mysql|mongodb|redis|aws|gcp|azure|docker|kubernetes|"
    r"terraform|airflow|spark|hadoop|kafka|elasticsearch|grpc|"
    r"pytorch|tensorflow|sklearn|huggingface|llm|rag|vector|milvus|weaviate|"
    r"snowflake|databricks|bigquery|lambda|s3|cloudfront|sagemaker)\b",
    re.I,
)

STAR_HINTS = {
    "situation": re.compile(r"\b(situation|context|problem|background)\b", re.I),
    "task": re.compile(r"\b(task|goal|objective|role)\b", re.I),
    "action": re.compile(r"\b(action|implemented|built|designed|led|drove|migrated)\b", re.I),
    "result": re.compile(r"\b(result|impact|outcome|metric|improved|reduced|increased|saved)\b", re.I),
}

METRIC_REGEX = re.compile(r"\b\d+(\.\d+)?\s?(%|percent|x|k|m|mn|million|billion|\$|sec|ms|req/s|rps|errors|latency|cost)\b", re.I)
OWNERSHIP_REGEX = re.compile(r"\b(I|my|me|myself|led|owned|drove|designed|architected|authored)\b", re.I)
FAILURE_REGEX = re.compile(r"\b(failed|outage|incident|postmortem|rollback|bug|regression|oncall)\b", re.I)

# --------- Helper planning utilities ---------
def has_metric(text: str) -> bool:
    return bool(METRIC_REGEX.search(text or ""))

def has_star_piece(text: str, piece: str) -> bool:
    rx = STAR_HINTS.get(piece)
    return bool(rx and rx.search(text or ""))

def star_coverage(text: str) -> int:
    return sum(int(has_star_piece(text, k)) for k in STAR_HINTS.keys())

def mentions_tech(text: str) -> bool:
    return bool(TECH_REGEX.search(text or ""))

def shows_ownership(text: str) -> bool:
    return bool(OWNERSHIP_REGEX.search(text or ""))

# --------- State & templates ---------
class SessionState:
    def __init__(self):
        self.turn: int = 0
        self.asked_topics: List[str] = []
        self.resume: Dict = {}
        self.jd: Dict = {}

    def mark(self, topic: str):
        if topic not in self.asked_topics:
            self.asked_topics.append(topic)

class InterviewAgent:
    """
    Conversation manager with light planning:
    - Tracks state per candidate
    - Picks diverse follow-ups based on the candidate's last answer
    - Uses OpenAI if available, otherwise robust templates
    """
    def __init__(self):
        self.state: Dict[str, SessionState] = {}
        self.client = OpenAI() if _OPENAI_OK else None

    # ---------- Public API used by app.py ----------
    def question_from_resume(self, candidate: str, parsed_resume: Dict) -> str:
        st = self.state.setdefault(candidate, SessionState())
        st.resume = parsed_resume or {}
        st.turn = 0
        st.asked_topics = []

        # Try to tailor the opener from resume skills/experience
        skills = st.resume.get("skills") or []
        exps = st.resume.get("experiences") or []
        if skills:
            pri_skill = skills[0]
            q = f"To start, could you walk me through a recent project where you used {pri_skill}? Focus on your role and the measurable impact."
        elif exps:
            q = f"Pick one of the experiences on your resume that best reflects this role. What was the challenge, and what changed because of your work?"
        else:
            q = "Could you walk me through a project you’re proud of and your specific impact?"
        st.mark("opener")
        st.turn = 1
        return q

    def start_interview(self, candidate: str, jd_info: Dict) -> str:
        st = self.state.setdefault(candidate, SessionState())
        st.jd = jd_info or {}
        st.turn = 1
        st.asked_topics = []

        focus = (jd_info.get("focus") or ["impact"])[0]
        level = jd_info.get("seniority") or "mid"
        if focus.lower() in ("system design", "architecture"):
            q = "Let’s start with system design: design a high-level architecture for a solution you recently shipped. What were the key components and trade-offs?"
        elif level.lower() in ("senior", "staff", "lead"):
            q = "Tell me about a project where you led the direction. How did you align stakeholders and what outcome did you drive?"
        else:
            q = "Could you walk me through a project you’re proud of and your specific impact?"
        st.mark("opener")
        return q

    def handle_answer(self, candidate: str, answer: str) -> Tuple[str, str]:
        """
        Returns (followup_question, coaching_feedback)
        """
        st = self.state.setdefault(candidate, SessionState())
        st.turn += 1

        # Try LLM for follow-up if available. If not, use templates.
        if self.client:
            try:
                sys = (
                    "You are a precise technical interviewer. Ask a single, concise follow-up question "
                    "that advances depth. Avoid repeating previous questions. Prefer specifics: metrics, "
                    "trade-offs, constraints, failure modes, scale, testing, or ownership."
                )
                user = f"Candidate answer: {answer}\nAlready covered: {', '.join(st.asked_topics) or 'none'}"
                chat = self.client.chat.completions.create(
                    model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                    messages=[
                        {"role": "system", "content": sys},
                        {"role": "user", "content": user},
                    ],
                    temperature=0.3,
                    max_tokens=120,
                )
                q = chat.choices[0].message.content.strip()
                # Light de-dup guard
                if any(tag in q.lower() for tag in st.asked_topics[-3:]):
                    q = self._rule_based_followup(answer, st)
            except Exception:
                q = self._rule_based_followup(answer, st)
        else:
            q = self._rule_based_followup(answer, st)

        # Coaching
        feedback = self._coaching(answer)

        return (q, feedback)

    def rubric_scores(self, transcript: str) -> Dict:
        # Keep lightweight local rubric (you already render this on the UI)
        depth = min(100, 40 + 10 * transcript.lower().count("why"))
        metrics = 90 if METRIC_REGEX.search(transcript or "") else 50
        structure = 90 if all(h.search(transcript or "") for h in STAR_HINTS.values()) else 60
        clarity = 80
        overall = round((depth + metrics + structure + clarity) / 4)
        return {
            "overall": overall,
            "categories": [
                {"name": "Depth", "score": depth, "rationale": "Probes root cause, trade-offs, constraints."},
                {"name": "Metrics", "score": metrics, "rationale": "Uses %/$/latency/scale."},
                {"name": "Structure", "score": structure, "rationale": "STAR / structured narrative."},
                {"name": "Clarity", "score": clarity, "rationale": "Clear, concise communication."},
            ],
            "notes": "Auto-scored locally for demo purposes.",
        }

    # ---------- Internal: rule-based planner ----------
    def _rule_based_followup(self, answer: str, st: SessionState) -> str:
        text = (answer or "").strip()
        asked = set(st.asked_topics)

        # 1) Missing result/metric → ask impact
        if "metrics" not in asked and not has_metric(text):
            st.mark("metrics")
            return "What measurable result did you achieve (e.g., % improvement, time saved, cost reduced, or scale handled)?"

        # 2) Missing STAR pieces → ask the first missing one
        if "star-result" not in asked and not has_star_piece(text, "result"):
            st.mark("star-result")
            return "What was the outcome? Please quantify the result if possible."
        if "star-action" not in asked and not has_star_piece(text, "action"):
            st.mark("star-action")
            return "What specific actions did you personally take? Call out key design or implementation steps."
        if "star-task" not in asked and not has_star_piece(text, "task"):
            st.mark("star-task")
            return "What was your exact scope or responsibility in this project?"
        if "star-situation" not in asked and not has_star_piece(text, "situation"):
            st.mark("star-situation")
            return "Briefly set the context—what problem or constraint were you addressing?"

        # 3) No technology specifics → ask architecture/tech stack
        if "tech" not in asked and not mentions_tech(text):
            st.mark("tech")
            return "What technologies or architecture choices did you use, and why were they a good fit?"

        # 4) Ownership/leadership
        if "ownership" not in asked and not shows_ownership(text):
            st.mark("ownership")
            return "Which parts did you personally own end-to-end, and where did you have to influence others?"

        # 5) Trade-offs & constraints (depth)
        if "tradeoffs" not in asked:
            st.mark("tradeoffs")
            return "What trade-offs did you consider (e.g., latency vs. throughput, cost vs. reliability)? Why that choice?"

        # 6) Failure/learning
        if "failure" not in asked and not FAILURE_REGEX.search(text):
            st.mark("failure")
            return "Tell me about a failure or incident on this project. What went wrong and what changed after?"

        # 7) Testing/quality
        if "quality" not in asked:
            st.mark("quality")
            return "How did you test and validate the solution (load testing, chaos, unit/integration, data quality checks)?"

        # 8) Scale & performance
        if "scale" not in asked:
            st.mark("scale")
            return "What scale does it run at now (requests/sec, data size, latency, error budget), and how did you ensure performance?"

        # 9) Security/Compliance
        if "security" not in asked:
            st.mark("security")
            return "Any security, privacy, or compliance requirements you had to meet? How did that affect the design?"

        # 10) Collaboration
        if "collab" not in asked:
            st.mark("collab")
            return "Who did you collaborate with (PMs, data, SRE, design)? How did you drive alignment or handle disagreements?"

        # Fallback—rotate a generic probe that still moves forward
        st.mark("wrap")
        return "If you had another month, what would you improve or measure next, and why?"

    def _coaching(self, answer: str) -> str:
        text = answer or ""
        tips: List[str] = []
        if not has_metric(text):
            tips.append("Add a metric: %, $, time saved, scale, latency, or error rate.")
        cov = star_coverage(text)
        if cov < 3:
            tips.append("Use STAR: Situation → Task → Action → Result.")
        if not mentions_tech(text):
            tips.append("Mention specific technologies and design choices.")
        if not shows_ownership(text):
            tips.append("Clarify your personal role and decisions.")
        if not tips:
            tips.append("Great structure—consider adding a brief trade-off you evaluated.")
        return " ".join(tips)
