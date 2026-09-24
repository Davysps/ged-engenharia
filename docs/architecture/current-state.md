# GED Engenharia — Auditoria Completa do Estado Atual

**Data da Auditoria:** 2026-09-24  
**Versão do Projeto:** 1.0.0  
**Branch:** main  
**Commit:** N/A (pre-commit audit)

---

## 1. Visão Geral da Arquitetura Atual

### 1.1 Estrutura de Pastas (Monorepo)

```
ged-engenharia/
├── src/                          # Backend Node.js/TypeScript (Express)
│   ├── lib/                      # Utilitários compartilhados
│   │   └── tenantContext.ts      # AsyncLocalStorage para isolamento multi-tenant
│   ├── middlewares/              # Middlewares Express
│   │   ├── auth.middleware.ts    # JWT verification + tenant extraction
│   │   └── upload.ts             # Multer memory storage (legacy)
│   ├── modules/                  # Domain-Driven Design modules
│   │   ├── auth/                 # Login, JWT issuance
│   │   ├── documents/            # Core GED: upload, revisions, OCR webhook
│   │   ├── approvals/            # Approval workflow engine (state machine)
│   │   ├── transmittals/         # GRD (Guia de Remessa) + worker webhook
│   │   ├── dashboard/            # KPIs operacionais consolidados
│   │   ├── management/           # ContractDiscipline CRUD + User invite
│   │   ├── planning/             # WorkPackage CRUD
│   │   ├── projects/             # Hierarchy: Client > Project > Contract
│   │   ├── timesheets/           # TimeLog per document/workpackage
│   │   └── audit/                # AuditLog listing (GESTOR only)
│   ├── services/                 # External integrations
│   │   ├── s3.service.ts         # S3 upload + presigned URLs
│   │   └── sqs.service.ts        # SQS message publisher
│   ├── prisma.ts                 # PrismaClient singleton + tenant extension
│   └── server.ts                 # Express app + route mounting
├── prisma/
│   ├── schema.prisma             # Complete data model (384 lines)
│   ├── seed.ts                   # Development seed data
│   └── migrations/               # Prisma migration history
├── ged-frontend/                 # React + Vite + TypeScript + Tailwind v4
│   └── src/
│       ├── contexts/             # AuthContext, ContractContext
│       ├── features/             # Feature-based modules
│       │   ├── auth/
│       │   ├── contracts/
│       │   ├── dashboard/
│       │   ├── documents/
│       │   ├── management/
│       │   ├── planning/
│       │   ├── transmittals/
│       │   └── audit/
│       ├── hooks/                # Shared hooks (usePermissions)
│       ├── lib/                  # Axios instance
│       └── types/                # Prisma-derived types
├── ged-worker-python/            # Background worker (PyMuPDF OCR)
│   ├── worker.py                 # SQS consumer + S3 download + text extraction
│   └── requirements.txt
├── .env                          # Environment variables (contains secrets)
├── package.json                  # Backend dependencies
├── tsconfig.json                 # TypeScript strict config
└── arquitetura.md                # Project master documentation
```

### 1.2 Stack Tecnológica

| Camada | Tecnologia | Versão | Observação |
|--------|------------|--------|------------|
| Runtime | Node.js | 20+ | Express 5.x |
| Linguagem | TypeScript | 6.0.3 | Strict mode enabled |
| ORM | Prisma | 7.8.0 | Adapter PG (Neon) |
| Database | PostgreSQL | Serverless | Neon DB |
| Auth | JWT + bcrypt | 9.0.3 / 6.0.0 | 1-day expiry |
| Storage | AWS S3 | SDK v3 | Presigned PUT URLs |
| Queue | AWS SQS | SDK v3 | Long polling (20s) |
| Worker | Python 3.11+ | - | PyMuPDF (fitz) |
| Frontend | React 18 + Vite | - | Tailwind CSS v4 |
| State | React Query | - | Not yet implemented (planned) |
| Validation | Zod | 4.4.3 | Schema-first |
| Excel | xlsx (SheetJS) | 0.18.5 | MDR export |

---

## 2. Modelo de Dados (Prisma Schema)

### 2.1 Entidades Principais (17 models)

