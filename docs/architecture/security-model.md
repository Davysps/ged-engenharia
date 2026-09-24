# GED Engenharia — Modelo de Segurança (Security Model)

**Versão:** 1.0 (Baseado em Auditoria 2026-09-24)  
**Classificação:** CONFIDENCIAL — Contém detalhes de vulnerabilidades conhecidas  
**Ação Imediata:** Ver seção "Credenciais Expostas — Rotação Obrigatória"

---

## 1. Resumo Executivo de Risco

| Métrica | Valor | Status |
|---------|-------|--------|
| **Credenciais Vazadas** | 7 secrets no `.env` committado | 🔴 **CRÍTICO** |
| **Cobertura de Testes** | 0% | 🔴 **CRÍTICO** |
| **Isolamento Tenant** | Application-level apenas (ALS) | 🟡 **MÉDIO** |
| **Auth Token Lifetime** | 24h (sem refresh) | 🟡 **MÉDIO** |
| **Rate Limiting** | Nenhum | 🟡 **MÉDIO** |
| **Security Headers** | Nenhum (helmet ausente) | 🟡 **MÉDIO** |
| **Audit Trail** | Implementado (Épico 12) | 🟢 **OK** |
| **RBAC** | Granular por ContractRole + Stage | 🟢 **OK** |
| **Client Portal Isolation** | Implementado (PATCH 10.4) | 🟢 **OK** |

---

## 2. Credenciais Expostas — ROTAÇÃO OBRIGATÓRIA (Hoje)

> **TODAS as credenciais abaixo estão no histórico do git. Devem ser revogadas e rotacionadas IMEDIATAMENTE.**

| Secret | Serviço | Ação Requerida |
|--------|---------|----------------|
| `DATABASE_URL` | Neon PostgreSQL | **Rotacionar senha no Neon Console** → Atualizar em Secrets Manager |
| `JWT_SECRET` | HS256 signing | **Gerar novo segredo 256-bit** → Invalidar todos os tokens ativos |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM User `ged-engenharia` | **Delete access key** → Criar nova → Migrar para IRSA (Roles) |
| `AWS_S3_BUCKET` | S3 | Bucket name não é segredo, mas **verificar policies** |
| `AWS_SQS_OCR_QUEUE_URL` | SQS | URL não é segredo, mas **verificar queue policy** |
| `GED_INTERNAL_WEBHOOK_URL` | Internal webhook | **Mudar para URL de produção** (não localhost) |
| `GED_INTERNAL_SECRET` | Webhook auth | **Rotacionar para UUID v4 criptograficamente forte** |

**Procedimento de Rotação:**
1. Revogar credenciais antigas nos provedores (AWS Console, Neon Console)
2. Gerar novas credenciais
3. Armazenar **apenas** em AWS Secrets Manager / GitHub Environments
4. Deploy com novas credenciais
5. Verificar funcionamento
6. Confirmar revogação das antigas

---

## 3. Autenticação (Authentication)

### 3.1 Estado Atual

```typescript
// src/modules/auth/auth.controller.ts:35-39
const token = jwt.sign(
  { userId: user.id, globalRole: user.globalRole },
  secret,           // HS256 (simétrico)
  { expiresIn: '1d' }
);
```

| Aspecto | Implementação | Risco |
|---------|---------------|-------|
| **Algoritmo** | HS256 (shared secret) | Chave única para assinar/verificar — se vazada, tokens falsificáveis |
| **Expiração Access** | 24 horas | Janela longa para token roubado |
| **Refresh Token** | **Não existe** | Usuário loga novamente a cada 24h ou fica logado indefinidamente |
| **Token Storage** | Frontend: `localStorage` (presumido) | XSS = token roubado |
| **Logout** | Client-side only (remove token) | Token válido até expirar no servidor |
| **Password Hash** | `bcrypt` (custo default 10) | OK — seed usa `'hash'` plain text (dev only) |
| **Brute Force Protection** | **Nenhum** | Login ilimitado |

### 3.2 Modelo Alvo (Target)

