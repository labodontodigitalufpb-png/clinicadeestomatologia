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

O painel administrativo possui uma tela para autorizar uma conta do Google Drive por OAuth 2.0. Configure na Vercel as variáveis documentadas em `.env.example`. O token permanente é obtido pela rota `/api/google/connect` e deve ser armazenado apenas como variável privada `GOOGLE_REFRESH_TOKEN`.

Depois de cada salvamento, a rota autenticada `/api/google/backup` cria ou atualiza a pasta `Clínica de Estomatologia UFPB/Semestre .../Ficha - Paciente`, grava um instantâneo `guia-clinico.json` e copia documentos e assinaturas. O escopo OAuth permanece limitado aos arquivos criados pelo aplicativo (`drive.file`). Opcionalmente, `GOOGLE_DRIVE_ROOT_FOLDER_ID` direciona as cópias para uma pasta específica do Meu Drive.

## Autenticação persistente

O frontend usa Supabase Auth quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` estão configuradas. Execute `supabase/setup.sql` uma vez no SQL Editor antes de habilitar essas variáveis na Vercel. O script cria perfis protegidos por RLS e força todo autocadastro a entrar como aluno; professores devem ser promovidos administrativamente.

O cadastro administrativo de professores usa a função `/api/admin/users` e exige `SUPABASE_SECRET_KEY` apenas na Vercel. Essa chave nunca deve receber prefixo `VITE_` nem ser adicionada ao repositório.

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