| Model | Descrição | Tenant Scope |
|-------|-----------|--------------|
| `Client` | Cliente final (ex: Vale S.A.) | Global |
| `Project` | Projeto do cliente (Épico 9) | Global |
| `Contract` | Contrato/Obra (tenant unit) | **Tenant Root** |
| `ContractDiscipline` | Disciplinas por contrato (Épico 6) | Tenant |
| `User` | Usuário global (interno/externo) | Global |
| `ContractMembership` | User ↔ Contract + Role | Tenant |
| `Document` | Metadados do documento técnico | Tenant |
| `Revision` | Revisão física (R0, R1...) + arquivo S3 | Filha de Document |
| `ApprovalWorkflow` | Carimbo de aprovação (state machine) | Filha de Revision |
| `Transmittal` | GRD (Guia de Remessa de Documentos) | Tenant |
| `TransmittalItem` | Revision ↔ Transmittal link | Filha de Transmittal |
| `WorkPackage` | Pacote de trabalho (Épico 7) | Tenant |
| `TimeLog` | Apontamento de horas (Épico 9) | Filha de Document/WP |
| `AuditLog` | Trilha de auditoria imutável (Épico 12) | Tenant |
| `DocumentLink` | Relacionamentos entre documentos (Épico 9) | Filha de Document |

### 2.2 Enums Críticos

```prisma
enum GlobalRole { SYSADMIN, USER }
enum ContractRole { GESTOR, COORDENADOR, ENGENHEIRO, PLANEJADOR, LEITOR }
enum RevisionStatus { EM_ELABORACAO, EM_REVISAO, APROVADO, REJEITADO, OBSOLETO }
enum ApprovalStatus { PENDENTE, APROVADO, APROVADO_COM_COMENTARIOS, REPROVADO }
enum ApprovalStage { VERIFICACAO, APROVACAO, CLIENTE }
enum TransmittalStatus { EM_PROCESSAMENTO, CONCLUIDO, ERRO }
enum DocumentOcrStatus { PENDING, PROCESSING, COMPLETED, FAILED }
enum Discipline { ELETRICA, HIDRAULICA, ESTRUTURAL, MECANICA, CIVIL, ARQUITETURA, OUTRO }
```

### 2.3 Relações-Chave

```
Client 1──N Project 1──N Contract 1──N ContractDiscipline
                              │
                              ├── N Document 1──N Revision 1──N ApprovalWorkflow
                              │                    │
                              │                    └── N TransmittalItem
                              ├── N Transmittal 1──N TransmittalItem
                              ├── N WorkPackage 1──N TimeLog
                              ├── N ContractMembership
                              └── N AuditLog
```

---

## 3. API Routes Map

### 3.1 Auth (Públicas)
| Method | Path | Controller | Auth |
|--------|------|------------|------|
| POST | `/auth/login` | `login` | ❌ |

### 3.2 Documents (Protected by JWT + Tenant)
| Method | Path | Controller | RBAC |
|--------|------|------------|------|
| POST | `/documents/upload` | `uploadDocument` | GESTOR/COORDENADOR |
| POST | `/documents/presigned-url` | `createPresignedUrl` | Any member |
| GET | `/documents/export/mdr` | `exportMDR` | Any member |
| GET | `/documents/:id` | `getDocumentById` | Any member (client filtered) |
| POST | `/documents/:id/revisions` | `uploadRevision` | GESTOR/COORDENADOR |
| POST | `/documents/:id/revisions/:revId/internal-update` | `internalUpdateRevision` | GESTOR/COORDENADOR/ENGENHEIRO |
| POST/PATCH | `/documents/:id/metadata` | `updateMetadataWebhook` | Internal secret |

### 3.3 Approvals (Protected by JWT + Tenant + Stage RBAC)
| Method | Path | Controller | RBAC |
|--------|------|------------|------|
| GET | `/approvals?contractId=` | `getPendingApprovals` | Role per stage |
| POST | `/approvals/:id` | `handleApprovalAction` | Stage-specific |

### 3.4 Transmittals (Protected by JWT + Tenant)
| Method | Path | Controller | RBAC |
|--------|------|------------|------|
| POST | `/contracts/:contractId/transmittals` | `create` | GESTOR/COORDENADOR/ENGENHEIRO |
| GET | `/contracts/:contractId/transmittals` | `list` | Any member |
| GET | `/contracts/:contractId/transmittals/approved-revisions` | `getApprovedRevisions` | Any member |
| PATCH | `/webhooks/transmittals/:transmittalId/complete` | `webhookComplete` | Worker only |

### 3.5 Management (Protected by JWT + Tenant)
| Method | Path | Controller | RBAC |
|--------|------|------------|------|
| GET | `/management/disciplines?contractId=` | `listDisciplines` | Any member |
| POST | `/management/disciplines?contractId=` | `createDiscipline` | GESTOR |
| PATCH | `/management/disciplines/:id?contractId=` | `updateDiscipline` | GESTOR |
| DELETE | `/management/disciplines/:id?contractId=` | `deleteDiscipline` | GESTOR |
| GET | `/management/users?contractId=` | `listUsers` | Any member |
| POST | `/management/users/invite?contractId=` | `inviteUser` | GESTOR |

