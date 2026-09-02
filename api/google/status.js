import { exchangeRefreshToken, googleConfig, missingConfig, sendJson } from './_shared.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Método não permitido.' });
  const config = googleConfig();
  const baseMissing = missingConfig(config, ['clientId', 'clientSecret', 'stateSecret']);
  if (baseMissing.length) return sendJson(response, 200, { status: 'configuration_required' });
  if (!config.refreshToken) return sendJson(response, 200, { status: 'authorization_required' });

  try {
    const accessToken = await exchangeRefreshToken(config);
    const googleResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await googleResponse.json();
    if (!googleResponse.ok) throw new Error(data.error?.message || 'A conta não respondeu.');
    return sendJson(response, 200, { status: 'connected', account: data.user });
  } catch (error) {
    return sendJson(response, 200, { status: 'invalid_token', error: error.message });
  }
}
