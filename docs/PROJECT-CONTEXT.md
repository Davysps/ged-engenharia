# GED Engenharia — Project Context

> **Documento de onboarding rápido para novas sessões de IA.**
> Baseado na Auditoria FASE 00 (2026-09-24).

---

## Produto

**GED Engenharia** é um SaaS B2B (EDMS/CDE — Engineering Document Management System / Common Data Environment) para gestão de documentos técnicos de engenharia multidisciplinar.

Atende empresas de engenharia nas disciplinas: Processos, Mecânica, Piping, Elétrica, Instrumentação, Civil, Estruturas, Geotecnia, Topografia, HSE, Meio Ambiente, BIM/CAD, Planejamento, Suprimentos, QA/QC, Comissionamento, Document Control.

---

## Objetivo

- **Workflow de aprovação rigoroso** (3 estágios: Verificação → Coordenação → Cliente)
- **Isolamento multi-tenant garantido** (dados de contratos nunca vazam)
- **Armazenamento escalável nuvem** (S3 + presigned URLs)
- **Busca full-text nativa** (PyMuPDF OCR assíncrono)
- **Auditoria imutável** (Data Room pronta para compliance)
- **Integração aberta** (Webhooks, API versionada, OpenAPI)

---

## Arquitetura

### Atual (Monorelo Único)
- **Backend:** Node.js 20+ / Express 5.x / TypeScript strict / Prisma 7.8.0 (PostgreSQL Neon)
- **Auth:** JWT HS256 (1 dia) + bcrypt
- **Storage:** AWS S3 (presigned PUT URLs)
- **Queue:** AWS SQS (long polling 20s)
- **Worker:** Python 3.11+ / PyMuPDF (OCR + GRD ZIP/Capa)
- **Frontend:** React 18 + Vite + Tailwind v4
- **Estrutura:** `src/`, `ged-frontend/`, `ged-worker-python/`, `prisma/` no mesmo repo
- **Isolamento tenant:** Prisma Extension + AsyncLocalStorage (application-level, **não confiável**)
- **Secrets:** `.env` **committado no git — RISCO CRÍTICO**

### Alvo (Target State)
- **Split repos:** `ged-api`, `ged-worker-ocr`, `ged-worker-transmittal`, `ged-worker-webhook`, `ged-scheduler`, `ged-frontend`, `ged-infra`, `ged-shared`
- **Deploy:** ECS Fargate (API + Workers), CloudFront+S3 (Frontend), Terraform (Infra)
- **Auth:** RS256 JWT (15min) + Refresh Token Rotation (30d, HttpOnly cookie)
- **Tenant Isolation:** PostgreSQL Row Level Security (RLS) — enforcado no banco
- **Secrets:** AWS Secrets Manager + Parameter Store + IRSA
- **Observability:** OpenTelemetry + Loki + Prometheus + Grafana
- **CI/CD:** GitHub Actions (lint, typecheck, test, build, deploy staging→prod)

---

## Domínio

```
Organization (Client)
└── Project
    └── Contract (Tenant Root / Unidade de Isolamento)
        ├── ContractDiscipline (Disciplinas técnicas do contrato)
        ├── ContractMembership (Usuários + ContractRole)
        ├── Document (Metadados: codigoDocumento, titulo, disciplina, pacote)
        │   └── Revision (R0, R1, R2... — imutáveis após publicação)
        │       ├── ApprovalWorkflow (State Machine: VERIFICACAO → APROVACAO → CLIENTE)
        │       └── TransmittalItem (Participação em GRDs)
        ├── Transmittal (GRD — Guia de Remessa de Documentos)
        │   └── TransmittalItem (Snapshot da Revision no momento da emissão)
        ├── WorkPackage (Planejamento: datas, status, documentos vinculados)
        ├── TimeLog (Apontamento de horas por documento/pacote)
        ├── DocumentLink (Relacionamentos: REFERENCIA, ANEXO, SUPERSEDE, COMPLEMENTA)
        └── AuditLog (Trilha imutável — CREATE only)
```

