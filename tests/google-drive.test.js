import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createState, verifyState, encryptRefreshToken, decryptRefreshToken, loadGoogleConfig, ensureCaseFolder, validateRootFolder, OAUTH_COOKIE } from '../api/google/_shared.js';
import connect from '../api/google/connect.js';
import callback from '../api/google/callback.js';
import backup from '../api/google/backup.js';
import status from '../api/google/status.js';

const userId = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
after(() => { globalThis.fetch = originalFetch; process.env = originalEnv; });
let requests, role, storedToken, failUpload, clinicalCase, uploads;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function response() {
  return { code: 200, headers: {}, status(code) { this.code = code; return this; }, setHeader(key, value) { this.headers[key] = value; return this; }, send(body) { this.body = body; return this; }, redirect(code, url) { this.code = code; this.url = url; return this; } };
}
const request = (method = 'POST') => ({ method, headers: { authorization: 'Bearer session' }, body: { caseId }, query: {} });
beforeEach(() => {
  Object.assign(process.env, { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'server-secret', GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_STATE_SECRET: 'state-secret', GOOGLE_REFRESH_TOKEN: 'legacy-token' });
  delete process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  requests = []; uploads = []; role = 'admin'; storedToken = null; failUpload = false;
  clinicalCase = { id: caseId, owner_id: userId, semester: '2026.2', record_number: '1', patient_name: 'Paciente', payload: { photos: [{ storagePath: `${caseId}/registration/photos/photo.png`, mimeType: 'image/png' }] } };
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    requests.push({ url, ...init });
    if (url.includes('/auth/v1/user')) return json({ id: userId, aud: 'authenticated' });
    if (url.includes('/rest/v1/profiles')) return json({ role });
    if (url.includes('/rest/v1/clinical_cases')) return json(init.method === 'PATCH' ? null : clinicalCase);
    if (url.includes('/storage/v1/object/') && url.includes('integrations/google-drive.enc')) {
      if (init.method === 'POST' || init.method === 'PUT') { storedToken = Buffer.from(init.body); return json({ Key: 'saved' }); }
      return storedToken ? new Response(storedToken) : json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 400);
    }
    if (url.includes('/storage/v1/object/')) return new Response('image', { headers: { 'Content-Type': 'image/png' } });
    if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'access', refresh_token: 'new-refresh-token' });
    if (url.includes('/drive/v3/about')) return json({ user: { emailAddress: 'professor@example.com' } });
    if (url.includes('/upload/drive/v3/files')) {
      const body = Buffer.from(init.body).toString();
      uploads.push(body);
      return failUpload ? json({ error: { message: 'Upload failed' } }, 500) : json({ id: `file-${uploads.length}` });
    }
    if (url.includes('/drive/v3/files?') && (!init.method || init.method === 'GET')) return json({ files: [] });
    if (url.includes('/drive/v3/files')) return json({ id: 'folder' });
    throw new Error(`Unexpected request: ${url}`);
  };
});

test('OAuth state requires its browser cookie and rejects tampering, expiry and future dates', () => {
  const state = createState('state-secret', userId);
  assert.equal(verifyState(state, 'state-secret', state), true);
  assert.equal(verifyState(state, 'state-secret'), false);
  assert.equal(verifyState(state, 'wrong-secret', state), false);
  assert.equal(verifyState(`${state}.extra`, 'state-secret', `${state}.extra`), false);
  const now = Date.now;
  try {
    Date.now = () => now() - 601000;
    const expired = createState('state-secret', userId);
    Date.now = () => now() + 601000;
    const future = createState('state-secret', userId);
    Date.now = now;
    assert.equal(verifyState(expired, 'state-secret', expired), false);
    assert.equal(verifyState(future, 'state-secret', future), false);
  } finally { Date.now = now; }
});

test('tokens are encrypted with authentication and reject a changed key', () => {
  const encrypted = encryptRefreshToken('private-token', 'secret');
  assert.equal(encrypted.includes(Buffer.from('private-token')), false);
  assert.equal(decryptRefreshToken(encrypted, 'secret'), 'private-token');
  assert.throws(() => decryptRefreshToken(encrypted, 'changed'));
  encrypted[30] ^= 1;
  assert.throws(() => decryptRefreshToken(encrypted, 'secret'));
});

test('connect rejects missing sessions, non-administrators and GET navigation', async () => {
  let res = response();
  await connect({ ...request(), headers: {} }, res);
  assert.equal(res.code, 401);
  role = 'student'; res = response();
  await connect(request(), res);
  assert.equal(res.code, 403);
  res = response(); await connect(request('GET'), res);
  assert.equal(res.code, 405);
});

test('administrator authorization persists encrypted token without exposing it to the browser', async () => {
  const res = response(); await connect(request(), res);
  assert.equal(res.code, 200);
  const url = new URL(JSON.parse(res.body).url);
  const state = url.searchParams.get('state');
  assert.match(res.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax/);
  const done = response();
  await callback({ ...request('GET'), headers: { cookie: `${OAUTH_COOKIE}=${state}` }, query: { state, code: 'auth-code' } }, done);
  assert.equal(done.code, 303);
  assert.equal(done.url, '/?drive=connected');
  assert.match(done.headers['Set-Cookie'], /Max-Age=0/);
  assert.equal(decryptRefreshToken(storedToken, 'state-secret'), 'new-refresh-token');
  const config = await loadGoogleConfig({ storage: { from: () => ({ download: async () => ({ data: new Blob([storedToken]) }) }) } });
  assert.equal(config.refreshToken, 'new-refresh-token');
});

