import { createClient } from '@supabase/supabase-js';
import { exchangeRefreshToken, googleConfig, missingConfig, sendJson } from './_shared.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://lrporteiwhokhdzxcakl.supabase.co';
const secretKey = process.env.SUPABASE_SECRET_KEY;

async function requireAdmin(request) {
  if (!secretKey) throw Object.assign(new Error('Configuração administrativa indisponível.'), { status: 503 });
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Sessão não informada.'), { status: 401 });
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Sessão inválida.'), { status: 401 });
  const { data: profile } = await admin.from('profiles').select('role').eq('id', data.user.id).single();
  if (profile?.role !== 'admin') throw Object.assign(new Error('Acesso restrito aos professores administradores.'), { status: 403 });
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Método não permitido.' });
  try {
    await requireAdmin(request);
    const config = googleConfig();
    const baseMissing = missingConfig(config, ['clientId', 'clientSecret', 'stateSecret']);
    if (baseMissing.length) return sendJson(response, 200, { status: 'configuration_required' });
    if (!config.refreshToken) return sendJson(response, 200, { status: 'authorization_required' });
    const accessToken = await exchangeRefreshToken(config);
    const googleResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await googleResponse.json();
    if (!googleResponse.ok) throw new Error(data.error?.message || 'A conta não respondeu.');
    return sendJson(response, 200, { status: 'connected', account: data.user });
  } catch (error) {
    if (error.status) return sendJson(response, error.status, { status: 'unavailable', error: error.message });
    return sendJson(response, 200, { status: 'invalid_token', error: error.message });
  }
}
