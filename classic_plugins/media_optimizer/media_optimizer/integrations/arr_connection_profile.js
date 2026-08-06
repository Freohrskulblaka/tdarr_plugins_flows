/*
 * Media Optimizer Arr Connection Profile
 * Created by: Freohrskulblaka
 * Created on: 2026-08-06
 * Description: Parses the classic plugin Arr connection profile input without exposing secrets.
 */

function parseArrConnectionProfile(value) {
  const allowedRootKeys = ['sonarr', 'radarr'];
  const allowedConnectionKeys = ['host', 'url', 'apiKey', 'api_key', 'key'];
  const emptyConnection = () => ({ host: '', apiKey: '', isConfigured: false });
  const normalizeConnection = (entry) => {
    const connection = {host: '', apiKey: '', isConfigured: false};

    if (!entry || typeof entry !== 'object') {
      connection.isConfigured = false;
    } else {
      connection.host = String(entry.host || entry.url || '').trim();
      connection.apiKey = String(entry.apiKey || entry.api_key || entry.key || '').trim();
      connection.isConfigured = Boolean(connection.host && connection.apiKey);
    }

    return connection;
  };

  const rawValue = String(value || '').trim();
  const connectionProfile = {
    isInvalid: false,
    validationError: '',
    sonarr: emptyConnection(),
    radarr: emptyConnection(),
  };
  let parsedProfile = {};

  if (!rawValue) {
    return connectionProfile;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    parsedProfile = parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue) ? parsedValue : {};
  } catch (error) {
    connectionProfile.isInvalid = true;
    connectionProfile.validationError = `Invalid arrConnectionProfile JSON: ${error.message}`;
    return connectionProfile;
  }

  const unknownRootKeys = Object.keys(parsedProfile).filter((key) => !allowedRootKeys.includes(key));
  const unknownConnectionKeys = allowedRootKeys.flatMap((appName) => {
    const entry = parsedProfile[appName];

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }

    return Object.keys(entry)
      .filter((key) => !allowedConnectionKeys.includes(key))
      .map((key) => `${appName}.${key}`);
  });
  const unknownKeys = [...unknownRootKeys, ...unknownConnectionKeys];

  if (unknownKeys.length > 0) {
    connectionProfile.isInvalid = true;
    connectionProfile.validationError = `Invalid arrConnectionProfile keys: ${unknownKeys.join(', ')}. Allowed root keys: ${allowedRootKeys.join(', ')}. Allowed connection keys: ${allowedConnectionKeys.join(', ')}.`;
    return connectionProfile;
  }

  connectionProfile.sonarr = normalizeConnection(parsedProfile.sonarr);
  connectionProfile.radarr = normalizeConnection(parsedProfile.radarr);

  return connectionProfile;
}

module.exports = {
  parseArrConnectionProfile,
};
