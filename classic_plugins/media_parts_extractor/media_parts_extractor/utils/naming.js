/*
 * Media Parts Extractor Naming Utilities
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Provides shared output directory and filename token rules.
 */

function getOutputDirectory(context) {
  if (context.settings.output.mode === 'Configured Directory') {
    return context.settings.output.directory;
  }

  return context.analysis.file.directory;
}

function formatNameParts(parts) {
  return parts
    .map(sanitizeToken)
    .filter(Boolean)
    .join('.');
}

function sanitizeToken(value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+|\.+$/g, '');
}

module.exports = { getOutputDirectory, formatNameParts, sanitizeToken };