```
┌─────────────────────────────────────────────────────────────────┐
                      AUTHENTICATION FLOW
└─────────────────────────────────────────────────────────────────┘

  ┌─────────┐     ┌─────────────┐     ┌─────────────┐
  │  User   │────►│  /auth/     │────►│  Access     │  15 min, RS256
  │  Agent  │     │  login      │     │  Token (JWT)│  {sub, roles, contracts[]}
  └─────────┘     └─────────────┘     └─────────────┘
                       │
                       ▼
                ┌─────────────┐
                │  Refresh    │  30 dias, HttpOnly Secure Cookie
                │  Token      │  Rotating (novo a cada uso)
                │  (DB stored,│  Revocável (logout, revoke all)
                │   hashed)   │
                └─────────────┘
                       │
                       ▼
                ┌─────────────┐
                │  /auth/     │  Valida refresh → emite novo access + novo refresh
                │  refresh    │
                └─────────────┘
```

**Implementação:**
- **Auth Service** dedicado (ou Cognito/Auth0) — separa identidade da API
- **RS256** (chave assimétrica) — chave pública para verificação, privada para assinatura
- **JWKS endpoint** para rotação de chaves sem downtime
- **Refresh Token Rotation** — previne replay attacks
- **Token Binding** — opcional: vincula token a device fingerprint

---

## 4. Autorização (Authorization)

### 4.1 RBAC Matrix Atual (Verificado no Código)

| Recurso / Ação | GESTOR | COORDENADOR | ENGENHEIRO | PLANEJADOR | LEITOR | CLIENTE (isClient) |
|----------------|--------|-------------|------------|------------|--------|-------------------|
| **Documentos** | | | | | | |
| Criar (shell + R0) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Nova Revisão (R1+) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Correção Interna | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Listar | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 Filtrado* |
| Visualizar Detalhes | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 Filtrado* |
| Exportar MDR | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Aprovações** | | | | | | |
| Verificação (Stage 1) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Aprovação (Stage 2) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Análise Cliente (Stage 3) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Disciplinas** | | | | | | |
| CRUD | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Usuários** | | | | | | |
| Listar Membros | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Convidar | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Planejamento** | | | | | | |
| WorkPackage CRUD | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Transmittals (GRD)** | | | | | | |
| Emitir | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Listar | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Auditoria** | | | | | | |
| Ver Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Timesheet** | | | | | | |
| Apontar Horas | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Excluir Próprio | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

*Filtrado: Só vê documentos com `ApprovalWorkflow.stage = CLIENTE`; carimbos internos removidos da resposta.

### 4.2 Implementação Atual — Pontos de Atenção

#### 4.2.1 Tenant Resolution Insegura (`auth.middleware.ts:20-30`)

```typescript
function extractTenantContractId(req: Request): number | undefined {
  const raw = req.query?.contractId ?? req.params?.contractId ?? (req as any).body?.contractId;
  // ...
}
```

**Problema:** `contractId` vem do **cliente** (query/params/body), não do token. Usuário malicioso pode:
- Enviar `contractId` de outro contrato onde não é membro
- Bypass: middleware valida membership **depois** de setar `req.contractId`
- Prisma Extension usa `AsyncLocalStorage` — se `contractId` inválido, query roda sem filtro (linha 68: `if (!contractId) return query(args)`)

**Mitigação Atual:** Services validam `ContractMembership` manualmente (repetido em 8+ services).

#### 4.2.2 Prisma Extension — Cobertura Incompleta

```typescript
// src/prisma.ts:38-53
const WHERE_OPERATIONS = new Set([..., 'findUnique', ...]); // findUnique INCLUÍDO
const CREATE_OPERATIONS = new Set(['create', 'createMany', ...]);
```

**Gaps:**
- `findUnique` com `include` que traversa relações **sem filtro** — ex: `prisma.document.findUnique({ where: { id }, include: { revisions: true } })` — revisões não filtradas por tenant
- `createMany` em transação: injeção de `contractId` funciona, mas se dev passar `contract: { connect: { id: X } }` conflita (linha 94)
- Raw queries (`$queryRaw`) não cobertas

#### 4.2.3 Transmittal Webhook Sem Validação de Tenant

```typescript
// src/modules/transmittals/transmittal.controller.ts:218
public webhookComplete: RequestHandler = async (req, res) => {
  const transmittalId = Number(req.params.transmittalId);
  // NENHUMA validação de contractId ou membership!
  await prisma.transmittal.update({ where: { id: transmittalId }, data: {...} });
}
```

