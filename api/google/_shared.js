import crypto from 'node:crypto';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const PRODUCTION_REDIRECT_URI = 'https://clinicadeestomatologia.vercel.app/api/google/callback';

export function googleConfig() {
  const configuredRedirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    stateSecret: process.env.GOOGLE_STATE_SECRET,
    redirectUri: configuredRedirectUri?.startsWith('https://') ? configuredRedirectUri : PRODUCTION_REDIRECT_URI,
  };
}

export function missingConfig(config, fields) {
  return fields.filter(field => !config[field]);
}

export function createState(secret) {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}.${nonce}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function verifyState(state, secret) {
  if (!state || !secret) return false;
  const [timestamp, nonce, signature] = state.split('.');
  if (!timestamp || !nonce || !signature) return false;
  if (Date.now() - Number(timestamp) > 10 * 60 * 1000) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${nonce}`).digest('hex');
  const supplied = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer);
}

export async function exchangeRefreshToken(config) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || 'Não foi possível renovar a autorização do Google.');
  return data.access_token;
}

export function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(body));
}
