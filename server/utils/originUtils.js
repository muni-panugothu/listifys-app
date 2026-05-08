const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const ensureProtocol = (value) => {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return value;
  }
  return `http://${value}`;
};

const toOrigin = (value) => {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(ensureProtocol(trimmed));
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return null;
  }
};

const toParts = (origin) => {
  const parsed = new URL(origin);
  return {
    protocol: parsed.protocol.toLowerCase(),
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port,
  };
};

const isLoopback = (hostname) => LOOPBACK_HOSTS.has(hostname);

const parseAllowedOrigins = (rawOrigins) => {
  return (rawOrigins || DEFAULT_CLIENT_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isOriginAllowed = (requestOrigin, allowedOrigins) => {
  const normalizedRequestOrigin = toOrigin(requestOrigin);
  if (!normalizedRequestOrigin) return false;

  const normalizedAllowedOrigins = (allowedOrigins || [])
    .map((origin) => toOrigin(origin))
    .filter(Boolean);

  if (normalizedAllowedOrigins.includes(normalizedRequestOrigin)) {
    return true;
  }

  const requestParts = toParts(normalizedRequestOrigin);

  return normalizedAllowedOrigins.some((allowedOrigin) => {
    const allowedParts = toParts(allowedOrigin);

    if (requestParts.protocol !== allowedParts.protocol) {
      return false;
    }

    if (!isLoopback(requestParts.hostname) || !isLoopback(allowedParts.hostname)) {
      return false;
    }

    // If the configured loopback origin has no explicit port, allow any loopback port.
    if (!allowedParts.port) {
      return true;
    }

    return requestParts.port === allowedParts.port;
  });
};

module.exports = {
  parseAllowedOrigins,
  isOriginAllowed,
};
