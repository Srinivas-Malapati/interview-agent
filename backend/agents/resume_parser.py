from __future__ import annotations
import io
import re
from typing import Dict, List, Union, Optional

def _try_pdf_text(data: bytes) -> Optional[str]:
    try:
        from pypdf import PdfReader
    except Exception:
        return None
    try:
        with io.BytesIO(data) as fh:
            reader = PdfReader(fh)
            pages = []
            for p in reader.pages:
                try:
                    pages.append(p.extract_text() or "")
                except Exception:
                    pages.append("")
            return "\n".join(pages)
    except Exception:
        return None

def _extract_text(data: Union[str, bytes]) -> str:
    if isinstance(data, str):
        return data
    if not data:
        return ""
    if data[:4] == b"%PDF":
        pdf_text = _try_pdf_text(data)
        if pdf_text is not None:
            return pdf_text
        return ""  # fallback: avoid binary gibberish
    try:
        return data.decode("utf-8", errors="replace")
    except Exception:
        return ""

def _normalize_lines(block: str) -> List[str]:
    lines = [re.sub(r"\s+", " ", ln).strip("•-— ").strip() for ln in block.splitlines()]
    lines = [ln for ln in lines if ln]
    return [ln for ln in lines if 2 <= len(ln.split()) <= 20][:10]

def parse_resume(data: Union[str, bytes]) -> Dict:
    text = _extract_text(data)
    skills: List[str] = []
    exps: List[str] = []

    if text:
        m = re.search(r"(skills|technical skills|tech stack)\s*:\s*(.+)", text, re.I)
        if m:
            skills = [s.strip() for s in re.split(r"[,\n;•]", m.group(2)) if s.strip()][:20]
        bullets = re.findall(r"(?:^|\n)[\-\*•]\s*(.+)", text)
        if bullets:
            exps = _normalize_lines("\n".join(bullets))[:20]
        if not exps:
            parts = re.split(r"\n(?=experience[^a-z]?)", text, flags=re.I)
            if len(parts) > 1:
                exps = _normalize_lines(parts[1])[:20]

    return {
        "raw_text": (text or "")[:20000],
        "skills": [re.sub(r"\s+", " ", s).strip() for s in skills],
        "experiences": [re.sub(r"\s+", " ", s).strip() for s in exps],
    }
