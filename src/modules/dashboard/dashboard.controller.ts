import { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { DashboardService } from './dashboard.service';

/**
 * Controller responsável pelo Dashboard Geral de Indicadores Operacionais.
 *
 * Mantém-se fino: apenas valida a autenticação, extrai o contractId (tenant)
 * da query string e delega toda a lógica de query + RBAC para o service.
 *
 * Rota: GET /dashboard?contractId=X
 */

/**
 * Retorna todos os indicadores operacionais consolidados de um contrato.
 *
 * O `contractId` atua como o identificador do tenant. Ele é extraído da
 * query string e validado no service contra a ContractMembership do usuário
 * autenticado, garantindo o isolamento multi-tenant.
 */
export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const contractId = parseInt(req.query.contractId as string, 10);

    if (isNaN(contractId)) {
      res.status(400).json({ error: 'O parâmetro contractId é obrigatório e deve ser um número válido.' });
      return;
    }

    const dashboardData = await DashboardService.getDashboardData(contractId, userId);

    res.status(200).json(dashboardData);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: você não tem permissão para este contrato.' });
      return;
    }

    console.error('[DashboardController] Erro FATAL:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao carregar os indicadores do dashboard.' });
  }
};
