# GED Engenharia — Product Roadmap

**Versão:** 1.0 (Pós-Auditoria 2026-09-24)  
**Horizonte:** 18 meses (6 releases trimestrais)  
**Metodologia:** Shape Up inspired — 6-week cycles + 2-week cooldown

---

## 1. Visão de Produto

> **Transformar o GED Engenharia na plataforma de referência para Gestão de Documentos de Engenharia no Brasil**, atendendo empresas multidisciplinares (Processos, Mecânica, Piping, Elétrica, Instrumentação, Civil, Estruturas, Geo, Topografia, HSE, Meio Ambiente, BIM/CAD, Planejamento, Suprimentos, QA/QC, Comissionamento, Document Control) com:
>
> - **Workflow de aprovação rigoroso** (3 estágios: Verificação → Coordenação → Cliente)
> - **Isolamento multi-tenant garantido** (dados de contratos nunca vazam)
> - **Armazenamento escalável nuvem** (S3 + presigned URLs)
> - **Busca full-text nativa** (PyMuPDF OCR assíncrono)
> - **Auditoria imutável** (Data Room pronta para compliance)
> - **Integração aberta** (Webhooks, API versionada, OpenAPI)

---

## 2. Releases Planejados

### Release 0.9 — **Hardening & Foundation** (Sprint 0-2 | Set-Out 2026)
**Objetivo:** Produção segura para piloto interno

| Epic | Features | Critério de Pronto |
|------|----------|-------------------|
| **Segurança Crítica** | Rotacionar todos secrets; CORS restritivo; Helmet+CSP; Rate limiting; JWT RS256 + Refresh Token; SQS DLQ | Zero critical vulns; Pen test básico passa |
| **Testes & CI/CD** | Vitest (backend/frontend); Playwright (E2E); GitHub Actions (lint, typecheck, test, build, deploy staging) | Pipeline verde; coverage ≥ 60% |
| **Isolamento Tenant** | Migrar Prisma Extension → PostgreSQL RLS; Validar membership antes de query | RLS ativo em prod; 0 cross-tenant leaks em testes |
| **Observabilidade Básica** | Pino logger + correlation ID; Health check profundo (/health); Structured logs JSON | Logs consultáveis no Loki; Alertas de erro 5xx |

**Entregável:** `v0.9.0` — Deploy staging + piloto com 1 contrato real

---

### Release 1.0 — **GA Core** (Sprint 3-5 | Nov 2026 - Jan 2027)
**Objetivo:** General Availability para clientes beta

| Epic | Features | Critério de Pronto |
|------|----------|-------------------|
| **Frontend Moderno** | React Query (cache/invalidação); TanStack Table virtualizado (10k docs); React Hook Form + Zod; Radix UI Design System | DocumentList 10k rows < 2s; Formulários validados FE/BE |
| **Soft Delete & Auditoria Completa** | `deletedAt` em todas entities; Partial unique indexes; Audit pagination + export CSV/Excel | Recuperação de deleção acidental; Audit logs exportáveis |
| **Idempotency & Integridade** | Idempotency-Key em POST mutantes; `fileHash` = SHA-256 real; Verificação no download | Zero uploads duplicados; Integridade verificada |
| **Worker Resiliente** | Container (Docker); Health check; ECS Fargate + HPA; HMAC-SHA256 webhook; S3 key validation | Worker auto-recovery; 99.9% uptime |
| **Notificações Mínimas** | Email (SendGrid/SES) para: aprovação pendente, GRD emitida, OCR falha | Usuários notificados sem polling |

**Entregável:** `v1.0.0` — GA para 3-5 clientes beta

---

### Release 1.1 — **Planning & Coordination Power-Up** (Sprint 6-8 | Fev-Abr 2027)
**Objetivo:** Diferencial para Planejadores e Coordenadores

