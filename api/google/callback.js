import { googleConfig, missingConfig, verifyState } from './_shared.js';

const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

export default async function handler(request, response) {
  const config = googleConfig();
  const missing = missingConfig(config, ['clientId', 'clientSecret', 'stateSecret']);
  if (missing.length) return response.status(503).send('Integração incompleta na Vercel.');
  if (!verifyState(request.query.state, config.stateSecret)) return response.status(400).send('Autorização inválida ou expirada. Inicie novamente pelo aplicativo.');
  if (request.query.error) return response.status(400).send(`Autorização recusada: ${escapeHtml(request.query.error)}`);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: request.query.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok) return response.status(400).send(`Falha ao concluir a autorização: ${escapeHtml(tokens.error_description || tokens.error)}`);
  if (!tokens.refresh_token) return response.status(400).send('O Google não devolveu um token permanente. Revogue o acesso anterior e tente conectar novamente.');

  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.status(200).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Google Drive conectado</title><style>body{margin:0;background:#edf3f0;color:#193c36;font:16px system-ui;display:grid;place-items:center;min-height:100vh}.card{width:min(620px,calc(100% - 32px));box-sizing:border-box;background:#fff;border:1px solid #d9e5e1;border-radius:18px;padding:32px;box-shadow:0 20px 60px #173f3820}h1{margin:0 0 10px}p{color:#61736e;line-height:1.6}code{display:block;overflow-wrap:anywhere;background:#f1f5f3;border:1px solid #dce6e2;border-radius:9px;padding:15px;color:#244f47}button,a{display:inline-flex;margin-top:15px;border:0;border-radius:9px;padding:12px 16px;background:#174a44;color:#fff;text-decoration:none;cursor:pointer}.warning{color:#8b503f;font-size:13px}</style></head><body><main class="card"><h1>Autorização concluída</h1><p>Copie o código abaixo e cadastre-o na Vercel como <strong>GOOGLE_REFRESH_TOKEN</strong>.</p><code id="token">${escapeHtml(tokens.refresh_token)}</code><button onclick="navigator.clipboard.writeText(document.getElementById('token').textContent);this.textContent='Copiado'">Copiar código</button><p class="warning">Este código dá acesso aos arquivos criados pelo aplicativo. Não envie por mensagem, não salve no GitHub e feche esta página depois de cadastrá-lo na Vercel.</p><a href="/">Voltar ao aplicativo</a></main></body></html>`);
}