### 3.6 Planning (Protected by JWT + Tenant)
| Method | Path | Controller | RBAC |
|--------|------|------------|------|
| GET | `/planning?contractId=` | `listWorkPackages` | Any member |
| POST | `/planning?contractId=` | `createWorkPackage` | GESTOR/COORDENADOR/PLANEJADOR |
| PATCH | `/planning/:id?contractId=` | `updateWorkPackage` | GESTOR/COORDENADOR/PLANEJADOR |
| DELETE | `/planning/:id?contractId=` | `deleteWorkPackage` | GESTOR/COORDENADOR/PLANEJADOR |

### 3.7 Timesheets (Protected by JWT + Tenant)
| Method | Path | Controller | RBAC |
|--------|------|------------|------|
| GET | `/timesheets?documentId=` | `listTimeLogs` | Any member |
| POST | `/timesheets` | `createTimeLog` | Any member |
| DELETE | `/timesheets/:id` | `deleteTimeLog` | Author only |

### 3.8 Projects (Protected by JWT)
| Method | Path | Controller | RBAC |
|--------|------|------------|------|
| GET | `/projects` | `getProjects` | Any member |
| GET | `/projects/:id` | `getProjectById` | Member of contract |

### 3.9 Dashboard (Protected by JWT + Tenant)
| Method | Path | Controller | RBAC |
|--------|------|------------|------|
| GET | `/dashboard?contractId=` | `getDashboard` | Any member |

### 3.10 Audit (Protected by JWT + Tenant)
| Method | Path | Controller | RBAC |
|--------|------|------------|------|
| GET | `/audit-logs?contractId=` | `listAuditLogs` | GESTOR only |

---

## 4. Middlewares

### 4.1 `auth.middleware.ts` — `verifyToken`
- **Função:** Valida JWT Bearer token, extrai `userId` + `globalRole`
- **Tenant Extraction:** Lê `contractId` de `query`, `params` ou `body`
- **AsyncLocalStorage:** Envolve `next()` com `runWithTenant({ userId, contractId })`
- **Retorna:** `AuthRequest` com `userId` e `contractId` opcional

### 4.2 `upload.ts` — `upload.single('file')`
- **Função:** Multer memory storage (legacy — usado apenas em `internalUpdateRevision`)
- **Nota:** Fluxo principal usa **S3 Presigned URLs** (sem multer)

### 4.3 Prisma Extension (`prisma.ts` — `tenantIsolation`)
- **Modelos com filtro automático:** `ContractDiscipline`, `ContractMembership`, `Document`, `Transmittal`, `WorkPackage`, `AuditLog`
- **Operações cobertas:** `findMany`, `findFirst`, `findUnique`, `count`, `aggregate`, `groupBy`, `update`, `updateMany`, `delete`, `deleteMany`, `upsert`, `create`, `createMany`
- **Injeção automática:** `contractId` no `where` e `data.contractId` no create

---

## 5. Autenticação e Autorização

### 5.1 JWT Payload
```json
{ "userId": 1, "globalRole": "USER", "iat": ..., "exp": ... }
```

### 5.2 RBAC Matrix (ContractRole × Ações)

| Ação | GESTOR | COORDENADOR | ENGENHEIRO | PLANEJADOR | LEITOR | CLIENTE (isClient) |
|------|--------|-------------|------------|------------|--------|-------------------|
| Criar Documento | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Subir Revisão (R1+) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Correção Interna | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Verificação (Stage 1) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Aprovação (Stage 2) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Análise Cliente (Stage 3) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Criar Disciplina | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Convidar Usuário | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Criar WorkPackage | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Emitir GRD | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Apontar Horas | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

### 5.3 Portal do Cliente (PATCH 10.4)
- Usuários com `User.isClient = true` só veem documentos com `ApprovalWorkflow.stage = CLIENTE`
- Carimbos internos (`VERIFICACAO`, `APROVACAO`) são **filtrados** na resposta
- Listagem e detalhamento aplicam filtro `revisions.some(approvalWorkflows.some(stage: CLIENTE))`

---

## 6. Armazenamento de Arquivos (S3)

### 6.1 Fluxo Atual (FASE 2 — Enterprise)
1. Frontend chama `POST /documents/presigned-url` com `fileName`, `fileType`
2. Backend gera `uploadUrl` (PUT, 15 min), `fileKey` (`contratos/{hash}.ext`), `filePath` (URL pública), `fileHash`
3. Frontend faz **PUT direto ao S3** (bypassa Node.js)
4. Frontend confirma upload enviando `fileKey` no `POST /documents/upload` ou `/revisions`
5. Backend resolve `filePath`/`fileHash` via `resolveFileReferences(fileKey)`

