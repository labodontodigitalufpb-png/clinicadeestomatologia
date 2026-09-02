import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://lrporteiwhokhdzxcakl.supabase.co';
const secretKey = process.env.SUPABASE_SECRET_KEY;

const json = (response, status, body) => response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(body));

async function requireAdmin(request) {
  if (!secretKey) throw Object.assign(new Error('SUPABASE_SECRET_KEY não configurada na Vercel.'), { status: 503 });
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Sessão não informada.'), { status: 401 });
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Sessão inválida ou expirada.'), { status: 401 });
  const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', data.user.id).single();
  if (profileError || profile?.role !== 'admin') throw Object.assign(new Error('Apenas administradores podem gerenciar usuários.'), { status: 403 });
  return admin;
}

export default async function handler(request, response) {
  try {
    const admin = await requireAdmin(request);
    if (request.method === 'GET') {
      const { data, error } = await admin.from('profiles').select('id, full_name, email, registration, role, created_at').order('full_name');
      if (error) throw error;
      return json(response, 200, { users: data });
    }
    if (request.method === 'POST') {
      const { fullName, email, registration, password } = request.body || {};
      if (!fullName?.trim() || !email?.trim() || !registration?.trim() || !password || password.length < 8) {
        return json(response, 400, { error: 'Preencha nome, e-mail, SIAPE e uma senha temporária de pelo menos oito caracteres.' });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim(), registration: registration.trim() },
      });
      if (error) return json(response, 400, { error: error.message });
      const { data: profile, error: profileError } = await admin.from('profiles').update({ role: 'admin', email: normalizedEmail, updated_at: new Date().toISOString() }).eq('id', data.user.id).select('id, full_name, email, registration, role, created_at').single();
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id);
        throw profileError;
      }
      return json(response, 201, { user: profile });
    }
    return json(response, 405, { error: 'Método não permitido.' });
  } catch (error) {
    return json(response, error.status || 500, { error: error.message || 'Erro interno.' });
  }
}
