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
 * - 2026-08-04 - Freohrskulblaka: Added compact no-op summary logging for already-compliant files.
 * - 2026-08-04 - Freohrskulblaka: Hid diagnostic reason breadcrumbs from normal no-op summaries.
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

function renderPlanSummary(plan, analysis, options = {}) {
  const lines = [];
  const includeReasons = options.includeReasons === true;

  lines.push(`Should process: ${plan.shouldProcess ? 'yes' : 'no'}`);
  lines.push(`Container: ${plan.container.sourceContainer || 'unknown'} -> ${plan.container.targetContainer}`);
  lines.push(`Video: ${summarizeVideo(plan.video)}`);
  lines.push(`Audio: ${summarizeAudio(plan.audio)}`);
  lines.push(`Subtitles: ${summarizeSubtitles(plan.subtitles)}`);
  lines.push(`Attachments: ${summarizeAttachments(plan.attachments)}`);
  lines.push(`Chapters: ${summarizeChapters(plan.chapters)}`);
  lines.push(`Metadata: ${summarizeMetadata(plan.metadata)}`);

  const originalLanguage = analysis?.originalLanguage;
  if (originalLanguage?.language) {
    const source = originalLanguage.source ? ` from ${originalLanguage.source}` : '';
    lines.push(`Original language: ${originalLanguage.language}${source}`);
  }

  if (includeReasons && plan.reasons.length > 0) {
    lines.push('');
    lines.push('Reasons:');
    plan.reasons.forEach((reason) => {
      lines.push(`  - ${reason}`);
    });
  }

  return lines.join('\n');
}

function summarizeVideo(videoPlan) {
  const keptCount = videoPlan.tracks.filter((track) => track.action === 'copy').length;
  const transcodeCount = videoPlan.tracks.filter((track) => track.action === 'transcode').length;

  if (transcodeCount === 0) {
    return `keeping ${keptCount} video track${keptCount === 1 ? '' : 's'}`;
  }

  return `keeping ${keptCount}, transcoding ${transcodeCount}`;
}

function summarizeAudio(audioPlan) {
  const keptCount = audioPlan.tracks.filter((track) => track.action === 'copy').length;
  const generatedCount = audioPlan.tracks.filter((track) => track.generated || track.action !== 'copy').length;
  const removedCount = audioPlan.removedTracks.length;
  const channelSummary = summarizeByCount(audioPlan.tracks, (track) => `${track.channels || 'unknown'}ch`);
  const parts = [`retaining ${audioPlan.tracks.length} audio track${audioPlan.tracks.length === 1 ? '' : 's'}`];

  if (channelSummary) {
    parts.push(channelSummary);
  }

  if (generatedCount > 0) {
    parts.push(`generating ${generatedCount}`);
  }

  if (removedCount > 0) {
    parts.push(`removing ${removedCount}`);
  } else if (keptCount === audioPlan.tracks.length) {
    parts.push('all copied');
  }

  return parts.join(', ');
}

function summarizeSubtitles(subtitlePlan) {
  const embeddedCount = subtitlePlan.tracks.filter((track) => track.sourceKind !== 'external').length;
  const externalCount = subtitlePlan.tracks.filter((track) => track.sourceKind === 'external').length;
  const removedCount = subtitlePlan.removedTracks.length;
  const languageSummary = summarizeByCount(subtitlePlan.tracks, (track) => track.languageLabel || track.language || 'unknown');
  const parts = [`retaining ${subtitlePlan.tracks.length} subtitle track${subtitlePlan.tracks.length === 1 ? '' : 's'}`];

  if (embeddedCount > 0 && externalCount > 0) {
    parts.push(`${embeddedCount} embedded, ${externalCount} external`);
  } else if (externalCount > 0) {
    parts.push(`${externalCount} external`);
  } else if (embeddedCount > 0) {
    parts.push(`${embeddedCount} embedded`);
  }

  if (languageSummary) {
    parts.push(languageSummary);
  }

  if (removedCount > 0) {
    parts.push(`removing ${removedCount}`);
  }

  return parts.join(', ');
}

