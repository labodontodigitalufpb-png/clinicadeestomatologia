import { authenticatedContext } from './_auth.js';
import { exchangeRefreshToken, googleConfig, loadGoogleConfig, missingConfig, sendJson, validateRootFolder } from './_shared.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Método não permitido.' });
  try {
    const { admin } = await authenticatedContext(request, true);
    let config = googleConfig();
    const baseMissing = missingConfig(config, ['clientId', 'clientSecret', 'stateSecret']);
    if (baseMissing.length) return sendJson(response, 200, { status: 'configuration_required' });
    config = await loadGoogleConfig(admin);
    if (!config.refreshToken) return sendJson(response, 200, { status: 'authorization_required' });
    const accessToken = await exchangeRefreshToken(config);
    const googleResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await googleResponse.json();
    if (!googleResponse.ok) throw new Error(data.error?.message || 'A conta não respondeu.');
    await validateRootFolder(accessToken, config.rootFolderId);
    return sendJson(response, 200, { status: 'connected', account: data.user });
  } catch (error) {
    if (error.status) return sendJson(response, error.status, { status: 'unavailable', error: error.message });
    return sendJson(response, 200, { status: error.connectionStatus || 'unavailable', error: error.message });
  }
}
