# GED Engenharia — Arquitetura Alvo (Target State)

**Versão:** 2.0 (Pós-Auditoria)  
**Data:** 2026-09-24  
**Status:** Proposta — Pendente Aprovação

---

## 1. Princípios Arquiteturais

| Princípio | Descrição |
|-----------|-----------|
| **Security First** | Zero-trust network, secrets management, RLS no DB, audit trail imutável |
| **Tenant Isolation Garantido** | Row-Level Security (PostgreSQL) + JWT claims — impossível vazar dados entre contratos |
| **Event-Driven Core** | Domain events para desacoplamento (DocumentCreated, RevisionApproved, GRDEmitted, OCRCompleted) |
| **Observability by Default** | OpenTelemetry tracing, structured logs, metrics, alerting desde o dia 1 |
| **Deploy Automation** | GitOps / CI/CD — main → staging → prod com gates automatizados |
| **Stateless Services** | API horizontalmente escalável, sessão em JWT, cache em Redis |
| **Contract-First APIs** | OpenAPI 3.1 spec → codegen (TypeScript/Zod) — frontend/backend sincronizados |
| **Graceful Degradation** | Worker offline → fila acumula; S3 indisponível → upload falha com retry; DB readonly → cache serve reads |

---

## 2. Topologia de Deploy Alvo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AWS / Cloud Provider                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   CloudFront │    │   WAF /      │    │  API Gateway │    │  Auth    │  │
│  │   (CDN)      │◄───│   Shield     │◄───│  (REST/WS)   │◄───│  Service │  │
│  └──────┬───────┘    └──────────────┘    └──────┬───────┘    └──────────┘  │
│         │                                       │                            │
│         ▼                                       ▼                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        VPC Private Subnets                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │  ged-api    │  │  ged-api    │  │  ged-api    │  │  ged-api   │  │   │
│  │  │  (ECS/Farg  │  │  (ECS/Farg  │  │  (ECS/Farg  │  │  (ECS/Farg │  │   │
│  │  │   x3 min)   │  │   x3 min)   │  │   x3 min)   │  │   x3 min)  │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │   │
│  │         │                │                │                │          │   │
│  │         └────────────────┼────────────────┼────────────────┘          │   │
│  │                          ▼                ▼                           │   │
│  │                 ┌─────────────────┐ ┌─────────────┐                  │   │
│  │                 │  Aurora PG      │ │  ElastiCache│                  │   │
│  │                 │  (RLS Enabled)  │ │  Redis      │                  │   │
│  │                 └────────┬────────┘ └──────┬──────┘                  │   │
│  │                          │                │                           │   │
│  │         ┌────────────────┼────────────────┼────────────────┐         │   │
│  │         ▼                ▼                ▼                ▼         │   │
│  │  ┌───────────┐   ┌─────────────┐ ┌──────────┐ ┌──────────────┐     │   │
│  │  │ ged-worker│   │ ged-worker  │ │ ged-work │ │ ged-scheduler│     │   │
│  │  │ -ocr      │   │ -transmittal│ │ -webhook │ │ (cron jobs)  │     │   │
│  │  │ (Fargate) │   │ (Fargate)   │ │ (Fargate)│ │ (EventBridge)│     │   │
│  │  └───────────┘   └─────────────┘ └──────────┘ └──────────────┘     │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   S3        │  │   SQS       │  │   SNS/      │  │   Secrets       │   │
│  │   (Versioned)    │   (DLQ)     │  │   EventBridge│  │   Manager       │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Repositórios (Monorepo com Turbo/Nx ou Multi-Repo)

| Repo | Responsabilidade | Deploy |
|------|------------------|--------|
| `ged-api` | Backend Express + Prisma + OpenAPI spec | ECS Fargate Service |
| `ged-worker-ocr` | PyMuPDF OCR consumer | ECS Fargate Task (SQS trigger) |
| `ged-worker-transmittal` | GRD ZIP/Capa generator | ECS Fargate Task (SQS trigger) |
| `ged-worker-webhook` | Webhook delivery + retry | ECS Fargate Task (EventBridge) |
| `ged-scheduler` | Cron jobs (cleanup, relatórios) | EventBridge + Lambda |
| `ged-frontend` | React + Vite + React Query | CloudFront + S3 (static) |
| `ged-infra` | Terraform/CDK — toda infra como código | Pipeline dedicado |
| `ged-shared` | Types, Zod schemas, OpenAPI client (npm package) | Publicado no GitHub Packages |

