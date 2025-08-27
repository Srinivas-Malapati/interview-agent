import React, { useRef, useState } from "react";

export default function UnifiedProfile({ candidateName, setCandidateName, apiBase }) {
  const fileRef = useRef();
  const [uploadState, setUploadState] = useState("Idle"); // Idle | Uploaded | Error

  const onDrop = async (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) await upload(f);
  };

  const upload = async (file) => {
    try {
      const fd = new FormData();
      fd.append("candidate", candidateName);
      fd.append("file", file);
      const res = await fetch(`${apiBase}/upload_resume`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUploadState("Uploaded");
    } catch (e) {
      console.error(e);
      setUploadState("Error");
    }
  };

  return (
    <div className="card">
      <div className="card-title">Candidate Setup</div>

      <div className="form-field">
        <label>Candidate</label>
        <input
          value={candidateName}
          onChange={(e) => setCandidateName(e.target.value)}
          placeholder="Candidate name"
        />
      </div>

      <div className="form-field">
        <label>Resume (PDF or text)</label>
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          Drag & drop resume here, or click to choose
        </div>
        <input
          type="file"
          ref={fileRef}
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <div className={`hint ${uploadState === "Error" ? "error" : ""}`}>
          {uploadState === "Idle" && "Waiting for resume…"}
          {uploadState === "Uploaded" && "Resume uploaded ✔"}
          {uploadState === "Error" && "Upload error: Not Found / HTTP error — check backend URL"}
        </div>
      </div>
    </div>
  );
}
