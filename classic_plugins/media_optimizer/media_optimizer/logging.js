/*
 * Media Optimizer Logging Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Provides structured log collection and Tdarr infoLog formatting for the media optimizer workflow.
 * Updates:
 * - 2026-08-05 - Freohrskulblaka: Added explicit summary entries so summary mode remains useful without normal info noise.
 * - 2026-06-29 - Freohrskulblaka: Created logging helpers with summary, normal, and debug log-level handling.
 */

function createLog(logLevel) {
  const entries = [];
  const resolvedLogLevel = logLevel || 'normal';

  const shouldLog = (level) => {
    const isDebugEntry = level === 'debug';
    const isInfoEntry = level === 'info';
    const isSummaryMode = resolvedLogLevel === 'summary';
    const isDebugMode = resolvedLogLevel === 'debug';

    if (isDebugEntry) {
      return isDebugMode;
    }

    if (isSummaryMode && isInfoEntry) {
      return false;
    }

    return true;
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

  const log = {
    section(title) {
      addEntry('section', title);
    },
    info(message, data) {
      addEntry('info', message, data);
    },
    summary(message, data) {
      addEntry('summary', message, data);
    },
    warn(message, data) {
      addEntry('warn', message, data);
    },
    error(message, data) {
      addEntry('error', message, data);
    },
    debug(message, data) {
      addEntry('debug', message, data);
    },
    toString() {
      const formattedEntries = entries.map(formatLogEntry);
      const output = formattedEntries.join('\n');

      return `${output}\n`;
    },
  };

  return log;
}

function formatLogEntry(entry) {
  let formattedEntry = '';

  if (entry.level === 'section') {
    formattedEntry = `\n=== ${entry.message} ===`;
    return formattedEntry;
  }

  if (typeof entry.data === 'undefined') {
    formattedEntry = `[${getDisplayLevel(entry.level)}] ${entry.message}`;
    return formattedEntry;
  }

  if (typeof entry.data === 'string') {
    formattedEntry = `[${getDisplayLevel(entry.level)}] ${entry.message}:\n${entry.data}`;
    return formattedEntry;
  }

  const formattedData = formatLogData(entry.data);
  formattedEntry = `[${getDisplayLevel(entry.level)}] ${entry.message}: ${formattedData}`;

  return formattedEntry;
}

function getDisplayLevel(level) {
  if (level === 'summary') {
    return 'info';
  }

  return level;
}

function formatLogData(data) {
  let formattedData = '';

  try {
    formattedData = JSON.stringify(data);
  } catch (error) {
    formattedData = `[Unable to format log data: ${error.message}]`;
  }

  return formattedData;
}

module.exports = {
  createLog,
};
