import React, { useRef, useState } from "react";

export default function ResumeUpload({ onFirstQuestion }) {
  const [toast, setToast] = useState(null);
  const [candidate, setCandidate] = useState("Srinivas");
  const [isOver, setIsOver] = useState(false);
  const fileRef = useRef(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const upload = async (file) => {
    const form = new FormData();
    form.append("file", file);
    form.append("candidate", candidate);

    try {
      const res = await fetch("http://localhost:8000/upload_resume/", { method: "POST", body: form });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { status: "error", message: text }; }

      if (data.status !== "ok") {
        showToast("error", `Upload error: ${data.message || "Unknown error"}`);
        return;
      }
      showToast("success", data.message || `Parsed ${file.name} ✓`);
      if (data.first_question) onFirstQuestion?.(data.first_question);
    } catch (e) {
      showToast("error", `Network error: ${e.message}`);
    }
  };

  const onChange = (e) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
  };

  const onDrop = (e) => {
    e.preventDefault(); setIsOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  return (
    <div style={{
      border: "1px solid var(--ring)", borderRadius: 12, padding: 16,
      background: "linear-gradient(180deg, #ffffff, #fbfdff)"
    }}>
      <h3 style={{ fontWeight: 900, marginBottom: 8 }}>Candidate Profile</h3>

      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontSize: 13, color: "var(--muted)" }}>Candidate</label>
        <input
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
          placeholder="Candidate name"
          style={{ border: "1px solid var(--ring)", borderRadius: 8, padding: "8px 12px", background: "#fff" }}
        />

        <label style={{ fontSize: 13, color: "var(--muted)" }}>Resume (PDF or text)</label>
        <div
          onDragOver={(e)=>{e.preventDefault(); setIsOver(true);}}
          onDragLeave={()=>setIsOver(false)}
          onDrop={onDrop}
          onClick={()=>fileRef.current?.click()}
          style={{
            border: `2px dashed ${isOver ? "#7c3aed" : "#e5e7eb"}`,
            background: isOver ? "rgba(124,58,237,.06)" : "#fff",
            borderRadius: 12, padding: "14px 12px", cursor: "pointer",
            color: "#64748b", fontSize: 14, textAlign:"center"
          }}
        >
          Drag & drop resume here, or click to choose
        </div>
        <input hidden ref={fileRef} type="file" onChange={onChange} />
      </div>

      {toast && (
        <div
          style={{
            marginTop: 12, padding: "8px 12px", borderRadius: 10, fontSize: 14,
            background: toast.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: toast.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${toast.type === "success" ? "#34d399" : "#fca5a5"}`
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