**Risco:** Worker comprometido (ou qualquer um com `GED_INTERNAL_SECRET`) pode atualizar **qualquer** transmittal de **qualquer** contrato.

---

## 5. Isolamento Multi-Tenant (Data Isolation)

### 5.1 Arquitetura Atual

```
┌────────────────────────────────────────────────────────────────┐
│                     REQUEST LIFECYCLE                          │
└────────────────────────────────────────────────────────────────┘

1. Request chega → verifyToken middleware
   ├── Valida JWT (assinatura, expiração)
   ├── Extrai userId, globalRole
   ├── Extrai contractId do request (query/params/body)
   └── runWithTenant({ userId, contractId }) → AsyncLocalStorage

2. Controller executa
   ├── Chama Service
   │   └── Service valida ContractMembership (manual, repetido)
   └── Chama Prisma
       └── Prisma Extension (tenantIsolation)
           ├── Se contractId no ALS E model em TENANT_SCOPED_MODELS
           │   └── Injeta contractId no where / data automaticamente
           └── Senão: query roda SEM filtro (responsabilidade do dev)

3. Response
```

### 5.2 Modelos com Filtro Automático (TENANT_SCOPED_MODELS)

```typescript
// src/prisma.ts:28-35
const TENANT_SCOPED_MODELS = new Set([
  'ContractDiscipline',
  'ContractMembership',
  'Document',
  'Transmittal',
  'WorkPackage',
  'AuditLog',
]);
```

**Modelos SEM filtro automático (globals/filhas):**
- `Client`, `Project`, `Contract`, `User` — globais
- `Revision`, `ApprovalWorkflow`, `TransmittalItem`, `TimeLog`, `DocumentLink` — filhas (isolamento herdado via relações)

### 5.3 Vulnerabilidades Conhecidas

| ID | Vetor | Impacto | Mitigação Atual |
|----|-------|---------|-----------------|
| MT-01 | `findUnique` + `include` sem filtro | Vazamento revisões/aprovações cross-tenant | Services validam membership manualmente |
| MT-02 | `contractId` manipulável pelo cliente | Acesso a contrato alheio | Service-level membership check |
| MT-03 | `Transmittal.webhookComplete` sem tenant check | Worker pode corromper qualquer contrato | `GED_INTERNAL_SECRET` apenas |
| MT-04 | Raw SQL / `$queryRaw` | Bypass total do ALS | Não usado atualmente |
| MT-05 | `Client`/`Project` globais | Enumeração de clientes/projetos alheios | Não expostos em listagens sem membership |

### 5.4 Alvo: PostgreSQL Row Level Security (RLS)

```sql
-- Habilita RLS nas tabelas tenant-scoped
ALTER TABLE "ContractDiscipline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transmittal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkPackage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- Policy: só vê linhas do contractId da sessão
CREATE POLICY tenant_isolation ON "Document"
  USING ("contractId" = current_setting('app.current_contract_id')::int);

-- Aplicado via Prisma middleware ANTES de cada query:
-- SET LOCAL app.current_contract_id = $1;
```

**Vantagens:**
- **Impossível burlar** — enforcado no engine do PostgreSQL
- **Performance** — índice parcial + policy é otimizado
- **Defesa em profundidade** — mesmo se app bugar, DB bloqueia

---

## 6. Proteção de Dados (Data Protection)

### 6.1 Em Trânsito

| Camada | Atual | Alvo |
|--------|-------|------|
| **API ↔ Client** | HTTPS (presumido) | TLS 1.3, HSTS, Certificate Transparency |
| **API ↔ Database** | Neon SSL (`sslmode=require`) | TLS 1.3 + mTLS (se suportado) |
| **API ↔ S3** | AWS SDK v3 (HTTPS) | HTTPS + SigV4 |
| **API ↔ SQS** | AWS SDK v3 (HTTPS) | HTTPS + SigV4 |
| **Worker ↔ S3/SQS** | boto3 (HTTPS) | HTTPS + IAM Roles |
| **Worker ↔ API (Webhook)** | HTTP (localhost!) | **HTTPS + mTLS ou HMAC-SHA256** |

### 6.2 Em Repouso

