
import React, { useEffect, useState } from "react";

export default function StatusBadge() {
  const [state, setState] = useState({ ready: false, pdf: false, key: "" });

  useEffect(() => {
    (async () => {
      try {
        const h = await fetch("http://localhost:8000/health").then(r=>r.json());
        const d = await fetch("http://localhost:8000/diag").then(r=>r.json());
        setState({ ready: !!h.ok, pdf: !!d.pypdf_available, key: d.openai_key_prefix || "" });
      } catch {
        setState({ ready: false, pdf: false, key: "" });
      }
    })();
  }, []);

  const ok = state.ready;
  return (
    <div style={{
      display:"inline-flex", gap:10, alignItems:"center",
      padding:"6px 12px", borderRadius:999, background:"#ffffffcc",
      boxShadow:"0 6px 20px rgba(0,0,0,.08)", marginTop:10
    }}>
      <span style={{fontWeight:900, color: ok ? "#16a34a" : "#b91c1c"}}>
        {ok ? "● API Ready" : "● API Down"}
      </span>
      <span style={{fontSize:13, color:"#64748b"}}>PDF: {state.pdf ? "on" : "text-only"}</span>
      <span style={{fontSize:13, color:"#64748b"}}>Key: {state.key}</span>
    </div>
  );
}
