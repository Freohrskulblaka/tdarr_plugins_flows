/*
 * Media Optimizer Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Coordinates media optimizer processing plans from the normalized analysis inventory and domain planning helpers.
 * Updates:
 * - 2026-06-29 - Freohrskulblaka: Created initial no-op planning helper for scaffold verification.
 * - 2026-06-30 - Freohrskulblaka: Replaced no-op planning with coordinated video, audio, subtitle, attachment, chapter, and metadata decisions.
 * - 2026-07-01 - Freohrskulblaka: Added required media stream safeguards for video and audio.
 * - 2026-07-13 - Freohrskulblaka: Extracted attachment and chapter planning into focused planning modules.
 * - 2026-07-15 - Freohrskulblaka: Extracted metadata planning into a focused planning module.
 * - 2026-07-15 - Freohrskulblaka: Added a command placeholder for the FFmpeg renderer output.
 */

const { planAttachments } = require('./attachment');
const { planVideo } = require('./video');
const { planAudio } = require('./audio');
const { planChapters } = require('./chapter');
const { planMetadata } = require('./metadata');
const { planSubtitles } = require('./subtitle');

function buildProcessingPlan(context) {
  const validation = validateRequiredStreams(context);
  const video = planVideo(context);
  const audio = planAudio(context);
  const subtitles = planSubtitles(context);
  const attachments = planAttachments(context);
  const chapters = planChapters(context);
  const metadata = planMetadata(context);
  const container = planContainer(context);
  const reasons = collectPlanReasons({
    container,
    video,
    audio,
    subtitles,
    attachments,
    chapters,
    metadata,
  });
  const shouldProcess = [
    container,
    video,
    audio,
    subtitles,
    attachments,
    chapters,
    metadata,
  ].some((section) => section.shouldProcess);

  const plan = {
    isValid: validation.isValid,
    shouldProcess,
    validation,
    reasons: [...validation.reasons, ...reasons],
    outputContainer: context.settings.output.container,
    container,
    video,
    audio,
    subtitles,
    attachments,
    chapters,
    metadata,
    command: null,
    ffmpegArgs: [],
  };

  return plan;
}

function validateRequiredStreams(context) {
  const reasons = [];
  const hasVideoStream = context.analysis.streams.video.hasPlayableStreams;
  const hasAudioStream = context.analysis.streams.audio.items.length > 0;

  if (!hasVideoStream) {
    reasons.push('No playable video stream was found. Media optimizer requires at least one video stream.');
  }

  if (!hasAudioStream) {
    reasons.push('No audio stream was found. Media optimizer requires at least one audio stream.');
  }

  const validation = {
    isValid: reasons.length === 0,
    hasVideoStream,
    hasAudioStream,
    reasons,
  };

  return validation;
}

function planContainer(context) {
  const reasons = [];
  const shouldRemux = context.analysis.file.needsRemux;

  if (shouldRemux) {
    reasons.push(`Container ${context.analysis.file.container} does not match target ${context.settings.output.container}.`);
  }

  if (context.analysis.file.useGenpts) {
    reasons.push('One or more streams have missing or unavailable duration; genpts may be required.');
  }

  const containerPlan = {
    sourceContainer: context.analysis.file.container,
    targetContainer: context.settings.output.container,
    shouldRemux,
    useGenpts: context.analysis.file.useGenpts,
    shouldProcess: shouldRemux || context.analysis.file.useGenpts,
    reasons,
  };

  return containerPlan;
}

function collectPlanReasons(sections) {
  const reasons = [];

  Object.keys(sections).forEach((sectionName) => {
    const section = sections[sectionName];

    (section.reasons || []).forEach((reason) => {
      if (reason) {
        reasons.push(`${sectionName}: ${reason}`);
      }
    });
  });

  return reasons;
}

module.exports = {
  buildProcessingPlan,
};