---

## 3. Modelo de Segurança Alvo

### 3.1 Autenticação (Auth Service Próprio ou Cognito/Auth0)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────►│  Auth API   │────►│  Token      │
│   (React)   │     │  /login     │     │  Service    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                    ┌───────────────────────────┘
                    ▼
         ┌─────────────────────┐
         │  JWT Access Token   │  (15 min, RS256)
         │  {                   │
         │    sub: "user:123",  │
         │    roles: ["GESTOR"],│
         │    contracts: [      │
         │      {id: 45, role:  │
         │       "GESTOR"}      │
         │    ],                │
         │    permissions: [...]│
         │  }                   │
         └─────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Refresh Token      │  (30d, HttpOnly Cookie, Rotating)
         │  (Stored in DB      │
         │   hashed, revocable)│
         └─────────────────────┘
```

### 3.2 Autorização — JWT Claims + RLS

```sql
-- PostgreSQL Row Level Security (exemplo)
ALTER TABLE "Contract" ENABLE ROW LEVEL SECURITY;
CREATE POLICY contract_tenant_isolation ON "Contract"
  USING (id = current_setting('app.current_contract_id')::int);

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_tenant_isolation ON "Document"
  USING ("contractId" = current_setting('app.current_contract_id')::int);

-- Aplicado via Prisma middleware no SET LOCAL app.current_contract_id = $1
```

**Vantagem:** Isolamento **no banco**, não no código — impossível burlar via bug de service.

### 3.3 Secrets Management

| Secret | Onde | Rotação |
|--------|------|---------|
| `DATABASE_URL` | AWS Secrets Manager | 90 dias (auto) |
| `JWT_PRIVATE_KEY` | AWS Secrets Manager | 90 dias (auto) |
| `AWS_ACCESS_KEY_ID` | IAM Roles for Service Accounts (IRSA) | N/A (role-based) |
| `S3_BUCKET` | Parameter Store | N/A |
| `SQS_QUEUE_URL` | Parameter Store | N/A |
| `WEBHOOK_SECRET` | Secrets Manager | 30 dias (manual) |
| `GED_INTERNAL_SECRET` | Secrets Manager | 30 dias (manual) |

**Nenhum secret em `.env`, `.env.example`, código, ou CI logs.**

---

## 4. Data Layer — PostgreSQL com RLS

### 4.1 Schema Evolution (Migrações Planejadas)

| Migration | Descrição | Impacto |
|-----------|-----------|---------|
| `202609_rls_enable` | Habilita RLS em todas as tabelas tenant-scoped | Requer `SET LOCAL` no Prisma middleware |
| `202609_soft_delete` | Adiciona `deletedAt` + partial unique indexes | Soft delete em todas entities |
| `202609_audit_partition` | Particiona `AuditLog` por mês (`createdAt`) | Performance em auditoria massiva |
| `202609_refresh_tokens` | Tabela `RefreshToken` (hashed, revocable) | Refresh token rotation |
| `202609_idempotency_keys` | Tabela `IdempotencyKey` (POST /documents/upload) | Uploads idempotentes |
| `202609_document_versioning` | `Document.history` JSONB (mudanças de metadados) | Auditoria de metadados |

### 4.2 Índices Críticos (Faltando Atualmente)

```prisma
model Document {
  @@index([contractId, contractDisciplineId])
  @@index([contractId, workPackageId])
  @@index([contractId, ocrStatus])
  @@index([contractId, createdAt])
}

model Revision {
  @@index([documentId, status])
  @@index([documentId, createdAt])
}

model ApprovalWorkflow {
  @@index([revisionId, stage, status])
  @@index([reviewerId, status])
}

