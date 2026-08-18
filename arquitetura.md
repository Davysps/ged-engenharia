# GED Engenharia — Documento Mestre (Arquitetura)

## Objetivo
Este documento é o "cérebro" do projeto GED Engenharia. Reúne decisões arquiteturais, convenções, modelo de dados e passos de infraestrutura para que todas as tarefas subsequentes sejam tomadas de forma consistente.

## Visão Geral do Produto
- **Problema:** Sistemas genéricos de GED não atendem requisitos críticos da engenharia (versionamento rigoroso, visualização de DWG/PDFs, workflows de aprovação, metadados técnicos).
- **Solução:** Plataforma SaaS B2B Multi-Tenant otimizada para gestão de contratos corporativos, com controle de revisões nativo, auditoria, armazenamento escalável em nuvem e APIs rápidas.

## Requisitos Não-Funcionais (Principais)
- **Performance:** Baixa latência para listagem e preview nativo no navegador.
- **Segurança (RBAC):** Controle de acesso granular por contrato (GESTOR, ENGENHEIRO, APROVADOR, LEITOR, PLANEJAMENTO) via JWT.
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
A fundação de dados foi migrada para suportar múltiplos clientes:
1. **Client & Contract:** A hierarquia principal. Um `Client` (ex: Vale S.A.) possui vários `Contract` (ex: Expansão Mina Norte).
2. **User & ContractMembership:** Usuários existem globalmente, mas o acesso aos contratos é ditado pela tabela pivô `ContractMembership`, que define a *role* específica daquele usuário naquele contrato.
3. **Document:** Metadados imutáveis de um arquivo técnico (ex: Código "VALE-CIV-PLA-001", Disciplina "CIVIL"). Pertence a um `Contract`. Atualizado com campos dinâmicos extraídos via IA.
4. **Revision:** O histórico físico. Cada documento tem 1 ou N revisões (R0, R1, R2). Apenas a URL do AWS S3 e o Hash ficam salvos aqui.
5. **ApprovalWorkflow:** Entidade com relação 1-para-1 com a Revisão, responsável por auditar quem solicitou, quem aprovou/rejeitou, a data e a justificativa técnica.

## Regras de Negócio Core
- O versionamento é imutável. Um documento nasce na R0. Se houver alteração, sobe-se um novo arquivo gerando a R1, marcando a R0 como "OBSOLETO". O ID do documento raiz não muda.
- Nenhuma rota de negócios pode ser acessada sem um Token JWT válido no cabeçalho (Bearer).
- Nenhuma listagem deve retornar dados globais; toda query (GET) deve ser filtrada obrigatoriamente pelas permissões do `userId` extraído do Token.
- Rotas de Webhook internas devem ser estritamente protegidas por *secrets* (`x-internal-secret`) para evitar manipulação externa de status de documentos.

## Estrutura de Pastas (Backend)
Mantemos a divisão estrita baseada em Domain-Driven Design (DDD):
    /src
      /middlewares   -> Lógica de interceptação (auth.middleware.ts, upload.ts)
      /services      -> Integrações externas (s3.service.ts, sqs.service.ts)
      /modules
        /auth        -> Domínio de autenticação (Login)
        /projects    -> Domínio de contratos e obras
        /documents   -> Domínio de documentos, revisões e webhooks
        /approvals   -> Domínio do workflow de aprovação
        /dashboard   -> Domínio do Dashboard Geral de Indicadores Operacionais
        /transmittals -> Domínio de guias de remessa (GRD)
      - server.ts    -> Ponto de entrada
      - prisma.ts    -> Instância Singleton do ORM

---

## ✅ Progresso Atual (O que já temos rodando)

- **[ÉPICO 1 CONCLUÍDO] Portal do Cliente (Frontend):** Autenticação JWT, Dashboard básico de Contratos dinâmico e controle de acesso (RBAC).
- **[ÉPICO 2 CONCLUÍDO] Integração S3, Revisões e Visualização:** Tabela de documentos, visualizador nativo e fluxo de Upload para AWS S3 blindado no Node.js.
- **[ÉPICO 3 CONCLUÍDO] Integração do Fluxo de Aprovações:** Entidade `ApprovalWorkflow` atrelada às revisões, painel de aprovações com RBAC e transações atômicas no Prisma.
- **[ÉPICO 4 CONCLUÍDO] Automação e Transmittals:** Geração de pacotes de guias de remessa e microsserviço Python que cria a "Capa de Lote" em PDF.
- **[ÉPICO 5 CONCLUÍDO] Extração Inteligente de Metadados (IA / OCR):** Fila SQS, Worker Python com AWS Textract para leitura de carimbos/selos e Webhook interno atualizando status de OCR.
- **[ÉPICO 8 CONCLUÍDO] Detalhamento de Documentos (Single Source of Truth):** Tela `/documentos/:id` com ficha completa do documento — metadados reais via Prisma, status de extração OCR/RPA, linha do tempo de revisões com histórico de aprovação/rejeição e referências de Transmittals. Tipagem rigorosa no frontend (`import type`, `TransmittalItemDetail`, `RevisionDetail`, asserções de não-nulidade para configurações de status).
- **[DASHBOARD CONCLUÍDO] Dashboard Geral de Indicadores Operacionais:** Tela de Visão Geral do Contrato (`/contracts/:contractId`) com KPIs consolidados — documentos por disciplina, status de revisões, fila de trabalho (top 5 pendências de aprovação) e histórico recente (últimas 5 GRDs). API backend em `src/modules/dashboard/` com isolamento multi-tenant rigoroso (RBAC via `ContractMembership`). Frontend em `ged-frontend/src/features/dashboard/` com Tailwind v4, tipagem rigorosa (`verbatimModuleSyntax`, `import type`) e tratamento de estados de loading/error.

