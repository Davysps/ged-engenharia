# Threat model inicial da fundação SaaS

**Status:** rascunho técnico para revisão de produto/segurança  
**Data:** 2026-10-14  
**Escopo:** backend atual com `Contract` como tenant operacional. Este documento não declara o sistema pronto para produção.

## Ativos e fronteiras

| Ativo | Fronteira atual | Proteção presente | Lacuna / ação requerida |
|---|---|---|---|
| Documentos, revisões e aprovações | Contrato (`contractId`) | JWT, contexto assíncrono e verificações em services/rotas | `contractId` ainda é escolhido no request; falta Organization, RLS e cobertura de todas as relações/endpoints |
| URLs pré-assinadas | Membership em contrato/documento + papel de escrita | Middleware valida contrato/documento pai e papel antes de assinar upload | URL assinada continua sendo bearer token por até 15 min; validar tamanho/tipo no S3 e vincular formalmente upload ao registro em etapa futura |
| Dados de usuários e memberships | Identidade global + contrato | Membership server-side nas rotas cobertas | `User.isClient` é global; faltam grants externos com escopo de organização/projeto |
| Arquivos S3 | Chave/URL assinada | Integração S3 existente | Verificação SHA-256 real, política de bucket, IAM de menor privilégio, versioning/MFA Delete e controles operacionais devem ser validados |
| Credenciais | Ambiente de execução | `.env` ignorado no checkout atual e `.env.example` com placeholders | Exposição histórica alegada pela auditoria; revogação de segredo não pode ser provada pelo código |
| Auditoria | Tabela `AuditLog` | Eventos registrados pela aplicação | Banco ainda não impede UPDATE/DELETE; acesso e retenção devem ser endurecidos antes de alegações de compliance |
| API e disponibilidade | Processo Express | CORS allowlist, Helmet, limite de payload e rate limit local | Rate limit precisa de store compartilhado em múltiplas réplicas; falta monitoramento e proteção de camada de borda |
| Callbacks internos | Segredo compartilhado `GED_INTERNAL_SECRET` | Segredo obrigatório, comparação em tempo constante; OCR confirma vínculo revisão-documento | Migrar para assinatura HMAC com timestamp/anti-replay e identidade/tenant do job |

## Agentes e ameaças prioritárias

1. **Usuário autenticado escolhe `contractId` de terceiro.** Membership middleware bloqueia as rotas cobertas; endpoints por IDs e relações precisam validar o contrato pai. RLS deve ser a defesa final na Etapa 2.
2. **Usuário tenta alcançar filho por ID (`documentId`, `revisionId`, `transmittalId`).** Detalhe e envio de revisões resolvem o documento pai e validam membership; OCR confirma que a revisão pertence ao documento informado. Ainda revisar sistematicamente todos os endpoints, exports, workers e relações.
3. **Usuário externo herda permissões internas por `isClient`.** Não usar a flag como autorização; migrar para grants externos explícitos e filtros por estágio na arquitetura de Organization.
4. **Atacante automatiza login ou sobrecarrega a API.** Limites locais retornam 429 e reduzem abuso básico; usar store compartilhado, WAF/edge controls e alertas antes de escalar.
5. **Proxy encaminha IP falso ou cadeia incorreta.** `TRUST_PROXY_HOPS` deve corresponder exatamente à topologia implantada; nunca configurá-lo como `true` sem desenho e validação do proxy.
6. **Credencial previamente exposta continua ativa.** Auditar provedores/histórico acessível, revogar e rotacionar credenciais. Exclusão do working tree não invalida chaves já copiadas.
7. **Worker/webhook forja ou repete eventos.** Callbacks internos exigem o segredo configurado e não aceitam revisão de outro documento. O segredo compartilhado ainda não substitui HMAC, timestamp, nonce, escopo de tenant e idempotência; tratar no épico de worker/webhook.
8. **Falha de infraestrutura ou erro humano destrói dados.** Backups sem restore demonstrado não bastam; exercício de recuperação e controles de retenção são gates operacionais.

## Decisões de configuração

- `CORS_ORIGINS`: lista explícita de origens completas permitidas; em produção vazia bloqueia chamadas browser cross-origin até configurar os domínios reais.
- `TRUST_PROXY_HOPS`: inteiro não negativo; `0` para acesso direto local. Em implantação, valor definido pelo número de saltos sob controle operacional.
- Rate limit: 300 requisições por IP a cada 15 minutos e 10 requisições por IP a cada 15 minutos em `/auth`; a cota é em memória por processo. Valores devem ser observados em piloto e o store substituído antes de múltiplas réplicas.
- Headers CSP/HSTS: CSP e headers padrão do Helmet ativos; HSTS somente quando `NODE_ENV=production`. A API não hospeda o frontend.
- Body JSON: máximo de 1 MB; uploads de arquivo usam fluxos/endpoints próprios e requerem limites independentes.

## Gates de risco

- **Antes do piloto:** matriz de acesso aprovada; revisão endpoint por endpoint e de workers/webhooks; credenciais rotacionadas; política de senhas/reset; staging com dados mascarados; segurança e rollback da migração definidos.
- **Antes de produção/venda:** Organization + RLS validados por testes negativos cross-tenant, store compartilhado de rate limit, segredo/backup/restore, DLQ e alertas, CI de segurança, termos/privacidade, suporte e resposta a incidentes.
- **Aceitação de risco:** qualquer exceção deve registrar responsável, justificativa, prazo de expiração e mitigação. Não tratar ausência de evidência como aprovação.
