import { requireAdminRole, serverClient } from './_auth.js';
import { googleConfig, missingConfig, OAUTH_COOKIE, oauthCookie, saveRefreshToken, verifyState } from './_shared.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  if (request.method !== 'GET') return response.status(405).send('Método não permitido.');
  try {
    const config = googleConfig();
    if (missingConfig(config, ['clientId', 'clientSecret', 'stateSecret']).length) return response.status(503).send('Integração incompleta na Vercel.');
    const cookieState = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${OAUTH_COOKIE}=`))?.slice(OAUTH_COOKIE.length + 1);
    if (!verifyState(request.query.state, config.stateSecret, cookieState)) return response.status(400).send('Autorização inválida ou expirada. Inicie novamente pelo aplicativo.');
    response.setHeader('Set-Cookie', oauthCookie('', 0));
    const admin = serverClient();
    await requireAdminRole(admin, request.query.state.split('.')[2]);
    if (request.query.error) return response.status(400).send('Autorização recusada. Volte ao aplicativo e tente novamente.');
    if (typeof request.query.code !== 'string' || !request.query.code) return response.status(400).send('Código de autorização ausente.');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: request.query.code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) return response.status(400).send('Falha ao concluir a autorização. Inicie novamente pelo aplicativo.');
    if (!tokens.refresh_token) return response.status(400).send('O Google não devolveu autorização para cópias automáticas. Revogue o acesso anterior e tente novamente.');
    await saveRefreshToken(admin, tokens.refresh_token, config.stateSecret);
    return response.redirect(303, '/?drive=connected');
  } catch (error) {
    return response.status(error.status || 500).send(error.message || 'Não foi possível concluir a conexão.');
  }
}
