# GED Engenharia — Regras Permanentes de Engenharia (AGENTS.md)

> **Documento vivo.** Atualizado a cada decisão arquitetural (ADR) e sprint review.
> **Versão:** 1.0 — Baseado em Auditoria FASE 00 (2026-09-24)

---

## 1. Objetivo do Produto

**GED Engenharia** é um SaaS B2B (EDMS/CDE) para gestão de documentos técnicos de engenharia multidisciplinar.

**Proposta de valor:**
- Workflow de aprovação rigoroso (3 estágios: Verificação → Coordenação → Cliente)
- Isolamento multi-tenant garantido (dados de contratos nunca vazam)
- Armazenamento escalável nuvem (S3 + presigned URLs)
- Busca full-text nativa (PyMuPDF OCR assíncrono)
- Auditoria imutável (Data Room pronta para compliance)
- Integração aberta (Webhooks, API versionada, OpenAPI)

**Público-alvo:** Empresas de engenharia (Processos, Mecânica, Piping, Elétrica, Instrumentação, Civil, Estruturas, Geo, Topografia, HSE, Meio Ambiente, BIM/CAD, Planejamento, Suprimentos, QA/QC, Comissionamento, Document Control)

---

## 2. Arquitetura Atual (Estado Pós-Auditoria FASE 00)

### 2.1 Stack
| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js 20+ / Express 5.x |
| Linguagem | TypeScript 6.0.3 (strict) |
| ORM | Prisma 7.8.0 (PostgreSQL Neon) |
| Auth | JWT HS256 (1 dia) + bcrypt |
| Storage | AWS S3 (presigned PUT URLs) |
| Queue | AWS SQS (long polling 20s) |
| Worker | Python 3.11+ / PyMuPDF (fitz) |
| Frontend | React 18 + Vite + Tailwind v4 |

### 2.2 Estrutura (Monorepo)
```
ged-engenharia/
├── src/                    # Backend Express
│   ├── lib/tenantContext.ts    # AsyncLocalStorage multi-tenant
│   ├── middlewares/            # auth.middleware.ts (JWT + tenant extraction)
│   ├── modules/                # DDD modules (auth, documents, approvals, transmittals, ...)
│   ├── services/               # s3.service.ts, sqs.service.ts
│   ├── prisma.ts               # PrismaClient + tenant extension
│   └── server.ts
├── prisma/schema.prisma    # 17 models, 384 linhas
├── ged-frontend/           # React + Vite
├── ged-worker-python/      # Worker OCR/GRD
└── .env                    # **COMMITTADO — RISCO CRÍTICO**
```

### 2.3 Modelo de Dados (Resumo)
**Tenant Root:** `Contract` — unidade de isolamento
```
Client 1──N Project 1──N Contract 1──N ContractDiscipline
                              ├── N Document 1──N Revision 1──N ApprovalWorkflow
                              │                    └── N TransmittalItem
                              ├── N Transmittal 1──N TransmittalItem
                              ├── N WorkPackage
                              ├── N ContractMembership
                              └── N AuditLog
```

### 2.4 Isolamento Multi-Tenant Atual
- **Prisma Extension** (`src/prisma.ts`) usa `AsyncLocalStorage` para injetar `contractId` automaticamente em queries
- Modelos com filtro automático: `ContractDiscipline`, `ContractMembership`, `Document`, `Transmittal`, `WorkPackage`, `AuditLog`
- **Gap crítico:** `contractId` vem do request (query/params/body), não do JWT — sujeito a manipulação
- **Gap crítico:** `findUnique` com `include` traversa relações sem filtro de tenant

### 2.5 Autenticação/Autorização Atual
- JWT payload: `{ userId, globalRole: SYSADMIN|USER }`
- `ContractRole`: `GESTOR`, `COORDENADOR`, `ENGENHEIRO`, `PLANEJADOR`, `LEITOR`
- `User.isClient = true` → Portal do Cliente (só vê stage `CLIENTE`, carimbos internos filtrados)
- RBAC implementado por middleware + validação manual de `ContractMembership` em services (duplicado em 8+ locais)

