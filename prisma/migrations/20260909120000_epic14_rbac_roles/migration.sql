-- Etapa 2.6 — Gestão de Acessos (RBAC) real de engenharia
-- Hard migration: APROVADOR deixa de existir como papel público.
-- O valor de catálogo APROVADOR é renomeado para COORDENADOR (mapeamento direto),
-- remapeando automaticamente qualquer membership existente. Em seguida, o novo
-- papel PLANEJADOR é adicionado ao enum ContractRole.

-- 1. APROVADOR → COORDENADOR (rows existentes são remapeadas pelo catálogo pg_enum)
ALTER TYPE "ContractRole" RENAME VALUE 'APROVADOR' TO 'COORDENADOR';

-- 2. Novo papel: PLANEJADOR (foco em Planejamento e Pacotes de Trabalho)
ALTER TYPE "ContractRole" ADD VALUE 'PLANEJADOR';