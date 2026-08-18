import type { FC } from 'react';
import { WorkPackageList } from '../components/WorkPackageList';

/**
 * Página principal do Épico 7: Módulo de Planejamento e Coordenação.
 * Composição de WorkPackageList dentro do ContractLayout.
 */
export const PlanningHome: FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Planejamento e Coordenação</h1>
        <p className="text-gray-600 mt-1">
          Gerencie os pacotes de trabalho e o cronograma do seu contrato.
        </p>
      </div>

      <WorkPackageList />
    </div>
  );
};
