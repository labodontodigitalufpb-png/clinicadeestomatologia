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
- página inicial de apresentação com login e cadastro demonstrativo para alunos e professores;
- dashboard do aluno e visão geral do professor;
- alternância demonstrativa entre os perfis Aluno e Professor;
- lista de casos com busca e filtro por status;
- acesso individual: cada aluno visualiza apenas os pacientes cadastrados em sua conta;
- Guia Clínico individual com resumo, dados do caso e linha do tempo;
- cadastro de paciente com anamnese inicial;
- upload múltiplo de fotografias, exames e documentos durante o cadastro;
- galeria clínica ampliável e listagem de arquivos dentro do Guia Clínico;
- registro demonstrativo de nova evolução e anexos;
- estados vazios e módulos preparados para expansão;
- dados inteiramente fictícios.

## Limites deste MVP

Esta entrega é um protótipo funcional de frontend. Os dados ficam em memória e são reiniciados ao recarregar a página. Antes de uso clínico real, ainda será necessário implementar API, PostgreSQL, autenticação, autorização individual no backend/banco, auditoria persistente, armazenamento privado, backups e demais controles da LGPD.

## Direção de arquitetura

```text
Frontend React
      ↓
API autenticada e autorizada
      ↓
PostgreSQL + políticas de acesso
      ↓
Armazenamento privado de arquivos
```

A regra central a preservar na API e no banco é: cada aluno acessa exclusivamente os pacientes vinculados à sua própria conta; professores administradores possuem acesso global; toda alteração gera auditoria.
