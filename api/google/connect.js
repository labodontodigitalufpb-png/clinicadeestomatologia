import { createState, DRIVE_SCOPE, googleConfig, missingConfig, sendJson } from './_shared.js';

export default function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Método não permitido.' });
  const config = googleConfig();
  const missing = missingConfig(config, ['clientId', 'clientSecret', 'stateSecret']);
  if (missing.length) return sendJson(response, 503, { error: 'Integração ainda não configurada na Vercel.', missing });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: createState(config.stateSecret),
  });
  response.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
