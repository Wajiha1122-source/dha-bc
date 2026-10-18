export function runtimeConfig(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === 'production';
  if (!env.DATABASE_URL?.trim()) {
    throw new Error('Missing DATABASE_URL. Set it in the hosting service Environment settings; local .env files are not uploaded to GitHub.');
  }
  const secret = env.SESSION_SECRET;
  // Render generates a 256-bit secret encoded as 44 Base64 characters.
  if (!secret || secret.length < 32 || secret.startsWith('REPLACE_')) {
    throw new Error('Missing or invalid SESSION_SECRET. Set a randomly generated secret of at least 32 characters in the hosting service Environment settings.');
  }
  const configuredOrigin = env.APP_ORIGIN || env.RENDER_EXTERNAL_URL || (production ? '' : 'http://localhost:5173');
  if (!configuredOrigin) throw new Error('Missing APP_ORIGIN. Set it to the public HTTPS application URL.');
  let url: URL;
  try { url = new URL(configuredOrigin); } catch { throw new Error('APP_ORIGIN must be a complete application URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('APP_ORIGIN must contain only the application origin, without a path, credentials, or query.');
  }
  if (production && url.protocol !== 'https:') throw new Error('Production APP_ORIGIN must use HTTPS for secure login cookies.');
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
  return {
    production, secret, origin: url.origin, port,
    host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1'),
    trustProxy: production && (env.TRUST_PROXY === '1' || (env.TRUST_PROXY === undefined && env.RENDER === 'true')),
  };
}
