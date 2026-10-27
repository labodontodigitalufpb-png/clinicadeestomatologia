import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://lrporteiwhokhdzxcakl.supabase.co';
const secretKey = process.env.SUPABASE_SECRET_KEY;

const json = (response, status, body) => response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(body));

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Método não permitido.' });
  if (!secretKey) return json(response, 503, { error: 'SUPABASE_SECRET_KEY não configurada na Vercel.' });

  const { name, registration, email, password } = request.body || {};
  const normalizedName = String(name || '').trim();
  const normalizedRegistration = String(registration || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (normalizedName.length < 2 || normalizedName.length > 160 || normalizedRegistration.length < 2 || normalizedRegistration.length > 40) {
    return json(response, 400, { error: 'Informe nome completo e matrícula válidos.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return json(response, 400, { error: 'Informe um e-mail válido.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return json(response, 400, { error: 'A senha deve ter pelo menos oito caracteres.' });
  }

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: normalizedName, registration: normalizedRegistration },
  });

  if (error) {
    const duplicate = /already|registered|exists/i.test(error.message);
    return json(response, 400, { error: duplicate ? 'Já existe uma conta cadastrada com este e-mail.' : error.message });
  }

  return json(response, 201, { success: true });
}
