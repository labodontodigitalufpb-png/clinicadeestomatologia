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
    rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
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

const driveQueryValue = value => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function driveRequest(accessToken, url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'O Google Drive não concluiu a operação.');
  return data;
}

export async function findDriveFile(accessToken, name, parentId, mimeType) {
  const clauses = [`name = '${driveQueryValue(name)}'`, 'trashed = false'];
  if (parentId) clauses.push(`'${driveQueryValue(parentId)}' in parents`);
  if (mimeType) clauses.push(`mimeType = '${driveQueryValue(mimeType)}'`);
  const params = new URLSearchParams({ q: clauses.join(' and '), spaces: 'drive', pageSize: '10', fields: 'files(id,name,mimeType,webViewLink)' });
  const data = await driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files?${params}`);
  return data.files?.[0] || null;
}

export async function ensureDriveFolder(accessToken, name, parentId) {
  const existing = await findDriveFile(accessToken, name, parentId, 'application/vnd.google-apps.folder');
  if (existing) return existing;
  return driveRequest(accessToken, 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) }),
  });
}

export async function uploadDriveFile(accessToken, { name, mimeType, buffer, parentId }) {
  const existing = await findDriveFile(accessToken, name, parentId);
  const boundary = `clinical_backup_${crypto.randomBytes(12).toString('hex')}`;
  const metadata = { name, mimeType, ...(!existing && parentId ? { parents: [parentId] } : {}) };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const filePath = existing ? `/${existing.id}` : '';
  return driveRequest(accessToken, `https://www.googleapis.com/upload/drive/v3/files${filePath}?uploadType=multipart&fields=id,name,webViewLink`, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}
