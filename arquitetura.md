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

---

## 🚀 Próximas Etapas (Roadmap Prioritário)

### FASE 1: Fundações Operacionais (O Básico Essencial)

**ÉPICO 6: Dashboard Inicial e Gestão de Contratos**
- **Painel do Gestor:** Interface para o Gerente do Contrato gerenciar a equipe, convidando usuários e atribuindo responsabilidades por disciplina (ex: João aprova Elétrica, Maria aprova Civil).
- **Dashboard de Entrada:** Tela inicial ao logar apresentando KPIs rápidos (total de documentos pendentes, guias de remessa recentes, aprovações pendentes do usuário logado).

**ÉPICO 7: Módulo de Planejamento e Coordenação**
- **Área do Planejamento:** View dedicada com permissões específicas para a equipe de controle. Terão a capacidade de iniciar a subida de "R0s (Planejado)" (placeholders) e extrair relatórios de cronograma vs. realizado.

> **✅ CONCLUÍDO:** O Épico 8 (Detalhamento de Documentos) foi finalizado. A tela `/documentos/:id` está ativa como "Single Source of Truth" para cada arquivo, com metadados reais, histórico de revisões e status OCR.

**ÉPICO 9: Histórico de Devolutivas (Markups) e Bloqueio de Revisões**
- **Fluxo de Retrabalho:** Melhoria na justificativa de rejeição. Criar a funcionalidade de registrar comentários detalhados/devolutivas do cliente na Revisão Rejeitada.
- **Regra de Negócio:** A subida de uma nova revisão (ex: R1) só será permitida pelo sistema se houver um histórico de devolutiva claro na revisão anterior (R0), garantindo rastreabilidade do motivo da alteração.

**ÉPICO 10: Sistema de Notificações Internas**
- **Comunicação:** Entidade no banco para registrar alertas (ex: "Você tem 5 novos documentos aguardando aprovação") visíveis no sino (bell icon) do menu superior do Frontend.

### FASE 2: Inovações para TOP 1 de Mercado (Pós-Fundações)

**ÉPICO 11: Markup e Redlining Visual Nativo**
- Ferramenta no navegador para o Engenheiro desenhar sobre o PDF da planta (círculos, marcações, textos) apontando o erro, sem precisar baixar e usar outro software.

**ÉPICO 12: Mobilidade e Acesso Offline (PWA)**
- Transformar o frontend em um App Progressivo. O mestre de obras sincroniza os dados no escritório, vai para o canteiro (sem internet), lê a planta e aprova/comenta; o sistema sincroniza sozinho quando o tablet voltar à rede.

**ÉPICO 13: Conformidade Global (ISO 19650)**
- Módulo onde o Gestor cadastra máscaras de nomenclatura rígidas. O upload só passa se o nome do arquivo seguir estritamente a máscara global definida para o contrato.

**ÉPICO 14: Comparação de Plantas por Visão Computacional**
- Utilizar o Worker Python para sobrepor a Revisão R0 e a Revisão R1 automaticamente, destacando em vermelho o que foi removido e em verde o que foi desenhado de novo na nova planta.