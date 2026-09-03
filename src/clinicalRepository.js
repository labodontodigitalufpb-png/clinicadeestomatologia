import { supabase } from './supabase';

const BUCKET = 'clinical-files';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeFileName = value => String(value || 'arquivo')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120) || 'arquivo';

const withoutTransientFields = item => {
  if (!item) return item;
  const { file, url, dataUrl, ...stored } = item;
  return stored;
};

async function uploadBlob(caseId, folder, name, blob) {
  const path = `${caseId}/${folder}/${crypto.randomUUID()}-${safeFileName(name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'application/octet-stream',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(`Não foi possível enviar ${name}: ${error.message}`);
  return path;
}

async function persistAsset(caseId, asset, folder) {
  if (!asset) return asset;
  if (asset.storagePath) return withoutTransientFields(asset);
  if (!asset.file) throw new Error(`O arquivo ${asset.name || 'selecionado'} precisa ser escolhido novamente antes de salvar.`);
  const storagePath = await uploadBlob(caseId, folder, asset.name, asset.file);
  return { ...withoutTransientFields(asset), storagePath, mimeType: asset.file.type || asset.mimeType || 'application/octet-stream', sizeBytes: asset.file.size };
}

async function persistSignature(caseId, signature, label) {
  if (!signature) return null;
  if (signature.storagePath) return withoutTransientFields(signature);
  if (!signature.dataUrl?.startsWith('data:')) throw new Error(`A assinatura de ${signature.name || 'responsável'} precisa ser refeita antes de salvar.`);
  const blob = await fetch(signature.dataUrl).then(response => response.blob());
  const storagePath = await uploadBlob(caseId, 'signatures', `${label}.png`, blob);
  return { ...withoutTransientFields(signature), storagePath, mimeType: 'image/png' };
}

async function serializePatient(patient, caseId) {
  const registration = patient.signatures?.registration || {};
  const timeline = await Promise.all((patient.timeline || []).map(async item => {
    const evolutionId = UUID_PATTERN.test(String(item.id)) ? item.id : crypto.randomUUID();
    return {
      ...item,
      id: evolutionId,
      photos: await Promise.all((item.photos || []).map(asset => persistAsset(caseId, asset, `evolutions/${evolutionId}/photos`))),
      files: await Promise.all((item.files || []).map(asset => persistAsset(caseId, asset, `evolutions/${evolutionId}/files`))),
      authorSignature: await persistSignature(caseId, item.authorSignature, `evolution-${evolutionId}-author`),
      professorSignature: await persistSignature(caseId, item.professorSignature, `evolution-${evolutionId}-professor`),
    };
  }));
  const { id, semester, ficha, name, status, ...details } = patient;
  return {
    ...details,
    photos: await Promise.all((patient.photos || []).map(asset => persistAsset(caseId, asset, 'registration/photos'))),
    files: await Promise.all((patient.files || []).map(asset => persistAsset(caseId, asset, 'registration/files'))),
    timeline,
    signatures: {
      ...(patient.signatures || {}),
      registration: {
        patient: await persistSignature(caseId, registration.patient, 'registration-patient'),
        student: await persistSignature(caseId, registration.student, 'registration-student'),
        professor: await persistSignature(caseId, registration.professor, 'registration-professor'),
      },
    },
  };
}

function collectStoragePaths(patient) {
  const paths = [];
  const addAsset = item => { if (item?.storagePath) paths.push(item.storagePath); };
  (patient.photos || []).forEach(addAsset);
  (patient.files || []).forEach(addAsset);
  const registration = patient.signatures?.registration || {};
  [registration.patient, registration.student, registration.professor].forEach(addAsset);
  (patient.timeline || []).forEach(item => {
    (item.photos || []).forEach(addAsset);
    (item.files || []).forEach(addAsset);
    [item.authorSignature, item.professorSignature].forEach(addAsset);
  });
  return [...new Set(paths)];
}

async function hydratePatient(row) {
  const patient = {
    ...(row.payload || {}),
    id: row.id,
    ownerId: row.owner_id,
    semester: row.semester,
    ficha: row.record_number,
    name: row.patient_name,
    status: row.status,
    driveBackedUpAt: row.drive_backed_up_at,
  };
  const paths = collectStoragePaths(patient);
  if (!paths.length) return patient;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw new Error(`Não foi possível abrir os arquivos privados: ${error.message}`);
  const urls = new Map((data || []).filter(item => item.signedUrl).map(item => [item.path, item.signedUrl]));
  const hydrateAsset = item => item?.storagePath ? { ...item, url: urls.get(item.storagePath) || '' } : item;
  const hydrateSignature = item => item?.storagePath ? { ...item, dataUrl: urls.get(item.storagePath) || '' } : item;
  return {
    ...patient,
    photos: (patient.photos || []).map(hydrateAsset),
    files: (patient.files || []).map(hydrateAsset),
    timeline: (patient.timeline || []).map(item => ({
      ...item,
      photos: (item.photos || []).map(hydrateAsset),
      files: (item.files || []).map(hydrateAsset),
      authorSignature: hydrateSignature(item.authorSignature),
      professorSignature: hydrateSignature(item.professorSignature),
    })),
    signatures: {
      ...(patient.signatures || {}),
      registration: {
        patient: hydrateSignature(patient.signatures?.registration?.patient),
        student: hydrateSignature(patient.signatures?.registration?.student),
        professor: hydrateSignature(patient.signatures?.registration?.professor),
      },
    },
  };
}

export async function loadClinicalCases() {
  const { data, error } = await supabase.from('clinical_cases').select('id, owner_id, semester, record_number, patient_name, status, payload, drive_backed_up_at').order('updated_at', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar os casos: ${error.message}`);
  return Promise.all((data || []).map(hydratePatient));
}