| Epic | Features | Critério de Pronto |
|------|----------|-------------------|
| **Curva S & Earned Value** | Integração WorkPackage + TimeLog → Curva S planejada vs. realizada; EV metrics (PV, EV, AC, SPI, CPI) | Dashboard mostra SPI/CPI por pacote |
| **Importação MDR em Massa** | Upload Excel/CSV → Cria Documents (shell) + WorkPackages + Disciplines; Validação Zod + preview | 500 docs importados em < 5 min |
| **Gestão de Recursos** | Alocação de horas por usuário/pacote/semana; Conflitos de overallocation | Planejador vê capacity vs. demand |
| **Relatórios Automatizados** | Agendamento (cron) de relatórios: MDR, Horas, Aprovações, GRDs → Email + Download | Relatórios semanais automáticos |
| **Baseline de Planejamento** | Snapshot de WorkPackages (datas, escopo) → Comparação com atual | Variance analysis (baseline vs. current) |

**Entregável:** `v1.1.0` — Módulo Planning nível enterprise

---

### Release 1.2 — **Client Portal & Collaboration** (Sprint 9-11 | Mai-Jul 2027)
**Objetivo:** Experiência superior para Clientes (atores externos)

| Epic | Features | Critério de Pronto |
|------|----------|-------------------|
| **Portal do Cliente White-label** | Subdomínio customizado (`cliente.ged-engenharia.com`); Branding (logo, cores); Termos de uso | Cliente acessa portal próprio |
| **Comentários & Anotações (Markup v1)** | Comentários em PDF (texto + posição); Resposta em thread; Download PDF anotado | Verificador comenta; Cliente vê e responde |
| **Assinatura Digital (e-CPF/ICP-Brasil)** | Integração ICP-Brasil para assinatura de GRD/Documentos; Validação de certificado | GRD assinada digitalmente |
| **Workflow Customizável** | Admin define etapas extra (ex: "Jurídico", "Suprimentos") por contrato; RBAC por etapa | Contratos com workflow 4-5 etapas |
| **Mobile PWA** | Installable PWA; Offline-first (cache últimos 50 docs); Push notifications | Usuário instala no celular; funciona offline |

**Entregável:** `v1.2.0` — Portal do Cliente pronto para grandes contas

---

### Release 1.3 — **BIM/CAD & Advanced Visualization** (Sprint 12-14 | Ago-Out 2027)
**Objetivo:** Suporte nativo a formatos de engenharia

| Epic | Features | Critério de Pronto |
|------|----------|-------------------|
| **Visualizador DWG/DXF** | Autodesk Platform Services (Forge) integration; Layer control; Measure/Markup | Abre .dwg no browser sem plugin |
| **Visualizador IFC (BIM)** | IFC.js / Three.js; Tree view (IfcBuilding → IfcElement); Properties panel | Modelo BIM navegável |
| **Comparação de Revisões (Visual Diff)** | Overlay PDF (R0 vs R1) — highlight mudanças; Diff DWG (layer comparison) | Engenheiro vê o que mudou visualmente |
| **Publicação BIM → Document** | Extração automática de pranchas do modelo IFC → Documents shell + metadados | BIM Manager publica 50 pranchas em 1 click |
| **Clash Detection Report Link** | Vincula relatório de interferência (BCF) aos Documents afetados | Rastreabilidade clash → doc |

**Entregável:** `v1.3.0` — Diferencial técnico para projetos BIM

---

### Release 1.4 — **Compliance, Integration & Scale** (Sprint 15-17 | Nov 2027 - Jan 2028)
**Objetivo:** Enterprise readiness + Ecossistema

| Epic | Features | Critério de Pronto |
|------|----------|-------------------|
| **ISO 19650 Compliance Pack** | Nomenclatura obrigatória (regex por disciplina); CDE workflows (WIP → Shared → Published → Archived); Exchange Information Requirements (EIR) template | Auditoria ISO 19650 passa |
| **Webhooks Públicos + API v2** | Eventos: `document.created`, `revision.approved`, `grd.emitted`; Retry + DLQ; API Keys por integração | ERP/PMO clientes integrados |
| **Multi-Region / DR** | Deploy ativo-passivo (SA-East-1 + US-East-1); RDS Global Database; S3 Cross-Region Replication | RPO < 1h, RTO < 4h |
| **Advanced Search & AI** | Busca semântica (embeddings) em `extractedText`; Classificação automática de disciplina (ML); Extração de metadados (tabela, lista de materiais) | "Encontre todas as válvulas de 6 polegadas" |
| **Self-Service Admin** | Superadmin UI: gestão de tenants, quotas, billing, feature flags, logs de auditoria cross-tenant | SaaS operável sem dev intervention |