model Transmittal {
  @@index([contractId, status])
  @@index([contractId, createdAt])
}

model TimeLog {
  @@index([userId, data])
  @@index([workPackageId, data])
}

model AuditLog {
  @@index([contractId, createdAt])
  @@index([entity, entityId])
}
```

---

## 5. API Layer — Contract-First

### 5.1 OpenAPI 3.1 Specification

```yaml
# packages/ged-shared/openapi.yaml
openapi: 3.1.0
info:
  title: GED Engenharia API
  version: 2.0.0
servers:
  - url: https://api.ged-engenharia.com/v1
paths:
  /documents:
    post:
      operationId: createDocument
      security: [{ BearerAuth: [] }]
      parameters:
        - $ref: '#/components/parameters/ContractIdHeader'
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateDocumentRequest'
      responses:
        '201':
          description: Document created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DocumentResponse'
        '403':
          $ref: '#/components/responses/Forbidden'
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  parameters:
    ContractIdHeader:
      name: X-Contract-Id
      in: header
      required: true
      schema:
        type: integer
```

### 5.2 Codegen Pipeline

```json
// package.json (ged-shared)
{
  "scripts": {
    "generate:api": "openapi-typescript openapi.yaml -o src/api.ts && orval --config orval.config.js"
  }
}
```

- **Backend:** Gera Zod schemas + route handlers tipados
- **Frontend:** Gera React Query hooks + Axios client tipado
- **Contrato único** — impossível drift entre FE/BE

### 5.3 Headers Obrigatórios

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `Authorization` | Sim | `Bearer <access_token>` |
| `X-Contract-Id` | Sim (exceto `/auth/*`, `/projects`) | Tenant context — validado vs JWT claims |
| `Idempotency-Key` | Para POST mutantes | Chave única para retry seguro |
| `X-Request-Id` | Auto | Correlation ID para tracing |

---

## 6. Event-Driven Architecture

### 6.1 Domain Events

| Event | Publisher | Consumers | Payload |
|-------|-----------|-----------|---------|
| `DocumentCreated` | `ged-api` | `ged-worker-ocr`, `ged-notifications` | `{ documentId, contractId, fileKey }` |
| `RevisionUploaded` | `ged-api` | `ged-worker-ocr`, `ged-worker-transmittal` | `{ revisionId, documentId, fileKey, versionLabel }` |
| `RevisionApproved` | `ged-api` | `ged-notifications`, `ged-worker-transmittal` | `{ revisionId, stage, approverId }` |
| `GRDEmitted` | `ged-api` | `ged-worker-transmittal`, `ged-notifications` | `{ transmittalId, contractId, revisionIds }` |
| `OCRCompleted` | `ged-worker-ocr` | `ged-api` (webhook), `ged-search` | `{ revisionId, extractedText, status }` |
| `TimeLogCreated` | `ged-api` | `ged-scheduler` (relatórios) | `{ timeLogId, userId, hours, date }` |

### 6.2 Event Bus — AWS EventBridge

```typescript
// ged-api/src/events/publisher.ts
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

export async function publishEvent<T>(detailType: string, detail: T): Promise<void> {
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: "ged.engenharia",
      DetailType: detailType,
      Detail: JSON.stringify(detail),
      EventBusName: "ged-events"
    }]
  }));
}
```

### 6.3 Dead Letter Queues (Obrigatório)

```
SQS Queue (ged-ocr) ──► DLQ (ged-ocr-dlq) ──► Alarm (CloudWatch) ──► PagerDuty/Slack
     │                        │
     │ MaxReceiveCount: 3     │ Retention: 14 dias
     ▼                        ▼
Worker OCR              Manual replay / investigation
```

---

## 7. Worker Services — Containerizados e Resilientes

### 7.1 ged-worker-ocr

```dockerfile
# Dockerfile.ocr
FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir boto3 pymupdf python-dotenv requests
COPY worker.py .
CMD ["python", "worker.py"]
```

**Health Check:** `GET /health` → verifica SQS connectivity + S3 access + DB webhook reachable

**Scaling:** HPA baseado em `ApproximateNumberOfMessagesVisible` (target: 10 msg/worker)

### 7.2 ged-worker-transmittal

- Gera ZIP + PDF Capa (reportlab / weasyprint)
- Upload para S3 → `Transmittal.zipUrl`, `pdfCapaUrl`
- Publica `GRDEmitted` event

### 7.3 ged-worker-webhook

- Consome `WebhookDelivery` events
- Retry exponencial (max 5x, 24h)
- DLQ após falha final
- Assina payload com HMAC-SHA256

---

## 8. Frontend — React Query + TanStack

### 8.1 Stack Atualizado

| Ferramenta | Substitui | Benefício |
|------------|-----------|-----------|
| `@tanstack/react-query` | Axios manual + useEffect | Cache, dedup, background refetch, optimistic updates |
| `@tanstack/react-table` | Table HTML manual | Virtualização 10k+ rows, sorting, filtering, column resize |
| `react-hook-form` + `zod` | Formulários manuais | Validação unificada FE/BE, performance |
| `@radix-ui/*` + `tailwindcss` | CSS customizado | Acessibilidade, consistência, velocidade |
| `msw` (Mock Service Worker) | Testes E2E reais | Testes isolados, CI confiável |

### 8.2 Query Invalidation Strategy

```typescript
// ged-frontend/src/hooks/useInvalidate.ts
export const queryKeys = {
  documents: (contractId: number) => ['documents', contractId],
  document: (id: number) => ['document', id],
  approvals: (contractId: number) => ['approvals', contractId],
  transmittals: (contractId: number) => ['transmittals', contractId],
  auditLogs: (contractId: number) => ['auditLogs', contractId],
};

// Após mutation:
mutation.onSuccess(() => {
  queryClient.invalidateQueries({ queryKey: queryKeys.documents(contractId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(contractId) });
});
```

---

## 9. Observabilidade

### 9.1 Three Pillars

| Pilar | Ferramenta | Implementação |
|-------|------------|---------------|
| **Logs** | Loki + Promtail | Structured JSON (pino) + labels: `service`, `contract_id`, `user_id`, `trace_id` |
| **Metrics** | Prometheus + Grafana | RED metrics (Rate, Errors, Duration) por endpoint + business KPIs |
| **Traces** | Tempo (Grafana) / Jaeger | OpenTelemetry SDK (Node/Python) — W3C traceparent propagation |

### 9.2 Dashboards Obrigatórios

1. **API Golden Signals** — latency p50/p95/p99, error rate, throughput
2. **Worker Health** — queue depth, processing time, success rate, DLQ size
3. **Business KPIs** — docs uploaded/day, approval cycle time, GRDs emitted, OCR throughput
4. **Tenant Isolation** — queries per contract, cross-tenant attempts (should be 0)
5. **Security** — failed logins, 403s, webhook auth failures

### 9.3 Alerting (PrometheusRule)

```yaml
groups:
- name: ged-critical
  rules:
  - alert: APIHighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 2m
    labels: { severity: critical }
    annotations: { summary: "API error rate > 5%" }
  - alert: OCRQueueBacklog
    expr: sqs_approximate_messages_visible{queue="ged-ocr"} > 100
    for: 5m
    labels: { severity: warning }
    annotations: { summary: "OCR queue backlog > 100" }
  - alert: WorkerDown
    expr: up{job="ged-worker-ocr"} == 0
    for: 1m
    labels: { severity: critical }
    annotations: { summary: "OCR worker down" }
```

---

## 10. CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        ports: [5432:5432]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run test -- --coverage
      - uses: codecov/codecov-action@v4
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
      - run: docker build -t ged-api:${{ github.sha }} .
      - run: docker push ged-api:${{ github.sha }}
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: aws ecs update-service --cluster ged-staging --service ged-api --force-new-deployment
  deploy-prod:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: aws ecs update-service --cluster ged-prod --service ged-api --force-new-deployment
```

---

## 11. Migração do Estado Atual → Alvo

| Componente | Atual | Alvo | Esforço | Risco |
|------------|-------|------|---------|-------|
| **Auth** | JWT HS256 no API | Auth Service (RS256) + Refresh | Médio | Alto (migração usuários) |
| **Tenant Isolation** | Prisma Extension (ALS) | PostgreSQL RLS | Alto | Médio (testes extensivos) |
| **API Spec** | Implícito (Zod) | OpenAPI 3.1 + Codegen | Médio | Baixo |
| **Workers** | Processo único Python | ECS Fargate + HPA + DLQ | Médio | Baixo |
| **Frontend State** | Axios + Context | React Query + Table | Médio | Baixo |
| **Secrets** | `.env` committado | Secrets Manager | Baixo | **Crítico (já exposto)** |
| **Tests** | Nenhum | Unit + Integration + E2E | Alto | Baixo |
| **Observability** | console.log | OTEL + Loki + Prometheus | Médio | Baixo |
| **Deploy** | Manual | GitHub Actions + ECS | Médio | Baixo |

---

## 12. Estimativa de Esforço (Sprints de 2 semanas)

| Fase | Sprints | Foco Principal | Entregável |
|------|---------|----------------|------------|
| 0 - Emergência | 0.5 | Secrets, hardening básico | Credenciais rotacionadas, rate limit, helmet |
| 1 - Fundação | 3 | Tests, CI/CD, RLS, Auth v2 | Pipeline verde, isolamento no DB, refresh tokens |
| 2 - Qualidade | 2 | React Query, Table, Forms, Design System | Frontend moderno, testável, performático |
| 3 - Observabilidade | 1 | OTEL, Dashboards, Alertas | Visibilidade total de prod |
| 4 - Features Críticas | 3 | Password reset, Email, Soft delete, Audit pagination | Prod-ready completo |
| 5 - Diferenciais | 4+ | DWG, Markup, PWA, ISO 19650, Webhooks públicos | Market leadership |

**Total estimado: ~13.5 sprints (~27 semanas) para produção enterprise-ready.**

---

## 13. Decisões Arquiteturais Registradas (ADR)

| ADR | Título | Status |
|-----|--------|--------|
| ADR-001 | Use PostgreSQL RLS for Multi-Tenant Isolation | Proposto |
| ADR-002 | Adopt OpenAPI 3.1 + Codegen for API Contracts | Proposto |
| ADR-003 | EventBridge for Domain Events | Proposto |
| ADR-004 | Containerize Workers on ECS Fargate | Proposto |
| ADR-005 | React Query + TanStack Table for Frontend State | Proposto |
| ADR-006 | Secrets Manager for All Credentials | **Aprovado (Urgente)** |
| ADR-007 | Soft Delete Pattern for All Entities | Proposto |
| ADR-008 | Idempotency Keys for Mutating Endpoints | Proposto |

---

## 14. Riscos da Migração

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| RLS quebra queries existentes | Alta | Alto | Test suite abrangente antes de habilitar; feature flag |
| Migração de usuários (refresh tokens) | Média | Alto | Dual-write period + migração gradual |
| Codegen quebra frontend | Média | Médio | Contrato versionado; testes de contrato no CI |
| Worker containerization revela bugs | Média | Médio | Staging idêntico a prod; canary deploy |
| Performance regressa com RLS | Baixa | Médio | Benchmarks antes/depois; índices otimizados |

---

## 15. Próximos Passos Imediatos

1. **Aprovar ADR-006 (Secrets)** — executar **hoje**
2. **Criar `ged-infra` repo** — Terraform para RDS, S3, SQS, EventBridge, Secrets Manager
3. **Setup GitHub Environments** — staging/prod com secrets
4. **Iniciar test suite** — Vitest (backend) + Vitest/RTL (frontend) + Playwright (E2E)
5. **Prototipar RLS** — branch `feat/rls` com migration + Prisma middleware `SET LOCAL`

---

> **Nota:** Este documento é vivo. Atualizar a cada decisão arquitetural (ADR) e a cada sprint review.