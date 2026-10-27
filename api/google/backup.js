import crypto from 'node:crypto';
import { authenticatedContext } from './_auth.js';
import { ensureCaseFolder, ensureDriveFolder, exchangeRefreshToken, loadGoogleConfig, missingConfig, sendJson, uploadDriveFile, validateRootFolder } from './_shared.js';

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

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Método não permitido.' });
  try {
    const caseId = request.body?.caseId;
    if (!caseId) return sendJson(response, 400, { error: 'Prontuário não informado.' });
    const { admin, user } = await authenticatedContext(request);
    const config = await loadGoogleConfig(admin);
    const missing = missingConfig(config, ['clientId', 'clientSecret', 'refreshToken']);
    if (missing.length) return sendJson(response, 503, { error: 'Google Drive ainda não está completamente configurado.' });
    const [{ data: clinicalCase, error: caseError }, { data: profile }] = await Promise.all([
      admin.from('clinical_cases').select('id, owner_id, semester, record_number, patient_name, status, payload, created_at, updated_at, drive_file_id').eq('id', caseId).single(),
      admin.from('profiles').select('role').eq('id', user.id).single(),
    ]);
    if (caseError || !clinicalCase) throw Object.assign(new Error('Prontuário não encontrado.'), { status: 404 });
    if (clinicalCase.owner_id !== user.id && profile?.role !== 'admin') throw Object.assign(new Error('Você não tem permissão para copiar este prontuário.'), { status: 403 });

    const accessToken = await exchangeRefreshToken(config);
    await validateRootFolder(accessToken, config.rootFolderId);
    const rootFolder = config.rootFolderId ? { id: config.rootFolderId } : await ensureDriveFolder(accessToken, 'Clínica de Estomatologia UFPB');
    const semesterFolder = await ensureDriveFolder(accessToken, safeFolderName(`Semestre ${clinicalCase.semester}`), rootFolder.id);
    const patientFolder = await ensureCaseFolder(accessToken, clinicalCase, semesterFolder.id);
    const filesFolder = await ensureDriveFolder(accessToken, 'Documentos e assinaturas', patientFolder.id);

    const snapshot = {
      schemaVersion: 2,
      backedUpAt: new Date().toISOString(),
      case: {
        ...clinicalCase.payload,
        id: clinicalCase.id,
        ownerId: clinicalCase.owner_id,
        semester: clinicalCase.semester,
        recordNumber: clinicalCase.record_number,
        patientName: clinicalCase.patient_name,
        status: clinicalCase.status,
        createdAt: clinicalCase.created_at,
        updatedAt: clinicalCase.updated_at,
      },
    };
    const storedFiles = collectStoredFiles(clinicalCase.payload || {});
    const manifest = [];
    for (const item of storedFiles) {
      if (typeof item.storagePath !== 'string' || !item.storagePath.startsWith(`${clinicalCase.id}/`) || item.storagePath.split('/').some(part => !/^[a-zA-Z0-9._-]+$/.test(part) || part === '..' || part === '.')) throw Object.assign(new Error('Arquivo fora do prontuário solicitado.'), { status: 403 });
      const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(item.storagePath);
      if (downloadError) throw new Error(`Falha ao preparar ${item.name} para o Drive.`);
      const name = `${crypto.createHash('sha256').update(item.storagePath).digest('hex')}-${item.storagePath.split('/').pop()}`;
      const file = await uploadDriveFile(accessToken, { name, mimeType: item.mimeType, buffer: Buffer.from(await blob.arrayBuffer()), parentId: filesFolder.id });
      manifest.push({ storagePath: item.storagePath, driveFileId: file.id, name });
    }

    snapshot.files = manifest;
    const snapshotFile = await uploadDriveFile(accessToken, {
      name: 'guia-clinico.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot, null, 2)),
      parentId: patientFolder.id,
    });

    const backedUpAt = new Date().toISOString();
    const { error: updateError } = await admin.from('clinical_cases').update({ drive_file_id: snapshotFile.id, drive_backed_up_at: backedUpAt }).eq('id', clinicalCase.id);
    if (updateError) throw new Error('A cópia foi criada, mas não foi possível registrar o status no Supabase.');
    return sendJson(response, 200, { status: 'backed_up', backedUpAt, filesCopied: storedFiles.length + 1, folderId: patientFolder.id });
  } catch (error) {
    return sendJson(response, error.status || 500, { error: error.message || 'Não foi possível copiar o prontuário para o Google Drive.' });
  }
}
