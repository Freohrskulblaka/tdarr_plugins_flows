/*
 * Media Optimizer Analysis Utilities
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Shared low-level helpers for media optimizer source analysis modules.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Added shared unique-value collection for analysis modules.
 */

function getUniqueValues(items, getValue) {
  const values = items.map(getValue);
  const uniqueValues = [...new Set(values)];

  return uniqueValues;
}

module.exports = {
  getUniqueValues,
};