| Ativo | Atual | Alvo |
|-------|-------|------|
| **Database (Neon)** | AES-256 (managed) | AES-256 + Customer Managed Keys (CMK) |
| **S3 Bucket** | SSE-S3 (default) | **SSE-KMS com CMK** + Versioning obrigatório |
| **SQS** | SSE-SQS (managed) | SSE-KMS |
| **Secrets** | `.env` committado 🔴 | **AWS Secrets Manager** + rotação automática |
| **Logs** | stdout (CloudWatch) | **Sem PII/tokens** — structured JSON, sem `Authorization` header |

### 6.3 Integridade de Arquivos

| Verificação | Atual | Gap |
|-------------|-------|-----|
| **Upload** | `fileHash` gerado no backend (randomBytes) | **Não é hash do conteúdo** — é ID aleatório |
| **Download** | Nenhuma verificação | **Verificar SHA-256 real** ao servir arquivo |
| **S3 Versioning** | Não confirmado | **Obrigatório** — protege contra sobrescrita acidental/maliciosa |
| **Presigned URL Expiry** | 15 min (900s) | OK — curto o suficiente |

**Correção Crítica:** `fileHash` deve ser `crypto.createHash('sha256').update(buffer).digest('hex')` do conteúdo real.

---

## 7. Segurança da API (API Security)

### 7.1 Headers de Segurança Ausentes

```typescript
// server.ts — ADICIONAR
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind precisa
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.amazonaws.com"], // S3 presigned
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' },
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth', limiter); // Stricter on auth
app.use(limiter); // Global
```

### 7.2 CORS Configuração Atual vs. Alvo

```typescript
// ATUAL (server.ts:19) — INSEGURO
app.use(cors()); // origin: '*', credentials: true

// ALVO
app.use(cors({
  origin: [
    'https://app.ged-engenharia.com',
    'https://staging.ged-engenharia.com',
    'http://localhost:5173', // dev apenas
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Contract-Id', 'Idempotency-Key'],
  maxAge: 86400,
}));
```

### 7.3 Validação de Entrada (Input Validation)

| Camada | Atual | Status |
|--------|-------|--------|
| **Body** | Zod schemas em todos controllers | ✅ |
| **Query Params** | Zod schemas (`documentListQuerySchema`, etc.) | ✅ |
| **Route Params** | Zod (`documentIdParamSchema`, etc.) | ✅ |
| **File Upload** | Multer memory (legacy) + Presigned URL (principal) | ⚠️ Parcial |
| **Webhook Payload** | Zod implícito + `x-internal-secret` | ⚠️ Secret fraco |

---

## 8. Segurança do Frontend

### 8.1 Armazenamento de Token

```typescript
// ged-frontend/src/contexts/AuthContext.tsx (presumido)
// ATUAL: localStorage.setItem('token', jwt)
// RISCO: XSS = token roubado

// ALVO: HttpOnly Cookie (Refresh) + Memory (Access)
// - Access Token: armazenado em variável React (memory only)
// - Refresh Token: HttpOnly Secure SameSite=Strict Cookie
// - Logout: chama /auth/logout → revoga refresh no server + limpa memory
```

### 8.2 Proteção de Rotas

```typescript
// ged-frontend/src/App.tsx:16-20 — OK
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
```

**Gap:** Não verifica **permissão por contrato** — usuário logado acessa `/contracts/999` e vê 403 apenas na API call.

### 8.3 Content Security Policy (Frontend)

```html
<!-- index.html — ADICIONAR -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; 
           script-src 'self' 'wasm-unsafe-eval'; 
           style-src 'self' 'unsafe-inline'; 
           img-src 'self' data: https:; 
           connect-src 'self' https://api.ged-engenharia.com https://*.amazonaws.com;
           font-src 'self'; 
           frame-ancestors 'none'; 
           base-uri 'self'; 
           form-action 'self';">
```

---

## 9. Segurança do Worker Python

### 9.1 Vulnerabilidades Atuais

