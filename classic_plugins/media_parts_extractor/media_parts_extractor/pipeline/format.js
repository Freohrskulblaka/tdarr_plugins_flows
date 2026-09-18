/*
 * Media Parts Extractor Formatting Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-22
 * Description: Formats planned and executed donor sidecar extraction work for Tdarr logs.
 */

function renderAnalysisSummary(analysis) {
  const summary = analysis.summary || {};
  const lines = [
    `Video streams: ${summary.videoStreamCount || 0}`,
    `Audio streams: ${summary.audioStreamCount || 0}`,
    `Subtitle streams: ${summary.subtitleStreamCount || 0}`,
    `Attachments: ${summary.attachmentCount || 0}`,
    `Chapters: ${summary.chapterCount || 0}`,
  ];

  if (summary.hasMultipleVideoStreams) {
    lines.push('Multiple video streams detected.');
  }

  if (summary.hasPictureSubtitles) {
    lines.push('Picture subtitles detected.');
  }

  return lines.join('\n');
}

function renderExtractionPlan(plan) {
  const lines = [];

  lines.push(`Video streams selected: ${plan.video.count}`);
  plan.video.items.forEach((item) => {
    lines.push(`  - 0:${item.sourceIndex} ${item.resolution} ${item.hdrType} ${item.codec} -> ${item.outputPath}`);
  });

  lines.push(`Audio streams selected: ${plan.audio.count}`);
  plan.audio.items.forEach((item) => {
    lines.push(`  - 0:${item.sourceIndex} ${item.language} ${item.channelFamily} ${item.codec} -> ${item.outputPath}`);
  });

  lines.push(`Subtitle streams selected: ${plan.subtitles.count}`);
  plan.subtitles.items.forEach((item) => {
    lines.push(`  - 0:${item.sourceIndex} ${item.language} ${item.subtitleType} ${item.codec} -> ${item.outputPath}`);
  });

  if (plan.reasons.length > 0) {
    lines.push('');
    lines.push('Notes:');
    plan.reasons.forEach((reason) => lines.push(`  - ${reason}`));
  }

  return lines.join('\n');
}

function renderCommandPreview(commandPlan) {
  const lines = [];

  lines.push(`Executable: ${commandPlan.isExecutable ? 'yes' : 'no'}`);
  lines.push(`Source: ${commandPlan.sourcePath || '(unresolved)'}`);

  commandPlan.commands.forEach((command) => {
    lines.push(`  - ${command.preview || command.reason}`);
  });

  return lines.join('\n');
}

function renderExecutionResults(results) {
  const lines = [];

  results.forEach((result) => {
    lines.push(`  - ${result.status}: ${result.outputPath}${result.reason ? ` (${result.reason})` : ''}`);
  });

  return lines.join('\n');
}

module.exports = {
  renderAnalysisSummary,
  renderCommandPreview,
  renderExecutionResults,
  renderExtractionPlan,
};
