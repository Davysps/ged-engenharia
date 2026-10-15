# Plano de evolução para SaaS GED profissional

**Status:** plano inicial, baseado na leitura do repositório em 2026-10-13  
**Objetivo:** sair do GED funcional atual para uma operação SaaS B2B segura, configurável e pronta para venda recorrente.

## Direção do produto

O produto deve atender uma empresa assinante que administra projetos e contratos de engenharia e convida seus próprios clientes para colaborar. Esses clientes externos precisam permanecer isolados dos demais clientes e enxergar somente os projetos, contratos, documentos e etapas autorizados.

O modelo atual usa `Contract` como raiz de tenant e `Client > Project > Contract` como hierarquia. Isso não representa a fronteira de assinatura do SaaS: a entidade assinante (organização/empresa de engenharia) ainda não existe. Antes de escalar clientes, o domínio deve distinguir:

```text
GED SaaS
└── Organização assinante (tenant e fronteira de cobrança/configuração)
    ├── Usuários e papéis da organização
    ├── Clientes externos da organização
    │   └── Projetos
    │       └── Contratos / empreendimentos
    │           └── Documentos, revisões, aprovações e GRDs
    └── Plano, limites, preferências e integrações
```

Uma pessoa pode participar de mais de uma organização ou contrato. Acesso externo é uma concessão explícita a escopos definidos; `User.isClient` sozinho não é uma fronteira de autorização. Configuração flexível deve começar por capacidades suportadas (modelos de workflow, disciplinas, nomenclatura, branding, retenção e permissões), com defaults versionados e validação, em vez de código específico por cliente.

## Diagnóstico do código observado

- Backend Express/TypeScript, Prisma/PostgreSQL, React/Vite e worker Python estão no mesmo repositório; os módulos já cobrem documentos, revisões, aprovação, GRD, planejamento e auditoria.
- `Contract` é a unidade de isolamento, mas `contractId` é lido de query/params/body; ausência de tenant faz a extensão Prisma deixar a consulta seguir sem filtro. A extensão não protege automaticamente relações incluídas nem modelos filhos.
- Login aceitava comparar senha com texto em `senhaHash`; o seed antigo gravava o literal `hash`. O fallback foi removido, cinco contas legadas foram convertidas para bcrypt preservando as senhas armazenadas, e a prévia posterior encontrou zero contas pendentes.
- O script `migrate:legacy-passwords` mantém modo de prévia por padrão; aplicação exige opt-in. O seed agora exige `SEED_DEFAULT_PASSWORD` e grava bcrypt.
- `src/server.ts` aplica allowlist CORS (`CORS_ORIGINS`), Helmet, limite JSON de 1 MB, rate limit global e mais restrito em `/auth`, e confiança configurável de proxy (`TRUST_PROXY_HOPS`). `/health` é liveness sem consumir o rate limit. O armazenamento padrão do rate limit é local à instância e exige store compartilhado antes de escalar horizontalmente.
- Dashboard, aprovações (listagem), planejamento, auditoria, gestão, GRD e exportação MDR agora validam `ContractMembership` em middleware antes do controller; endpoints por ID de documento/revisão continuam exigindo autorização pelo recurso pai e não substituem RLS.
- `package.json` não tem suíte de testes configurada (`npm test` falha por definição). Não há `CHANGELOG.md` no estado observado.
- O `.gitignore` ignora `.env`; a auditoria/contexto existente afirma que houve segredo versionado anteriormente. O histórico Git e credenciais externas precisam ser auditados/rotacionados operacionalmente; remover um arquivo do estado atual não revoga uma credencial.
- A trilha de auditoria é consultável, mas o schema não impede alteração/exclusão no banco. Soft delete, verificação SHA-256, RLS, recuperação e operação/monitoramento ainda não estão prontos para sustentar promessas de compliance/SLA.

## Etapas até venda

Os prazos são faixas para planejamento, não compromissos. Reestimar após inventário de dependências, definição de equipe e desenho de arquitetura.

