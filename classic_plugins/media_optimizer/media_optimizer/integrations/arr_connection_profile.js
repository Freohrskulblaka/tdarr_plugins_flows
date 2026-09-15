/*
 * Media Optimizer Arr Connection Profile
 * Created by: Freohrskulblaka
 * Created on: 2026-08-06
 * Description: Parses the classic plugin Arr connection profile input without exposing secrets.
 */

function parseArrConnectionProfile(value) {
  const allowedRootKeys = ['sonarr', 'radarr'];
  const allowedConnectionKeys = ['host', 'apiKey'];

  const rawValue = String(value || '').trim();
  const connectionProfile = {
    isInvalid: false,
    validationError: '',
    sonarr: {host: '', apiKey: ''},
    radarr: {host: '', apiKey: ''},
  };

  if (!rawValue) {
    return connectionProfile;
  }

  let parsedProfile;

  try {
    parsedProfile = JSON.parse(rawValue);
  } catch (error) {
    connectionProfile.isInvalid = true;
    connectionProfile.validationError = `Invalid arrConnectionProfile JSON: ${error.message}`;
    return connectionProfile;
  }

  if (!parsedProfile || typeof parsedProfile !== 'object' || Array.isArray(parsedProfile)) {
    connectionProfile.isInvalid = true;
    connectionProfile.validationError = 'Invalid arrConnectionProfile: expected a JSON object.';
    return connectionProfile;
  }

  const errors = Object.keys(parsedProfile)
    .filter((key) => !allowedRootKeys.includes(key))
    .map((key) => `unknown root key ${key}`);

  allowedRootKeys.forEach((appName) => {
    const entry = parsedProfile[appName];

    if (entry === undefined || entry === null) {
      return;
    }

    if (typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${appName} must be an object`);
      return;
    }

    errors.push(...Object.keys(entry)
      .filter((key) => !allowedConnectionKeys.includes(key))
      .map((key) => `unknown key ${appName}.${key}`));

    const host = String(entry.host || '').trim();
    const apiKey = String(entry.apiKey || '').trim();

    if (Boolean(host) !== Boolean(apiKey)) {
      errors.push(`${appName} requires both host and apiKey`);
      return;
    }

    connectionProfile[appName] = {host, apiKey};
  });

  if (errors.length > 0) {
    connectionProfile.isInvalid = true;
    connectionProfile.validationError = `Invalid arrConnectionProfile: ${errors.join('; ')}. Expected keys: sonarr.host, sonarr.apiKey, radarr.host, radarr.apiKey.`;
  }

  return connectionProfile;
}

module.exports = {
  parseArrConnectionProfile,
};