---

## 🛠️ Dívida Técnica / Refinamento Futuro

### Dashboard Operacional
- **Refatorar UI para Custom Hooks:** A tela `DashboardOperacional.tsx` ainda realiza chamadas diretas via `dashboardService` dentro de `useEffect`. Recomenda-se extrair a lógica de fetch para um hook customizado (`useDashboard`) para melhorar a reutilização e testabilidade.
- **Validação Zod no Controller:** O controller do dashboard valida `contractId` manualmente com `parseInt` e `isNaN`. Recomenda-se migrar para schemas Zod validando `body` e `query params` antes de chegar ao Service, garantindo consistência com o novo módulo de Gestão.
- **Índices Prisma para otimizar agregações:** As queries de agregação (`groupBy`, `findMany` com `include` aninhado) do dashboard não possuem índices compostos otimizados. Recomenda-se adicionar `@@index` em `contractId` e campos de data nas models `Document`, `Revision`, `ApprovalWorkflow` e `Transmittal` para acelerar as consultas de KPIs.

## 🚀 Próximas Etapas (Roadmap Prioritário)

### FASE 1: Fundações Operacionais (O Básico Essencial)

**ÉPICO 6: Dashboard Inicial e Gestão de Contratos**
- **Painel do Gestor:** Interface para o Gerente do Contrato gerenciar a equipe, convidando usuários e atribuindo responsabilidades por disciplina (ex: João aprova Elétrica, Maria aprova Civil).
- **✅ CONCLUÍDO:** Implementado o módulo `management` com CRUD completo de Disciplinas (`ContractDiscipline`) e gestão de usuários (listagem + convite). Backend em `src/modules/management/` (schemas Zod, service DDD, controller fino, routes protegidas por JWT) e frontend em `src/features/management/` (hooks, components, pages). RBAC: apenas `GESTOR` pode criar/editar/remover disciplinas e convidar usuários; todos os membros podem listar. Multi-tenant: todas as queries filtradas por `contractId` validado via `ContractMembership`.
- **Dashboard de Entrada:** ✅ **CONCLUÍDO** — Tela de Visão Geral do Contrato (`/contracts/:contractId`) apresentando KPIs consolidados: total de documentos por disciplina, contagem de documentos por status de revisão (Aprovado, Em Revisão, Rejeitado, etc.), top 5 pendências de aprovação mais recentes e histórico das 5 últimas Transmittals emitidas. Todos os dados são filtrados obrigatoriamente pelo `contractId` (tenant) com verificação de membro via `ContractMembership`.

**ÉPICO 7: Módulo de Planejamento e Coordenação**
- **Área do Planejamento:** View dedicada com permissões específicas para a equipe de controle. Terão a capacidade de iniciar a subida de "R0s (Planejado)" (placeholders) e extrair relatórios de cronograma vs. realizado.

> **✅ CONCLUÍDO (ÉPICO 7 — Planejamento + Integração 7.5):** O Módulo de Planejamento e Coordenação foi **finalizado**. Entregas:
> - **Gestão de Pacotes de Trabalho (`WorkPackage`):** model Prisma, API em `src/modules/planning/` (Zod + DDD + RBAC GESTOR) e feature frontend em `ged-frontend/src/features/planning/` (Custom Hooks `usePlanning` + Tailwind v4), sempre com isolamento multi-tenant por `contractId`.
> - **Integração com Documentos (Épico 7.5):** o model `Document` ganhou vínculos opcionais `workPackageId` e `contractDisciplineId` (FKs para `WorkPackage` e `ContractDiscipline`). O backend de upload (`document.controller.ts`) converte estes IDs (strings do FormData → Int) e os persiste no `prisma.document.create()`. O formulário de upload (`ged-frontend/src/features/documents/components/UploadForm.tsx`) agora consome `usePlanning(contractId)` e `useDisciplines(contractId)` e permite vincular o documento à Disciplina do Contrato e ao Pacote de Trabalho ao submeter o R0. **ÉPICO 8 (Refinamento Visual e Limpeza Arquitetural):** o campo legado `disciplina` (enum) foi **removido** do model `Document` — o vínculo depende agora exclusivamente de `contractDisciplineId` e `workPackageId` (backend, seed e frontend atualizados).

