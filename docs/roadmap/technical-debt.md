# GED Engenharia — Dívida Técnica (Technical Debt)

**Versão:** 1.0 (Baseado em Auditoria 2026-09-24)  
**Classificação:** INTERNO — Priorização para Sprint Planning

---

## 1. Resumo da Dívida Técnica

| Categoria | Itens Críticos | Itens Altos | Itens Médios | Itens Baixos | Total |
|-----------|----------------|-------------|--------------|--------------|-------|
| **Segurança** | 3 | 4 | 2 | 1 | 10 |
| **Arquitetura** | 1 | 3 | 4 | 2 | 10 |
| **Qualidade de Código** | 0 | 2 | 5 | 3 | 10 |
| **Testes** | 1 | 0 | 0 | 0 | 1 |
| **Observabilidade** | 0 | 2 | 1 | 0 | 3 |
| **DevOps/Infra** | 1 | 2 | 2 | 1 | 6 |
| **Frontend** | 0 | 2 | 3 | 2 | 7 |
| **Worker Python** | 1 | 2 | 1 | 0 | 4 |
| **TOTAL** | **7** | **17** | **18** | **9** | **51** |

---

## 2. Dívida Crítica (Bloqueadores de Produção)

| ID | Título | Descrição | Esforço | Owner |
|----|--------|-----------|---------|-------|
| **SEC-001** | **Credenciais expostas no git** | 7 secrets no `.env` committado (DB, AWS, JWT, Webhook) | 2h | Tech Lead |
| **SEC-002** | **Zero testes automatizados** | `npm test` falha propositalmente; 0% cobertura | 2 sprints | Team |
| **SEC-003** | **Tenant ID controlado pelo cliente** | `contractId` vem de query/body, não do JWT claim | 1 sprint | Backend |
| **SEC-004** | **Worker Python sem DLQ** | Mensagens envenenadas travam fila OCR/GRD | 1 dia | DevOps |
| **SEC-005** | **Webhook URL localhost em produção** | `GED_INTERNAL_WEBHOOK_URL` aponta para localhost | 30 min | DevOps |
| **ARCH-001** | **Monolito único sem boundaries** | API, Worker, Frontend no mesmo repo, deploy acoplado | 2 sprints | Arquitetura |
| **DEVOPS-001** | **Deploy manual** | Sem CI/CD; build/run manual em servidor | 1 sprint | DevOps |

---

## 3. Dívida Alta (Impacto Significativo)

| ID | Título | Descrição | Esforço | Owner |
|----|--------|-----------|---------|-------|
| **SEC-006** | **JWT HS256 + 24h sem refresh** | Chave simétrica, token longo, sem rotação | 1 sprint | Backend |
| **SEC-007** | **Sem rate limiting** | Brute force login, DoS em endpoints | 4h | Backend |
| **SEC-008** | **CORS aberto (`*`)** | Qualquer origem pode chamar API com credenciais | 30 min | Backend |
| **SEC-009** | **Sem security headers (helmet)** | CSP, HSTS, X-Frame-Options ausentes | 2h | Backend |
| **ARCH-002** | **Prisma Extension tenant isolation incompleto** | `findUnique` + `include` bypassa filtro; raw queries não cobertas | 1 sprint | Backend |
| **ARCH-003** | **Validação de membership duplicada** | 8+ services repetem `ContractMembership.findUnique` | 3 dias | Backend |
| **ARCH-004** | **Transmittal webhook sem tenant check** | Worker pode atualizar qualquer transmittal | 2h | Backend |
| **ARCH-005** | **Hardcoded strings em enums/status** | Magic strings espalhadas (ex: `'APROVADO'` vs enum) | 2 dias | Backend |
| **CODE-001** | **`exactOptionalPropertyTypes` força `null` verboso** | `parsed.workPackageId ?? null` em todo create | 1 dia | Backend |
| **CODE-002** | **Error handling inconsistente** | `try/catch` repetido, códigos de erro customizados (`error.code`) | 3 dias | Backend |
| **OBS-001** | **Sem structured logging** | `console.log`/`console.error` — sem correlation ID, níveis | 1 sprint | Backend |
| **OBS-002** | **Health check superficial** | `/health` só retorna OK — não verifica DB/S3/SQS | 4h | Backend |
| **FE-001** | **Axios manual sem cache/invalidação** | Sem React Query — refetch manual, loading states inconsistentes | 1 sprint | Frontend |
| **FE-002** | **Tabela DocumentList sem virtualização** | Trava com 1000+ docs — sem TanStack Table | 1 sprint | Frontend |
| **WORKER-001** | **Single process, sem health check** | SPOF — falha = OCR/GRD para | 1 sprint | DevOps |
| **WORKER-002** | **Webhook secret fraco + sem HMAC** | `x-internal-secret` estático, sem timestamp/nonce | 4h | Backend |
| **WORKER-003** | **S3 Key validation ausente** | Path traversal teórico via `filePath` malicioso | 2h | Backend |

