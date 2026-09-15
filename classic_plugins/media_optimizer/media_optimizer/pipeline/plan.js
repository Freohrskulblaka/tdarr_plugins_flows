/*
 * Media Optimizer Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Coordinates media optimizer processing plans from the normalized analysis inventory and domain planning helpers.
 */

const { planAttachments } = require('../domains/attachments/plan');
const { planVideo } = require('../domains/video/plan');
const { planAudio } = require('../domains/audio/plan');
const { planChapters } = require('../domains/chapters/plan');
const { planMetadata } = require('../domains/metadata/plan');
const { planSubtitles } = require('../domains/subtitles/plan');

function buildProcessingPlan(context) {
  const validation = validateRequiredStreams(context);
  const sections = {
    container: planContainer(context),
    video: planVideo(context),
    audio: planAudio(context),
    subtitles: planSubtitles(context),
    attachments: planAttachments(context),
    chapters: planChapters(context),
    metadata: planMetadata(context),
  };
  const sectionReasons = Object.entries(sections).flatMap(([sectionName, section]) => {
    return (section.reasons || [])
      .filter(Boolean)
      .map((reason) => `${sectionName}: ${reason}`);
  });

  const plan = {
    isValid: validation.isValid,
    shouldProcess: Object.values(sections).some((section) => section.shouldProcess),
    validation,
    reasons: [...validation.reasons, ...sectionReasons],
    outputContainer: context.settings.output.container,
    ...sections,
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
  const sourceContainer = context.analysis.file.container;
  const targetContainer = String(context.settings.output.container || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  const shouldRemux = Boolean(sourceContainer && targetContainer && sourceContainer !== targetContainer);
  const isCacheOutput = context.analysis.file.isTdarrCacheOutput;
  const hasInvalidStreamDurations = context.analysis.file.hasInvalidStreamDurations;
  const useGenpts = Boolean(hasInvalidStreamDurations && shouldRemux && !isCacheOutput);

  if (shouldRemux) {
    reasons.push(`Container ${sourceContainer} does not match target ${targetContainer}.`);
  }

  if (useGenpts) {
    reasons.push('One or more streams have missing or unavailable duration; genpts may be required.');
  } else if (hasInvalidStreamDurations && isCacheOutput) {
    reasons.push('Genpts-only remux is skipped on Tdarr cache outputs to avoid cyclic cleanup passes.');
  } else if (hasInvalidStreamDurations && !shouldRemux) {
    reasons.push('Genpts-only remux is skipped because the container already matches the target.');
  }

  const containerPlan = {
    sourceContainer,
    targetContainer,
    shouldRemux,
    useGenpts,
    shouldProcess: shouldRemux || useGenpts,
    reasons,
  };

  return containerPlan;
}

module.exports = {
  buildProcessingPlan,
};
