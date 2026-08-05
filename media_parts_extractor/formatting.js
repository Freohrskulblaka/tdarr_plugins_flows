/*
 * Media Parts Extractor Formatting Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-22
 * Description: Formats planned and executed donor sidecar extraction work for Tdarr logs.
 */

function renderExtractionPlan(plan) {
  const lines = [];

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
  renderCommandPreview,
  renderExecutionResults,
  renderExtractionPlan,
};