---

## 4. Dívida Média (Manutenibilidade/Escalabilidade)

| ID | Título | Descrição | Esforço | Owner |
|----|--------|-----------|---------|-------|
| **SEC-010** | **Webhook secret sem rotação** | `GED_INTERNAL_SECRET` fixo, sem expiração | 4h | Backend |
| **SEC-011** | **Senhas em texto plano no seed** | `senhaHash: 'hash'` e `TEMP_PASSWORD_` | 2h | Backend |
| **ARCH-006** | **Client/Project globais sem tenant** | Enumeração possível cross-tenant | 2 dias | Backend |
| **ARCH-007** | **DocumentLink sem contractId direto** | Isolamento herdado — validação manual necessária | 1 dia | Backend |
| **ARCH-008** | **TimeLog validação repetida** | `requireDocumentAccess` duplicado em services | 1 dia | Backend |
| **ARCH-009** | **Soft delete inexistente** | Hard delete em todas entities — perda irreversível | 1 sprint | Backend |
| **ARCH-010** | **Versionamento de metadados Doc ausente** | `codigoDocumento`/`titulo` mutáveis sem histórico | 2 dias | Backend |
| **CODE-003** | **Controllers gordos** | Lógica de negócio misturada com HTTP (ex: `document.controller.ts` 730 linhas) | 1 sprint | Backend |
| **CODE-004** | **Zod schemas duplicados** | `contractId` validado em múltiplos schemas | 2 dias | Backend |
| **CODE-005** | **TypeScript `any` em catch blocks** | `error: any` — perde type safety | 1 dia | Backend |
| **CODE-006** | **Magic numbers/strings** | `expiresIn: '1d'`, `900` (15min), `2000` (comment max) | 1 dia | Backend |
| **CODE-007** | **Import paths relativos profundos** | `../../../prisma`, `../../middlewares` — frágil a refatoração | 2 dias | Backend |
| **CODE-008** | **Middleware `upload.ts` legacy** | Multer memory storage — só usado em `internalUpdateRevision` | 2h | Backend |
| **CODE-009** | **`AuthRequest` interface duplicada** | Definida em `auth.middleware.ts`, importada em controllers | 1h | Backend |
| **OBS-003** | **Sem métricas de negócio** | KPIs só no dashboard — não expostos para Prometheus | 2 dias | Backend |
| **DEVOPS-002** | **Worker Python não containerizado** | Deploy manual, dependências globais | 1 sprint | DevOps |
| **DEVOPS-003** | **Variáveis de ambiente inconsistentes** | `.env` raiz + worker lê `../.env` — frágil | 4h | DevOps |
| **DEVOPS-004** | **Sem backup/DR testado** | Neon tem PITR mas não validado | 1 dia | DevOps |
| **FE-003** | **Estado global em Context API** | `AuthContext`, `ContractContext` — re-renders desnecessários | 3 dias | Frontend |
| **FE-004** | **Componentes grandes não testáveis** | `DocumentDetail.tsx` 48k, `DocumentList.tsx` 22k linhas | 1 sprint | Frontend |
| **FE-005** | **CSS classes hardcoded (Tailwind)** | Design system inconsistente — sem tokens centralizados | 1 sprint | Frontend |
| **FE-006** | **Hooks de negócio misturados com UI** | `useDocumentsQuery` faz fetch + formatação | 3 dias | Frontend |
| **WORKER-004** | **PyMuPDF sem sandbox** | Parser PDF exposto a malicious PDFs | 2 dias | DevOps |

---

## 5. Dívida Baixa (Qualidade/Cosmética)

