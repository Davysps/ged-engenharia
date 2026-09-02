import { useQuery } from '@tanstack/react-query';
import { documentService } from '../services/document.service';
import type { DocumentListFilters, DocumentListItem } from '../types/document.types';

/**
 * Hook React Query para o Acervo Técnico (listagem de documentos).
 *
 * Responsável por toda a lógica de busca/cache/sincronização. O queryKey leva
 * em conta o contrato (tenant) e os filtros ativos, o que garante que mudanças
 * no filtro disparem um re-fetch automático sem `useEffect` manual.
 */
export function useDocumentsQuery(contractId: number, filters: DocumentListFilters = {}) {
  return useQuery<DocumentListItem[]>({
    queryKey: ['documents', contractId, filters],
    queryFn: () => documentService.listByContract(contractId, filters),
    enabled: !!contractId,
    placeholderData: (prev) => prev,
  });
}