function summarizeAttachments(attachmentPlan) {
  if (attachmentPlan.tracks.length === 0) {
    return 'none';
  }

  return `keeping ${attachmentPlan.keptCount} subtitle fonts, removing ${attachmentPlan.removedCount} non-font attachments`;
}

function summarizeChapters(chapterPlan) {
  const count = getChapterDisplayCount(chapterPlan);
  const detail = count === 1 ? 'chapter marker source' : 'chapter markers';

  return `${chapterPlan.action} ${count} ${detail}`;
}

function summarizeMetadata(metadataPlan) {
  const cleanupItems = [];

  if (metadataPlan.stripGlobalTags && metadataPlan.globalTagKeys.length > 0) {
    cleanupItems.push(`${metadataPlan.globalTagKeys.length} global tag${metadataPlan.globalTagKeys.length === 1 ? '' : 's'}`);
  }

  if (metadataPlan.removeFileTitle && metadataPlan.fileTitle) {
    cleanupItems.push('file title');
  }

  if (metadataPlan.removeVideoTitles && metadataPlan.videoTitleTracks.length > 0) {
    cleanupItems.push(`${metadataPlan.videoTitleTracks.length} video title${metadataPlan.videoTitleTracks.length === 1 ? '' : 's'}`);
  }

  if (metadataPlan.removeExtraTagStreams && metadataPlan.extraTagTracks.length > 0) {
    cleanupItems.push(`${metadataPlan.extraTagTracks.length} extra tag stream${metadataPlan.extraTagTracks.length === 1 ? '' : 's'}`);
  }

  if (cleanupItems.length === 0) {
    return 'no cleanup needed';
  }

  return `cleanup planned for ${cleanupItems.join(', ')}`;
}

function summarizeByCount(items, getLabel) {
  const counts = new Map();

  items.forEach((item) => {
    const label = getLabel(item);
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
    .map(([label, count]) => `${count} ${label}`)
    .join(', ');
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

  lines.push(`  keeping ${attachmentPlan.keptCount} subtitle fonts; removing ${attachmentPlan.removedCount} non-font attachments`);

  attachmentPlan.tracks
    .filter((track) => track.action === 'remove')
    .forEach((track) => {
      lines.push(`  remove src=${track.sourceIndex} name="${track.fileName}" mime="${track.mimeType || track.codecName || 'unknown'}"`);
    });
}

function renderChapters(lines, chapterPlan) {
  const details = [];
  const chapterCount = getChapterDisplayCount(chapterPlan);

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
  lines.push(`Chapters: ${chapterPlan.action} (${chapterCount})${detailText}`);
}

function renderMetadata(lines, metadataPlan) {
  lines.push('Metadata:');
  lines.push(`  stripGlobalTags=${metadataPlan.stripGlobalTags ? 'yes' : 'no'} globalTagKeys=${metadataPlan.globalTagKeys.length}`);
  lines.push(`  removeFileTitle=${metadataPlan.removeFileTitle ? 'yes' : 'no'} fileTitle=${metadataPlan.fileTitle ? 'yes' : 'no'}`);
  lines.push(`  removeVideoTitles=${metadataPlan.removeVideoTitles ? 'yes' : 'no'} titledVideoStreams=${metadataPlan.videoTitleTracks.length}`);
  lines.push(`  removeExtraTagStreams=${metadataPlan.removeExtraTagStreams ? 'yes' : 'no'} extraTagStreams=${metadataPlan.extraTagTracks.length}`);

  metadataPlan.videoTitleTracks.forEach((track) => {
    lines.push(`  video src=${track.sourceIndex} action=${track.action} title="${track.title}"`);
  });

  metadataPlan.extraTagTracks.forEach((track) => {
    lines.push(`  ${track.codecType || 'unknown'} src=${track.sourceIndex} action=${track.action} codec=${track.codecName || 'unknown'} title="${track.title}"`);
  });
}

function getChapterDisplayCount(chapterPlan) {
  return chapterPlan.entryCount || chapterPlan.markerCount || chapterPlan.count;
}

module.exports = {
  renderFinalTrackTable,
  renderPlanSummary,
};
