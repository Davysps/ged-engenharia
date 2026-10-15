# Changelog

Alterações relevantes do GED Engenharia.

## Não lançado

### Isolamento de contratos — Etapa 2.1

- Exigir membership e papel de escrita para gerar URLs pré-assinadas por contrato ou documento.
- Validar o acesso ao documento antes de detalhar/enviar revisões e impedir associação de disciplina ou pacote de outro contrato.
- Exigir membership vigente para excluir apontamentos de horas.
- Exigir segredo interno configurado nos callbacks; comparar segredo em tempo constante e conferir vínculo entre documento e revisão no retorno do OCR.
- Remover valor do segredo dos logs do worker.

### Segurança e fundação SaaS

- Aplicar Helmet, limites de payload JSON e rate limiting global e de autenticação; manter `/health` fora da cota geral.
- Configurar confiança de proxy com `TRUST_PROXY_HOPS` e ignorar caches/temporários locais no Git.
- Centralizar verificação de membership em rotas selecionadas de contrato.
- Documentar gates de piloto, limitações operacionais e threat model inicial para evolução multi-tenant.
- Atualizar dependências dentro das faixas semver permitidas; advisories remanescentes continuam exigindo triagem.
