/*
 * Media Parts Extractor Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-22
 * Description: Selects donor video, audio, and subtitle streams for sidecar extraction.
 */

const { planVideo } = require('../domains/video/plan');
const { planAudio } = require('../domains/audio/plan');
const { planSubtitles } = require('../domains/subtitles/plan');

function buildExtractionPlan(context) {
  const validation = validateSource(context);
  const video = planVideo(context);
  const audio = planAudio(context);
  const subtitles = planSubtitles(context);
  const shouldProcess = video.items.length > 0 || audio.items.length > 0 || subtitles.items.length > 0;

  return {
    isValid: validation.isValid,
    shouldProcess,
    validation,
    reasons: [...validation.reasons, ...video.reasons, ...audio.reasons, ...subtitles.reasons],
    video,
    audio,
    subtitles,
    command: null,
  };
}

function validateSource(context) {
  const reasons = [];
  const isVideoFile = context.analysis.file.medium === 'video';

  if (!isVideoFile) {
    reasons.push('Media Parts Extractor requires a video media file.');
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
}

module.exports = { buildExtractionPlan };