| ID | Título | Descrição | Esforço | Owner |
|----|--------|-----------|---------|-------|
| **SEC-012** | **Prisma query logging em prod** | Pode vazar queries sensíveis | 1h | Backend |
| **ARCH-011** | **`project.routes.ts` subutilizado** | Apenas 2 rotas — considerar merge em `projects` module | 2h | Backend |
| **ARCH-012** | **`Discipline` enum legado** | Removido do schema mas pode ter referências | 1h | Backend |
| **CODE-010** | **Comentários excessivos em controllers** | Explicam "o que" não "por que" — verboso | 2 dias | Backend |
| **CODE-011** | **`AuditService.log` fire-and-forget** | Erro silencioso — sem retry/monitoring | 4h | Backend |
| **CODE-012** | **`approvalActionSchema` permite `comments` opcional** | Mas controller valida obrigatório — duplicação | 1h | Backend |
| **CODE-013** | **`STAGE_LABEL` objeto no controller** | Deveria ser enum helper ou i18n | 1h | Backend |
| **DEVOPS-005** | **Artefatos no repo** | `ged-worker-python/output/`, `teste-upload.html`, `GEMINI.TXT` | 30 min | Team |
| **FE-007** | **`hero.png`, `react.svg`, `vite.svg` unused** | Assets padrão Vite não removidos | 15 min | Frontend |
| **FE-008** | **`index.css` quase vazio** | Tailwind v4 usa `@import "tailwindcss"` — arquivo desnecessário | 15 min | Frontend |

---

## 6. Análise de Causa Raiz (Top 5)

| Dívida | Causa Raiz | Prevenção |
|--------|------------|-----------|
| **Credenciais no git** | `.env` não no `.gitignore` inicial; falta de secret scanning no CI | `git-secrets` / `truffleHog` no pre-commit + CI |
| **Zero testes** | Cultura "move fast" sem definição de Done; falta de infra de teste | Definir "Definition of Done" com testes; setup Vitest/Playwright dia 1 |
| **Tenant inseguro** | Prototipagem rápida — `contractId` no request era "suficiente" | Threat modeling na arquitetura; ADR para isolamento |
| **Monolito acoplado** | Início como MVP único; não previsto multi-repo | Monorepo com Turbo/Nx desde início; boundaries claros |
| **Worker frágil** | Script Python "temporário" virou produção | Tratar workers como services desde v1; containerizar |

---

## 7. Priorização por Valor × Esforço (ICE Score)

| ID | Impacto (1-10) | Confiança (1-10) | Facilidade (1-10) | ICE | Prioridade |
|----|----------------|------------------|-------------------|-----|------------|
| SEC-001 | 10 | 10 | 10 | **1000** | P0 - Hoje |
| SEC-002 | 10 | 10 | 3 | **300** | P0 - Sprint 1 |
| SEC-003 | 9 | 10 | 5 | **450** | P0 - Sprint 1 |
| SEC-004 | 8 | 10 | 8 | **640** | P0 - Sprint 1 |
| SEC-005 | 7 | 10 | 10 | **700** | P0 - Hoje |
| ARCH-001 | 9 | 8 | 2 | **144** | P1 - Sprint 2-3 |
| SEC-006 | 8 | 9 | 5 | **360** | P1 - Sprint 1 |
| SEC-007 | 7 | 10 | 9 | **630** | P1 - Sprint 1 |
| SEC-008 | 6 | 10 | 10 | **600** | P1 - Sprint 1 |
| SEC-009 | 6 | 10 | 9 | **540** | P1 - Sprint 1 |
| ARCH-002 | 8 | 9 | 4 | **288** | P1 - Sprint 2 |
| CODE-001 | 4 | 10 | 8 | **320** | P2 - Sprint 2 |
| FE-001 | 7 | 9 | 4 | **252** | P2 - Sprint 2 |
| FE-002 | 7 | 9 | 4 | **252** | P2 - Sprint 2 |
| WORKER-001 | 8 | 8 | 4 | **256** | P2 - Sprint 2 |
| OBS-001 | 6 | 8 | 5 | **240** | P2 - Sprint 2 |
| ... | ... | ... | ... | ... | ... |

---

## 8. Plano de Pagamento da Dívida (Sprint by Sprint)