test('callback rejects a different browser and rechecks administrator role', async () => {
  const state = createState('state-secret', userId);
  let res = response();
  await callback({ ...request('GET'), headers: {}, query: { state, code: 'code' } }, res);
  assert.equal(res.code, 400);
  role = 'student'; res = response();
  await callback({ ...request('GET'), headers: { cookie: `${OAUTH_COOKIE}=${state}` }, query: { state, code: 'code' } }, res);
  assert.equal(res.code, 403);
  assert.equal(requests.some(item => item.url.includes('oauth2.googleapis.com')), false);
});

test('token storage errors fail closed instead of silently switching accounts', async () => {
  await assert.rejects(loadGoogleConfig({ storage: { from: () => ({ download: async () => ({ error: { status: 500, message: 'Unavailable' } }) }) } }), /consultar/);
  storedToken = encryptRefreshToken('token', 'old-secret');
  const res = response(); await status(request('GET'), res);
  assert.equal(JSON.parse(res.body).status, 'invalid_token');
});

test('failed attachment upload never publishes the new snapshot or backup timestamp', async () => {
  failUpload = true;
  const res = response(); await backup(request(), res);
  assert.equal(res.code, 500);
  assert.equal(uploads.some(body => body.includes('guia-clinico.json')), false);
  assert.equal(requests.some(item => item.url.includes('/rest/v1/clinical_cases') && item.method === 'PATCH'), false);
});

test('successful backup uploads attachments before JSON and records their mapping', async () => {
  const res = response(); await backup(request(), res);
  assert.equal(res.code, 200);
  assert.equal(JSON.parse(res.body).filesCopied, 2);
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].includes('guia-clinico.json'), false);
  assert.match(uploads[1], /guia-clinico.json/);
  assert.match(uploads[1], /"driveFileId": "file-1"/);
  assert.match(uploads[1], new RegExp(caseId));
  assert.equal(requests.at(-1).method, 'PATCH');
});

test('backup denies other cases and storage paths outside the requested case', async () => {
  role = 'student'; clinicalCase.owner_id = 'other-user';
  let res = response(); await backup(request(), res);
  assert.equal(res.code, 403);
  clinicalCase.owner_id = userId;
  clinicalCase.payload.photos[0].storagePath = 'integrations/google-drive.enc';
  res = response(); await backup(request(), res);
  assert.equal(res.code, 403);
  assert.equal(uploads.length, 0);
  clinicalCase.payload.photos[0].storagePath = `${caseId}/../other/file.png`;
  res = response(); await backup(request(), res);
  assert.equal(res.code, 403);
});

test('renaming or moving a case updates the same folder by immutable case ID', async () => {
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), ...init });
    return json(init.method === 'PATCH' ? { id: 'existing-folder' } : { files: [{ id: 'existing-folder', parents: ['old-semester'] }] });
  };
  const folder = await ensureCaseFolder('access', clinicalCase, 'new-semester');
  assert.equal(folder.id, 'existing-folder');
  assert.match(new URL(requests[0].url).searchParams.get('q'), new RegExp(caseId));
  const update = requests[1];
  assert.equal(update.method, 'PATCH');
  assert.equal(new URL(update.url).searchParams.get('removeParents'), 'old-semester');
  assert.equal(new URL(update.url).searchParams.get('addParents'), 'new-semester');
  assert.equal(JSON.parse(update.body).appProperties.clinicalCaseId, caseId);
});

test('configured root must be accessible and allow creating files', async () => {
  globalThis.fetch = async () => json({ error: { message: 'Not found' } }, 404);
  await assert.rejects(validateRootFolder('access', 'inaccessible'), /não está acessível/);
  globalThis.fetch = async () => json({ mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: false } });
  await assert.rejects(validateRootFolder('access', 'readonly'), /não permite/);
});

test('missing stored token and missing legacy token request authorization', async () => {
  delete process.env.GOOGLE_REFRESH_TOKEN;
  const res = response(); await status(request('GET'), res);
  assert.equal(res.code, 200);
  assert.equal(JSON.parse(res.body).status, 'authorization_required');
});

test('callback storage failure does not claim connection success or display the token', async () => {
  const state = createState('state-secret', userId);
  const mock = globalThis.fetch;
  globalThis.fetch = (url, init) => String(url).includes('/storage/v1/object/') ? Promise.resolve(json({ message: 'Storage unavailable' }, 500)) : mock(url, init);
  const res = response();
  await callback({ ...request('GET'), headers: { cookie: `${OAUTH_COOKIE}=${state}` }, query: { state, code: 'code' } }, res);
  assert.equal(res.code, 500);
  assert.equal(res.url, undefined);
  assert.equal(res.body.includes('new-refresh-token'), false);
});

test('legacy folder adoption verifies snapshot identity before renaming', async () => {
  clinicalCase.drive_file_id = 'old-json';
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), ...init });
    if (String(url).includes('alt=media')) return json({ case: { id: caseId } });
    if (String(url).includes('/old-json?')) return json({ parents: ['old-patient-folder'] });
    if (String(url).includes('/old-patient-folder?')) return json({ id: 'old-patient-folder', parents: ['old-semester'] });
    return json({ files: [] });
  };
  await ensureCaseFolder('access', clinicalCase, 'new-semester');
  const update = requests.find(item => item.method === 'PATCH');
  assert.match(update.url, /old-patient-folder/);
  assert.equal(JSON.parse(update.body).appProperties.clinicalCaseId, caseId);
});