---

## 3. Arquitetura Alvo (Target State)

### 3.1 Princípios
| Princípio | Descrição |
|-----------|-----------|
| **Security First** | Zero-trust, secrets management, RLS no DB, audit trail imutável |
| **Tenant Isolation Garantido** | PostgreSQL RLS + JWT claims — impossível vazar dados entre contratos |
| **Event-Driven Core** | Domain events (DocumentCreated, RevisionApproved, GRDEmitted, OCRCompleted) |
| **Observability by Default** | OpenTelemetry, structured logs, metrics, alerting desde dia 1 |
| **Deploy Automation** | GitOps / CI/CD — main → staging → prod com gates |
| **Stateless Services** | API horizontalmente escalável, sessão em JWT, cache em Redis |
| **Contract-First APIs** | OpenAPI 3.1 spec → codegen (TypeScript/Zod) |

### 3.2 Topologia de Deploy Alvo
- **ged-api** (ECS Fargate, 3+ tasks) — Backend Express
- **ged-worker-ocr** (ECS Fargate, SQS trigger) — PyMuPDF OCR
- **ged-worker-transmittal** (ECS Fargate, SQS trigger) — GRD ZIP/Capa
- **ged-worker-webhook** (ECS Fargate, EventBridge) — Webhook delivery + retry
- **ged-scheduler** (EventBridge + Lambda) — Cron jobs
- **ged-frontend** (CloudFront + S3 static) — React
- **ged-infra** (Terraform/CDK) — Infra as code
- **ged-shared** (npm package) — Types, Zod schemas, OpenAPI client

### 3.3 Segurança Alvo
- **Auth:** RS256 JWT (15min access) + Refresh Token Rotation (30d, HttpOnly cookie, revocável)
- **Tenant:** `contractId` como claim no JWT + validado via RLS no PostgreSQL
- **Secrets:** AWS Secrets Manager (zero secrets em `.env`, código, CI logs)
- **API:** Helmet + CSP + HSTS, Rate limiting, CORS restritivo, Idempotency Keys
- **Worker:** Containerizado, Health checks, HMAC-SHA256 webhook, DLQ obrigatória

### 3.4 Data Layer Alvo
- **PostgreSQL RLS** em todas tabelas tenant-scoped (`ContractDiscipline`, `Document`, `Transmittal`, `WorkPackage`, `AuditLog`, etc.)
- **Soft Delete** em todas entities (`deletedAt` + partial unique indexes)
- **AuditLog particionado** por mês
- **Índices críticos** para performance (ver `target-state.md:164-198`)

---

## 4. Regras de Multi-Tenancy

1. **Contrato = Tenant.** Todo dado operacional pertence a um `Contract`.
2. **Nunca confiar em `organizationId`/`tenantId`/`contractId` enviado pelo cliente.** O `contractId` deve vir do JWT claim ou ser validado server-side via membership ANTES de qualquer query.
3. **Toda operação de dados deve respeitar o tenant atual.** Queries sem `contractId` no filtro são proibidas em modelos tenant-scoped.
4. **RLS no banco é a defesa final.** Mesmo se o código falhar, o PostgreSQL bloqueia acesso cross-tenant.
5. **Entidades globais (`Client`, `Project`, `User`, `Contract`)** não têm RLS, mas nunca são expostas em listagens sem validação de membership.
6. **Entidades filhas (`Revision`, `ApprovalWorkflow`, `TransmittalItem`, `TimeLog`, `DocumentLink`)** herdam isolamento via relação com o pai — services devem validar ambos os lados no mesmo contrato.
7. **Toda nova entidade precisa de estratégia explícita de tenant** (global, tenant-root, tenant-scoped, filha) documentada no ADR.

---

## 5. Regras de Autorização Server-Side

