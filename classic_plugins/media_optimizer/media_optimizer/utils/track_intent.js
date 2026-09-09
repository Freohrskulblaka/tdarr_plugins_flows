/*
 * Media Optimizer Track Intent Utility Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-10
 * Description: Detects commentary and descriptive track intent from stream dispositions and titles.
 * Updates:
 * - 2026-07-10 - Freohrskulblaka: Added shared commentary and descriptive track detection.
 */

const { normalizeVariantText } = require('./language');

const COMMENTARY_TITLE_PATTERNS = [
  /commentary|commentator|director.?s? comment|audio comment/,
  /comentarios?|comentarios? del director|comentarios? de director|audio comentario|audiocomentario/,
];
const DESCRIPTIVE_TITLE_PATTERNS = [
  /descriptive|description|described video|narration|narrator/,
  /audio descriptivo|audiodescripcion|descripcion de audio|narracion|narrador/,
];

function analyzeTrackIntent({ disposition, title }) {
  const normalizedTitle = normalizeVariantText(title);
  const commentaryReasons = [
    Boolean(disposition?.comment) ? 'commentary disposition flag' : '',
    COMMENTARY_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle)) ? 'commentary title keyword' : '',
  ].filter(Boolean);
  const descriptiveReasons = [
    Boolean(disposition?.descriptions) ? 'descriptive disposition flag' : '',
    DESCRIPTIVE_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle)) ? 'descriptive title keyword' : '',
  ].filter(Boolean);

  return {
    isCommentary: commentaryReasons.length > 0,
    isDescriptive: descriptiveReasons.length > 0,
    commentaryReasons,
    descriptiveReasons,
  };
}

module.exports = {
  analyzeTrackIntent,
};
