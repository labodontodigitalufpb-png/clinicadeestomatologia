import { createClient } from '@supabase/supabase-js';
import { ensureDriveFolder, exchangeRefreshToken, googleConfig, missingConfig, sendJson, uploadDriveFile } from './_shared.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://lrporteiwhokhdzxcakl.supabase.co';
const secretKey = process.env.SUPABASE_SECRET_KEY;
const BUCKET = 'clinical-files';

const safeFolderName = value => String(value || 'Sem nome').replace(/[\\/]/g, '-').trim().slice(0, 160);

function collectStoredFiles(payload) {
  const files = [];
  const add = (item, category) => {
    if (!item?.storagePath) return;
    files.push({
      storagePath: item.storagePath,
      name: `${category}-${item.storagePath.split('/').pop()}`,
      mimeType: item.mimeType || 'application/octet-stream',
    });
  };
  (payload.photos || []).forEach(item => add(item, 'foto-inicial'));
  (payload.files || []).forEach(item => add(item, 'arquivo-inicial'));
  const registration = payload.signatures?.registration || {};
  add(registration.patient, 'assinatura-paciente');
  add(registration.student, 'assinatura-aluno');
  add(registration.professor, 'assinatura-professor');
  (payload.timeline || []).forEach((evolution, index) => {
    const prefix = `evolucao-${index + 1}`;
    (evolution.photos || []).forEach(item => add(item, `${prefix}-foto`));
    (evolution.files || []).forEach(item => add(item, `${prefix}-arquivo`));
    add(evolution.authorSignature, `${prefix}-assinatura-responsavel`);
    add(evolution.professorSignature, `${prefix}-assinatura-professor`);
  });
  return [...new Map(files.map(item => [item.storagePath, item])).values()];
}

async function authenticatedContext(request) {
  if (!secretKey) throw Object.assign(new Error('SUPABASE_SECRET_KEY não configurada na Vercel.'), { status: 503 });
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Sessão não informada.'), { status: 401 });
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Sessão inválida ou expirada.'), { status: 401 });
  return { admin, user: data.user };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Método não permitido.' });
  try {
    const caseId = request.body?.caseId;
    if (!caseId) return sendJson(response, 400, { error: 'Prontuário não informado.' });
    const config = googleConfig();
    const missing = missingConfig(config, ['clientId', 'clientSecret', 'refreshToken']);
    if (missing.length) return sendJson(response, 503, { error: 'Google Drive ainda não está completamente configurado.' });
    const { admin, user } = await authenticatedContext(request);
    const [{ data: clinicalCase, error: caseError }, { data: profile }] = await Promise.all([
      admin.from('clinical_cases').select('id, owner_id, semester, record_number, patient_name, status, payload, created_at, updated_at').eq('id', caseId).single(),
      admin.from('profiles').select('role').eq('id', user.id).single(),
    ]);
    if (caseError || !clinicalCase) throw Object.assign(new Error('Prontuário não encontrado.'), { status: 404 });
    if (clinicalCase.owner_id !== user.id && profile?.role !== 'admin') throw Object.assign(new Error('Você não tem permissão para copiar este prontuário.'), { status: 403 });

    const accessToken = await exchangeRefreshToken(config);
    const rootFolder = config.rootFolderId ? { id: config.rootFolderId } : await ensureDriveFolder(accessToken, 'Clínica de Estomatologia UFPB');
    const semesterFolder = await ensureDriveFolder(accessToken, safeFolderName(`Semestre ${clinicalCase.semester}`), rootFolder.id);
    const patientFolder = await ensureDriveFolder(accessToken, safeFolderName(`${clinicalCase.record_number} - ${clinicalCase.patient_name}`), semesterFolder.id);
    const filesFolder = await ensureDriveFolder(accessToken, 'Documentos e assinaturas', patientFolder.id);

    const snapshot = {
      schemaVersion: 1,
      backedUpAt: new Date().toISOString(),
      case: {
        id: clinicalCase.id,
        ownerId: clinicalCase.owner_id,
        semester: clinicalCase.semester,
        recordNumber: clinicalCase.record_number,
        patientName: clinicalCase.patient_name,
        status: clinicalCase.status,
        createdAt: clinicalCase.created_at,
        updatedAt: clinicalCase.updated_at,
        ...clinicalCase.payload,
      },
    };
    const snapshotFile = await uploadDriveFile(accessToken, {
      name: 'guia-clinico.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot, null, 2)),
      parentId: patientFolder.id,
    });

    const storedFiles = collectStoredFiles(clinicalCase.payload || {});
    for (const item of storedFiles) {
      const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(item.storagePath);
      if (downloadError) throw new Error(`Falha ao preparar ${item.name} para o Drive.`);
      await uploadDriveFile(accessToken, { name: safeFolderName(item.name), mimeType: item.mimeType, buffer: Buffer.from(await blob.arrayBuffer()), parentId: filesFolder.id });
    }

    const backedUpAt = new Date().toISOString();
    const { error: updateError } = await admin.from('clinical_cases').update({ drive_file_id: snapshotFile.id, drive_backed_up_at: backedUpAt }).eq('id', clinicalCase.id);
    if (updateError) throw new Error('A cópia foi criada, mas não foi possível registrar o status no Supabase.');
    return sendJson(response, 200, { status: 'backed_up', backedUpAt, filesCopied: storedFiles.length + 1, folderId: patientFolder.id });
  } catch (error) {
    return sendJson(response, error.status || 500, { error: error.message || 'Não foi possível copiar o prontuário para o Google Drive.' });
  }
}