### 6.2 Estrutura de Chaves S3
```
s3://ged-engenharia-documentos-prd/contratos/{hash}.pdf
```

### 6.3 Worker Python Access
- Baixa via `s3.download_file(Bucket, Key, Filename)` usando `filePath` → key parsing

---

## 7. Mensageria (SQS) e Worker Python

### 7.1 Fila OCR
- **Queue:** `AWS_SQS_OCR_QUEUE_URL`
- **Payload:** `{ documentId, revisionId, filePath }`
- **Consumer:** `ged-worker-python/worker.py` (long polling 20s)

### 7.2 Worker Flow
1. Recebe mensagem SQS
2. Parse `filePath` → extrai S3 key
3. Download temporário para `/tmp/{uuid}.pdf`
4. `PyMuPDF (fitz)` extrai texto completo de todas as páginas
5. POST webhook para `GED_INTERNAL_WEBHOOK_URL` com `x-internal-secret`
6. Payload webhook: `{ documentId, revisionId, status: "COMPLETED", extractedText }`
7. Backend grava `Revision.extractedText` + `Document.ocrStatus = COMPLETED`
8. Deleta mensagem SQS (ou vai para DLR se falhar — **não implementado**)

### 7.3 Webhook Endpoint
- `POST/PATCH /documents/:id/metadata`
- Protegido por header `x-internal-secret` == `GED_INTERNAL_SECRET`
- Aceita formato legado (Épico 5) e novo (Épico 13)

---

## 8. Workflows Implementados

### 8.1 Aprovação Estrita (Épico 10 — State Machine)

```
VERIFICACAO (Stage 1)          APROVACAO (Stage 2)           CLIENTE (Stage 3)
      │                              │                            │
      ▼                              ▼                            ▼
┌─────────┐                    ┌─────────┐                  ┌─────────┐
│ PENDENTE│                    │ PENDENTE│                  │ PENDENTE│
└────┬────┘                    └────┬────┘                  └────┬────┘
     │                              │                            │
     ├─ APROVADO ──────────────────►│                            │
     │                              │                            │
     ├─ APROVADO_COM_COMENTARIOS ──►│  (retorno → REJEITADO)     │
     │                              │                            │
     └─ REPROVADO ─────────────────►│  (retorno → REJEITADO)     │
                                    │                            │
                                    ├─ APROVADO ────────────────►│ (APROVADO final)
                                    │                            │
                                    ├─ APROVADO_COM_COMENTARIOS ─►│ (REJEITADO → exige R+1)
                                    │                            │
                                    └─ REPROVADO ────────────────►│ (REJEITADO → exige R+1)
```

- **Gatekeeper nova revisão (R+1):** Só permite se ciclo `CLIENTE` concluído OU legacy sem aprovações + status `APROVADO`
- **Correção Interna (PATCH 10.3):** Substitui arquivo da **mesma revisão**, reinicia carimbo `VERIFICACAO` (não cria R+1)

### 8.2 GRD / Transmittal (Épico 4 + 10.1)
- **Gatekeeper emissão:** Todas as revisões do lote devem ter `status = APROVADO`
- **Pós-emissão:** Cria `ApprovalWorkflow` stage `CLIENTE` para cada revisão (destrava análise do cliente)
- **Worker Python:** Gera ZIP + PDF de capa → webhook `/webhooks/transmittals/:id/complete` com `zipUrl`, `pdfCapaUrl`

### 8.3 OCR / Full-Text Search (Épico 5 + 13)
- Assíncrono via SQS + Worker Python
- Texto extraído salvo em `Revision.extractedText` (Text column)
- Busca em `listDocuments`: `revisions.some.extractedText.contains(busca)`

---

## 9. Auditoria (Épico 12)

### 9.1 Model `AuditLog`
```prisma
model AuditLog {
  action     String   // 'UPLOAD_DOCUMENT', 'APPROVE_REVISION', 'EMIT_GRD', ...
  entity     String   // 'Document', 'Revision', 'ApprovalWorkflow', 'Transmittal'
  entityId   Int
  details    Json?    // { versionLabel, status, codigo, ... }
  ipAddress  String?
  user       User     @relation(fields: [userId], references: [id])
  contract   Contract @relation(fields: [contractId], references: [id])
}
```

### 9.2 Pontos de Interceptação (`AuditService.log`)
- `DocumentController.uploadDocument` → `CREATE_DOCUMENT_SHELL` / `UPLOAD_DOCUMENT`
- `DocumentController.uploadRevision` → `UPLOAD_REVISION`
- `DocumentController.internalUpdateRevision` → `INTERNAL_UPDATE_REVISION`
- `ApprovalController.handleApprovalAction` → `APPROVAL_{STATUS}`
- `TransmittalController.create` → `EMIT_GRD`

