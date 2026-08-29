# GED Engenharia — Documento Mestre (Arquitetura)

## Objetivo
Este documento é o "cérebro" do projeto GED Engenharia. Reúne decisões arquiteturais, convenções, modelo de dados e passos de infraestrutura para que todas as tarefas subsequentes sejam tomadas de forma consistente.

## Visão Geral do Produto
- **Problema:** Sistemas genéricos de GED não atendem requisitos críticos da engenharia (versionamento rigoroso, visualização de DWG/PDFs, workflows de aprovação, metadados técnicos).
- **Solução:** Plataforma SaaS B2B Multi-Tenant otimizada para gestão corporativa, com controle de revisões nativo, auditoria, armazenamento escalável em nuvem e APIs rápidas.

## Requisitos Não-Funcionais (Principais)
- **Performance:** Baixa latência para listagem e preview nativo no navegador.
- **Segurança (RBAC):** Controle de acesso granular por contrato via JWT.
- **Isolamento de Dados (Multi-Tenant):** Clientes diferentes nunca enxergam dados uns dos outros.
- **Escalabilidade e Nuvem:** Arquivos físicos residem na AWS S3; o banco de dados opera em Serverless (Neon DB). Processamento pesado ocorre em background via mensageria.

## Stack Tecnológica Consolidada
- **Backend API:** Node.js + TypeScript + Express.
- **Mensageria / Integração:** AWS SQS (Simple Queue Service) para processamento assíncrono.
- **ORM & Banco de Dados:** Prisma 7 + PostgreSQL (Neon DB com adapter @prisma/adapter-pg).
- **Autenticação:** JSON Web Tokens (JWT) com bcrypt.
- **Storage (Nuvem):** AWS S3 (via `@aws-sdk/client-s3` com uploads via RAM).
- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4.
- **Microsserviços (Background Jobs):** Python (Processamento OCR com AWS Textract e RPA).

## Design de Entidades Core (Prisma Schema Atualizado)
A fundação de dados suporta múltiplos clientes e uma estrutura hierárquica robusta:
1. **Hierarquia Estrutural:** O sistema segue a ramificação `Client` (ex: Vale S.A.) ➔ `Project` (ex: Mina Norte) ➔ `Contract` (ex: Expansão).
2. **User & ContractMembership (Cargos vs Papéis):** Usuários existem globalmente. O acesso é ditado pela tabela pivô `ContractMembership`. Há uma separação estrita:
   - **JobTitle (Tag Visual):** "Engenheiro Junior", "Projetista", "Analista de Planejamento", "Arquivo Técnico". Apenas para sinalização.
   - **WorkflowRole (Permissões Sistêmicas):** "Elaborador", "Verificador", "Aprovador", "Planejador", "Coordenador", "Emissor" (quem emite GRD).
3. **Document:** Metadados imutáveis de um arquivo técnico (ex: Código "VALE-CIV-PLA-001"). Pertence a um `Contract`. O cadastro pelo planejamento/disciplina deve apenas anexar o documento e iniciar o fluxo.
4. **Revision:** O histórico físico (R0, R1, R2). Apenas a URL do AWS S3 e o Hash ficam salvos aqui.
5. **ApprovalWorkflow:** Entidade 1-para-1 com a Revisão, audita solicitações, aprovações, datas e justificativas. Identifica automaticamente se a ação foi de um membro interno (time) ou externo (cliente).
6. **TimeLog (Horas):** Controle de horas gastas por documento/pacote para extração de relatórios pelo planejamento.

## Regras de Negócio Core
- **Imutabilidade de Versão:** Um documento nasce na R0. Nova alteração gera a R1, marcando a R0 como "OBSOLETO". O ID raiz não muda.
- **Bloqueio de Revisão (Gatekeeper):** Só é permitido subir uma nova revisão após a anterior passar por todo o fluxo (verificar, aprovar e não ter comentários pendentes). O histórico de devolutiva é obrigatório.
- **Isolamento e Segurança:** Nenhuma rota acessível sem JWT. Nenhuma listagem global; queries filtradas obrigatoriamente pelas permissões do `userId`.
- **Webhooks Internos:** Rotas protegidas por *secrets* (`x-internal-secret`) para evitar manipulação externa.

## Estrutura de Pastas (Backend)
Divisão estrita baseada em Domain-Driven Design (DDD):
    /src
      /middlewares   -> Lógica de interceptação (auth.middleware.ts, upload.ts)
      /services      -> Integrações externas (s3.service.ts, sqs.service.ts)
      /modules
        /auth        -> Domínio de autenticação (Login)
        /projects    -> Domínio de hierarquia (Clientes, Projetos, Contratos)
        /documents   -> Domínio de documentos, revisões e webhooks
        /approvals   -> Domínio do workflow de aprovação
        /dashboard   -> Domínio do Dashboard Geral de Indicadores
        /transmittals -> Domínio de guias de remessa (GRD)
      - server.ts    -> Ponto de entrada
      - prisma.ts    -> Instância Singleton do ORM