### Sprint 0 (Esta Semana) — **Emergência**
- [ ] SEC-001: Rotacionar TODAS as credenciais expostas
- [ ] SEC-005: Corrigir `GED_INTERNAL_WEBHOOK_URL` para URL real
- [ ] DEVOPS-005: Remover artefatos do repo (`output/`, `teste-upload.html`, `GEMINI.TXT`)
- [ ] SEC-008: Configurar CORS restritivo
- [ ] SEC-009: Adicionar `helmet` + CSP básico

### Sprint 1 — **Fundação Segura**
- [ ] SEC-002: Setup Vitest (backend) + Vitest/RTL (frontend) + Playwright (E2E)
- [ ] SEC-002: Escrever testes para `auth`, `tenant isolation`, `approval gatekeepers`
- [ ] SEC-003: Mover `contractId` para JWT claim OU validar membership ANTES de Prisma Extension
- [ ] SEC-004: Configurar SQS DLQ + Redrive Policy + CloudWatch Alarm
- [ ] SEC-006: Migrar JWT para RS256 + Refresh Token Rotation (15min access / 30d refresh)
- [ ] SEC-007: Implementar rate limiting (`express-rate-limit`)
- [ ] WORKER-002: Implementar HMAC-SHA256 no webhook worker→API
- [ ] WORKER-003: Validar S3 Key pattern no worker

### Sprint 2 — **Arquitetura Limpa**
- [ ] ARCH-002: Migrar Prisma Extension → PostgreSQL RLS (com migração + testes)
- [ ] ARCH-003: Centralizar `requireMembership` em middleware/service base
- [ ] ARCH-004: Adicionar tenant validation no `Transmittal.webhookComplete`
- [ ] CODE-001: Remover `exactOptionalPropertyTypes` OU criar helper `optionalNull`
- [ ] CODE-002: Criar `ApiError` classes + error handler middleware global
- [ ] FE-001: Instalar `@tanstack/react-query` + migrar `document.service.ts` hooks
- [ ] FE-002: Instalar `@tanstack/react-table` + virtualização no `DocumentList`
- [ ] OBS-001: Implementar `pino` logger + correlation ID middleware
- [ ] OBS-002: Health check profundo (`/health` verifica Prisma, S3, SQS)

### Sprint 3 — **Qualidade e Observabilidade**
- [ ] ARCH-005: Substituir magic strings por enums/constants centralizados
- [ ] ARCH-009: Implementar Soft Delete (`deletedAt` + partial unique indexes)
- [ ] ARCH-010: Versionar metadados Document (`history` JSONB)
- [ ] CODE-003: Extrair lógica de `document.controller.ts` para `DocumentService` (já parcial)
- [ ] CODE-007: Configurar `paths` no `tsconfig.json` (`@/modules/*`, `@/services/*`)
- [ ] CODE-008: Remover `upload.ts` ou migrar `internalUpdateRevision` para presigned URL
- [ ] FE-003: Migrar Context API → Zustand/React Query para estado global
- [ ] FE-004: Quebrar `DocumentDetail` em componentes menores + Storybook
- [ ] WORKER-001: Containerizar worker + Health Check + Deploy ECS Fargate
- [ ] WORKER-004: Adicionar sandbox (gVisor) ou validar PDF com `pdfcpu` antes de PyMuPDF

### Sprint 4 — **Hardening**
- [ ] ARCH-006: Adicionar RLS em `Client`/`Project` ou remover exposição cross-tenant
- [ ] ARCH-007: Adicionar `contractId` em `DocumentLink` (denormalizado)
- [ ] ARCH-008: Unificar `requireDocumentAccess` em `BaseService`
- [ ] SEC-010: Rotação automática `GED_INTERNAL_SECRET` (Secrets Manager + Lambda)
- [ ] SEC-011: Seed com bcrypt real + remover `TEMP_PASSWORD_`
- [ ] DEVOPS-002: Worker Python containerizado em produção
- [ ] DEVOPS-003: Unificar `.env` → Secrets Manager + Parameter Store
- [ ] DEVOPS-004: Testar restore de backup Neon (PITR)
- [ ] FE-005: Criar Design System tokens (cores, spacing, typography) + Storybook
- [ ] FE-006: Separar `useDocumentsQuery` em `useDocuments` (fetch) + `useDocumentFilters` (UI)

