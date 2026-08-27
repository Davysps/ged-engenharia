import { type FC, useState } from 'react';
import { useContract } from '../../../contexts/ContractContext';
import { DisciplineList } from '../../management/components/DisciplineList';
import { UserList } from '../../management/components/UserList';
import { AuditLogList } from '../components/AuditLogList';

type ManagementTab = 'USERS_DISCIPLINES' | 'AUDIT_TRAIL';

export const ManagementHome: FC = () => {
  const { role } = useContract();
  const isManager = role === 'GESTOR';

  const [activeTab, setActiveTab] = useState<ManagementTab>('USERS_DISCIPLINES');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Gestão</h1>
        <p className="text-gray-600 mt-1">Administre disciplinas, membros e a trilha de auditoria do contrato.</p>
      </div>

      {/* Sistema de Abas */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px" aria-label="Abas de gestão">
          <button
            onClick={() => setActiveTab('USERS_DISCIPLINES')}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 ${
              activeTab === 'USERS_DISCIPLINES'
                ? 'border-slate-700 text-slate-800 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Usuários & Disciplinas
          </button>

          {isManager && (
            <button
              onClick={() => setActiveTab('AUDIT_TRAIL')}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 ${
                activeTab === 'AUDIT_TRAIL'
                  ? 'border-slate-700 text-slate-800 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Trilha de Auditoria
            </button>
          )}
        </nav>
      </div>

      {/* Conteúdo das Abas */}
      <div className="bg-white rounded-lg">
        {activeTab === 'USERS_DISCIPLINES' && (
          <div className="space-y-8 p-1">
            <DisciplineList />
            <hr className="border-gray-200" />
            <UserList />
          </div>
        )}

        {activeTab === 'AUDIT_TRAIL' && isManager && (
          <div className="p-1">
            <AuditLogList />
          </div>
        )}
      </div>
    </div>
  );
};