---

## ✅ Progresso Atual (O que já temos rodando)
- **[ÉPICO 1] Portal do Cliente:** Auth JWT, Dashboard dinâmico e RBAC.
- **[ÉPICO 2] Integração S3 e Visualização:** Tabela de docs, viewer nativo e fluxo S3 blindado.
- **[ÉPICO 3] Fluxo de Aprovações:** `ApprovalWorkflow`, painel de aprovações e transações Prisma.
- **[ÉPICO 4] Automação e Transmittals:** GRDs e microserviço Python de Capa de Lote.
- **[ÉPICO 5] Extração IA/OCR:** Fila SQS, Worker Python Textract, Webhook interno.
- **[ÉPICO 6] Gestão de Contratos:** Módulo `management` com CRUD de Disciplinas e gestão de usuários multi-tenant.
- **[ÉPICO 7] Planejamento e Coordenação:** Gestão de `WorkPackage`, integração com Upload (`contractDisciplineId` e `workPackageId`). O campo legado `disciplina` (enum) foi removido com sucesso.
- **[ÉPICO 8] Detalhamento:** Tela `/documentos/:id` como Single Source of Truth com timeline de revisões e histórico.
- **[ÉPICO 8] Refinamento Visual e UI/UX (Concluído):** Identidade visual própria na Topbar (marca "GED Engenharia" + ícone de Nuvem), Top Navigation Bar substituindo a Sidebar, nomes/códigos de documentos clicáveis (atalho principal para o detalhamento via `/contracts/:contractId/documents/:documentId`) e Modal de "Histórico de Versões" com acesso rápido ao clicar no ícone de Relógio na listagem.
- **[ÉPICO 9] Estruturação Hierárquica e Apontamento de Horas (✅ CONCLUÍDO):** Modelos `Project`, `TimeLog` e `DocumentLink` criados no Prisma; `Contract` ganhou `projectId` opcional (retrocompatibilidade). Backend: módulo `timesheets` (CRUD de horas com `userId` do JWT + isolamento multi-tenant por membership do contrato) e `GET /projects` agora devolve a árvore completa `Clientes > Projetos > Contratos`. Frontend: seção "Apontamento de Horas" no detalhamento do documento (`TimesheetForm`, `TimesheetList`, `useTimesheet`) e Dashboard agrupado por Cliente/Projeto.
- **[ÉPICO 11] Exportação de MDR (✅ CONCLUÍDO):** Rota `GET /documents/export/mdr` (backend) gerando Excel com metadados consolidados do contrato (Código, Título, Disciplina, Pacote, Revisão, Status, Data). Botão "Exportar MDR" no frontend (DocumentList) com download via blob.
- **[ÉPICO 10] Fluxograma Visual e Motor de Aprovação Estrito (✅ CONCLUÍDO):** Motor de aprovação estrito com status exatos `APROVADO`, `APROVADO_COM_COMENTARIOS`, `REPROVADO` e `PENDENTE` no `ApprovalWorkflow`; campo `isClient` em `ApprovalWorkflow` e `User` para diferenciar atores internos (Time) de externos (Cliente). GATEKEEPER no upload de novas revisões: a revisão anterior precisa estar finalizada e sem pendências em aberto (senão `403`). Frontend: dropdown com as ações exatas "Aprovar sem comentários", "Aprovar com comentários" e "Reprovar"; timeline diferencia visualmente comentários do Time (azul) e do Cliente (laranja); botão "Visualizar Fluxo" com modal de Fluxograma horizontal (Elaboração ➔ Verificação ➔ Revisão Verificação ➔ Aprovação ➔ Revisão Aprovação) destacando a etapa atual.
- **[ÉPICO 12] Trilha de Auditoria / Data Room (✅ CONCLUÍDO):** Model `AuditLog` com `action`, `entity`, `entityId`, `details` (JSON), `ipAddress`, `createdAt`. Relação multi-tenant com `User` e `Contract`. Backend: `AuditService.log()` + `GET /audit-logs` (protegido por GESTOR). Intercepção em controllers de Documento (upload, nova revisão), Aprovações (aprovação/rejeição) e Transmittals (emissão de GRD). Frontend: aba "Trilha de Auditoria" no módulo de Gestão com tabela visual de sistema de segurança.
- **[ÉPICO 9] Busca Avançada (Filtros da Listagem) (✅ CONCLUÍDO — Fecha a Fase 1):** `GET /documents` aceita query params combináveis `busca` (contains case-insensitive em `codigo`/`titulo`), `disciplinaId` (`contractDisciplineId`) e `pacoteId` (`workPackageId`). Frontend (DocumentList): estados ligados à Toolbar do Acervo Técnico (input de pesquisa + selects de Disciplina e Pacote populados via `/disciplines` e `/work-packages`) com debounce de 400ms. As condições operam em conjunto com o RBAC do Portal do Cliente (PATCH 10.4 — `stage: CLIENTE`).
- **[DASHBOARD]** KPI consolidados (documentos por disciplina, status, pendências, últimas GRDs).