### Sprint 5+ — **Modernização Contínua**
- [ ] ARCH-001: Split monorepo → `ged-api`, `ged-worker-*`, `ged-frontend`, `ged-infra`, `ged-shared`
- [ ] CODE-004: Consolidar Zod schemas em `ged-shared` package
- [ ] CODE-005: Eliminar `any` — strict mode total
- [ ] CODE-006: Centralizar constants em `ged-shared/constants`
- [ ] CODE-009: Mover `AuthRequest` para `@/types/express`
- [ ] CODE-010: Limpar comentários "o que" — manter apenas "por que" complexo
- [ ] CODE-011: `AuditService.log` com retry + dead letter + monitoring
- [ ] CODE-012: Alinhar schema + controller validation (DRY)
- [ ] CODE-013: `ApprovalStage` label via i18n ou enum helper
- [ ] FE-007/008: Limpar assets e CSS não usados

---

## 9. Métricas de Acompanhamento

| Métrica | Atual | Alvo Sprint 4 | Alvo Sprint 8 |
|---------|-------|---------------|---------------|
| **Cobertura de Testes** | 0% | 60% | 85% |
| **Tempo de Build CI** | N/A | < 10 min | < 7 min |
| **Deploy Frequency** | Manual | 1/sprint | 1/day |
| **MTTR (Mean Time to Recovery)** | Horas | < 30 min | < 10 min |
| **Change Failure Rate** | Desconhecido | < 15% | < 5% |
| **Critical Vulnerabilities** | 7 | 0 | 0 |
| **High Vulnerabilities** | 17 | < 3 | 0 |
| **Code Duplication (SonarQube)** | ~15% | < 5% | < 3% |
| **Technical Debt Ratio** | ~40% | < 10% | < 5% |

---

## 10. Decisões de "Não Fazer" (Won't Fix)

| ID | Item | Justificativa |
|----|------|---------------|
| WF-001 | Migrar para NestJS/Fastify | Express 5 atende; custo de migração > benefício |
| WF-002 | Adicionar GraphQL | REST + OpenAPI codegen atende; complexidade desnecessária |
| WF-003 | Micro-frontends | Frontend coeso; módulos feature-based já isolados |
| WF-004 | Event Sourcing completo | AuditLog atende; complexidade só justifica se temporal queries necessárias |
| WF-005 | Kubernetes (EKS/GKE) | ECS Fargate serverless atende; k8s adiciona ops overhead |

---

## 11. Arquivo Morto / Para Remoção

| Caminho | Motivo | Ação |
|---------|--------|------|
| `ged-worker-python/output/` | Artefatos de build/teste | `git rm -r --cached` + adicionar no `.gitignore` |
| `teste-upload.html` | Teste manual antigo | `git rm` |
| `GEMINI.TXT` | Notas de IA | `git rm` |
| `src/middlewares/upload.ts` | Legacy — só usado em 1 rota | Migrar `internalUpdateRevision` para presigned URL + remover |
| `prisma.config.ts` | Não usado (dotenv no `prisma.ts`) | Verificar se Prisma CLI precisa; senão remover |
| `arquitetura.md` | Substituído por `docs/architecture/` | Manter como histórico ou arquivar |

---

## 12. Definição de "Pronto" (Definition of Done) — Atualizada

Para **cada PR**, obrigatório:

- [ ] **Lint passa:** `npm run lint` (ESLint + Prettier)
- [ ] **Typecheck passa:** `npm run typecheck` (`tsc --noEmit`)
- [ ] **Testes passam:** `npm run test` (unit + integration)
- [ ] **Cobertura ≥ 80%** nos arquivos alterados
- [ ] **Security scan:** `npm audit` + `trivy` (CI) sem critical/high
- [ ] **Documentação:** README/ADR atualizado se arquitetura mudar
- [ ] **Changelog:** Entrada em `CHANGELOG.md` (Conventional Commits)
- [ ] **Code Review:** 2 aprovações (1 senior + 1 domain expert)
- [ ] **Deploy Preview:** Funcionando em staging (se frontend/API)

---

> **Nota:** Esta lista é viva. Atualizar a cada Sprint Review e Retrospective.  
> **Próxima Revisão:** Sprint 1 Planning