**Entregável:** `v1.4.0` — Plataforma SaaS B2B enterprise-ready

---

### Release 2.0 — **Platform & Ecosystem** (Sprint 18+ | 2028+)
**Objetivo:** Plataforma extensível, marketplace, IA nativa

| Tema | Direção |
|------|---------|
| **Plugin/Extension System** | SDK para clientes desenvolverem validações customizadas, relatórios, integrações |
| **AI Copilot** | "Gere MDR deste contrato"; "Resuma pendências de aprovação"; "Detecte inconsistências no MDR" |
| **Marketplace de Templates** | MDR templates por tipo de projeto (Oil & Gas, Mineração, Infraestrutura, Industrial) |
| **Federação de Dados** | Query cross-tenant (com consentimento) para holdings/consórcios |
| **Digital Twin Integration** | Vinculo Document ↔ Asset Tag ↔ Sensor Data (IoT) para comissionamento/operação |

---

## 3. Priorização por Framework RICE

| Feature | Reach (usuários/mês) | Impact (1-5) | Confidence (1-5) | Effort (semanas) | RICE Score |
|---------|---------------------|--------------|------------------|------------------|------------|
| Rotacionar Secrets | Todos | 5 | 5 | 0.5 | **250** |
| Rate Limiting | Todos | 4 | 5 | 0.5 | **200** |
| RLS Migration | Todos | 5 | 4 | 4 | **20** |
| React Query Migration | Todos (FE) | 5 | 5 | 3 | **41.7** |
| TanStack Table | Todos (FE) | 4 | 5 | 3 | **33.3** |
| Soft Delete | Todos | 4 | 5 | 2 | **40** |
| Email Notifications | Todos | 4 | 5 | 1 | **80** |
| Worker Containerization | Ops | 5 | 5 | 2 | **62.5** |
| Curva S / EV | Planejadores (20%) | 5 | 4 | 4 | **10** |
| MDR Import | Planejadores (20%) | 5 | 5 | 2 | **25** |
| Client White-label | Clientes (30%) | 4 | 4 | 3 | **16** |
| PDF Markup | Verificadores (40%) | 5 | 3 | 4 | **15** |
| DWG Viewer | Engenheiros (60%) | 4 | 3 | 6 | **12** |
| ISO 19650 Pack | Enterprise (10%) | 5 | 4 | 5 | **4** |
| Public Webhooks | Integradores (5%) | 4 | 4 | 3 | **2.7** |

---

## 4. Dependências Críticas entre Releases

```
R0.9 (Hardening)
    │
    ├──► R1.0 (GA Core) ◄── Requer: RLS, Tests, CI/CD, Auth v2
    │       │
    │       ├──► R1.1 (Planning) ◄── Requer: React Query, Table, Soft Delete
    │       │
    │       ├──► R1.2 (Client Portal) ◄── Requer: Auth v2, Notifications, PWA
    │       │
    │       ├──► R1.3 (BIM/CAD) ◄── Requer: S3 versioning, Worker resilient, API v2
    │       │
    │       └──► R1.4 (Compliance) ◄── Requer: Audit completa, Webhooks, Multi-region
    │
    └──► R2.0 (Platform) ◄── Requer: API v2 estável, Plugin SDK, AI infra
```

---

## 5. Recursos Necessários (Team Composition)

| Role | R0.9 | R1.0 | R1.1 | R1.2 | R1.3 | R1.4 |
|------|------|------|------|------|------|------|
| **Tech Lead / Arquiteto** | 1 | 1 | 1 | 1 | 1 | 1 |
| **Backend Engineers** | 2 | 2 | 2 | 2 | 2 | 2 |
| **Frontend Engineers** | 1 | 2 | 2 | 2 | 2 | 1 |
| **DevOps / Platform** | 1 | 1 | 1 | 1 | 1 | 1 |
| **QA / Test Engineer** | 0 | 1 | 1 | 1 | 1 | 1 |
| **Product Manager** | 0.5 | 1 | 1 | 1 | 1 | 1 |
| **UX/UI Designer** | 0 | 0.5 | 1 | 1 | 1 | 0.5 |
| **Security Engineer** | 0.5 (consult) | 0.5 | 0.25 | 0.25 | 0.25 | 0.5 |