---

## 🛠️ Dívida Técnica / Refinamento Futuro
### Dashboard Operacional
- **Refatorar UI para Custom Hooks:** Extrair lógica do `DashboardOperacional.tsx` para `useDashboard`.
- **Validação Zod no Controller:** Migrar validações manuais de `contractId` para schemas Zod (`body` e `query params`).
- **Índices Prisma:** Adicionar `@@index` em `contractId` e datas nas models de agregação para otimizar queries pesadas.

---

## 🚀 Próximas Etapas (Roadmap Prioritário & Plano de Ação)

### FASE 1: Fundações Operacionais e UX Refinada — ✅ CONCLUÍDA

**ÉPICO 9: Estruturação Hierárquica e Apontamento de Horas** _(✅ CONCLUÍDO)_
- **Hierarquia Real:** Navegação de pastas/estruturas agrupando Cliente > Projetos > Contrato (modelos `Project`, `Contract.projectId`).
- **Controle de Horas (Timesheet):** Lançamento de horas trabalhadas por documento para relatórios analíticos do Planejamento (módulo `timesheets`).
- **Relacionamentos (Anexos):** Vínculos entre documentos (model `DocumentLink`).

**ÉPICO 10: Fluxograma Visual e Motor de Aprovação Estrito** _(✅ CONCLUÍDO)_
- **Fluxograma Interativo:** Botão "Visualizar Fluxo" exibindo graficamente o estado atual: *Elaboração ➔ Verificação ➔ Revisão Verificação ➔ Aprovação ➔ Revisão Aprovação*.
- **Controle Estrito de Caixa de Comentários:** Ações exatas **"Aprovado sem comentários"**, **"Aprovado com comentários"** e **"Reprovado"**.
- **Identificação de Atores:** Timeline sinaliza visualmente se o comentário/reprovação foi da equipe interna ou do Cliente (`isClient`).

**ÉPICO 11: Exportação de MDR (Master Document Register)** _(✅ CONCLUÍDO)_
- Rota backend `GET /documents/export/mdr` gerando planilha Excel (.xlsx) com colunas: Código, Título, Disciplina, Pacote, Revisão Atual, Status do Workflow e Data da Última Revisão.
- Frontend: botão "Exportar MDR" na toolbar de filtros do DocumentList, download via blob com nomenclatura `MDR_Contrato_Data.xlsx`.

**ÉPICO 12: Trilha de Auditoria (Data Room & Audit Logs)** _(✅ CONCLUÍDO)_
- **Model `AuditLog`:** Registro imutável de ações críticas com `userId`, `contractId`, `action`, `entity`, `entityId`, `details` (JSON), `ipAddress` e `createdAt`.
- **Serviço de Auditoria:** Helper síncrono `AuditService.log()` invocado em controllers de Documentos, Aprovações e Transmittals.
- **Rota `GET /audit-logs`:** Protegida por RBAC (apenas GESTOR), retorna logs do contrato ordenados por data DESC.
- **Frontend (Data Room):** Aba "Trilha de Auditoria" no módulo de Gestão com tabela visual de segurança (monoespaçada).

**Busca Avançada (Filtros da Listagem)** _(✅ CONCLUÍDO — fechou a Fase 1)_
- `GET /documents` aceita query params combináveis `busca`, `disciplinaId` e `pacoteId`, operando em conjunto com o RBAC do Portal do Cliente (PATCH 10.4).
- Frontend: input de pesquisa + selects de Disciplina e Pacote na Toolbar do Acervo Técnico, com debounce de 400ms.

### FASE 2: Inovações para TOP 1 de Mercado (Diferenciais)

**ÉPICO 13: OCR Autônomo e Full-Text Search Nativo**
- Melhorar o Worker Python para realizar a leitura total do PDF (não apenas do selo) de forma silenciosa e autônoma, permitindo que a barra de busca encontre "palavras que contenham dentro do PDF" e retorne o documento na listagem.

**ÉPICO 14: Visualizadores Avançados, Markup e Redlining**
- **PDF Comentado Gerado por IA:** Fazer com que os comentários do verificador gerem automaticamente um novo arquivo concatenado chamado `XXX-XXX-XXX_RX_Comentado.pdf`.
- **Visualizador DWG:** Integrar um visualizador nativo de arquivos CAD no navegador para complementar a visualização de PDF. (Será refinado caso exija APIs pagas como Autodesk Forge).

**ÉPICO 15: Notificações, Conformidade (ISO 19650) e PWA**
- Implementação de Máscaras de nomenclatura rígidas para o contrato.
- Acesso Offline via App Progressivo (PWA) e Alertas de Sino/E-mail para os usuários.