### 9.3 Acesso
- `GET /audit-logs?contractId=` — **apenas GESTOR**
- Filtros: `entity`, `action`, `entityId`
- Ordenação: `createdAt DESC`

---

## 10. Frontend — Principais Fluxos

### 10.1 Rotas Principais (`App.tsx`)
```
/login                          → LoginForm
/dashboard                      → Dashboard (hierarchy tree)
/contracts/:contractId          → ContractLayout (shell)
  ├─ /                          → DashboardOperacional
  ├─ /documents                 → DocumentList (toolbar: search, disciplina, pacote)
  ├─ /documents/:documentId     → DocumentDetail (SSOT: revisions, workflows, transmittals, timesheet)
  ├─ /approvals                 → ApprovalDashboard (pending queue per role)
  ├─ /transmittals              → TransmittalDashboard (emit GRD, list)
  ├─ /management                → ManagementHome (disciplines CRUD, users invite)
  └─ /planning                  → PlanningHome (workpackages CRUD)
/documentos/:id                 → DocumentDetail (alias direto)
```

### 10.2 Componentes-Chave (Documents)
- `DocumentList.tsx` — Toolbar com busca, filtro disciplina/pacote, export MDR
- `DocumentDetail.tsx` — Timeline completa: revisões, workflows, transmittals, timesheet
- `ApprovalDashboard.tsx` — Fila de aprovações por estágio (interno/cliente)
- `EmitirGrdModal.tsx` — Seleção de revisões APROVADO + validação gatekeeper
- `WorkflowFlowchart.tsx` — Visualização horizontal do state machine
- `InternalCorrectionForm.tsx` — Correção interna (mesma revisão)
- `RevisionUploadForm.tsx` — Nova revisão oficial (R+1)

### 10.3 Contextos
- `AuthContext` — Login, logout, token storage, `isAuthenticated`
- `ContractContext` — `currentContractId`, `currentContract`, setter

---

## 11. Código Morto / Não Utilizado

| Arquivo | Status | Motivo |
|---------|--------|--------|
| `src/middlewares/upload.ts` | **Parcial** | Usado apenas em `internalUpdateRevision` (multipart). Fluxo principal usa presigned URLs. |
| `src/modules/projects/project.routes.ts` | **Ativo** | Apenas 2 rotas (`/projects`, `/projects/:id`) |
| `ged-worker-python/output/` | **Artefato** | PDFs de teste (GRD_4_Capa.pdf, GRD_4_pacote.zip) — não versionar |
| `teste-upload.html` | **Artefato** | Teste manual de upload — não versionar |
| `GEMINI.TXT` | **Artefato** | Notas de IA — não versionar |

---

## 12. Testes

| Camada | Framework | Status |
|--------|-----------|--------|
| Backend | **Nenhum** | `package.json: "test": "echo 'Error: no test specified' && exit 1"` |
| Frontend | **Nenhum** | Sem configuração de teste (Vitest/Jest/Playwright) |
| Worker Python | **Nenhum** | Script standalone sem testes |

**Cobertura:** 0% — **Risco Crítico**

---

## 13. Secrets e Arquivos Sensíveis

### 13.1 `.env` (COMMITTED — **RISCO CRÍTICO**)
```env
DATABASE_URL=""
JWT_SECRET=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET=""
AWS_SQS_OCR_QUEUE_URL=""
GED_INTERNAL_WEBHOOK_URL=""
GED_INTERNAL_SECRET=""
```

**Ação Imediata:** Revogar todas as credenciais expostas. Usar `.env.example` + secret manager.

### 13.2 `.gitignore` (Incompleto)
```
node_modules/
.env
```
**Faltando:** `*.log`, `dist/`, `build/`, `.vercel`, `.turbo`, `ged-worker-python/output/`, `teste-upload.html`, `GEMINI.TXT`

---

## 14. Problemas de Arquitetura Identificados

| ID | Problema | Severidade | Localização |
|----|----------|------------|-------------|
| ARCH-01 | **Monolito único** — backend, worker, frontend no mesmo repo sem boundaries claros de deploy | Alto | Estrutura de pastas |
| ARCH-02 | **Prisma Extension tenant isolation** — usa `AsyncLocalStorage` mas não cobre `createMany` em transações complexas | Médio | `src/prisma.ts:101` |
| ARCH-03 | **Tenant resolution via request** — `contractId` vem de query/params/body (não do JWT), sujeito a manipulação | Alto | `auth.middleware.ts:20-30` |
| ARCH-04 | **Sem rate limiting** — endpoints públicos e autenticados expostos a brute-force/DoS | Alto | `server.ts` |
| ARCH-05 | **CORS aberto** — `app.use(cors())` sem `origin` restrictivo | Médio | `server.ts:19` |
| ARCH-06 | **Worker Python sem DLQ** — mensagens falhas perdidas ou retries infinitos | Médio | `worker.py:129` |
| ARCH-07 | **Webhook URL hardcoded** — `GED_INTERNAL_WEBHOOK_URL` usa `localhost` | Alto | `.env:30` |
| ARCH-08 | **Sem health checks profundos** — `/health` só retorna OK, não verifica DB/S3/SQS | Médio | `server.ts:22` |
| ARCH-09 | **Frontend sem React Query** — fetch manual, sem cache/invalidação/optimistic updates | Alto | `ged-frontend/src/lib/axios.ts` |
| ARCH-10 | **TypeScript `exactOptionalPropertyTypes`** — força `null` em FKs opcionais, verboso | Baixo | `document.controller.ts:22-24` |

