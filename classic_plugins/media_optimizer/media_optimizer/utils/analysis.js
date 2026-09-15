/*
 * Media Optimizer Analysis Utilities
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Shared low-level helpers for media optimizer source analysis modules.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Added shared unique-value collection for analysis modules.
 */

function getUniqueValues(items, getValue) {
  return [...new Set(items.map(getValue))];
}

module.exports = {
  getUniqueValues,
};
