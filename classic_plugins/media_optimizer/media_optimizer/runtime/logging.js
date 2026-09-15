/*
 * Media Optimizer Logging Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Provides structured log collection and Tdarr infoLog formatting for the media optimizer workflow.
 * Updates:
 * - 2026-08-05 - Freohrskulblaka: Added explicit summary entries so summary mode remains useful without normal info noise.
 * - 2026-06-29 - Freohrskulblaka: Created logging helpers with summary, normal, and debug log-level handling.
 */

const LOG_ENTRY_LEVELS = ['section', 'info', 'summary', 'warn', 'error', 'debug'];
const LOG_LEVEL_ENTRIES = {
  summary: new Set(['section', 'summary', 'warn', 'error']),
  normal: new Set(['section', 'info', 'summary', 'warn', 'error']),
  debug: new Set(LOG_ENTRY_LEVELS),
};

function createLog(logLevel) {
  const entries = [];
  const resolvedLogLevel = logLevel || 'normal';
  const enabledEntries = LOG_LEVEL_ENTRIES[resolvedLogLevel];

  if (!enabledEntries) {
    throw new Error(`Invalid log level: ${resolvedLogLevel}`);
  }

  const addEntry = (level, message, data) => {
    if (!enabledEntries.has(level)) {
      return;
    }

    const entry = {level, message, data};

    entries.push(entry);
  };

  const log = LOG_ENTRY_LEVELS.reduce((logger, level) => {
    logger[level] = (message, data) => addEntry(level, message, data);
    return logger;
  }, {});

  Object.assign(log, {
    toString() {
      const formattedEntries = entries.map(formatLogEntry);
      const output = formattedEntries.join('\n');

      return `${output}\n`;
    },
  });

  return log;
}

function formatLogEntry(entry) {
  const displayLevel = entry.level === 'summary' ? 'info' : entry.level;

  if (entry.level === 'section') {
    return `\n=== ${entry.message} ===`;
  }

  if (typeof entry.data === 'undefined') {
    return `[${displayLevel}] ${entry.message}`;
  }

  if (typeof entry.data === 'string') {
    return `[${displayLevel}] ${entry.message}:\n${entry.data}`;
  }

  let formattedData = '';

  try {
    formattedData = JSON.stringify(entry.data);
  } catch (error) {
    formattedData = `[Unable to format log data: ${error.message}]`;
  }

  return `[${displayLevel}] ${entry.message}: ${formattedData}`;
}

module.exports = {
  createLog,
};
