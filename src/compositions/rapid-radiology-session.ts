// The `rapid-radiology` composition's script (#42): the CT Chest demo data and
// the beats' timings. Pure, so `bun test` covers it. In a report line, text in
// [[double brackets]] came from the findings; the rest is the radiologist's own
// normal template, word for word.
export const REPORT_TYPES = [
  "CT Chest",
  "CT Abdomen and Pelvis",
  "MRI Knee",
  "MRI Brain",
  "US Abdomen",
] as const;

export const FINDINGS =
  "comparison CT chest 14 March 2025\nleft lower lobe consolidation with air bronchograms\nsmall left pleural effusion\n4mm right upper lobe nodule, stable from prior";

export const OPENAI = [
  "[[Comparison is made to previous imaging dated 14 March 2025.]]",
  "The central airways are patent.",
  "[[Left lower lobe consolidation with air bronchograms. 4 mm right upper lobe nodule, stable from prior.]] No suspicious lung nodules.",
  "[[Small left pleural effusion.]] No pneumothorax.",
  "Normal heart size. No pericardial effusion.",
  "Normal calibre thoracic aorta and main pulmonary artery.",
  "No enlarged mediastinal, hilar or axillary lymph nodes.",
  "Visualised upper abdomen unremarkable.",
  "No aggressive osseous lesions.",
];

export const GEMINI = [
  "[[Comparison is made to previous imaging dated 14 March 2025.]]",
  "The central airways are patent.",
  "[[Left lower lobe consolidation with air bronchograms.]]",
  "[[4mm right upper lobe nodule, stable from prior.]] No new suspicious lung nodules.",
  "[[Small left pleural effusion.]] No pneumothorax.",
  "Normal heart size. No pericardial effusion.",
  "Normal calibre thoracic aorta and main pulmonary artery.",
  "No enlarged mediastinal, hilar or axillary lymph nodes.",
  "Visualised upper abdomen unremarkable.",
  "No aggressive osseous lesions.",
];

export const KEY_LINE =
  "■ from your findings · the rest is your template, word for word";
export const KEY_LEAD = "■ from your findings";

/** Typing speed of the findings (characters a second). */
export const FINDINGS_CPS = 50;
/** The end state is held this long, then the composition restarts. */
export const HOLD_MS = 7500;

export interface Segment {
  text: string;
  found: boolean;
}

/** A report line as runs: what came from the findings, and the template's own. */
export function segments(line: string): Segment[] {
  const out: Segment[] = [];
  for (const part of line.split(/(\[\[.*?\]\])/)) {
    if (!part) continue;
    const found = part.startsWith("[[");
    out.push({ text: found ? part.slice(2, -2) : part, found });
  }
  return out;
}
