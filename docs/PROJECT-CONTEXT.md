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

### Atual (Monorepo Único)
- **Backend:** Node.js 20+ / Express 5.x / TypeScript strict / Prisma 7.8.0 (PostgreSQL Neon)
- **Auth:** JWT HS256 (1 dia) + bcrypt
- **Storage:** AWS S3 (presigned PUT URLs)
- **Queue:** AWS SQS (long polling 20s)
- **Worker:** Python 3.11+ / PyMuPDF (OCR + GRD ZIP/Capa)
- **Frontend:** React 18 + Vite + Tailwind v4
- **Estrutura:** `src/`, `ged-frontend/`, `ged-worker-python/`, `prisma/` no mesmo repo
- **Isolamento tenant:** Prisma Extension + AsyncLocalStorage e verificações de membership em rotas selecionadas; ainda sem RLS e sem fronteira Organization
- **Secrets:** `.env` ignorado no checkout atual; auditoria registra exposição histórica e rotação externa ainda precisa ser confirmada

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

### Bloqueadores antes de piloto/venda
1. **Possível exposição histórica de credenciais** — confirmar validade e rotação nos provedores e revisar forks/clones.
2. **Zero testes automatizados configurados** — esta rodada não implementou suíte; habilitar gates CI antes do piloto.
3. **Tenant SaaS ainda é `Contract`** — `contractId` vem do request, as verificações cobrem rotas selecionadas e não há RLS.
4. **Worker sem DLQ e webhooks sem HMAC/anti-replay completo** — hardening operacional necessário.
5. **Rate limiter em memória por processo** — store compartilhado obrigatório antes de múltiplas réplicas.
6. **Sem fluxo de redefinição de senha, observabilidade, restore demonstrado ou readiness operacional.**

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

### 🔴 Gates de Produção ainda abertos
| ID | Gate | Severidade |
|----|------|------------|
| SEC-001 | Confirmar/rotacionar credenciais e revisar histórico/forks externos | Crítico |
| SEC-002 | Sem suíte de testes/CI; cobertura de isolamento ainda não demonstrada | Crítico |
| SEC-003 | `Contract` ainda é tenant; sem Organization, RLS e autorização universal | Crítico |
| SEC-004 | Worker sem DLQ e webhooks sem HMAC/anti-replay completo | Alto |
| SEC-005 | Rate limiter em memória; sem store compartilhado para múltiplas réplicas | Alto |
| OPS-001 | Sem restore demonstrado, monitoramento e processo operacional de suporte | Alto |

### 🟡 Dívida Técnica Alta
- JWT HS256 24h sem refresh token
- Rate limiting local por processo (não compartilhado entre réplicas)
- CORS por allowlist configurável; origens de produção ainda devem ser definidas
- Helmet/CSP ativos; HSTS apenas em produção
- Prisma Extension incompleto (`findUnique` + `include` bypassa filtro)
- Validação de membership duplicada em 8+ services
- Transmittal webhook sem tenant check
- Frontend: Axios manual, sem React Query, tabela sem virtualização
- Worker: single process, sem health check, secret fraco

---

## Roadmap (Fases 01–14)

### Direção SaaS e etapa de comercialização (atualização 2026-10-14)

O plano para evoluir do piloto até venda recorrente está em [`roadmap/saas-readiness-plan.md`](roadmap/saas-readiness-plan.md). O desenho atual `Client > Project > Contract` não define a organização assinante do SaaS. Antes de dados reais de clientes, a arquitetura precisa representar `Organization (tenant assinante) > clientes externos > projetos > contratos` e validar acesso de forma server-side e no PostgreSQL.

Correção aplicada: login valida e-mail/senha e aceita apenas hashes bcrypt; o fallback que comparava senha diretamente com `senhaHash` foi removido. Esta fundação não torna o sistema pronto para piloto ou produção.