| Componente | Risco | Mitigação |
|------------|-------|-----------|
| **Webhook URL** | `http://localhost:3000/...` hardcoded | Usar variável de ambiente + HTTPS em prod |
| **Internal Secret** | Header `x-internal-secret` estático | HMAC-SHA256 com timestamp + nonce; rotação |
| **S3 Download** | Path traversal via `filePath` malicioso | Validar key: `^contratos/[a-f0-9]{32}\.pdf$` |
| **Temp Files** | `tempfile.mkstemp()` — OK | Limpeza em `finally` — OK |
| **PyMuPDF** | Parser PDF — surface de ataque | Manter atualizado; considerar sandbox (gVisor/Firecracker) |
| **Single Process** | SPOF — sem health check, sem restart auto | Container + Health Check + HPA |
| **No DLQ** | Mensagens envenenadas travam fila | SQS Redrive Policy → DLQ + Alarme |

### 9.2 Hardening do Worker

```python
# worker.py — ADICIONAR
import hmac
import hashlib
import time

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """HMAC-SHA256 com timestamp anti-replay."""
    # Formato: "t={timestamp},v1={signature}"
    parts = dict(part.split('=') for part in signature.split(','))
    timestamp = int(parts['t'])
    if abs(time.time() - timestamp) > 300:  # 5 min tolerance
        return False
    expected = hmac.new(secret.encode(), f"{timestamp}.{payload.decode()}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts['v1'])

# Validar S3 Key antes de download
def validate_s3_key(key: str) -> bool:
    return bool(re.match(r'^contratos/[a-f0-9]{32}\.pdf$', key))
```

---

## 10. Auditoria e Logging de Segurança

### 10.1 Eventos Auditados (Épico 12 — Implementado)

| Evento | Ação | Entidade | Detalhes |
|--------|------|----------|----------|
| Upload Documento | `UPLOAD_DOCUMENT` | `Document` | codigo, titulo, revisionLabel, fileHash |
| Nova Revisão | `UPLOAD_REVISION` | `Revision` | documentId, versionLabel, fileHash |
| Correção Interna | `INTERNAL_UPDATE_REVISION` | `Revision` | documentId, versionLabel, fileHash |
| Aprovação/Rejeição | `APPROVAL_{STATUS}` | `ApprovalWorkflow` | revisionId, stage, prevStatus, newStatus, hasComments |
| Emissão GRD | `EMIT_GRD` | `Transmittal` | codigo, assunto, proposito, revisionCount, revisionIds |

**Gap:** Não audita **login**, **logout**, **falha de auth**, **acesso negado (403)**, **mudança de role**, **convite de usuário**.

### 10.2 Logs Estruturados (Alvo)

```json
{
  "timestamp": "2026-09-24T15:30:45.123Z",
  "level": "INFO",
  "service": "ged-api",
  "traceId": "abc-123-def-456",
  "spanId": "789xyz",
  "userId": 42,
  "contractId": 5,
  "action": "APPROVAL_APROVADO",
  "entity": "ApprovalWorkflow",
  "entityId": 123,
  "details": {
    "revisionId": 456,
    "stage": "VERIFICACAO",
    "previousStatus": "PENDENTE",
    "newRevisionStatus": "EM_REVISAO"
  },
  "ipAddress": "203.0.113.195",
  "userAgent": "Mozilla/5.0...",
  "outcome": "SUCCESS"
}
```

**Ferramentas:** `pino` (logger) + `pino-pretty` (dev) → Loki (prod)

---

## 11. Plano de Resposta a Incidentes (IRP)

### 11.1 Cenários Críticos

| Cenário | Detecção | Contenção | Erradicação | Recuperação |
|---------|----------|-----------|-------------|-------------|
| **Credencial AWS vazada** | CloudTrail / GuardDuty / Alerta | Revogar key IAM imediatamente | Rotacionar todas keys; auditoria CloudTrail | Deploy com novas credenciais |
| **Token JWT roubado** | Logs de acesso anômalo | Revogar refresh tokens do usuário | Forçar re-login; invalidar access tokens (blocklist curto) | Monitorar atividade |
| **SQL Injection** | WAF / Logs de erro 500 | Bloquear IP no WAF | Corrigir código (raw query) | Deploy fix; revisar logs |
| **Worker comprometido** | Transmittals/OCR anômalos | Parar worker (ECS stop) | Rotacionar `GED_INTERNAL_SECRET`; auditar DB | Reprocessar itens afetados |
| **Ransomware no S3** | Versioning + Lifecycle | Suspender bucket; habilitar MFA Delete | Restaurar versões anteriores | Verificar integridade |

### 11.2 Contatos de Escalação

