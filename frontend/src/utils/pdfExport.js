/**
 * Generate a polished PDF of an interview session.
 *
 * Layout:
 *   Page 1: Header + overall score + body language + delivery + final feedback
 *   Page 2+: Full transcript with rewrites per turn
 */
import { jsPDF } from "jspdf";

const COLORS = {
  ink:    [26, 24, 18],     // gray-900
  body:   [63, 58, 48],     // gray-700
  muted:  [122, 110, 93],   // gray-500
  cream:  [250, 246, 240],
  card:   [255, 255, 255],
  hair:   [232, 223, 208],
  coral:  [232, 90, 79],
  gold:   [200, 155, 91],
  green:  [124, 158, 105],
  red:    [198, 68, 40],
};

const PAGE_W = 595;   // A4 portrait at 72dpi
const PAGE_H = 842;
const MARGIN = 40;
const COL_W  = PAGE_W - 2 * MARGIN;

function setColor(doc, fn, rgb) {
  doc[fn](rgb[0], rgb[1], rgb[2]);
}

function drawCard(doc, x, y, w, h, fill = COLORS.card) {
  setColor(doc, "setFillColor", fill);
  setColor(doc, "setDrawColor", COLORS.hair);
  doc.roundedRect(x, y, w, h, 8, 8, "FD");
}

function drawProgressBar(doc, x, y, w, pct, color) {
  const filled = Math.max(0, Math.min(100, pct || 0)) / 100;
  // Track
  setColor(doc, "setFillColor", [243, 237, 226]);
  doc.roundedRect(x, y, w, 5, 2.5, 2.5, "F");
  // Fill
  setColor(doc, "setFillColor", color);
  if (filled > 0) doc.roundedRect(x, y, w * filled, 5, 2.5, 2.5, "F");
}

function wrapText(doc, text, maxWidth) {
  return doc.splitTextToSize(text || "", maxWidth);
}

