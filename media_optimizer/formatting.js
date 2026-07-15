/*
 * Media Optimizer Formatting Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Formats media optimizer plan details into readable Tdarr log output.
 * Updates:
 * - 2026-06-29 - Freohrskulblaka: Created final track table formatting helper.
 * - 2026-06-30 - Freohrskulblaka: Updated formatting for sectioned processing plans.
 * - 2026-07-06 - Freohrskulblaka: Updated video bitrate formatting for nested bitrate profiles.
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
  lines.push(`Chapters: ${plan.chapters.action} (${plan.chapters.count})`);
  lines.push(`Strip global tags: ${plan.metadata.stripGlobalTags ? 'yes' : 'no'}`);

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

  attachmentPlan.tracks.forEach((track) => {
    lines.push(`  src=${track.sourceIndex} action=${track.action} font=${track.isFont ? 'yes' : 'no'} name="${track.fileName}" mime="${track.mimeType}"`);
  });
}

module.exports = {
  renderFinalTrackTable,
};
