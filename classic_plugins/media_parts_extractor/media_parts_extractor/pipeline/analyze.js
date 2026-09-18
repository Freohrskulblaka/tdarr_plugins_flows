/*
 * Media Parts Extractor Analysis Adapter
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Reuses Media Optimizer normalized source analysis in source and deployed layouts.
 */

function analyzeFile(context) {
  const candidates = [
    '../../media_optimizer/pipeline/analyze',
    '../../../media_optimizer/media_optimizer/pipeline/analyze',
  ];

  for (const candidate of candidates) {
    let resolvedPath;
    try {
      resolvedPath = require.resolve(candidate);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        continue;
      }
      throw error;
    }
    return require(resolvedPath).analyzeFile(context);
  }

  throw new Error('Media Parts Extractor requires the sibling Media Optimizer support folder.');
}

module.exports = { analyzeFile };
