**GED Engenharia — Documento Mestre (arquitetura.md)**

Objetivo
---------
Este documento é o "cérebro" do projeto GED Engenharia. Reúne decisões arquiteturais, convenções, modelo de dados inicial e passos de infraestrutura para que todas as tarefas subsequentes sejam tomadas de forma consistente.

Visão Geral do Produto
-----------------------
- Problema: Sistemas genéricos de GED não atendem requisitos críticos da engenharia (versionamento rigoroso, visualização de DWG/PDFs, workflows de aprovação, metadados técnicos).
- Solução: Plataforma SaaS otimizada para arquivos técnicos, com controle de revisões, visualizadores embutidos, extração automática de metadados e APIs rápidas.

Requisitos Não-Funcionais (Principais)
-------------------------------------
- Performance e baixa latência para listagem/preview.
- Segurança: controle de acesso por roles, trilhas de auditoria imutáveis.
- Escalabilidade horizontal (microserviços para processamento pesado).
- Observabilidade: logs estruturados e métricas básicas desde o MVP.

Stack Tecnológica (decisão inicial)
----------------------------------
- Backend API: Node.js + TypeScript + Express
- ORM: Prisma (PostgreSQL / Neon DB)
- Uploads/armazenamento: Multiplos runners — inicialmente disk (local) para desenvolvimento; S3/compatible para produção.
- Processamento/IA: Microsserviços em Python (OCR, extração, RPA)
- Frontend: React + Vite + TypeScript + Tailwind CSS v4
- Infra e deploy: Docker + CI (GitHub Actions) e Neon DB (Postgres gerenciado)

Modelo de Dados Inicial (MVP)
------------------------------
Entidades essenciais e atributos resumidos:

- `User` — id, nome, email, senha_hash, role (ENGENHEIRO|COORDENADOR|ADMIN), createdAt, updatedAt
- `Project` (Obra) — id, codigo, nome, descricao, cliente, createdAt, updatedAt
- `Document` — id, projectId, codigo_documento, titulo, disciplina, metadata(json), createdBy, createdAt
- `Revision` — id, documentId, versionLabel (A, B, C...), filePath, fileHash, status (EM_ELABORACAO|EM_REVISAO|APROVADO|OBSOLETO), approvedBy, approvedAt, createdAt
- `AuditTrail` — id, entityType, entityId, action, performedBy, performedAt, details(json)

Observações de modelagem
------------------------
- `Document` agrupa semanticamente as revisões; a versão física fica no `Revision`.
- Arquivos grandes (DWG, PDFs multi-pranchas) devem armazenar metadados e um link (S3/local) e disponibilizar visualizadores via serviço de preview.

Padrões e Convenções (rápidas)
------------------------------
- Branching: `main` (produção), `develop` (integração), feature branches `feat/<descrição>`.
- Commits: Conventional Commits (tipo:escopo:descrição).
- Código TypeScript: `strict: true` no `tsconfig.json`.
- Nomes: snake_case para DB, camelCase para código JS/TS.

Infraestrutura Inicial — Passo a Passo (MVP Back-end)
-----------------------------------------------------
Execute os comandos abaixo no terminal (Powershell) a partir da raiz do projeto. Eles criam o projeto Node.js, adicionam dependências e inicializam o Prisma.

```powershell
cd d:\xampp\htdocs\ged-engenharia
git init
npm init -y
# Dependências de runtime
npm install express multer dotenv @prisma/client
# Dependências de desenvolvimento
npm install -D typescript ts-node-dev prisma @types/node @types/express @types/multer
# Inicializar TypeScript e Prisma
npx tsc --init
npx prisma init
```

Notas importantes após `npx prisma init`:
- Atualize a variável `DATABASE_URL` em `.env` com a string de conexão do Neon DB.
- Defina o `schema.prisma` inicial usando o modelo de dados acima e rode `npx prisma migrate dev --name init` quando tiver o banco disponível.

Estrutura de pastas sugerida (MVP)
---------------------------------
- `/src` — código TypeScript do backend (rotas, controllers, services, middlewares)
- `/src/modules` — módulos por domínio (users, projects, documents)
- `/prisma` — `schema.prisma` e migrações
- `/scripts` — helpers e scripts de infra/local
- `/docs` — documentação viva (incluindo este `arquitetura.md`)

Próximos passos imediatos
-------------------------
1. Confirmar string de conexão do PostgreSQL (Neon) e configurar `.env`.
2. Definir o `schema.prisma` mínimo e executar `npx prisma migrate dev --name init`.
3. Implementar rota de health-check e um endpoint básico `GET /projects` com PRISMA mocked.

Regras de ouro para interação com a IA
-------------------------------------
1. Sempre fornecer somente os arquivos relevantes ao pedir uma implementação (ex.: rota + modelo DB).
2. Trabalhar em ciclos curtos: implementar → testar → commitar → avançar.
3. Documentar decisões importantes neste arquivo antes de mudar o design do DB.

Referências rápidas
-------------------
- Este arquivo: [arquitetura.md](arquitetura.md#L1)

---
Versão do documento: 2026-06-09 — autor: time de arquitetura