/*
 * Media Parts Extractor Response Library
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Builds the Tdarr response after donor sidecar extraction.
 */

function createResponse(context) {
  return Object.assign({}, context.response, {
    processFile: false,
    preset: '',
    infoLog: context.log.toString(),
  });
}

module.exports = { createResponse };
