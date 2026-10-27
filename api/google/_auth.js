import { createClient } from '@supabase/supabase-js';

export function serverClient() {
  if (!process.env.SUPABASE_SECRET_KEY) throw Object.assign(new Error('SUPABASE_SECRET_KEY não configurada na Vercel.'), { status: 503 });
  return createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://lrporteiwhokhdzxcakl.supabase.co', process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdminRole(admin, userId) {
  const { data, error } = await admin.from('profiles').select('role').eq('id', userId).single();
  if (error || data?.role !== 'admin') throw Object.assign(new Error('Acesso restrito aos professores administradores.'), { status: 403 });
}

export async function authenticatedContext(request, adminOnly = false) {
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error('Sessão não informada.'), { status: 401 });
  const admin = serverClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Sessão inválida ou expirada.'), { status: 401 });
  if (adminOnly) await requireAdminRole(admin, data.user.id);
  return { admin, user: data.user };
}
