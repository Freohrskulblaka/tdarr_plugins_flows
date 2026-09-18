/*
 * Media Parts Extractor Video Plan Library
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Selects playable donor video tracks for extraction.
 */

const { buildVideoOutputPath } = require('./naming');

function planVideo(context) {
  const mode = context.settings.video.mode;
  const playableStreams = context.analysis.streams.video.items.filter((stream) => !stream.analysis.isImageStream);
  const selectedStreams = mode === 'Primary Video' ? playableStreams.slice(0, 1) : playableStreams;
  const items = mode === 'None'
    ? []
    : selectedStreams.map((stream) => ({
      sourceIndex: stream.index,
      codec: stream.codec_name || 'unknown',
      width: stream.analysis.width,
      height: stream.analysis.height,
      resolution: stream.analysis.resolution?.label || '',
      hdrType: stream.analysis.hdr?.type || 'sdr',
      title: stream.tags?.title || stream.tags?.TITLE || '',
      outputPath: buildVideoOutputPath(context, stream),
    }));
  const reasons = [];

  if (mode === 'None') {
    reasons.push('Video extraction disabled by input.');
  } else if (items.length === 0) {
    reasons.push('No playable video streams matched the extraction inputs.');
  }

  return {
    mode,
    items,
    count: items.length,
    reasons,
  };
}

module.exports = { planVideo };