| Etapa | Resultado | Principais entregas | Gate de saída |
|---|---|---|---|
| **1. Fundação segura e definição do SaaS** | Escopo de piloto e fronteiras de segurança decididos | Inventário de riscos; modelo Organização → Cliente externo → Projeto → Contrato; perfis de configuração suportados; remoção de autenticação insegura; plano de migração e critérios de piloto | Credenciais expostas revogadas; login só com hash seguro; matriz de acesso aprovada; arquitetura e fluxo de migração revisados; testes de segurança planejados |
| **2.1. Autorização no modelo Contract** | Rotas do modelo atual validam associação antes de ler/gravar | Membership centralizada para presign por contrato/documento; checagem de escrita; vínculos documento-disciplina-pacote no mesmo contrato; exclusão de horas requer membership; segredo obrigatório para webhooks e consistência revisão-documento | Usuário sem membership não gera upload assinado, não acessa recursos e não altera callbacks; relações cruzadas são recusadas |
| **2.2. Organization e reconciliação** | Organização assinante é representada sem atribuir dados legados por suposição | Models Organization/Membership, relações aditivas, import do mapa aprovado `Client → Organization`, relatório de reconciliação e plano de rollback | 100% dos clientes/projetos/contratos/memberships legados com destino revisado; staging validado pelo proprietário dos dados |
| **2.3. PostgreSQL RLS e contexto** | Banco aplica isolamento para API, jobs e relações | Contexto transacional seguro para Prisma/Pool; policies em tabelas diretas e filhas; migração reversível; feature gate e workers | Testes negativos entre duas organizações/API/jobs/includes; RLS habilitado sem query tenant-scoped fora de contexto |
| **3. Qualidade, CI e operação piloto** | Mudanças repetíveis e serviço observável | Testes unitários/integrados/E2E; CI; logs estruturados e correlação; health/readiness; backup e restore exercitados; DLQ e alertas; worker containerizado; ambientes staging/prod | Pipeline verde; cobertura e checks de segurança definidos; restore demonstrado; alertas e runbooks exercitados; nenhum segredo em Git/histórico ativo |
| **4. GED Core configurável** | Fluxos comuns atendidos sem forks por cliente | Templates de metadados/nomenclatura; workflows e papéis configuráveis dentro de limites; disciplinas e campos configuráveis; versionamento de configuração; import/export MDR; busca, performance e auditoria | Dois clientes-piloto configurados sem customização exclusiva de código; migrações e versões de configuração compatíveis; métricas de uso e suporte disponíveis |
| **5. Piloto fechado** | Uso real acompanhado e correção de lacunas | Onboarding assistido; importação de documentos; treinamento; suporte; coleta de incidentes e feedback; critérios de segurança, disponibilidade e adoção | Pilotos concluem fluxo real de upload → revisão → aprovação → GRD; incidentes críticos resolvidos; referências e custos de atendimento conhecidos |
| **6. Pronto para vender** | Oferta recorrente clara, contratável e suportável | Planos e limites; billing/faturamento; termos, privacidade/LGPD, DPA e retenção; política de suporte/SLA; processo de onboarding/offboarding/exportação; status e comunicação de incidentes; pricing validado | Contratos e cobrança revisados por especialistas; fluxo de suporte testado; custos unitários e margem entendidos; segurança/privacidade e capacidade operacional aprovadas |
| **7. Lançamento e escala** | Aquisição repetível sem comprometer isolamento ou suporte | Site/demo; materiais comerciais; canal de vendas; métricas de conversão e churn; capacity planning; roadmap de integrações e white-label por demanda | Primeiros clientes pagantes onboarded; métricas e suporte dentro dos limites acordados; plano de escala baseado em uso real |

## Primeira etapa: escopo executável

### Entregas desta rodada

1. Registrar o diagnóstico e os gates de comercialização neste plano.
2. Remover do login a aceitação da senha em texto puro armazenada no campo `senhaHash`.
3. Tratar a arquitetura Organizacional multi-tenant como pré-requisito para liberar qualquer piloto com dados de clientes reais.
4. Fechar CORS por allowlist e permitir configurar a URL da API por ambiente no frontend, sem embutir URL local em builds de staging/produção.

### Concluído nesta implementação local da Etapa 1

