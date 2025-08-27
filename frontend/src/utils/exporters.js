
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** JSON */
export function exportJSON({ candidate, tags, summary, transcript, score, createdAt }) {
  const payload = { candidate, tags, summary, transcript, score, createdAt };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `HireSense_${candidate.replace(/\s+/g,'_')}.json`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 400);
}

/** CSV (turn, role, text) */
export function exportCSV({ candidate, messages }) {
  const rows = [["turn","role","text"]];
  let turn = 1;
  messages.forEach(m=>{
    rows.push([turn, m.role, `"${(m.text||"").replace(/"/g,'""')}"`]);
    if (m.role === "Candidate") turn += 1;
  });
  const csv = rows.map(r=>r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `HireSense_${candidate.replace(/\s+/g,'_')}.csv`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 400);
}

/** PDF with branding, radar image, notes */
export function exportPDF({ candidate, role="Software Engineer", level="Mid", tags, summary, messages, score, radarDataURL, logoDataURL }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pad = 36;

  // Header
  if (logoDataURL) {
    try { doc.addImage(logoDataURL, "PNG", pad, pad, 90, 28); } catch(_) {}
  }
  doc.setFont("helvetica","bold"); doc.setFontSize(18);
  doc.text("HireSense • Interview Report", pad+100, pad+20);
  doc.setFont("helvetica",""); doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(`Candidate: ${candidate} • ${role} • ${level}`, pad, pad+50);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pad, pad+66);

  // Score & chart
  doc.setTextColor(30); doc.setFontSize(14); doc.setFont("helvetica","bold");
  doc.text("Score Summary", pad, pad+100);
  doc.setFontSize(11); doc.setFont("helvetica","");

  const scores = [
    ["Overall", (score?.score ?? score?.overall ?? 0).toString()],
    ["Depth", (score?.Depth ?? score?.categories?.find(c=>c.name==="Depth")?.score ?? 0).toString()],
    ["Metrics", (score?.Metrics ?? score?.categories?.find(c=>c.name==="Metrics")?.score ?? 0).toString()],
    ["Structure", (score?.Structure ?? score?.categories?.find(c=>c.name==="Structure")?.score ?? 0).toString()],
    ["Clarity", (score?.Clarity ?? score?.categories?.find(c=>c.name==="Clarity")?.score ?? 0).toString()]
  ];
  autoTable(doc, { startY: pad+110, theme:"plain", styles:{ fontSize:11 }, body: scores });

  if (radarDataURL) {
    try { doc.addImage(radarDataURL, "PNG", 300, pad+90, 240, 240); } catch(_) {}
  }

  // Summary
  const y1 = Math.max(doc.lastAutoTable?.finalY || (pad+140), pad+340);
  doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(30);
  doc.text("Decision Notes", pad, y1);
  doc.setFont("helvetica",""); doc.setFontSize(11); doc.setTextColor(50);
  const wrapped = doc.splitTextToSize(summary || "—", 520);
  doc.text(wrapped, pad, y1+18);

  // Tags
  doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(30);
  const y2 = y1 + 18 + wrapped.length*14 + 12;
  doc.text("Signals / Tags", pad, y2);
  doc.setFont("helvetica",""); doc.setFontSize(11); doc.setTextColor(50);
  doc.text((tags && tags.length ? tags.join(", ") : "—"), pad, y2+18);

  // Transcript
  const y3 = y2 + 44;
  doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(30);
  doc.text("Transcript (abridged)", pad, y3);

  const tableData = messages.slice(0, 40).map((m, i)=>[
    i+1, m.role, (m.text||"").replace(/\s+/g," ").slice(0,220)
  ]);
  autoTable(doc, {
    startY: y3+10,
    head: [["#", "Role", "Text"]],
    body: tableData,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [29,78,216] },
  });

  doc.save(`HireSense_${candidate.replace(/\s+/g,'_')}.pdf`);
}
