import { authenticatedContext } from './_auth.js';
import { createState, DRIVE_SCOPE, googleConfig, missingConfig, oauthCookie, sendJson } from './_shared.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Método não permitido.' });
  try {
    const { user } = await authenticatedContext(request, true);
    const config = googleConfig();
    const missing = missingConfig(config, ['clientId', 'clientSecret', 'stateSecret']);
    if (missing.length) return sendJson(response, 503, { error: 'Integração ainda não configurada na Vercel.', missing });
    const state = createState(config.stateSecret, user.id);
    const params = new URLSearchParams({
      client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code',
      scope: DRIVE_SCOPE, access_type: 'offline', prompt: 'consent', state,
    });
    response.setHeader('Set-Cookie', oauthCookie(state));
    return sendJson(response, 200, { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  } catch (error) {
    return sendJson(response, error.status || 500, { error: error.message || 'Não foi possível iniciar a conexão.' });
  }
}