1. **Toda autorização crítica deve ocorrer no servidor.** Frontend apenas esconde UI; backend bloqueia.
2. **RBAC por `ContractRole` + `ApprovalStage`** é a fonte da verdade (ver matriz em `current-state.md:239-252`).
3. **Validação de membership** deve ser centralizada (middleware ou base service), nunca duplicada.
4. **Portal do Cliente (`isClient=true`):** Só acessa documentos com `ApprovalWorkflow.stage = CLIENTE`. Carimbos `VERIFICACAO`/`APROVACAO` são filtrados na resposta.
5. **Ações de escrita** (upload, aprovação, GRD, convite) exigem role explícito verificado no controller.
6. **`SYSADMIN` (global)** não existe no código atual — não implementar cross-tenant sem ADR aprovado.

---

## 6. Regras de Segurança

1. **Nenhum secret no Git.** `.env` apenas local; `.env.example` versionado. Secrets em AWS Secrets Manager / GitHub Environments.
2. **Rotacionar credenciais expostas IMEDIATAMENTE** (ver `security-model.md:25-46`).
3. **JWT:** Migrar para RS256 + Refresh Token Rotation (15min access / 30d refresh HttpOnly cookie).
4. **Rate Limiting** obrigatório em todos endpoints (global + stricter em `/auth`).
5. **CORS restritivo:** `origin` apenas domínios permitidos (prod/staging/localhost dev).
6. **Security Headers:** Helmet + CSP + HSTS + X-Frame-Options + Referrer-Policy.
7. **Validação de entrada:** Zod em body, query, params. Arquivos: presigned URL (principal) + validação MIME/size.
8. **Webhooks:** HMAC-SHA256 com timestamp + nonce (anti-replay). Secret rotacionado periodicamente.
9. **Integridade de arquivos:** `fileHash` = SHA-256 real do conteúdo. Verificar no download/visualização.
10. **S3 Versioning + MFA Delete** obrigatórios no bucket de produção.
11. **Logs estruturados (pino/JSON)** sem PII/tokens. Correlation ID propagado (W3C traceparent).
12. **Password Reset** obrigatório antes de produção.
13. **Não desabilitar testes para fazer o build passar.**

---

## 7. Regras de Documentos e Revisões

1. **Documento = Metadados + Histórico de Revisões.** `codigoDocumento` único por `contractId`.
2. **Shell Document:** Criação sem arquivo (placeholder para MDR).
3. **Revisão Inicial (R0):** Criada junto com primeiro upload físico.
4. **Nova Revisão Oficial (R1+):** Só permitida após ciclo `CLIENTE` concluído OU legacy `APROVADO` sem workflow (Gatekeeper Épico 10.3).
5. **Correção Interna:** Substitui arquivo da **mesma revisão**, reinicia carimbo `VERIFICACAO` (não cria R+1). Permitida apenas após retorno interno (`REPROVADO`/`APROVADO_COM_COMENTARIOS`).
6. **Revisões Oficiais Publicadas são Imutáveis.** Nunca sobrescrever `filePath`, `fileHash`, `versionLabel`, `status` de revisão já `APROVADO` ou `REJEITADO`.
7. **`fileHash` deve ser SHA-256 do conteúdo real**, não ID aleatório. Verificado no download.
8. **OCR Assíncrono:** SQS → Worker Python → Webhook → `Revision.extractedText` + `Document.ocrStatus`.

---

## 8. Regras de Workflows

1. **Approval Workflow = State Machine Estrita (3 estágios):**
   - `VERIFICACAO` (Engenheiro/Coordenador/Gestor) → `APROVACAO` (Coordenador/Gestor) → `CLIENTE` (Cliente externo)
   - Cada carimbo é **novo registro** (histórico preservado, nunca sobrescrito).
   - Retorno interno (`REPROVADO`/`APROVADO_COM_COMENTARIOS`) → Correção Interna (mesma revisão).
   - Retorno cliente (`REPROVADO`/`APROVADO_COM_COMENTARIOS`) → Exige Nova Revisão Oficial (R+1).
