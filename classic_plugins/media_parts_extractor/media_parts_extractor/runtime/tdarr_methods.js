/*
 * Media Parts Extractor Tdarr Methods Runtime Adapter
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Resolves Tdarr input helpers in source and deployed layouts.
 */

function loadTdarrMethodsLib() {
  const candidatePaths = [
    '../methods/lib',
    '../../methods/lib',
    '../../../methods/lib',
    '../../../../methods/lib',
  ];

  const errors = [];

  for (const candidatePath of candidatePaths) {
    try {
      const resolvedPath = require.resolve(candidatePath);
      return require(resolvedPath)();
    } catch (error) {
      if (error && error.code === 'MODULE_NOT_FOUND') {
        errors.push(`${candidatePath}: ${error.message}`);
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Unable to load Tdarr methods/lib from Media Parts Extractor package. Tried: ${errors.join(' | ')}`);
}

module.exports = { loadTdarrMethodsLib };
