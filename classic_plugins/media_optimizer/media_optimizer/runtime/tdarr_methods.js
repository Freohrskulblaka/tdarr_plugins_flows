/*
 * Media Optimizer Tdarr Methods Runtime Adapter
 * Created by: Freohrskulblaka
 * Created on: 2026-08-06
 * Description: Resolves Tdarr's runtime methods/lib helper from local and deployed plugin layouts.
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
    let resolvedPath;

    try {
      resolvedPath = require.resolve(candidatePath);
    } catch (error) {
      if (error && error.code === 'MODULE_NOT_FOUND') {
        errors.push(`${candidatePath}: ${error.message}`);
        continue;
      }

      throw error;
    }

    return require(resolvedPath)();
  }

  throw new Error(`Unable to load Tdarr methods/lib from Media Optimizer package. Tried: ${errors.join(' | ')}`);
}

module.exports = {
  loadTdarrMethodsLib,
};
