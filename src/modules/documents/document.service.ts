import { Prisma, ApprovalStage } from '@prisma/client';
import { prisma } from '../../prisma';
import * as XLSX from 'xlsx';
import type { ContractRole } from '@prisma/client';
import type { DocumentListQueryInput } from './document.schemas';

/**
 * PATCH 10.4: Opções de visibilidade por papel (RBAC do Portal do Cliente).
 * PREMISSA MÁXIMA: O Cliente deve ser "cego" para os processos internos.
 */
export interface DocumentVisibilityOptions {
  isClient?: boolean;
}

/**
 * Service responsável pela lógica de consulta de documentos.
 *
 * Segue o princípio do DDD: isola as queries complexas e a verificação de RBAC
 * do controller, mantendo-o fino e testável.
 *
 * ISOLAMENTO MULTI-TENANT (CRÍTICO):
 * Toda consulta é filtrada obrigatoriamente pelo `contractId` (tenant), que é
 * previamente validado contra a `ContractMembership` do usuário autenticado.
 * Clientes diferentes nunca enxergam dados uns dos outros.
 */

export class DocumentService {
  /**
   * Lista os documentos de um contrato (tenant) com Busca Avançada.
   *
   * @param contractId - ID do contrato (tenant) proveniente da rota
   * @param userId     - ID do usuário autenticado (extraído do JWT)
   * @param filters    - Filtros de busca avançada: busca, disciplinaId, pacoteId
   * @param options    - PATCH 10.4: visibilidade do Portal do Cliente (isClient)
   * @returns Documentos com revisões, disciplina do contrato e pacote de trabalho
   * @throws Error com código 'ACCESS_DENIED' se o usuário não for membro do contrato
   */
  static async listDocuments(
    contractId: number,
    userId: number,
    filters: DocumentListQueryInput,
    options?: DocumentVisibilityOptions
  ) {
    // ── 1. VERIFICAÇÃO DE RBAC / ISOLAMENTO MULTI-TENANT ──────────────
    const membership = await prisma.contractMembership.findUnique({
      where: {
        userId_contractId: { userId, contractId },
      },
      select: { role: true },
    });

    if (!membership) {
      const error = new Error('Acesso negado: usuário não é membro deste contrato.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    // ── 2. MONTA O `where` DO PRISMA COM OS FILTROS DE BUSCA AVANÇADA ─
    const where: Record<string, unknown> = { contractId };

    // ── PATCH 10.4: ISOLAMENTO DO PORTAL DO CLIENTE ─────────────────────
    // PREMISSA MÁXIMA: o Cliente é "cego" para os processos internos.
    // Se o requisitante for isClient, só retorna documentos que já chegaram
    // ao estágio CLIENTE (ou seja, que foram emitidos via GRD). Documentos
    // em elaboração/verificação/aprovação interna NUNCA aparecem na listagem.
    const isClient = options?.isClient === true;
    if (isClient) {
      where.revisions = {
        some: {
          approvalWorkflows: {
            some: { stage: ApprovalStage.CLIENTE },
          },
        },
      };
    }

    if (filters.disciplinaId) {
      where.contractDisciplineId = filters.disciplinaId;
    }

    if (filters.pacoteId) {
      where.workPackageId = filters.pacoteId;
    }

    if (filters.busca) {
      where.OR = [
        { codigoDocumento: { contains: filters.busca, mode: 'insensitive' } },
        { titulo: { contains: filters.busca, mode: 'insensitive' } },
        // ÉPICO 13: Full-Text Search — encontra documentos onde a palavra está
        // "dentro do PDF" (texto extraído localmente pelo worker PyMuPDF).
        { revisions: { some: { extractedText: { contains: filters.busca, mode: 'insensitive' } } } },
      ];
    }

    const documents = await prisma.document.findMany({
      where: where as Prisma.DocumentWhereInput,
      orderBy: { createdAt: 'desc' },
      include: {
        revisions: {
          orderBy: { createdAt: 'asc' }, // Garante que a R0, R1 venham na ordem certa
        },
        contractDiscipline: true,
        workPackage: true,
      },
    });

    return documents;
  }

  /**
   * Busca um documento pelo ID com todos os dados aninhados necessários para a
   * tela de detalhamento (Épico 8).
   *
   * @param documentId - ID do documento no banco
   * @param userId     - ID do usuário autenticado (extraído do JWT)
   * @param options    - PATCH 10.4: visibilidade do Portal do Cliente (isClient)
   * @returns Documento completo com revisões, workflows de aprovação, transmittals
   *          e a role do usuário no contrato, ou null se não existir ou o usuário
   *          não tiver acesso.
   */
  static async findDocumentById(
    documentId: number,
    userId: number,
    options?: DocumentVisibilityOptions
  ) {
    // ── PATCH 10.4: ISOLAMENTO DO PORTAL DO CLIENTE ─────────────────────
    const isClient = options?.isClient === true;

    const document = await prisma.document.findUnique({
      where: {
        id: documentId,
        // Filtragem multi-tenant: apenas membros do contrato veem o documento
        contract: {
          memberships: {
            some: { userId: userId },
          },
        },
        // PREMISSA MÁXIMA (PATCH 10.4): o Cliente só acessa documentos que
        // chegaram ao estágio CLIENTE. Documentos ainda em ciclo interno
        // (elaboração/verificação/aprovação) retornam null → 403 no controller.
        ...(isClient
          ? {
              revisions: {
                some: {
                  approvalWorkflows: {
                    some: { stage: ApprovalStage.CLIENTE },
                  },
                },
              },
            }
          : {}),
      },
      include: {
        contract: {
          include: {
            client: true,
          },
        },
        createdBy: {
          select: { nome: true, email: true },
        },
        contractDiscipline: true,
        workPackage: true,
        revisions: {
          orderBy: { createdAt: 'asc' },
          include: {
            // PATCH 10.2: Histórico completo de carimbos (Verificação → Aprovação → Cliente)
            approvalWorkflows: {
              orderBy: { requestedAt: 'asc' },
              include: {
                requester: { select: { nome: true } },
                reviewer: { select: { nome: true } },
              },
            },
            transmittalItems: {
              include: {
                transmittal: {
                  include: {
                    createdBy: { select: { nome: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!document) {
      return null;
    }

    // ── PATCH 10.4: SANITIZAÇÃO DOS CARIMBOS PARA O CLIENTE ─────────────
    // "Não expor a roupa suja do time": se isClient, remove dos arrays de
    // approvalWorkflows todos os carimbos internos (VERIFICACAO/APROVACAO).
    // Nota: a Máquina de Estados (PATCH 10.2) define apenas VERIFICACAO,
    // APROVACAO e CLIENTE — não existe estágio EMISSAO no schema; o carimbo
    // visível ao cliente é, portanto, somente o do estágio CLIENTE.
    if (isClient) {
      document.revisions = document.revisions.map((revision) => ({
        ...revision,
        approvalWorkflows: revision.approvalWorkflows.filter(
          (workflow) => workflow.stage === ApprovalStage.CLIENTE
        ),
      }));
    }

    // Busca a role específica do usuário neste contrato para RBAC no frontend
    const membership = await prisma.contractMembership.findUnique({
      where: {
        userId_contractId: {
          userId: userId,
          contractId: document.contractId,
        },
      },
      select: { role: true },
    });

    return {
      ...document,
      userRole: (membership?.role ?? null) as ContractRole | null,
    };
  }

  /**
   * ÉPICO 11: Exportação de MDR (Master Document Register).
   * Gera uma planilha Excel (.xlsx) com todos os documentos do contrato,
   * incluindo disciplina, pacote, revisão atual, status do workflow e data
   * da última revisão.
   *
   * @param contractId - ID do contrato (tenant)
   * @param userId     - ID do usuário autenticado (extraído do JWT)
   * @returns Buffer do arquivo .xlsx pronto para download
   * @throws Error com código 'ACCESS_DENIED' se o usuário não for membro do contrato
   */
  static async exportMDR(contractId: number, userId: number): Promise<Buffer> {
    // ── 1. VERIFICAÇÃO DE RBAC / ISOLAMENTO MULTI-TENANT ──────────────
    const membership = await prisma.contractMembership.findUnique({
      where: {
        userId_contractId: { userId, contractId },
      },
      select: { role: true },
    });

    if (!membership) {
      const error = new Error('Acesso negado: usuário não é membro deste contrato.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    // ── 2. BUSCA TODOS OS DOCUMENTOS DO CONTRATO COM RELACIONAMENTOS ─
    const documents = await prisma.document.findMany({
      where: { contractId },
      orderBy: { codigoDocumento: 'asc' },
      include: {
        contractDiscipline: true,
        workPackage: true,
        revisions: {
          orderBy: { createdAt: 'asc' },
          include: {
            approvalWorkflows: {
              orderBy: { requestedAt: 'asc' },
            },
          },
        },
      },
    });

    // ── 3. MONTA AS LINHAS DA PLANILHA ────────────────────────────────
    const rows = documents.map((doc) => {
      const revisions = doc.revisions ?? [];
      const currentRevision = revisions.length > 0 ? revisions[revisions.length - 1] : null;

      // Determina o status do workflow a partir do último carimbo
      let workflowStatus = 'SEM FLUXO';
      if (currentRevision) {
        const approvals = currentRevision.approvalWorkflows ?? [];
        if (approvals.length > 0) {
          const lastApproval = approvals[approvals.length - 1];
          workflowStatus = lastApproval?.status ?? 'SEM FLUXO';
        } else {
          workflowStatus = currentRevision.status;
        }
      }

      // Data da última revisão
      const lastRevisionDate = currentRevision
        ? currentRevision.createdAt
        : null;

      return {
        'Código do Documento': doc.codigoDocumento,
        'Título': doc.titulo,
        'Disciplina': doc.contractDiscipline?.nome ?? '—',
        'Pacote': doc.workPackage?.nome ?? '—',
        'Revisão Atual': currentRevision?.versionLabel ?? '—',
        'Status do Workflow': workflowStatus,
        'Data da Última Revisão': lastRevisionDate
          ? new Date(lastRevisionDate).toLocaleDateString('pt-BR')
          : '—',
      };
    });

    // ── 4. GERA O ARQUIVO XLSX ────────────────────────────────────────
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Largura das colunas para melhor leitura
    worksheet['!cols'] = [
      { wch: 25 }, // Código do Documento
      { wch: 50 }, // Título
      { wch: 20 }, // Disciplina
      { wch: 20 }, // Pacote
      { wch: 14 }, // Revisão Atual
      { wch: 22 }, // Status do Workflow
      { wch: 22 }, // Data da Última Revisão
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MDR');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer as Buffer;
  }
}
