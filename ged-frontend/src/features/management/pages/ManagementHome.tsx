import type { FC } from 'react';
import { DisciplineList } from '../components/DisciplineList';
import { UserList } from '../components/UserList';

/**
 * Página principal do Épico 6: Gestão de Usuários e Disciplinas.
 * Composição de DisciplineList e UserList dentro do ContractLayout.
 */
export const ManagementHome: FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Gestão de Usuários e Disciplinas</h1>
        <p className="text-gray-600 mt-1">Administre as disciplinas e membros do seu contrato.</p>
      </div>

      <DisciplineList />

      <hr className="border-gray-200" />

      <UserList />
    </div>
  );
};
