# Clínica de Estomatologia – UFPB

MVP responsivo do sistema de gerenciamento clínico e acadêmico da Clínica de Estomatologia da UFPB.

## Executar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

Para validar a versão de produção:

```bash
npm run build
npm run preview
```

## O que está implementado

- interface responsiva para computador, tablet e celular;
- página inicial de apresentação com autenticação persistente para alunos e professores;
- dashboard do aluno e visão geral do professor;
- alternância demonstrativa entre os perfis Aluno e Professor;
- lista de casos com busca e filtro por status;
- acesso individual: cada aluno visualiza apenas os pacientes cadastrados em sua conta;
- Guia Clínico individual com resumo, dados do caso e linha do tempo;
- cadastro de paciente com anamnese inicial;
- upload múltiplo e privado de fotografias, exames, documentos e assinaturas;
- galeria clínica ampliável e listagem de arquivos dentro do Guia Clínico;
- registro persistente de evoluções, consentimento e assinaturas;
- histórico de revisões de cada prontuário;
- cópia automática dos prontuários e arquivos no Google Drive conectado;
- estados vazios e módulos preparados para expansão;
- separação dos casos por semestre acadêmico.

## Ativação do banco e armazenamento

Execute `supabase/setup.sql` no SQL Editor do projeto correto. O script é idempotente e cria perfis, prontuários, histórico de revisões, políticas RLS e o bucket privado `clinical-files`. Cada aluno acessa apenas os próprios casos; professores administradores possuem acesso global. As imagens e os documentos são entregues ao navegador por URLs assinadas com duração limitada.

Antes de uso assistencial real, a instituição ainda deve validar o termo de consentimento, a política de retenção, os perfis de acesso, o plano de incidentes e os demais controles aplicáveis à LGPD.

## Integração com Google Drive

O painel administrativo autoriza uma conta do Google Drive por OAuth 2.0. Configure na Vercel `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_STATE_SECRET`, `GOOGLE_REDIRECT_URI` e `SUPABASE_SECRET_KEY` conforme `.env.example`. Habilite a Drive API no Google Cloud e cadastre exatamente a mesma URI de retorno no cliente OAuth. Depois do deploy, entre como professor administrador, abra **Google Drive** e clique em **Conectar Google Drive**. Ao concluir o consentimento, o aplicativo salva a autorização e retorna ao painel, sem copiar tokens ou fazer outro deploy.

A rota `POST /api/google/connect` exige sessão administrativa. O retorno OAuth confere o `state` assinado, sua validade de dez minutos e um cookie `HttpOnly`, `Secure`, `SameSite=Lax` do navegador que iniciou a conexão. O perfil administrativo é consultado novamente antes de persistir a autorização. Use o mesmo domínio HTTPS no aplicativo e na URI de retorno; o cookie seguro não é destinado ao servidor HTTP local do Vite.

O refresh token é criptografado com AES-256-GCM e armazenado em `clinical-files/integrations/google-drive.enc` pelo backend. As políticas de `supabase/setup.sql` impedem acesso de usuários autenticados a esse prefixo, pois ele não corresponde a um UUID de prontuário. O bucket deve permanecer privado. Mantenha `GOOGLE_STATE_SECRET` longo, aleatório e estável: sua troca exige reconectar a conta. O token nunca é devolvido ao navegador. `GOOGLE_REFRESH_TOKEN` continua aceito para instalações antigas quando ainda não há autorização armazenada; após reconectar pelo painel, a autorização armazenada passa a ter prioridade.

Depois de cada salvamento, a rota autenticada `/api/google/backup` cria ou atualiza a pasta `Clínica de Estomatologia UFPB/Semestre .../Ficha ... - Paciente`. A pasta recebe o ID imutável do prontuário nos metadados do Drive e é renomeada ou movida quando o cadastro muda. Cópias antigas são reaproveitadas quando o JSON indicado por `drive_file_id` confirma o mesmo ID de prontuário. Anexos recebem nomes estáveis derivados de seu caminho e são enviados antes de publicar `guia-clinico.json`. O JSON inclui o mapeamento entre os caminhos do Supabase e os arquivos do Drive. O status de sucesso só é registrado após concluir todos os envios. Uma falha preserva o salvamento principal e permite tentar novamente pelo botão **Copiar no Drive**. Não há fila de repetição automática nem remoção automática de cópias antigas.

O escopo OAuth permanece limitado a `drive.file`. Sem `GOOGLE_DRIVE_ROOT_FOLDER_ID`, o aplicativo cria a própria pasta raiz. Se usar essa variável, a pasta precisa estar previamente acessível ao aplicativo e permitir criação de arquivos; informar o ID de uma pasta arbitrária do Meu Drive não concede acesso. O painel verifica a pasta e explica a falha. Para usar uma pasta criada automaticamente pelo aplicativo, remova essa variável e faça novo deploy.

Validação local, com Google e Supabase simulados:

```bash
node --test tests/google-drive.test.js
npm run build
```

## Autenticação persistente

O frontend usa Supabase Auth quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` estão configuradas. Execute `supabase/setup.sql` uma vez no SQL Editor antes de habilitar essas variáveis na Vercel. O script cria perfis protegidos por RLS e força todo autocadastro a entrar como aluno; professores devem ser promovidos administrativamente.

Os cadastros de alunos são confirmados automaticamente pela função `/api/auth/register`, permitindo o acesso imediato sem confirmação por e-mail. O cadastro administrativo de professores usa a função `/api/admin/users`. Ambas exigem `SUPABASE_SECRET_KEY` apenas na Vercel. Essa chave nunca deve receber prefixo `VITE_` nem ser adicionada ao repositório.

## Direção de arquitetura

```text
Frontend React
      ↓
API autenticada e autorizada
      ↓
Supabase PostgreSQL + RLS + auditoria
      ↓
Supabase Storage privado
      ↓
Cópia autenticada no Google Drive
```

A regra central a preservar na API e no banco é: cada aluno acessa exclusivamente os pacientes vinculados à sua própria conta; professores administradores possuem acesso global; toda alteração gera auditoria.