2. **Gatekeeper Nova Revisão:** Bloqueia R+1 se houver carimbo `PENDENTE` ou ciclo `CLIENTE` não finalizado.
3. **GRD (Transmittal):** Gatekeeper — todas revisões do lote devem ter `status = APROVADO`. Pós-emissão cria carimbo `CLIENTE` para cada revisão.
4. **Worker GRD:** Gera ZIP + PDF Capa → webhook `/webhooks/transmittals/:id/complete` com `zipUrl`, `pdfCapaUrl`.
5. **Transmittals devem preservar snapshot da revisão enviada.** `TransmittalItem` referencia `Revision` imutável no momento da emissão.

---

## 9. Regras de Auditoria

1. **Eventos de auditoria críticos não podem ser alterados pelo usuário.** `AuditLog` é `CREATE` only — nunca `UPDATE`/`DELETE`.
2. **Ações auditadas obrigatórias:** `UPLOAD_DOCUMENT`, `UPLOAD_REVISION`, `INTERNAL_UPDATE_REVISION`, `APPROVAL_{STATUS}`, `EMIT_GRD`, `LOGIN`, `LOGOUT`, `AUTH_FAILURE`, `ACCESS_DENIED`, `ROLE_CHANGE`, `USER_INVITE`.
3. **Campos obrigatórios:** `action`, `entity`, `entityId`, `details` (JSON), `ipAddress`, `userId`, `contractId`, `createdAt`.
4. **Acesso a audit logs:** Apenas `GESTOR` do contrato.
5. **Auditoria de metadados de Document:** Implementar versionamento (`history` JSONB) para `codigoDocumento`, `titulo`, `disciplina`.

---

## 10. Regras de Armazenamento

1. **S3 Presigned PUT URLs** para upload direto do frontend (15 min expiry).
2. **Estrutura de chaves:** `contratos/{sha256}.pdf` (hash do conteúdo).
3. **S3 Versioning + MFA Delete** obrigatórios em produção.
4. **Worker Python** acessa via `s3.download_file` usando key parsing — validar pattern `^contratos/[a-f0-9]{32}\.pdf$` antes de download.
5. **Nenhum arquivo em memória no backend** (exceto legacy `internalUpdateRevision` — migrar para presigned).
6. **Backup/DR:** Neon PITR habilitado + teste de restore documentado.

---

## 11. Regras de Testes

1. **Toda nova funcionalidade precisa de testes.** Cobertura mínima 80% nos arquivos alterados.
2. **Backend:** Vitest (unit + integration). Testes de: auth, tenant isolation, approval gatekeepers, RBAC, webhook security.
3. **Frontend:** Vitest + React Testing Library (unit) + Playwright (E2E crítico: login, upload, aprovação, GRD).
4. **Worker Python:** Pytest (unit) + integração com LocalStack/moto.
5. **Contract Tests:** OpenAPI spec + codegen garante FE/BE sincronizados.
6. **CI:** `npm run test -- --coverage` obrigatório no pipeline. Falha se coverage < 80% em arquivos alterados.

---

## 12. Regras de Migrations

1. **Toda migration Prisma é versionada e revisada.** `prisma migrate dev` local → `prisma migrate deploy` no CI/CD.
2. **RLS migrations** requerem feature flag + test suite abrangente antes de habilitar em prod.
3. **Soft Delete:** Adicionar `deletedAt` + partial unique indexes em uma migration por entidade.
4. **Índices críticos** adicionados via migration separada (não no schema inicial).
5. **Dados sensíveis no seed:** Usar bcrypt real, nunca senhas em texto plano. Seed de produção separado.

---

## 13. Regras de Git