**Total FTE:** ~5.5 → ~8.5 → ~9.25 → ~9.25 → ~9.25 → ~8

---

## 6. Go-to-Market por Release

| Release | Target | Canais | Métrica Sucesso |
|---------|--------|--------|-----------------|
| **R0.9** | Piloto Interno (1-2 contratos) | Direct | Zero security incidents; 99.5% uptime |
| **R1.0** | Beta Fechado (3-5 clientes) | Direct Sales + Indicação | 3 contratos ativos; NPS > 40 |
| **R1.1** | Early Adopters (10-15 clientes) | Inbound + Parceiros | 10 contratos; MRR R$ 50k |
| **R1.2** | Contas Enterprise (5-10) | Field Sales | 2 enterprise logos; ACV > R$ 200k |
| **R1.3** | Projetos BIM ( nicho) | Parcerias Autodesk/Integrators | 3 projetos BIM ativos |
| **R1.4** | Mercado Geral (SaaS B2B) | Marketing + Channel | 50 contratos; MRR R$ 500k |

---

## 7. Riscos do Roadmap

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Atraso em RLS Migration** | Média | Alto | Spike técnico em R0.9; fallback: manter Prisma Extension + testes extensivos |
| **Autodesk Forge API Changes** | Baixa | Médio | Abstração `ViewerAdapter`; eval alternativas (Speckle, IFC.js) |
| **Contratação DevOps/Backend** | Média | Alto | Contratar antecipado; upskill interno; contractors para spikes |
| **Scope Creep em R1.1/R1.2** | Alta | Médio | Shape Up: fixed scope per cycle; "betting table" a cada 6 semanas |
| **Dependência AWS (Vendor Lock-in)** | Baixa | Médio | Terraform modular; abstrações S3/SQS/EventBridge para portabilidade |
| **LGPD/ISO Compliance Gaps** | Média | Alto | Legal review a cada release; DPO consultivo |

---

## 8. OKRs por Release

### R0.9 — Hardening
- **O:** Estabelecer fundação segura e confiável
- **KR1:** 0 vulnerabilidades críticas/altas no `trivy`/`npm audit`
- **KR2:** Pipeline CI/CD 100% verde por 5 deploys consecutivos
- **KR3:** RLS ativo em staging com 0 cross-tenant leaks em 10k testes automatizados

### R1.0 — GA Core
- **O:** Entregar produto core estável e usável para beta
- **KR1:** 3 clientes beta ativos usando diariamente por 30 dias
- **KR2:** DocumentList carrega 10k docs em < 2s (p95)
- **KR3:** Zero data loss incidents (soft delete + backup testado)

### R1.1 — Planning Power-Up
- **O:** Tornar o módulo Planning indispensável para coordenadores
- **KR1:** 80% dos planejadores ativos usam Curva S semanalmente
- **KR2:** Importação MDR de 500 docs em < 5 min com < 2% erros
- **KR3:** Relatórios automatizados gerados sem intervenção manual

### R1.2 — Client Portal
- **O:** Experiência do cliente superior a alternativas (SharePoint, e-mail, FTP)
- **KR1:** 100% dos clientes beta usam portal (não e-mail) para aprovações
- **KR2:** Tempo médio de análise do cliente reduzido em 40%
- **KR3:** NPS do portal do cliente > 50

### R1.3 — BIM/CAD
- **O:** Suporte nativo a formatos de engenharia sem plugins
- **KR1:** 50% dos projetos BIM usam visualizador nativo
- **KR2:** Publicação IFC→Document em < 2 min para 100 pranchas
- **KR3:** Zero dependência de software desktop para visualização

