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

export function createState(secret, userId) {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}.${nonce}.${userId}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export const OAUTH_COOKIE = '__Host-google-oauth';
export const oauthCookie = (state, maxAge = 600) => `${OAUTH_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export function verifyState(state, secret, cookieState) {
  if (typeof state !== 'string' || !secret || state !== cookieState) return false;
  const parts = state.split('.');
  if (parts.length !== 4) return false;
  const [timestamp, nonce, userId, signature] = parts;
  if (!/^\d+$/.test(timestamp) || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9-]{36}$/.test(userId) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const age = Date.now() - Number(timestamp);
  if (age < 0 || age > 10 * 60 * 1000) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${nonce}.${userId}`).digest();
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), expected);
}

// This non-UUID prefix is denied by the clinical-files RLS policies, including for professors.
const TOKEN_PATH = 'integrations/google-drive.enc';
const tokenKey = secret => crypto.createHash('sha256').update(`google-drive-token:${secret}`).digest();

export function encryptRefreshToken(token, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptRefreshToken(buffer, secret) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(secret), buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8');
}

export async function saveRefreshToken(admin, token, secret) {
  const { error } = await admin.storage.from('clinical-files').upload(TOKEN_PATH, encryptRefreshToken(token, secret), {
    contentType: 'application/octet-stream', upsert: true, cacheControl: '0',
  });
  if (error) throw new Error('Não foi possível armazenar a autorização. Verifique o bucket privado clinical-files e tente novamente.');
}

export async function loadGoogleConfig(admin) {
  const config = googleConfig();
  if (!config.stateSecret) return config;
  const { data, error } = await admin.storage.from('clinical-files').download(TOKEN_PATH);
  if (error) {
    // Only a missing object permits the legacy environment-token fallback.
    if (String(error.statusCode || error.status) === '404' || error.message === 'Object not found') return config;
    throw Object.assign(new Error('Não foi possível consultar a autorização armazenada do Google Drive.'), { status: 503 });
  }
  try {
    config.refreshToken = decryptRefreshToken(Buffer.from(await data.arrayBuffer()), config.stateSecret);
  } catch {
    throw Object.assign(new Error('A chave da autorização mudou. Conecte o Google Drive novamente.'), { connectionStatus: 'invalid_token' });
  }
  return config;
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
  if (!response.ok) throw Object.assign(new Error('Não foi possível renovar a autorização do Google.'), { connectionStatus: data.error === 'invalid_grant' ? 'invalid_token' : 'unavailable' });
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

export async function validateRootFolder(accessToken, folderId) {
  if (!folderId) return;
  let folder;
  try {
    folder = await driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,mimeType,trashed,capabilities(canAddChildren)`);
  } catch {
    throw Object.assign(new Error('A pasta configurada não está acessível ao aplicativo. Remova GOOGLE_DRIVE_ROOT_FOLDER_ID para criar uma pasta automaticamente, ou use uma pasta já autorizada ao aplicativo.'), { connectionStatus: 'folder_unavailable' });
  }
  if (folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder' || !folder.capabilities?.canAddChildren) {
    throw Object.assign(new Error('A pasta configurada não permite criar as cópias. Escolha uma pasta acessível ou remova GOOGLE_DRIVE_ROOT_FOLDER_ID.'), { connectionStatus: 'folder_unavailable' });
  }
}

export async function ensureCaseFolder(accessToken, clinicalCase, parentId) {
  const name = `Ficha ${clinicalCase.record_number} - ${clinicalCase.patient_name}`.replace(/[\\/]/g, '-').slice(0, 160);
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='clinicalCaseId' and value='${driveQueryValue(clinicalCase.id)}' }`;
  const params = new URLSearchParams({ q, fields: 'files(id,parents,appProperties)', pageSize: '2' });
  const { files = [] } = await driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files?${params}`);
  if (files.length > 1) throw new Error('Há mais de uma pasta para este prontuário. Verifique as cópias antes de continuar.');
  let folder = files[0];
  // Adopt the previous backup only after checking the case ID in its JSON.
  if (!folder && clinicalCase.drive_file_id) {
    try {
      const snapshot = await driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(clinicalCase.drive_file_id)}?alt=media`);
      if (snapshot.case?.id === clinicalCase.id) {
        const file = await driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(clinicalCase.drive_file_id)}?fields=parents`);
        if (file.parents?.[0]) {
          const candidate = await driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.parents[0])}?fields=id,parents,appProperties,trashed`);
          if (!candidate.trashed && (!candidate.appProperties?.clinicalCaseId || candidate.appProperties.clinicalCaseId === clinicalCase.id)) folder = candidate;
        }
      }
    } catch {
      // A deleted or inaccessible legacy backup is recreated below.
    }
  }
  const metadata = { name, appProperties: { clinicalCaseId: clinicalCase.id } };
  if (!folder) return driveRequest(accessToken, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...metadata, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const move = new URLSearchParams({ fields: 'id' });
  if (!folder.parents?.includes(parentId)) {
    move.set('addParents', parentId);
    if (folder.parents?.length) move.set('removeParents', folder.parents.join(','));
  }
  return driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folder.id)}?${move}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata),
  });
}
