# ADR-009: Organização assinante como fronteira do tenant SaaS

- **Status:** Aceito como direção para a migração; implantação ainda pendente
- **Data:** 2026-10-13
- **Contexto:** O produto atende empresas de engenharia que assinam o GED e administram vários clientes externos, projetos e contratos. O schema atual trata `Contract` como tenant e não guarda a organização assinante. `User.isClient` é global, portanto não identifica com segurança em qual organização/projeto a pessoa é externa.

## Decisão

Introduzir `Organization` como raiz do tenant de assinatura, cobrança e configuração. `Client` passa a representar um cliente externo pertencente a uma organização. `Project` e `Contract` permanecem escopos operacionais subordinados. Uma pessoa mantém uma identidade global e pode ter memberships distintas em várias organizações e escopos.

```text
Organization
├── OrganizationMembership (equipe da empresa assinante)
├── Client (cliente externo desta organização)
│   └── Project
│       └── Contract
│           ├── ContractMembership (papel e acesso operacional)
│           └── Documents, revisions, approvals, transmittals, audit
└── TenantSettings (configuração versionada e limitada pelo plano)
```

## Regras de acesso

1. Cada organização assinante vê somente seus clientes, projetos, contratos e dados operacionais.
2. Usuários internos recebem membership na organização; permissões de engenharia continuam atribuídas no contrato, inicialmente pelos papéis existentes.
3. Usuários externos recebem grants explícitos para clientes/projetos/contratos específicos. `isClient` pode permanecer temporariamente para compatibilidade de UI, mas não autoriza acesso.
4. A visibilidade de workflows do cliente é aplicada por grant e estágio no backend. Frontend não decide autorização.
5. Suporte SaaS não recebe bypass cross-tenant implícito. Acesso excepcional requer identidade operacional separada, escopo temporário, justificativa e evento de auditoria.
6. Dados e relações filhos herdam a organização do pai. Policies RLS e constraints compostas devem impedir referências cruzadas entre organizações.
7. Toda query operacional deve executar em contexto de organização validado por membership. Contexto ausente ou inválido falha fechado.

## Configurabilidade

Configurações customizáveis são dados versionados e validados, nunca código por cliente. A primeira versão deve suportar perfis configuráveis de nomenclatura, metadados extras, disciplinas, templates de workflow dentro de limites aprovados, branding e retenção conforme o plano. Cada mudança guarda versão, autor e data; contratos podem fixar uma versão de configuração para não alterar fluxos em andamento.

Regras de isolamento, trilha de auditoria e permissões mínimas não são customizáveis. Feature flags e limites de plano são avaliados no servidor.

## Migração segura

1. Criar `Organization` e as relações novas sem remover os campos atuais.
2. Obter um mapa revisado `Client existente → Organization assinante` a partir do dono dos dados. Não inferir que cada `Client` legado é uma organização assinante.
3. Carregar o mapa em staging e validar contagens, contratos órfãos, memberships, clientes compartilhados e unicidade de códigos/CNPJ no novo escopo.
4. Fazer backfill transacional; manter `contractId` como filtro operacional durante a janela de compatibilidade.
5. Comparar leituras antigas e novas, testar acessos negativos entre organizações e jobs/webhooks, habilitar RLS em modo controlado e validar rollback.
6. Tornar `organizationId` obrigatório apenas depois da reconciliação e dos gates. Remover o modelo legado em migration posterior.

Se o proprietário dos dados não conseguir fornecer o mapa, a migração para produção fica bloqueada; não usar uma organização padrão para absorver dados sem evidência de propriedade.

## Consequências

- Novos cadastros devem criar a organização assinante antes de clientes/projetos/contratos.
- Chaves únicas globais como CNPJ e código de contrato precisam ser revisadas; códigos operacionais devem ser únicos no escopo organizacional apropriado.
- Membership passa a ter contexto organizacional e grants externos com escopo definido.
- RLS deve usar identidade de tenant por transação/conexão, compatível com pool e workers; variável de sessão compartilhada sem reset não é suficiente.
- Billing, limites, white-label e onboarding passam a se vincular à organização.
- A tabela existente `Client` não pode ser simplesmente renomeada para `Organization`: são conceitos diferentes.

## Critérios de aceite da implementação

- Duas organizações não conseguem ler nem alterar dados uma da outra, inclusive por `include`, endpoints de detalhe, exportações, webhooks e workers.
- Usuário externo só enxerga escopos que recebeu por grant e apenas os estágios permitidos.
- Contexto ausente falha fechado; nenhum modelo operacional é consultado sem membership validada.
- Migração reconcilia 100% das entidades e memberships legadas, com relatório de exceções e rollback exercitado.
- Configurações têm schema/versão, autorização, auditoria e testes de compatibilidade.
