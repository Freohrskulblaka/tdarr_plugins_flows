/*
 * Media Parts Extractor Logging Library
 * Created by: Freohrskulblaka
 * Created on: 2026-08-06
 * Description: Provides structured log collection and Tdarr infoLog formatting for the media parts extractor workflow.
 */

function createLog(logLevel) {
  const entries = [];
  const resolvedLogLevel = logLevel || 'normal';
  const validLogLevels = ['summary', 'normal', 'debug'];
  const validEntryLevels = ['section', 'info', 'summary', 'warn', 'error', 'debug'];

  if (!validLogLevels.includes(resolvedLogLevel)) {
    throw new Error(`Invalid log level: ${resolvedLogLevel}`);
  }

  const shouldLog = (level) => {
    if (!validEntryLevels.includes(level)) {
      throw new Error(`Invalid log entry level: ${level}`);
    }

    const shouldLogSummary = resolvedLogLevel === 'summary' && level !== 'info' && level !== 'debug';
    const shouldLogNormal = resolvedLogLevel === 'normal' && level !== 'debug';
    const shouldLogDebug = resolvedLogLevel === 'debug';

    return shouldLogSummary || shouldLogNormal || shouldLogDebug;
  };

  const addEntry = (level, message, data) => {
    if (!shouldLog(level)) {
      return;
    }

    const entry = {
      level,
      message,
      data,
    };

    entries.push(entry);
  };

  const log = validEntryLevels.reduce((logger, level) => {
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