1. **Branch `main` protegida:** Code review obrigatório (2 aprovações: 1 senior + 1 domain expert).
2. **Conventional Commits:** `feat:`, `fix:`, `refactor:`, `security:`, `docs:`, `test:`, `chore:`.
3. **Nunca `git push --force` na `main`.** Rebase em feature branches apenas.
4. **Não commitar `.env`, `*.log`, `dist/`, `build/`, `.vercel`, `.turbo`, `ged-worker-python/output/`, `teste-upload.html`, `GEMINI.TXT`.**
5. **Changelog:** Entrada em `CHANGELOG.md` a cada PR (Conventional Commits).
6. **Pre-commit hooks:** lint, typecheck, secret scan (git-secrets/truffleHog).

---

## 14. Regras de Secrets

1. **Zero secrets no repositório.** `.env` no `.gitignore` (já está, mas `.env` atual está committado — rotacionar TUDO).
2. **Secrets em runtime:** AWS Secrets Manager (DB, JWT, Webhook) + Parameter Store (S3 bucket, SQS URL) + IRSA para AWS SDK.
3. **Rotação:** DB/JWT a cada 90d (auto), Webhook a cada 30d (manual), chaves de assinatura via JWKS.
4. **CI/CD:** GitHub Environments (staging/prod) com secrets injetados no runtime — nunca em logs.
5. **Desenvolvimento:** `.env.local` (não versionado) ou 1Password CLI.

---

## 15. Regras: Não Criar Mocks / Fake Completion

1. **Não simular funcionalidade.** Implementar end-to-end real (DB real, S3 real, SQS real em testes de integração).
2. **Não usar `--no-verify`** para pular hooks de commit.
3. **Não desabilitar testes** para fazer build passar.
4. **Não fazer "completion theater"** — marcar tarefa como done só quando critérios de aceitação atendidos e testes passando.
5. **Não versionar artefatos de build/teste** (`output/`, `dist/`, `coverage/`, `.turbo/`).

---

## 16. Processo Obrigatório: ANALYZE → PLAN → IMPLEMENT → TEST → REVIEW → DOCUMENT → COMMIT

Para **toda** tarefa não-trivial (≥ 3 passos ou alteração arquitetural):

| Fase | Ação | Entregável |
|------|------|------------|
| **ANALYZE** | Ler código existente, docs, ADRs. Entender impacto. | Análise escrita (comentário no issue/PR) |
| **PLAN** | Definir passos, arquivos afetados, testes necessários, riscos. | Plano em issue/PR description |
| **IMPLEMENT** | Codificar seguindo convenções, regras acima. | Código funcional |
| **TEST** | Rodar testes unit/integration/E2E. Verificar coverage. | Testes verdes + coverage ≥ 80% |
| **REVIEW** | Self-review + 2 aprovações (senior + domain). Security review se toque em auth/tenant. | PR aprovado |
| **DOCUMENT** | Atualizar AGENTS.md, PROJECT-CONTEXT.md, ADRs, CHANGELOG.md se arquitetura mudar. | Docs sincronizados |
| **COMMIT** | Merge via PR (squash ou merge commit). Deploy staging automático. | Em `main` |

**Exceção:** Hotfix de segurança crítico (P0) — pode pular DOCUMENT/REVIEW completo, mas **nunca** pular TEST e security review posterior obrigatório.

---

## 17. Referências Rápidas

- **Auditoria Completa:** `docs/architecture/current-state.md`
- **Arquitetura Alvo:** `docs/architecture/target-state.md`
- **Modelo de Segurança:** `docs/architecture/security-model.md`
- **Modelo de Domínio:** `docs/architecture/domain-model.md`
- **Roadmap Produto:** `docs/roadmap/product-roadmap.md`
- **Dívida Técnica:** `docs/roadmap/technical-debt.md`
- **Schema Prisma:** `prisma/schema.prisma`
- **ADRs:** `docs/architecture/target-state.md:512-524` (ADR-001 a ADR-008)

---

> **Última atualização:** 2026-09-24 — FASE 00.5 Bootstrap
> **Próxima revisão:** Sprint 1 Planning (pós-R0.9)