### R1.4 — Compliance & Scale
- **O:** Plataforma pronta para vendas enterprise em escala
- **KR1:** Auditoria ISO 19650 passa sem não-conformidades
- **KR2:** 3 integrações ERP/PMO ativas via webhooks públicos
- **KR3:** DR testado com RPO < 1h, RTO < 4h

---

## 9. Comunicação e Governança

| Cerimônia | Frequência | Participantes | Artefato |
|-----------|------------|---------------|----------|
| **Sprint Planning** | Início de ciclo (6 sem) | PM + Tech Lead + Team | Sprint Backlog + Bets |
| **Daily Standup** | Diário (15 min) | Team | Blockers + Progress |
| **Sprint Review** | Fim de ciclo | PM + Stakeholders | Demo + Métricas |
| **Retrospective** | Fim de ciclo | Team | Action Items (max 3) |
| **Betting Table** | A cada 2 ciclos | PM + Tech Lead + Leadership | Próximas Bets (6 semanas) |
| **Roadmap Review** | Trimestral | Leadership + PM + Tech Lead | Roadmap Atualizado |
| **Security Review** | Mensal | Security Eng + Tech Lead | Vuln Report + Action Plan |

---

## 10. Budget Estimate (High-Level)

| Categoria | R0.9-R1.0 (6 meses) | R1.1-R1.4 (12 meses) | Total 18m |
|-----------|---------------------|----------------------|-----------|
| **Pessoal (CLT + Benefícios)** | R$ 600k | R$ 1.4M | R$ 2.0M |
| **Infra AWS (Prod + Staging)** | R$ 80k | R$ 250k | R$ 330k |
| **Ferramentas (GitHub, SendGrid, Auth0, Forge, Monitoring)** | R$ 50k | R$ 120k | R$ 170k |
| **Segurança (Pen Test, Auditoria, Certificações)** | R$ 30k | R$ 100k | R$ 130k |
| **Contingência (15%)** | R$ 114k | R$ 280k | R$ 394k |
| **TOTAL** | **R$ 874k** | **R$ 2.15M** | **R$ 3.02M** |

---

## 11. Definição de Sucesso do Produto (North Star)

> **Número de Documentos Técnicos Gerenciados Ativamente por Mês**
>
> - **Definição:** Docs com pelo menos 1 ação (upload, aprovação, download, apontamento) nos últimos 30 dias
> - **Meta 18m:** 500.000 docs/mês ativos
> - **Proxy Metrics:** Contratos ativos, Usuários ativos, GRDs emitidas, Horas apontadas

---

## 12. Apêndice: Features Já Entregues (Baseline)

| Épico | Feature | Status | Release Baseline |
|-------|---------|--------|------------------|
| 1 | Auth JWT + Login | ✅ | v0.1 |
| 2 | S3 Presigned Upload + Visualização PDF | ✅ | v0.2 |
| 3 | Approval Workflow (State Machine 3 estágios) | ✅ | v0.3 |
| 4 | Transmittals (GRD) + Worker Python (ZIP/Capa) | ✅ | v0.4 |
| 5 | OCR (Textract → PyMuPDF) + Full-Text Search | ✅ | v0.5 |
| 6 | ContractDiscipline CRUD + User Invite | ✅ | v0.6 |
| 7 | WorkPackage CRUD + Document Linking | ✅ | v0.7 |
| 8 | Document Detail (SSOT) + Advanced Search | ✅ | v0.8 |
| 9 | Hierarchy (Client>Project>Contract) + TimeLog + DocumentLink | ✅ | v0.8 |
| 10 | Strict Approval Engine + Client Portal Isolation | ✅ | v0.8 |
| 11 | MDR Export (Excel) | ✅ | v0.8 |
| 12 | Audit Logs (Data Room) | ✅ | v0.8 |
| 13 | PyMuPDF OCR + Full-Text Search Nativo | ✅ | v0.8 |

**Baseline Atual:** `v0.8` — Funcional mas **NÃO PRONTO PARA PRODUÇÃO** (ver Technical Debt)

---

> **Próxima Atualização:** Sprint 1 Planning (pós-R0.9)  
> **Owner:** Product Manager + Tech Lead