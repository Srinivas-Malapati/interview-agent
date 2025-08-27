from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from agents.interview_agent import InterviewAgent
from agents.resume_parser import parse_resume
from agents.jd_parser import parse_jd
from db.database import Base, engine  # for auto table creation
import db.models  # noqa: F401 — ensures models are registered

app = FastAPI()

# CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auto-create tables on boot
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

agent = InterviewAgent()

@app.post("/upload_resume/")
async def upload_resume(file: UploadFile):
    text = await file.read()
    parsed = parse_resume(text.decode("utf-8", errors="ignore"))
    return {"resume": parsed}

@app.post("/start_interview/")
async def start_interview(candidate: str = Form(...), jd: str = Form(...)):
    jd_info = parse_jd(jd)
    first_q = agent.start_interview(candidate, jd_info)
    return {"question": first_q}

@app.post("/answer/")
async def answer(candidate: str = Form(...), response: str = Form(...)):
    followup, feedback = agent.handle_answer(candidate, response)
    return {"followup": followup, "feedback": feedback}