export function exportSessionPDF({
  candidateName, role, seniority, durationMin,
  overall, scores, bodyLanguage, speech,
  messages, lastTurn,
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "normal");

  // ─── PAGE 1: HEADER ───
  // Cream background strip at top
  setColor(doc, "setFillColor", COLORS.cream);
  doc.rect(0, 0, PAGE_W, 90, "F");

  // Brand
  setColor(doc, "setFillColor", COLORS.coral);
  doc.roundedRect(MARGIN, 30, 32, 32, 8, 8, "F");
  doc.setFontSize(18).setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("G", MARGIN + 11, 53);

  doc.setFontSize(22).setFont("helvetica", "bold");
  setColor(doc, "setTextColor", COLORS.ink);
  doc.text("Greenroom Interview Report", MARGIN + 50, 50);

  doc.setFontSize(11).setFont("helvetica", "normal");
  setColor(doc, "setTextColor", COLORS.muted);
  doc.text(
    `${candidateName || "—"}   ·   ${role || ""} ${seniority ? `(${seniority})` : ""}   ·   ${durationMin || 0} min`,
    MARGIN + 50, 68,
  );

  // ─── OVERALL SCORE + BODY LANGUAGE side-by-side ───
  let y = 115;
  const cardH = 130;
  const halfW = (COL_W - 14) / 2;

  // Overall card
  drawCard(doc, MARGIN, y, halfW, cardH);
  doc.setFontSize(8).setFont("helvetica", "bold");
  setColor(doc, "setTextColor", COLORS.gold);
  doc.text("OVERALL SCORE", MARGIN + 18, y + 22);

  doc.setFontSize(48).setFont("helvetica", "bold");
  setColor(doc, "setTextColor", COLORS.ink);
  const overallText = String(overall || 0);
  doc.text(overallText, MARGIN + halfW / 2 - doc.getTextWidth(overallText) / 2, y + 78);

  doc.setFontSize(10).setFont("helvetica", "normal");
  setColor(doc, "setTextColor", COLORS.muted);
  const verdict = overall >= 70 ? "Strong performance" : overall >= 50 ? "Room for improvement" : "Needs more practice";
  const verdictW = doc.getTextWidth(verdict);
  doc.text(verdict, MARGIN + halfW / 2 - verdictW / 2, y + 100);

  // Body language card
  const blX = MARGIN + halfW + 14;
  drawCard(doc, blX, y, halfW, cardH);
  doc.setFontSize(8).setFont("helvetica", "bold");
  setColor(doc, "setTextColor", COLORS.gold);
  doc.text("BODY LANGUAGE", blX + 18, y + 22);

  const blMetrics = [
    ["Engagement", bodyLanguage?.engagement || 0],
    ["Warmth",     bodyLanguage?.warmth || 0],
    ["Composure",  bodyLanguage?.composure || 0],
    ["Energy",     bodyLanguage?.energy || 0],
  ];
  doc.setFontSize(9).setFont("helvetica", "normal");
  let by = y + 40;
  blMetrics.forEach(([label, pct]) => {
    setColor(doc, "setTextColor", COLORS.body);
    doc.text(label, blX + 18, by);
    doc.text(`${pct}%`, blX + halfW - 22, by, { align: "right" });
    drawProgressBar(doc, blX + 18, by + 4, halfW - 40, pct,
      pct >= 70 ? COLORS.green : pct >= 40 ? [59, 130, 246] : COLORS.red);
    by += 19;
  });

  // ─── DELIVERY + FINAL FEEDBACK ───
  y += cardH + 14;
  drawCard(doc, MARGIN, y, halfW, cardH);
  doc.setFontSize(8).setFont("helvetica", "bold");
  setColor(doc, "setTextColor", COLORS.gold);
  doc.text("DELIVERY", MARGIN + 18, y + 22);

  doc.setFontSize(9).setFont("helvetica", "normal");
  if (speech?.totalWords > 0) {
    setColor(doc, "setTextColor", COLORS.body);
    doc.setFontSize(20).setFont("helvetica", "bold");
    setColor(doc, "setTextColor", COLORS.ink);
    doc.text(`${speech.wpm}`, MARGIN + 18, y + 50);
    doc.setFontSize(9).setFont("helvetica", "normal");
    setColor(doc, "setTextColor", COLORS.muted);
    doc.text("wpm", MARGIN + 18 + doc.getTextWidth(String(speech.wpm)) + 4, y + 50);
    doc.text(`(${speech.paceLabel})`, MARGIN + 18, y + 65);

    setColor(doc, "setTextColor", COLORS.body);
    doc.text(`Clarity: ${speech.clarityScore}%`, MARGIN + 18, y + 88);
    doc.text(`Filler words: ${speech.fillerCount} (${Math.round(speech.fillerRatio * 100)}%)`, MARGIN + 18, y + 102);
    if (speech.topFiller) {
      doc.text(`Most-used filler: "${speech.topFiller}"`, MARGIN + 18, y + 116);
    }
  } else {
    setColor(doc, "setTextColor", COLORS.muted);
    doc.setFontSize(10).setFont("helvetica", "italic");
    doc.text("No spoken answers recorded.", MARGIN + 18, y + 50);
  }

  // Final Feedback (sub-scores)
  drawCard(doc, blX, y, halfW, cardH);
  doc.setFontSize(8).setFont("helvetica", "bold");
  setColor(doc, "setTextColor", COLORS.gold);
  doc.text("FINAL FEEDBACK", blX + 18, y + 22);

  const subScores = scores || {};
  const ssMetrics = [
    ["Structure",  subScores.structure || 0],
    ["Clarity",    subScores.clarity || 0],
    ["Relevance",  subScores.relevance || 0],
    ["Impact",     subScores.impact || 0],
  ];
  doc.setFontSize(9).setFont("helvetica", "normal");
  let sy = y + 40;
  ssMetrics.forEach(([label, pct]) => {
    setColor(doc, "setTextColor", COLORS.body);
    doc.text(label, blX + 18, sy);
    doc.text(`${pct}`, blX + halfW - 22, sy, { align: "right" });
    drawProgressBar(doc, blX + 18, sy + 4, halfW - 40, pct,
      pct >= 70 ? COLORS.green : pct >= 40 ? [59, 130, 246] : COLORS.red);
    sy += 19;
  });

  // Coaching tip
  y += cardH + 14;
  if (lastTurn?.feedback) {
    setColor(doc, "setFillColor", [255, 241, 236]);
    setColor(doc, "setDrawColor", [255, 216, 204]);
    doc.roundedRect(MARGIN, y, COL_W, 50, 6, 6, "FD");
    doc.setFontSize(8).setFont("helvetica", "bold");
    setColor(doc, "setTextColor", COLORS.coral);
    doc.text("💡 COACHING TIP", MARGIN + 14, y + 17);
    doc.setFontSize(10).setFont("helvetica", "normal");
    setColor(doc, "setTextColor", COLORS.body);
    const lines = wrapText(doc, lastTurn.feedback, COL_W - 28);
    doc.text(lines, MARGIN + 14, y + 33);
  }

  // ─── PAGE 2+: TRANSCRIPT WITH REWRITES ───
  if (messages?.length) {
    doc.addPage();
    y = MARGIN;

    doc.setFontSize(16).setFont("helvetica", "bold");
    setColor(doc, "setTextColor", COLORS.ink);
    doc.text("Interview Transcript", MARGIN, y);
    y += 24;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const isAgent = m.role === "Agent";
      const speaker = isAgent ? "Interviewer" : "You";
      const speakerColor = isAgent ? COLORS.coral : COLORS.ink;

      // Speaker line
      doc.setFontSize(9).setFont("helvetica", "bold");
      setColor(doc, "setTextColor", speakerColor);
      doc.text(speaker.toUpperCase(), MARGIN, y);
      y += 14;

      // Body
      doc.setFontSize(10).setFont("helvetica", "normal");
      setColor(doc, "setTextColor", COLORS.body);
      const lines = wrapText(doc, m.text, COL_W);
      // Page break check
      if (y + lines.length * 12 > PAGE_H - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(lines, MARGIN, y);
      y += lines.length * 12 + 16;
    }

    // Final rewrite card on transcript page
    if (lastTurn?.rewrite) {
      if (y + 90 > PAGE_H - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      setColor(doc, "setFillColor", [255, 246, 240]);
      setColor(doc, "setDrawColor", COLORS.gold);
      doc.roundedRect(MARGIN, y, COL_W, 80, 8, 8, "FD");
      doc.setFontSize(9).setFont("helvetica", "bold");
      setColor(doc, "setTextColor", COLORS.coral);
      doc.text("✨ SAY THIS INSTEAD", MARGIN + 14, y + 20);
      doc.setFontSize(10).setFont("helvetica", "normal");
      setColor(doc, "setTextColor", COLORS.ink);
      const rwLines = wrapText(doc, lastTurn.rewrite, COL_W - 28);
      doc.text(rwLines, MARGIN + 14, y + 38);
    }
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8).setFont("helvetica", "normal");
    setColor(doc, "setTextColor", COLORS.muted);
    doc.text(
      `Generated by Greenroom · joinGreenroom.vercel.app · Page ${p} of ${pageCount}`,
      PAGE_W / 2, PAGE_H - 22, { align: "center" }
    );
  }

  // Save
  const fname = `Greenroom_${(candidateName || "session").replace(/\s+/g, "_")}_${role?.replace(/\s+/g, "_") || "interview"}.pdf`;
  doc.save(fname);
}
