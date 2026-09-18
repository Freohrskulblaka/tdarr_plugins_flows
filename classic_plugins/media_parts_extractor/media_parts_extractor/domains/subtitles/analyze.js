/*
 * Media Parts Extractor Subtitle Analysis Adapter
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Reads the normalized embedded subtitle facts.
 */

function getSubtitleAnalysis(stream) {
  return stream.analysis?.subtitle || stream;
}

module.exports = { getSubtitleAnalysis };