export async function saveClinicalCase(patient) {
  let caseId = UUID_PATTERN.test(String(patient.id)) ? patient.id : null;
  if (!caseId) {
    const { data: sessionData } = await supabase.auth.getSession();
    const ownerId = sessionData.session?.user?.id;
    if (!ownerId) throw new Error('Sua sessão expirou. Entre novamente para salvar o paciente.');
    const { data, error } = await supabase.from('clinical_cases').insert({
      owner_id: ownerId,
      semester: patient.semester,
      record_number: patient.ficha,
      patient_name: patient.name,
      status: patient.status,
      payload: {},
    }).select('id').single();
    if (error) throw new Error(`Não foi possível criar o prontuário: ${error.message}`);
    caseId = data.id;
  }
  try {
    const payload = await serializePatient(patient, caseId);
    const { data, error } = await supabase.from('clinical_cases').update({
      semester: patient.semester,
      record_number: patient.ficha,
      patient_name: patient.name,
      status: patient.status,
      payload,
      updated_at: new Date().toISOString(),
    }).eq('id', caseId).select('id, owner_id, semester, record_number, patient_name, status, payload, drive_backed_up_at').single();
    if (error) throw new Error(`Não foi possível salvar o prontuário: ${error.message}`);
    return hydratePatient(data);
  } catch (error) {
    if (!UUID_PATTERN.test(String(patient.id))) await supabase.from('clinical_cases').delete().eq('id', caseId);
    throw error;
  }
}

export async function deleteClinicalCase(patient) {
  const paths = collectStoragePaths(patient);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) throw new Error(`Não foi possível remover os arquivos clínicos: ${storageError.message}`);
  }
  const { error } = await supabase.from('clinical_cases').delete().eq('id', patient.id);
  if (error) throw new Error(`Não foi possível remover o prontuário: ${error.message}`);
}

export async function backupClinicalCase(caseId) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sua sessão expirou antes da cópia no Google Drive.');
  const response = await fetch('/api/google/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ caseId }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'O prontuário foi salvo, mas a cópia no Google Drive falhou.');
  return result;
}