---

## 15. Riscos de Segurança

| ID | Risco | Impacto | Mitigação |
|----|-------|---------|-----------|
| SEC-01 | **Secrets comitados no `.env`** — DB, AWS, JWT, Webhook secret expostos publicamente | **Crítico** | Revogar TODAS as credenciais imediatamente; rotacionar chaves |
| SEC-02 | **JWT sem refresh token** — access token de 1 dia, sem rotação | Alto | Implementar refresh token + short-lived access (15min) |
| SEC-03 | **Tenant ID controlado pelo cliente** — `contractId` vem de query/body, não do token | **Crítico** | Mover `contractId` para claim do JWT ou validar membership server-side antes de usar |
| SEC-04 | **Webhook secret fixo** — `GED_INTERNAL_SECRET` estático, sem rotação | Alto | Rotacionar periodicamente; usar mTLS ou AWS IAM auth |
| SEC-05 | **Senhas em texto plano no seed** — `senhaHash: 'hash'` e `TEMP_PASSWORD_` | Médio | Usar bcrypt real no seed; não comitar seeds com senhas reais |
| SEC-06 | **CORS `*`** — qualquer origem pode chamar API com credenciais | Médio | Restringir `origin` aos domínios permitidos |
| SEC-07 | **Sem helmet/security headers** — sem CSP, HSTS, X-Frame-Options | Médio | Adicionar `helmet` middleware |
| SEC-08 | **Upload internal-update usa multer** — arquivo em memória sem validação de tipo/tamanho | Baixo | Validar MIME + size limit; mover para presigned URL |
| SEC-09 | **Prisma logs em produção** — pode vazar queries sensíveis | Baixo | Desabilitar query logging em prod |

---

## 16. Riscos de Multi-Tenancy (Isolamento)

| ID | Risco | Impacto | Localização |
|----|-------|---------|-------------|
| MT-01 | **Prisma extension não cobre `findUnique` com include de relações cross-tenant** | Alto | `prisma.ts:42` — `WHERE_OPERATIONS` não inclui `findUnique` com include que traversa relações sem filtro |
| MT-02 | **`Client`, `Project`, `User` globais** — sem tenant, mas acessíveis via relações | Médio | Seed cria 1 client, 1 project, 1 contract |
| MT-03 | **`ContractMembership` validação manual** — cada service repete `findUnique(userId_contractId)` | Médio | Duplicação em 8+ services |
| MT-04 | **`Transmittal.webhookComplete` sem validação de tenant** — worker pode atualizar qualquer transmittal | Alto | `transmittal.controller.ts:218` |
| MT-05 | **`DocumentLink` não tem `contractId`** — isolamento herdado via `Document.contractId` | Baixo | OK se services validarem ambos os docs no mesmo contrato |
| MT-06 | **`TimeLog` validação via `document.contractId`** — OK, mas repetido | Baixo | `timesheet.service.ts:26` |

---

## 17. Riscos de Dados

| ID | Risco | Impacto |
|----|-------|---------|
| DATA-01 | **Soft delete inexistente** — `delete` é hard delete em todas as entities | Perda irreversível |
| DATA-02 | **Sem versionamento de metadados de Document** — `codigoDocumento`, `titulo` mutáveis | Auditoria incompleta |
| DATA-03 | **`Revision.fileHash` não verificado na leitura** — corrupção silenciosa não detectada | Integridade |
| DATA-04 | **`extractedText` pode ser grande** — coluna `Text` sem limite, impacto em backup/query | Performance/Storage |
| DATA-05 | **Sem backup automatizado documentado** — Neon tem point-in-time recovery mas não testado | Disaster Recovery |

---

## 18. Riscos Operacionais

