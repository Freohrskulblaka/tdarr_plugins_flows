/*
 * Media Optimizer Track Intent Utility Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-10
 * Description: Detects reusable track intent signals from stream dispositions and titles.
 * Updates:
 * - 2026-07-10 - Freohrskulblaka: Added shared commentary detection.
 */

const { normalizeVariantText } = require('./language');

const COMMENTARY_TITLE_PATTERNS = [
  /commentary|commentator|director.?s? comment|audio comment/,
  /descriptive|description|described video|narration|narrator/,
  /comentarios?|comentarios? del director|comentarios? de director|audio comentario|audiocomentario/,
  /audio descriptivo|audiodescripcion|descripcion de audio|narracion|narrador/,
];

function analyzeCommentaryTrack({ disposition, title }) {
  const normalizedTitle = normalizeVariantText(title);
  const hasCommentaryDisposition = Boolean(disposition?.comment || disposition?.descriptions);
  const matchedTitlePattern = COMMENTARY_TITLE_PATTERNS.find((pattern) => pattern.test(normalizedTitle));
  const reasons = [];

  if (hasCommentaryDisposition) {
    reasons.push('commentary disposition flag');
  }

  if (matchedTitlePattern) {
    reasons.push('commentary title keyword');
  }

  const commentary = {
    isCommentary: reasons.length > 0,
    reasons,
  };

  return commentary;
}

module.exports = {
  analyzeCommentaryTrack,
};
