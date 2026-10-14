# Changelog

Alterações relevantes do GED Engenharia.

## Não lançado

### Segurança e fundação SaaS

- Aplicar Helmet, limites de payload JSON e rate limiting global e de autenticação; manter `/health` fora da cota geral.
- Configurar confiança de proxy com `TRUST_PROXY_HOPS` e ignorar caches/temporários locais no Git.
- Centralizar verificação de membership em rotas selecionadas de contrato.
- Documentar gates de piloto, limitações operacionais e threat model inicial para evolução multi-tenant.
- Atualizar dependências dentro das faixas semver permitidas; advisories remanescentes continuam exigindo triagem.