> **✅ CONCLUÍDO:** O Épico 8 (Detalhamento de Documentos) foi finalizado. A tela `/documentos/:id` está ativa como "Single Source of Truth" para cada arquivo, com metadados reais, histórico de revisões e status OCR.

> **✅ CONCLUÍDO:** O Dashboard Geral de Indicadores Operacionais foi entregue. A rota `GET /dashboard?contractId=X` retorna KPIs consolidados, status de revisões, fila de trabalho e histórico recente. A tela está integrada como a Visão Geral do Contrato em `/contracts/:contractId`.

**ÉPICO 8: Refinamento Visual e Limpeza Arquitetural**
- **🔄 INICIADO (Épico 8) — Busca Avançada e Limpeza:** Remoção do campo legado `disciplina` (enum) do model `Document` (o vínculo passa a depender exclusivamente de `contractDisciplineId` e `workPackageId`), limpeza do backend (schemas Zod, controller e service) e busca avançada nos filtros de listagem (`busca`, `disciplinaId`, `pacoteId`). Frontend com Toolbar de Busca Avançada em `DocumentList.tsx` e remoção do input legado em `UploadForm.tsx`.
- **🔄 INICIADO (Épico 8) — Redesign: Menu Superior (Topbar):** Substituição do layout de Sidebar (Barra Lateral) por uma Top Navigation Bar moderna em `ContractLayout.tsx` (Tailwind v4), com o nome do contrato atual e links horizontais (Dashboard, Documentos, Transmittals, Planejamento, Gestão).

**ÉPICO 9: Histórico de Devolutivas (Markups) e Bloqueio de Revisões**
- **Fluxo de Retrabalho:** Melhoria na justificativa de rejeição. Criar a funcionalidade de registrar comentários detalhados/devolutivas do cliente na Revisão Rejeitada.
- **Regra de Negócio:** A subida de uma nova revisão (ex: R1) só será permitida pelo sistema se houver um histórico de devolutiva claro na revisão anterior (R0), garantindo rastreabilidade do motivo da alteração.

**ÉPICO 10: Sistema de Notificações Internas**
- **Comunicação:** Entidade no banco para registrar alertas (ex: "Você tem 5 novos documentos aguardando aprovação") visíveis no sino (bell icon) do menu superior do Frontend.

**🔒 PENDENTES PARA FECHAR A FASE 1 (Excelência B2B):**
- **Trilha de Auditoria:** Logs de eventos críticos (criação/edição/exclusão de documentos, revisões, aprovações, GRDs e Work Packages) persistidos com `userId`, `contractId`, timestamp e payload, garantindo rastreabilidade completa exigida pelo mercado corporativo.
- **Notificações In-App/Email:** Alertas de fluxos e GRDs (novas aprovações, revisões rejeitadas, transmittals emitidos) entregues no sino do Frontend e/ou por e-mail aos membros do contrato.
- **Exportação de MDR — Master Document Register (Excel/CSV):** Exportação do registro mestre de documentos do contrato em planilha, respeitando o isolamento multi-tenant por `contractId`.
- **Busca Avançada e Filtros Refinados:** Busca por código/título/disciplina/status com filtros combináveis nas listagens de documentos, revisões e GRDs.
- **🔄 INICIADO (Épico 8):** Busca Avançada e Limpeza (filtros `busca`, `disciplinaId`, `pacoteId` em documentos) e Redesign: Menu Superior (Topbar) — ver seção Épico 8 na Fase 1.

### FASE 2: Inovações para TOP 1 de Mercado (Pós-Fundações)

**ÉPICO 11: Markup e Redlining Visual Nativo**
- Ferramenta no navegador para o Engenheiro desenhar sobre o PDF da planta (círculos, marcações, textos) apontando o erro, sem precisar baixar e usar outro software.

**ÉPICO 12: Mobilidade e Acesso Offline (PWA)**
- Transformar o frontend em um App Progressivo. O mestre de obras sincroniza os dados no escritório, vai para o canteiro (sem internet), lê a planta e aprova/comenta; o sistema sincroniza sozinho quando o tablet voltar à rede.

**ÉPICO 13: Conformidade Global (ISO 19650)**
- Módulo onde o Gestor cadastra máscaras de nomenclatura rígidas. O upload só passa se o nome do arquivo seguir estritamente a máscara global definida para o contrato.

**ÉPICO 14: Comparação de Plantas por Visão Computacional**
- Utilizar o Worker Python para sobrepor a Revisão R0 e a Revisão R1 automaticamente, destacando em vermelho o que foi removido e em verde o que foi desenhado de novo na nova planta.