| Nível | Contato | SLA |
|-------|---------|-----|
| P0 (Crítico — Dados vazados) | Tech Lead + Security Officer | 15 min |
| P1 (Alto — Serviço down) | On-call Engineer | 30 min |
| P2 (Médio — Funcionalidade degradada) | Team Lead | 2h |
| P3 (Baixo — Bug não-crítico) | Sprint Planning | Próxima sprint |

---

## 12. Checklist de Hardening (Pré-Produção)

### 12.1 Infraestrutura
- [ ] **Revogar TODAS as credenciais expostas** (Seção 2)
- [ ] Configurar **AWS Secrets Manager** para todos os secrets
- [ ] Habilitar **S3 Versioning** + **MFA Delete** no bucket
- [ ] Configurar **SQS DLQ** + Redrive Policy + CloudWatch Alarm
- [ ] Configurar **WAF** (AWS WAF) com regras OWASP Top 10
- [ ] Configurar **VPC** privada para API/Workers/DB (sem internet egress desnecessário)
- [ ] **IRSA (IAM Roles for Service Accounts)** — remover access keys do código

### 12.2 Aplicação (Backend)
- [ ] Adicionar **helmet** + CSP + HSTS
- [ ] Adicionar **rate limiting** (global + stricter em `/auth`)
- [ ] Implementar **Refresh Token Rotation** + RS256 JWT
- [ ] Migrar **Prisma Extension → PostgreSQL RLS**
- [ ] Validar **`fileHash` = SHA-256 real** do conteúdo
- [ ] Adicionar **verificação de integridade** no download/visualização
- [ ] Implementar **Idempotency Keys** em POST mutantes
- [ ] Auditar **todas as raw queries** (`$queryRaw`) — eliminar ou proteger

### 12.3 Aplicação (Frontend)
- [ ] Mover **Access Token para memory**, Refresh para **HttpOnly Cookie**
- [ ] Adicionar **CSP meta tag** no `index.html`
- [ ] Implementar **PrivateRoute com verificação de contrato** (não só auth)
- [ ] Sanitizar **todos os inputs renderizados** (XSS prevention)

### 12.4 Worker Python
- [ ] Containerizar (Docker) + Health Check endpoint
- [ ] Deploy em **ECS Fargate** com HPA
- [ ] Implementar **HMAC-SHA256** no webhook (timestamp + nonce)
- [ ] Validar **S3 Key pattern** antes de download
- [ ] Configurar **DLQ** + Alarme CloudWatch
- [ ] Adicionar **structured logging** (JSON) + correlation ID

### 12.5 Observabilidade
- [ ] **OpenTelemetry** instrumentation (Node + Python)
- [ ] **Structured logs** (pino) → Loki
- [ ] **Metrics** (Prometheus) → Grafana dashboards
- [ ] **Alertas** críticos (error rate, queue backlog, worker down, auth failures)

### 12.6 Processos
- [ ] **CI/CD** com gates: lint, typecheck, test, build, security scan (SAST/DAST)
- [ ] **Dependabot/Renovate** para atualizações de dependências
- [ ] **Code Review obrigatório** (2 aprovações) para `main`
- [ ] **Pen Test** anual (terceirizado)
- [ ] **Treino de Segurança** para equipe (OWASP Top 10, phishing, etc.)

---

## 13. Conformidade e Normas

| Norma | Status Atual | Gap Principal |
|-------|--------------|---------------|
| **LGPD (Lei Geral de Proteção de Dados)** | Parcial | Consentimento, DPO, relatório de impacto, direito ao esquecimento (soft delete) |
| **ISO 27001** | Não iniciado | SGSI, gestão de riscos, controles Annex A |
| **ISO 19650** (BIM/GED) | Parcial | Nomenclatura, CDE workflows, validação de metadados |
| **SOC 2 Type II** | Não iniciado | Controles de segurança, disponibilidade, confidencialidade |
| **OWASP ASVS Level 2** | Parcial | Auth, Session, Access Control, Input Validation, Crypto |

---

## 14. Referências

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [AWS Well-Architected Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)

---

> **Última Atualização:** 2026-09-24 — Auditoría Completa  
> **Próxima Revisão:** Após implementação da Fase 0 (Emergência)  
> **Responsável:** Tech Lead / Security Officer