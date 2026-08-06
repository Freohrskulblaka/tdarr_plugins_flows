/*
 * Media Optimizer Tdarr Methods Runtime Adapter
 * Created by: Freohrskulblaka
 * Created on: 2026-08-06
 * Description: Resolves Tdarr's runtime methods/lib helper from local and deployed plugin layouts.
 */

function loadTdarrMethodsLib() {
  const candidatePaths = createParentCandidatePaths('methods/lib', 4);
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

  throw new Error(`Unable to load Tdarr methods/lib from Media Optimizer package. Tried: ${errors.join(' | ')}`);
}

function createParentCandidatePaths(targetPath, maxDepth) {
  const candidatePaths = [];
  let parentPath = '..';

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    candidatePaths.push(`${parentPath}/${targetPath}`);
    parentPath = `../${parentPath}`;
  }

  return candidatePaths;
}

module.exports = {
  loadTdarrMethodsLib,
};
