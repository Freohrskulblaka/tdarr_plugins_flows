/*
 * Media Optimizer Arr Connections
 * Created by: Freohrskulblaka
 * Created on: 2026-09-15
 * Description: Resolves Sonarr and Radarr connections from Tdarr variables or the worker environment without logging secrets.
 */

const {parseArrConnectionProfile} = require('./arr_connection_profile');

const CONNECTION_VARIABLES = {
  sonarr: {
    host: 'MediaOptimizerSonarrHost',
    apiKey: 'MediaOptimizerSonarrAPIKey',
    environmentHost: 'MEDIA_OPTIMIZER_SONARR_HOST',
    environmentApiKey: 'MEDIA_OPTIMIZER_SONARR_API_KEY',
  },
  radarr: {
    host: 'MediaOptimizerRadarrHost',
    apiKey: 'MediaOptimizerRadarrAPIKey',
    environmentHost: 'MEDIA_OPTIMIZER_RADARR_HOST',
    environmentApiKey: 'MEDIA_OPTIMIZER_RADARR_API_KEY',
  },
};

function resolveArrConnections(otherArguments = {}, environment = process.env, fallbackProfileValue = '') {
  const userVariables = otherArguments.userVariables || {};
  const fallbackProfile = parseArrConnectionProfile(fallbackProfileValue);
  const errors = [];
  const connections = {};

  Object.entries(CONNECTION_VARIABLES).forEach(([appName, names]) => {
    const libraryVariables = userVariables.library || {};
    const globalVariables = userVariables.global || {};
    const candidates = [
      {name: 'library variables', host: libraryVariables[names.host], apiKey: libraryVariables[names.apiKey]},
      {name: 'global variables', host: globalVariables[names.host], apiKey: globalVariables[names.apiKey]},
      {name: 'environment variables', host: environment?.[names.environmentHost], apiKey: environment?.[names.environmentApiKey]},
      {name: 'plugin input fallback', host: fallbackProfile[appName]?.host, apiKey: fallbackProfile[appName]?.apiKey},
    ].map((candidate) => ({
      ...candidate,
      host: String(candidate.host || '').trim(),
      apiKey: String(candidate.apiKey || '').trim(),
    }));
    const source = candidates.find((candidate) => candidate.host && candidate.apiKey)
      || candidates.find((candidate) => candidate.host || candidate.apiKey)
      || {name: 'not configured', host: '', apiKey: ''};

    if (Boolean(source.host) !== Boolean(source.apiKey)) {
      errors.push(`${appName} requires both host and API key in ${source.name}`);
    }

    connections[appName] = {
      host: source.host,
      apiKey: source.apiKey,
      source: source.name,
    };
  });

  return {
    isInvalid: fallbackProfile.isInvalid || errors.length > 0,
    validationError: fallbackProfile.validationError
      || (errors.length > 0 ? `Invalid Arr connection variables: ${errors.join('; ')}.` : ''),
    ...connections,
  };
}

module.exports = {
  resolveArrConnections,
};