**Roles por Contrato:** `GESTOR` | `COORDENADOR` | `ENGENHEIRO` | `PLANEJADOR` | `LEITOR`
**Portal Cliente:** `User.isClient = true` → vê apenas stage `CLIENTE`, carimbos internos filtrados.

---

## Multi-Tenancy

- **Contrato = Tenant.** Todo dado operacional pertence a um `Contract`.
- **Isolamento atual:** Prisma Extension injeta `contractId` via `AsyncLocalStorage` baseado no request (query/params/body). **Vulnerável:** `contractId` controlado pelo cliente.
- **Isolamento alvo:** `contractId` como claim no JWT + PostgreSQL RLS policies em todas tabelas tenant-scoped. Defesa em profundidade: mesmo com bug no código, o banco bloqueia acesso cross-tenant.
- **Entidades globais** (`Client`, `Project`, `User`, `Contract`) não têm RLS, mas nunca expostas sem validação de membership.
- **Entidades filhas** herdam isolamento via relação com pai (validar ambos os lados no mesmo contrato).

---

## Segurança

### Princípios
1. **Zero Trust** — nunca confiar no cliente (tenant ID, roles, dados)
2. **Defesa em Profundidade** — RLS no DB + validação no código + JWT claims
3. **Secrets Zero no Git** — tudo em Secrets Manager / Environments
4. **Auditoria Imutável** — `AuditLog` é append-only
5. **Integridade de Arquivos** — `fileHash` = SHA-256 real, verificado no download

### Bloqueadores Críticos (Devem Ser Corrigidos Antes de Qualquer Feature)
1. **7 secrets expostos no `.env` committado** (DB, AWS Keys, JWT, Webhook) — rotacionar TODOS imediatamente
2. **Zero testes automatizados** — `npm test` falha propositalmente
3. **Tenant ID inseguro** — `contractId` vem do request, não do token
4. **Worker Python sem DLQ** — mensagens envenenadas travam fila
5. **Webhook URL aponta para localhost** — `GED_INTERNAL_WEBHOOK_URL` hardcoded
6. **Sem rate limiting, CORS aberto, sem security headers (helmet)**

---

## Estado Atual (Resumo da Auditoria FASE 00)

### ✅ Funcionalidades Completas (Épicos 1–13)
- Auth JWT + Login
- S3 Presigned Upload + Visualização PDF
- Approval Workflow (State Machine 3 estágios)
- Transmittals (GRD) + Worker Python (ZIP/Capa)
- OCR (PyMuPDF) + Full-Text Search
- ContractDiscipline CRUD + User Invite
- WorkPackage CRUD + Document Linking
- Document Detail (SSOT) + Advanced Search
- Hierarchy (Client>Project>Contract) + TimeLog + DocumentLink
- Strict Approval Engine + Client Portal Isolation
- MDR Export (Excel)
- Audit Logs (Data Room)

### 🔴 Blockers de Produção
| ID | Blocker | Severidade |
|----|---------|------------|
| SEC-001 | Credenciais expostas no git | Crítico |
| SEC-002 | Zero testes | Crítico |
| SEC-003 | Tenant ID controlado pelo cliente | Crítico |
| SEC-004 | Worker sem DLQ | Crítico |
| SEC-005 | Webhook URL localhost | Crítico |
| ARCH-001 | Monolito único sem boundaries de deploy | Alto |
| DEVOPS-001 | Deploy manual (sem CI/CD) | Alto |

### 🟡 Dívida Técnica Alta
- JWT HS256 24h sem refresh token
- Sem rate limiting
- CORS `*`
- Sem helmet/security headers
- Prisma Extension incompleto (`findUnique` + `include` bypassa filtro)
- Validação de membership duplicada em 8+ services
- Transmittal webhook sem tenant check
- Frontend: Axios manual, sem React Query, tabela sem virtualização
- Worker: single process, sem health check, secret fraco

---

## Roadmap (Fases 01–14)

