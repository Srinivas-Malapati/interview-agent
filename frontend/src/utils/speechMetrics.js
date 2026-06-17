/**
 * Compute speech-delivery metrics from the candidate's transcripts.
 *
 *  - wpm:           words per minute across all candidate turns
 *  - fillerCount:   number of filler words used
 *  - fillerRatio:   fillerCount / totalWords (0..1)
 *  - topFiller:     most-used filler word
 *  - clarityScore:  0..100, penalizing high filler ratio
 *  - paceLabel:     "Too slow" / "On pace" / "Too fast"
 *
 * Inputs:
 *   candidateTexts   array of strings, each one a candidate answer
 *   durationSeconds  total elapsed time of the interview, in seconds
 */

const FILLERS = [
  "um", "uh", "uhm", "ah", "er", "erm",
  "like", "you know", "y'know",
  "actually", "basically", "literally", "honestly",
  "i mean", "kind of", "kinda", "sort of", "sorta",
  "so", "right",
];

const WORD_RE = /\b[\w']+\b/g;

function countMatches(haystack, needle) {
  // Word-boundary, case-insensitive count; supports multi-word fillers via spacing.
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]");
  const rx = new RegExp(`(^|[^\\w])${escaped}(?=$|[^\\w])`, "gi");
  let count = 0;
  while (rx.exec(haystack) !== null) count++;
  return count;
}

export function computeSpeechMetrics(candidateTexts, durationSeconds) {
  const text = (candidateTexts || []).join(" ").trim();
  const lower = " " + text.toLowerCase() + " ";
  const allWords = (text.match(WORD_RE) || []);
  const totalWords = allWords.length;

  // Filler scan
  const breakdown = {};
  let fillerCount = 0;
  for (const f of FILLERS) {
    const c = countMatches(lower, f);
    if (c > 0) {
      breakdown[f] = c;
      fillerCount += c;
    }
  }
  const topFiller = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const fillerRatio = totalWords > 0 ? fillerCount / totalWords : 0;

  // Pace
  const minutes = Math.max(durationSeconds / 60, 0.01);
  const wpm = totalWords > 0 ? Math.round(totalWords / minutes) : 0;

  // Heuristics (interview-coach norms: 130-160 wpm sweet spot, <2% filler is clean)
  let paceLabel = "On pace";
  if (totalWords > 30) {
    if (wpm < 110) paceLabel = "Too slow";
    else if (wpm > 175) paceLabel = "Too fast";
  } else {
    paceLabel = "Not enough words";
  }

  // Clarity: 100 - (filler ratio * 1000 capped)
  const clarityScore = Math.max(0, Math.min(100, 100 - Math.round(fillerRatio * 1000)));

  return {
    totalWords,
    wpm,
    paceLabel,
    fillerCount,
    fillerRatio,
    topFiller,
    breakdown,
    clarityScore,
  };
}