Compatibilidade de credenciais: o seed antigo armazenava senhas como texto, o que explica o `401` após a exigência de bcrypt. Cinco contas legadas foram convertidas para bcrypt preservando suas senhas; uma nova prévia encontrou zero contas pendentes. O comando `migrate:legacy-passwords` opera em prévia por padrão e só grava após opt-in; o seed passou a exigir `SEED_DEFAULT_PASSWORD` e gravar bcrypt.

Também aplicado: CORS por allowlist (`CORS_ORIGINS`, localhost em desenvolvimento), `VITE_API_URL`, Helmet/CSP, HSTS apenas em produção, limite JSON de 1 MB e rate limits geral e `/auth`. `/health` não consome a cota geral. O rate limit é local por processo; store compartilhado é obrigatório antes de escalar réplicas.

Etapa 2.1: URLs pré-assinadas exigem membership e papel de escrita no contrato ou documento; detalhes/revisões usam middleware que resolve o contrato pai; documentos recusam disciplina/pacote de outro contrato; exclusão de apontamento requer membership vigente. Webhooks internos exigem segredo configurado e comparação em tempo constante; callback de OCR valida que revisão e documento correspondem. O worker não imprime mais o segredo em logs.

Autorização: rotas com `contractId` explícito em dashboard, listagem de aprovações, planejamento, auditoria, gestão, GRD e exportação MDR agora passam por `requireContractMembership` antes do controller. Rotas por IDs de recursos filhos continuam precisando validar o contrato do recurso pai; RLS permanece pendente.

Nota de estado: a auditoria de 2026-09-24 registra exposição de `.env`. Em 2026-10-13, `.env` está ignorado e não foi encontrado nas refs/objetos Git alcançáveis deste checkout. Isso não verifica forks, clones antigos ou validade/revogação das credenciais; revisar os provedores continua necessário. A fronteira SaaS foi registrada em [ADR-009](architecture/ADR-009-organizacao-assinante.md): `Organization` assinante contém clientes externos, projetos e contratos; a migração requer mapa de propriedade revisado.

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

### Fundação aplicada na Etapa 1
1. Login apenas com bcrypt, migração legada em modo prévia por padrão e seed seguro.
2. `.env.example`, CORS allowlist, `VITE_API_URL`, Helmet/CSP, HSTS em produção e JSON limitado a 1 MB.
3. Rate limit geral e mais restrito em `/auth`; `TRUST_PROXY_HOPS` configurável para a topologia real.
4. Membership centralizada em rotas selecionadas e documentação de arquitetura, riscos e gates.

### Gates antes de piloto/venda
1. Confirmar e rotacionar credenciais nos provedores; revisar forks, clones e histórico externo.
2. Implementar redefinição de senha após escolher/configurar provedor de e-mail.
3. Aprovar matriz de acesso, revisar endpoints de recursos filhos e mapear `Client` legado para `Organization` com o proprietário dos dados.
4. Implementar Organization + RLS, DLQ e HMAC para workers/webhooks; configurar store compartilhado de rate limit antes de múltiplas réplicas.
5. Adicionar testes/CI, monitoramento e restore exercitado, além de suporte, privacidade e cobrança antes de venda.

### Sprint 1 (Fundação Segura)
- Setup Vitest (backend) + Vitest/RTL (frontend) + Playwright (E2E)
- Testes para: auth, tenant isolation, approval gatekeepers, RBAC, webhook security
- Mover `contractId` para JWT claim OU validar membership ANTES de Prisma Extension
- Migrar JWT para RS256 + Refresh Token Rotation (15min access / 30d refresh)
- Implementar HMAC-SHA256 no webhook worker→API
- Validar S3 Key pattern no worker (`^contratos/[a-f0-9]{32}\.pdf$`)

---

## Próximo Objetivo

Concluir a Etapa 2.1 com verificação manual e avançar para Organization/reconciliação (Etapa 2.2) após aprovação do mapa de propriedade legado. A Etapa 2.1 ainda não fornece RLS e não libera piloto com dados reais nem venda.

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