| Fase | Nome | Foco | Entregável |
|------|------|------|------------|
| **00.5** | Bootstrap Contexto | Documentação | AGENTS.md, PROJECT-CONTEXT.md |
| **01** | Security Hardening | Secrets, Auth v2, Rate Limit, RLS, DLQ, Containerize Worker | `v0.9.0` — Piloto seguro |
| **02** | Testes & CI/CD | Vitest, Playwright, GitHub Actions, Coverage ≥ 60% | Pipeline verde |
| **03** | Frontend Moderno | React Query, TanStack Table, React Hook Form, Radix UI | `v1.0.0` — GA Core |
| **04** | Soft Delete & Auditoria | `deletedAt`, partial indexes, audit pagination/export | Recuperação + compliance |
| **05** | Idempotency & Integridade | Idempotency-Key, SHA-256 real, verificação download | Zero duplicatas, integridade |
| **06** | Worker Resiliente | Docker, Health check, ECS Fargate, HPA, HMAC webhook | 99.9% uptime |
| **07** | Notificações | Email (SendGrid/SES) para aprovações, GRD, OCR falha | Sem polling |
| **08** | Planning Power-Up | Curva S/EV, MDR Import, Recursos, Relatórios auto, Baseline | `v1.1.0` |
| **09** | Client Portal | White-label, Markup v1, Assinatura digital, Workflow custom, PWA | `v1.2.0` |
| **10** | BIM/CAD | DWG/DXF Viewer (Forge), IFC Viewer, Visual Diff, Publicação BIM | `v1.3.0` |
| **11** | Compliance & Integration | ISO 19650, Webhooks públicos, Multi-region DR, AI Search, Self-service Admin | `v1.4.0` |
| **12** | Platform & Ecosystem | Plugin SDK, AI Copilot, Marketplace, Federação, Digital Twin | `v2.0+` |

---

## Fase Atual

**FASE 01 — Security Hardening**

Objetivo: Corrigir todos os blockers de segurança antes de implementar novas features comerciais.

### Próximos Passos Imediatos (Esta Semana)
1. **Rotacionar TODAS as credenciais expostas** (Neon DB password, AWS Access Keys, JWT Secret, Webhook Secret)
2. **Adicionar `.env.example` e remover `.env` do git**
3. **Configurar CORS restritivo** (origins: prod, staging, localhost)
4. **Adicionar `helmet` + CSP + HSTS**
5. **Implementar rate limiting** (`express-rate-limit` — global + stricter em `/auth`)
6. **Corrigir `GED_INTERNAL_WEBHOOK_URL`** para URL real de produção
7. **Configurar SQS DLQ** + Redrive Policy + CloudWatch Alarm
8. **Remover artefatos do repo:** `ged-worker-python/output/`, `teste-upload.html`, `GEMINI.TXT`

### Sprint 1 (Fundação Segura)
- Setup Vitest (backend) + Vitest/RTL (frontend) + Playwright (E2E)
- Testes para: auth, tenant isolation, approval gatekeepers, RBAC, webhook security
- Mover `contractId` para JWT claim OU validar membership ANTES de Prisma Extension
- Migrar JWT para RS256 + Refresh Token Rotation (15min access / 30d refresh)
- Implementar HMAC-SHA256 no webhook worker→API
- Validar S3 Key pattern no worker (`^contratos/[a-f0-9]{32}\.pdf$`)

---

## Próximo Objetivo

**Corrigir os blockers de segurança (FASE 01) antes de implementar novas features comerciais.**

Não alterar banco, autenticação, APIs, frontend ou infraestrutura além do necessário para o hardening de segurança. Foco exclusivo em: secrets rotation, auth hardening, tenant isolation fix, worker resilience, CI/CD setup, test infrastructure.

---

## Referências

- `AGENTS.md` — Regras permanentes de engenharia (este diretório)
- `docs/architecture/current-state.md` — Auditoria completa do estado atual
- `docs/architecture/target-state.md` — Arquitetura alvo detalhada
- `docs/architecture/security-model.md` — Modelo de segurança e vulnerabilidades
- `docs/architecture/domain-model.md` — Modelo de domínio e regras de negócio
- `docs/roadmap/product-roadmap.md` — Roadmap de produto 18 meses
- `docs/roadmap/technical-debt.md` — Dívida técnica priorizada (51 itens)
- `prisma/schema.prisma` — Schema do banco (fonte da verdade)