| ID | Risco | Impacto |
|----|-------|---------|
| OPS-01 | **Deploy manual** — sem CI/CD pipeline | Erro humano, downtime |
| OPS-02 | **Worker Python como processo único** — sem systemd/k8s/deployment, sem auto-restart | SPOF |
| OPS-03 | **Sem observabilidade** — sem logs estruturados, metrics, tracing | Debugging difícil |
| OPS-04 | **SQS sem DLQ** — mensagens envenenadas bloqueiam fila | Parada de OCR |
| OPS-05 | **S3 bucket versioning não confirmado** — sobrescrita de arquivos possível | Perda de revisões |
| OPS-06 | **Database migrations manuais** — `prisma migrate deploy` não automatizado | Drift de schema |

---

## 19. Funcionalidades Existentes (Verificadas no Código)

| Épico | Funcionalidade | Status | Evidência |
|-------|----------------|--------|-----------|
| 1 | Auth JWT + Login | ✅ Completo | `auth.controller.ts`, `auth.middleware.ts` |
| 2 | S3 Presigned Upload + Visualização | ✅ Completo | `s3.service.ts`, `document.controller.ts` |
| 3 | Approval Workflow (state machine) | ✅ Completo | `approval.controller.ts`, `ApprovalWorkflow` model |
| 4 | Transmittals (GRD) + Worker Python (capa/ZIP) | ✅ Completo | `transmittal.controller.ts`, `worker.py` |
| 5 | OCR via AWS Textract (legado) | ⚠️ Parcial | `sqs.service.ts`, `worker.py` (migrou para PyMuPDF) |
| 6 | ContractDiscipline CRUD + User Invite | ✅ Completo | `management.*` |
| 7 | WorkPackage CRUD + Document linking | ✅ Completo | `planning.*`, `document.controller.ts` |
| 8 | Document Detail (SSOT) + Advanced Search | ✅ Completo | `document.service.ts`, `DocumentDetail.tsx` |
| 9 | Hierarchy (Client>Project>Contract) + TimeLog + DocumentLink | ✅ Completo | `project.controller.ts`, `timesheet.*`, `DocumentLink` |
| 10 | Strict Approval Engine + Client Portal Isolation | ✅ Completo | `approval.controller.ts`, PATCH 10.2/10.3/10.4 |
| 11 | MDR Export (Excel) | ✅ Completo | `document.service.ts:exportMDR`, `DocumentList.tsx` |
| 12 | Audit Logs (Data Room) | ✅ Completo | `audit.*`, `ManagementHome.tsx` |
| 13 | Full-Text Search (PyMuPDF) | ✅ Completo | `worker.py`, `Revision.extractedText`, search filter |

---

## 20. Funcionalidades Incompletas / Não Robustas

| Funcionalidade | Gap | Impacto |
|----------------|-----|---------|
| **Client Portal (isClient)** | Listagem/Detalhamento filtrados, mas **criação de revisão/correção não bloqueada explicitamente** no controller (depende de RBAC) | Cliente poderia tentar POST se souber endpoints |
| **OCR Legacy (Textract)** | Código residual aceita payload antigo `{ ocrStatus, metadata }` | Confusão, superfície de ataque |
| **Worker Python** | Sem DLQ, sem health endpoint, sem métricas, single process | Falha silenciosa, processamento travado |
| **GRD Worker Webhook** | `webhookComplete` não valida `contractId` + `internal-secret` fraco | Worker comprometido = dados corrompidos |
| **Timesheet** | Sem validação de horas negativas/zero, sem aprovação de horas | Dados sujos |
| **DocumentLink** | Apenas `REFERENCIA`/`ANEXO`, sem tipologia rica (supersede, complementa, etc.) | Limitado |
| **MDR Export** | Não inclui horas apontadas, não filtra por disciplina/pacote | Incompleto para relatórios |
| **Audit Logs** | Sem paginação, sem export, apenas GESTOR vê | Usabilidade/Compliance |
| **Password Reset** | **Não existe** | Usuário travado se esquecer senha |
| **Email Notifications** | **Não existe** | Sem alertas de aprovação/GRD/OCR |
| **DWG Viewer** | **Não existe** (planejado Épico 14) | Gap para Engenharia |
| **Markup/Redlining** | **Não existe** (planejado Épico 14) | Gap para Verificação |

---

## 21. Dependências Externas

| Dependência | Tipo | Risco se Indisponível |
|-------------|------|----------------------|
| Neon DB (PostgreSQL) | Database | **Parada total** |
| AWS S3 | Storage | Upload/download falha |
| AWS SQS | Queue | OCR/GRD assíncrono para |
| AWS IAM (Keys) | Auth | Todas as integrações AWS param |
| PyMuPDF (fitz) | OCR Engine | Extração de texto para |
| Node.js 20+ | Runtime | Build/execução falha |

---

## 22. Sugestão de Arquitetura Alvo (Resumo)

