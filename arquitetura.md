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
        /projects    -> (Nota: A renomear futuramente para /contracts)
        /documents   -> Domínio de documentos e revisões
          - document.controller.ts
          - document.routes.ts
      - server.ts    -> Ponto de entrada
      - prisma.ts    -> Instância Singleton do ORM

---

## ✅ Progresso Atual (O que já temos rodando)
- Banco de Dados Multi-Tenant conectado (Neon DB) e populado com Seed.
- Autenticação JWT implementada e trancando rotas (CORS ativo).
- Padrão de Upload alterado de Disco Local para AWS S3 (operando via buffer de memória).
- Transações atômicas criadas para o roteamento inicial de Documentos (R0).
- **[ÉPICO 1 CONCLUÍDO] Portal do Cliente (Frontend):** - Aplicação React inicializada com Vite + TS + Tailwind v4 (Feature-Sliced Design).
  - Tela de Login operando com Context API e persistência de Token JWT via Axios interceptors.
  - Dashboard de Contratos dinâmico, listando obras baseadas no controle de acesso (RBAC) do usuário.
  - Componente corporativo de Upload (Drag & Drop) integrado ao endpoint S3.

## 🚀 Próximas Etapas (Épicos de Resultado Expressivo)

Com a fundação do Frontend e Backend estabelecida, o foco agora é a usabilidade e o fluxo de engenharia dentro dos contratos:

### ÉPICO 2: Workflow de Aprovação, Revisões e Visualização
- Desenvolver a "Área Exclusiva do Contrato" no Frontend, roteando para painéis específicos baseados na *role* do usuário (GESTOR, ENGENHEIRO, LEITOR).
- Refatorar o endpoint atual de `uploadRevision` (R1, R2) para enviar os novos arquivos para a AWS S3 de forma fluida.
- Implementar visualizador de PDF/Imagens nativo na interface React.

### ÉPICO 3: Automação (Transmittals e IA)
- Funcionalidade de gerar GRD (Guia de Remessa) compilando múltiplos arquivos do S3 em um ZIP estruturado com protocolo.
- Preparação do terreno para RPA em Python para extração de selos via OCR.