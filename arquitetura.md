# GED Engenharia — Documento Mestre (Arquitetura)

## Objetivo
Este documento é o "cérebro" do projeto GED Engenharia. Reúne decisões arquiteturais, convenções, modelo de dados e passos de infraestrutura para que todas as tarefas subsequentes sejam tomadas de forma consistente.

## Visão Geral do Produto
- **Problema:** Sistemas genéricos de GED não atendem requisitos críticos da engenharia (versionamento rigoroso, visualização de DWG/PDFs, workflows de aprovação, metadados técnicos).
- **Solução:** Plataforma SaaS B2B Multi-Tenant otimizada para gestão de contratos corporativos, com controle de revisões nativo, auditoria, armazenamento escalável em nuvem e APIs rápidas.

## Requisitos Não-Funcionais (Principais)
- **Performance:** Baixa latência para listagem e preview nativo no navegador.
- **Segurança (RBAC):** Controle de acesso granular por contrato (GESTOR, ENGENHEIRO, APROVADOR, LEITOR) via JWT.
- **Isolamento de Dados (Multi-Tenant):** Clientes diferentes nunca enxergam dados uns dos outros.
- **Escalabilidade e Nuvem:** Arquivos físicos residem na AWS S3; o banco de dados opera em Serverless (Neon DB).

## Stack Tecnológica Consolidada
- **Backend API:** Node.js + TypeScript + Express.
- **ORM & Banco de Dados:** Prisma 7 + PostgreSQL (Neon DB com adapter @prisma/adapter-pg).
- **Autenticação:** JSON Web Tokens (JWT) com bcrypt.
- **Storage (Nuvem):** AWS S3 (via `@aws-sdk/client-s3` com uploads via RAM).
- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4.
- **Processamento Futuro:** Microsserviços em Python (OCR, extração, RPA).

## Design de Entidades Core (Prisma Schema Atualizado)
A fundação de dados foi migrada para suportar múltiplos clientes:
1. **Client & Contract:** A hierarquia principal. Um `Client` (ex: Vale S.A.) possui vários `Contract` (ex: Expansão Mina Norte).
2. **User & ContractMembership:** Usuários existem globalmente, mas o acesso aos contratos é ditado pela tabela pivô `ContractMembership`, que define a *role* específica daquele usuário naquele contrato.
3. **Document:** Metadados imutáveis de um arquivo técnico (ex: Código "VALE-CIV-PLA-001", Disciplina "CIVIL"). Pertence a um `Contract`.
4. **Revision:** O histórico físico. Cada documento tem 1 ou N revisões (R0, R1, R2). Apenas a URL do AWS S3 e o Hash ficam salvos aqui.
5. **ApprovalWorkflow:** Entidade com relação 1-para-1 com a Revisão, responsável por auditar quem solicitou, quem aprovou/rejeitou, a data e a justificativa técnica.

## Regras de Negócio Core
- O versionamento é imutável. Um documento nasce na R0. Se houver alteração, sobe-se um novo arquivo gerando a R1, marcando a R0 como "OBSOLETO". O ID do documento raiz não muda.
- Nenhuma rota de negócios pode ser acessada sem um Token JWT válido no cabeçalho (Bearer).
- Nenhuma listagem deve retornar dados globais; toda query (GET) deve ser filtrada obrigatoriamente pelas permissões do `userId` extraído do Token.

## Estrutura de Pastas (Backend)
Mantemos a divisão estrita baseada em Domain-Driven Design (DDD):
    /src
      /middlewares   -> Lógica de interceptação (auth.middleware.ts, upload.ts)
      /services      -> Integrações externas (s3.service.ts)
      /modules
        /auth        -> Domínio de autenticação (Login)
        /projects    -> Domínio de contratos e obras
        /documents   -> Domínio de documentos e revisões
        /approvals   -> Domínio do workflow de aprovação
      - server.ts    -> Ponto de entrada
      - prisma.ts    -> Instância Singleton do ORM

---

## ✅ Progresso Atual (O que já temos rodando)
- Banco de Dados Multi-Tenant conectado (Neon DB) e populado com Seed.
- Autenticação JWT implementada e trancando rotas (CORS ativo).
- Padrão de Upload alterado de Disco Local para AWS S3 (operando via buffer de memória).
- Transações atômicas criadas para o roteamento inicial de Documentos (R0).
- **[ÉPICO 1 CONCLUÍDO] Portal do Cliente (Frontend):** - Aplicação React inicializada com Vite + TS + Tailwind v4 (Feature-Sliced Design).
  - Tela de Login operando com Context API e persistência de Token JWT.
  - Dashboard de Contratos dinâmico, listando obras baseadas no controle de acesso (RBAC).
- **[ÉPICO 2 CONCLUÍDO] Integração S3, Revisões e Visualização:**
  - Área Exclusiva do Contrato desenvolvida no Frontend.
  - Tabela dinâmica conectada ao banco de dados, exibindo o acervo técnico real.
  - Visualizador de PDF/Imagens Nativo implementado na interface React.
  - Fluxo de Upload blindado no Node.js (criação R0 e novas revisões R1, R2 enviando para S3).
- **[ÉPICO 3 CONCLUÍDO] Integração do Fluxo de Aprovações (Workflow):**
  - Entidade `ApprovalWorkflow` modelada no Prisma com transações atômicas aninhadas (Nested Updates).
  - Controle rígido de Enums e tipagem para evitar falhas silenciosas no ORM.
  - Criação automática de pendências no momento do upload de documentos e revisões.
  - Painel de Aprovações no Frontend consumindo dados reais da API com proteção RBAC (somente GESTOR e APROVADOR processam documentos).
  - Justificativa técnica obrigatória acoplada à rejeição de arquivos.

---

## 🚀 Próximas Etapas (Épicos de Resultado Expressivo)

### ÉPICO 4: Automação e Transmittals (Guias de Remessa)
- **Modelagem:** Criar a tabela `Transmittal` para agrupar documentos aprovados.
- **Backend (Node.js):** Endpoint para selecionar documentos aprovados e gerar o protocolo de envio.
- **Integração Python:** Construir um microsserviço ou script Python responsável por ler os documentos S3 de um Transmittal, gerar um PDF de "Capa de Lote" (com QR Codes) e empacotar tudo num arquivo `.zip`.
- **Frontend:** Nova aba "Transmittals" para visualização e emissão oficial de pacotes para o cliente.

### ÉPICO 5: Extração Inteligente de Metadados (IA / OCR)
- **RPA Python:** Criar um serviço autônomo que, ao receber uma planta em PDF, faz a leitura do "selo" do projeto (carimbo no canto inferior direito).
- **Auto-preenchimento:** Extrair automaticamente Título, Código do Documento e Disciplina para reduzir o trabalho manual do Engenheiro durante o Upload.

### ÉPICO 6: Dashboard Analítico e Relatórios
- **Métricas:** Fornecer ao GESTOR gráficos de tempo médio de aprovação, gargalos por disciplina (ex: "Estrutural demora mais que Elétrica") e volume de revisões.
- **Exportação:** Geração de relatórios em Excel/CSV do acervo técnico atualizado (Lista de Documentos - LD).