> **Detalhamento completo em `docs/architecture/target-state.md`**

1. **Split Monorepo** → `ged-api`, `ged-worker`, `ged-frontend`, `ged-infra` (repos separados ou monorepo com Turbo/Nx)
2. **API Gateway + Auth Service** → Centraliza JWT, tenant resolution, rate limiting
3. **Prisma Middleware → Row Level Security (RLS)** — Policies no PostgreSQL para isolamento garantido no DB
4. **Event-Driven** — Kafka/EventBridge para domain events (DocumentCreated, RevisionApproved, GRDEmitted)
5. **Worker como Deployment** — Containerizado, health checks, HPA, DLQ
6. **Frontend** — React Query + TanStack Table + React Hook Form + Radix UI
6. **Observabilidade** — OpenTelemetry + Loki + Grafana + AlertManager
7. **CI/CD** — GitHub Actions: lint, typecheck, test, build, deploy (staging → prod)
8. **Secrets** — 1Password / AWS Secrets Manager / Vault (nunca em `.env`)

---

## 23. Ordem Recomendada de Implementação (Próximos Passos)

### Fase 0 — **Emergência (Esta Semana)**
1. [ ] **Revogar TODAS as credenciais no `.env`** (DB, AWS, JWT, Webhook)
2. [ ] Adicionar `.env.example` e remover `.env` do git
3. [ ] Configurar secret manager (GitHub Environments / AWS Secrets Manager)
4. [ ] Adicionar `helmet`, `cors` restritivo, rate limiting (`express-rate-limit`)

### Fase 1 — **Fundação Técnica (Sprint 1-2)**
5. [ ] Implementar **testes unitários** (Vitest backend + React Testing Library frontend)
6. [ ] Implementar **CI/CD** (GitHub Actions: lint, typecheck, test, build)
7. [ ] Migrar **Prisma Extension → PostgreSQL RLS** (políticas por `contractId`)
8. [ ] Mover `contractId` para **JWT claim** (ou validar membership antes de qualquer query)
9. [ ] Adicionar **DLQ no SQS** + redrive policy
10. [ ] Containerizar **Worker Python** + health endpoint + deploy (ECS/Fargate/Cloud Run)

### Fase 2 — **Qualidade e Escalabilidade (Sprint 3-4)**
11. [ ] **React Query** no frontend (cache, invalidação, optimistic updates)
12. [ ] **TanStack Table** virtualizada no DocumentList (10k+ rows)
13. [ ] **React Hook Form + Zod** em todos os formulários
14. [ ] **Radix UI / Shadcn** design system consistente
15. [ ] **OpenTelemetry** tracing + structured logs (pino)
16. [ ] **Refresh Token** rotation + short-lived access tokens

### Fase 3 — **Funcionalidades Críticas Faltantes (Sprint 5-6)**
17. [ ] **Password Reset** (email + token temporário)
18. [ ] **Email Notifications** (SendGrid/SES) — aprovações, GRD, OCR falha
19. [ ] **Soft Delete** em todas as entities (`deletedAt`, unique partial index)
20. [ ] **Paginação + Export** em Audit Logs
21. [ ] **Validação de integridade** `fileHash` no download/visualização

### Fase 4 — **Diferenciais de Mercado (Sprint 7+)**
22. [ ] **DWG Viewer** (Autodesk Platform Services / Forge)
23. [ ] **Markup/Redlining** (PDF-lib + annotations layer)
24. [ ] **PWA + Offline** (Workbox)
25. [ ] **ISO 19650 Compliance** — nomenclatura, CDE workflows
26. [ ] **Webhooks Públicos** — integração com ERPs/PMOs clientes

---

## 24. Conclusão da Auditoria

O projeto **GED Engenharia** possui um **core funcional robusto** para um MVP de GED focado em engenharia:
- Modelo de dados bem desenhado para o domínio (hierarquia, revisões, workflow estrito, multi-tenant por contrato)
- Funcionalidades críticas implementadas: upload S3 presigned, approval state machine, GRD, OCR assíncrono, audit trail, MDR export, timesheet, hierarquia
- Frontend React com UX adequada para usuários técnicos

**Porém, bloqueadores críticos impedem produção:**
1. **Secrets expostos no git** — risco imediato de comprometimento total
2. **Zero testes** — regressões inevitáveis
3. **Tenant resolution insegura** — `contractId` controlado pelo cliente
4. **Sem CI/CD, observabilidade, deploy automatizado** — operacionalmente frágil
5. **Worker Python sem resiliência** — SPOF para OCR/GRD

**Recomendação:** **Não ir para produção** antes de completar Fase 0 + Fase 1. O código base é sólido para evoluir, mas precisa de hardening de segurança e engenharia de plataforma.