- Login aceita apenas bcrypt; script de migração de senhas legadas em modo prévia por padrão; seed exige senha fornecida por ambiente e grava hash.
- CORS por allowlist e URL da API configurável no frontend por ambiente.
- Helmet com CSP e headers padrão; HSTS somente em produção. Limites de payload JSON, requisições gerais e tentativas em `/auth`; `/health` não usa cota da API.
- `TRUST_PROXY_HOPS` explícito para a API identificar IPs por trás de proxy sem confiar cegamente em `X-Forwarded-For`.
- Middleware compartilhado valida membership antes dos controllers das listagens/ações que recebem `contractId` diretamente (dashboard, gestão, planejamento, auditoria, exportação MDR, GRD e listagem de aprovações). Ações por IDs de recursos filhos ainda dependem das verificações de acesso ao recurso pai.
- A Etapa 2 foi dividida em incrementos verificáveis. A Etapa 2.1 fecha as lacunas de autorização do modelo atual; Organization/reconciliação e RLS vêm nas Etapas 2.2 e 2.3.
- ADR-009 define a organização assinante e a migração não assume que `Client` legado equivale a `Organization`.
- Threat model inicial e gates de piloto registrados em [Threat model da fundação SaaS](../architecture/saas-threat-model.md).

### Gates restantes antes de piloto com dados reais

- Verificação local de 2026-10-13: `.env` está ignorado e não apareceu nas refs/objetos alcançáveis deste checkout. Ainda é necessário revisar clones/forks e verificar/rotacionar as credenciais nos provedores (banco, AWS, JWT e webhooks), pois a auditoria anterior registra exposição.
- Revisar clones/forks, confirmar validade das credenciais registradas no histórico e rotacionar DB, AWS, JWT e webhook conforme aplicável; essa ação depende de acesso aos provedores.
- Impor troca de senha fraca/default e implementar fluxo de redefinição antes de convidar usuários reais. Não há provedor de e-mail nem configuração segura de envio registrada neste repositório.
- Preparar e revisar o mapa de propriedade legado `Client → Organization` com o proprietário dos dados; não iniciar backfill sem reconciliação e rollback ensaiado.
- Aprovar a matriz de permissões e critérios do piloto com os responsáveis de produto/segurança. O threat model nesta etapa é inicial e não substitui revisão independente.
- Antes de deploy com várias réplicas, configurar store compartilhado (ex.: Redis) para rate limit; confirmar número de proxies confiáveis e origens reais de staging/produção.
- Configurar alertas, restore de backup, DLQ/retentativa de worker, CI com suíte de segurança e operação de suporte; pertencem às etapas seguintes e bloqueiam venda.
- Avaliar e tratar findings do `npm audit`; atualização automática sem major não elimina todos os advisories, e dependências sem correção disponível precisam de substituição ou mitigação documentada.

### Critério de encerramento da Etapa 1

Etapa de fundação no código e documentação concluída; etapa **não significa autorização para piloto nem venda**. O gate permanece fechado até os itens externos acima serem evidenciados, a matriz de acesso ser aprovada e os riscos sem correção receberem decisão explícita. Implementação de `Organization`, PostgreSQL RLS e isolamento entre organizações pertence à Etapa 2.

## Sequenciamento técnico recomendado

1. Não adicionar features comerciais antes de os gates das Etapas 1–3 serem atendidos.
2. Projetar e migrar a fronteira Organization antes de adicionar billing, white-label ou self-service admin; esses recursos dependem de tenant correto.
3. Implementar a política de configuração como dados tipados e versionados, com defaults e limites do plano; evitar campos livres que alterem regras de segurança.
4. Executar migração em staging com cópia representativa, validar contagens e integridade, manter plano de rollback e só então migrar produção.
5. Fazer pilotos fechados antes da venda aberta. A venda depende também de suporte, termos/privacidade, cobrança, onboarding, backup/restore e resposta a incidentes, não só de features.

## Decisões que precisam de ADR

- `Organization` como tenant de assinatura, com `Contract` como escopo operacional filho.
- Modelo de colaboração entre a organização de engenharia e seus clientes externos, incluindo convites e escopo de acesso.
- Configuração por organização/contrato: campos, nomenclatura, workflows, papéis, branding, retenção e limites de plano.
- Estratégia de RLS e identidade de conexão PostgreSQL para evitar bypass via pool compartilhado.
- Política de planos, limites, cobrança e isolamento de armazenamento.

Nenhuma dessas decisões autoriza acesso cross-tenant de SYSADMIN; suporte operacional deve ter fluxo auditado, limitado e aprovado por ADR próprio.
