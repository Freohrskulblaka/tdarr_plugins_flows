/*
 * Media Optimizer Formatting Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Formats media optimizer plan details into readable Tdarr log output.
 * Updates:
 * - 2026-06-29 - Freohrskulblaka: Created final track table formatting helper.
 * - 2026-06-30 - Freohrskulblaka: Updated formatting for sectioned processing plans.
 * - 2026-07-06 - Freohrskulblaka: Updated video bitrate formatting for nested bitrate profiles.
 * - 2026-07-15 - Freohrskulblaka: Added metadata cleanup detail rendering.
 */

function renderFinalTrackTable(plan) {
  const lines = [];

  lines.push(`Should process: ${plan.shouldProcess ? 'yes' : 'no'}`);
  lines.push(`Container: ${plan.container.sourceContainer || 'unknown'} -> ${plan.container.targetContainer}`);
  lines.push('');
  renderVideo(lines, plan.video);
  lines.push('');
  renderAudio(lines, plan.audio);
  lines.push('');
  renderSubtitles(lines, plan.subtitles);
  lines.push('');
  renderAttachments(lines, plan.attachments);
  lines.push('');
  renderChapters(lines, plan.chapters);
  renderMetadata(lines, plan.metadata);

  if (plan.reasons.length > 0) {
    lines.push('');
    lines.push('Reasons:');
    plan.reasons.forEach((reason) => {
      lines.push(`  - ${reason}`);
    });
  }

  return lines.join('\n');
}

function renderVideo(lines, videoPlan) {
  lines.push('Video:');

  videoPlan.tracks.forEach((track) => {
    const hdr = track.hdr?.isHdr ? ' hdr=yes' : '';
    const bitrate = track.bitrate ? ` bitrate=${track.bitrate.current.kbps}k target=${track.bitrate.selected.targetKbps}k` : '';
    lines.push(`  ${track.outputIndex} src=${track.sourceIndex} ${track.language} ${track.codec}->${track.targetCodec} ${track.width}x${track.height} ${track.resolution?.label || ''}${hdr}${bitrate} action=${track.action} default=${track.default ? 'yes' : 'no'}`);
  });
}

function renderAudio(lines, audioPlan) {
  lines.push('Audio:');

  audioPlan.tracks.forEach((track) => {
    const generated = track.generated ? ' generated=yes' : '';
    const codec = track.targetCodec && track.targetCodec !== track.codec ? `${track.codec}->${track.targetCodec}` : track.codec;
    lines.push(`  ${track.outputIndex} src=${track.sourceIndex} ${track.language} ${codec} ${track.channels}ch action=${track.action} default=${track.default ? 'yes' : 'no'}${generated} title="${track.title}"`);
  });

  audioPlan.removedTracks.forEach((track) => {
    lines.push(`  remove src=${track.sourceIndex} ${track.language} ${track.codec} ${track.channels}ch reason="${track.reasons.join('; ')}"`);
  });
}

function renderSubtitles(lines, subtitlePlan) {
  lines.push('Subtitles:');

  subtitlePlan.tracks.forEach((track) => {
    const source = track.sourceKind === 'external' ? `external="${track.sourcePath}"` : `src=${track.sourceIndex}`;
    const languageLabel = track.languageLabel || track.language;
    const formatLabel = track.formatLabel || track.codec;
    lines.push(`  ${track.outputIndex} ${source} ${languageLabel} ${formatLabel} ${track.subtitleType} action=${track.action} default=${track.default ? 'yes' : 'no'} forced=${track.forced ? 'yes' : 'no'} title="${track.title}"`);
  });

  subtitlePlan.removedTracks.forEach((track) => {
    const source = track.sourceKind === 'external' ? `external="${track.sourcePath}"` : `src=${track.sourceIndex}`;
    const languageLabel = track.languageLabel || track.language;
    const formatLabel = track.formatLabel || track.codec;
    lines.push(`  remove ${source} ${languageLabel} ${formatLabel} reason="${track.reasons.join('; ')}"`);
  });
}

function renderAttachments(lines, attachmentPlan) {
  lines.push('Attachments:');

  if (attachmentPlan.tracks.length === 0) {
    lines.push('  none');
    return;
  }

  lines.push(`  kept=${attachmentPlan.keptCount} removed=${attachmentPlan.removedCount} fonts=${attachmentPlan.fontCount} nonFonts=${attachmentPlan.nonFontCount}`);

  attachmentPlan.tracks.forEach((track) => {
    lines.push(`  src=${track.sourceIndex} action=${track.action} font=${track.isFont ? 'yes' : 'no'} name="${track.fileName}" mime="${track.mimeType}"`);
  });
}

function renderChapters(lines, chapterPlan) {
  const details = [];

  if (chapterPlan.durationSeconds > 0) {
    details.push(`duration=${Math.floor(chapterPlan.durationSeconds)}s`);
  }

  if (chapterPlan.intervalSeconds) {
    details.push(`interval=${chapterPlan.intervalSeconds}s`);
  }

  if (chapterPlan.mediaType) {
    details.push(`mediaType="${chapterPlan.mediaType}"`);
  }

  const detailText = details.length > 0 ? ` ${details.join(' ')}` : '';
  lines.push(`Chapters: ${chapterPlan.action} (${chapterPlan.count})${detailText}`);
}

function renderMetadata(lines, metadataPlan) {
  lines.push('Metadata:');
  lines.push(`  stripGlobalTags=${metadataPlan.stripGlobalTags ? 'yes' : 'no'} globalTagKeys=${metadataPlan.globalTagKeys.length}`);
  lines.push(`  removeFileTitle=${metadataPlan.removeFileTitle ? 'yes' : 'no'} fileTitle=${metadataPlan.fileTitle ? 'yes' : 'no'}`);
  lines.push(`  removeVideoTitles=${metadataPlan.removeVideoTitles ? 'yes' : 'no'} titledVideoStreams=${metadataPlan.videoTitleTracks.length}`);
  lines.push(`  removeExtraTagStreams=${metadataPlan.removeExtraTagStreams ? 'yes' : 'no'} extraTagStreams=${metadataPlan.extraTagTracks.length}`);
  lines.push(`  writeCustomGlobalMetadata=${metadataPlan.writeCustomGlobalMetadata ? 'yes' : 'no'}`);

  metadataPlan.videoTitleTracks.forEach((track) => {
    lines.push(`  video src=${track.sourceIndex} action=${track.action} title="${track.title}"`);
  });

  metadataPlan.extraTagTracks.forEach((track) => {
    lines.push(`  ${track.codecType || 'unknown'} src=${track.sourceIndex} action=${track.action} codec=${track.codecName || 'unknown'} title="${track.title}"`);
  });
}

module.exports = {
  renderFinalTrackTable,
};
