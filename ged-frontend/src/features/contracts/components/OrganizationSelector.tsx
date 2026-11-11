import React from 'react';
import { useOrganization } from '../../../contexts/OrganizationContext';
import type { Organization } from '../../../contexts/OrganizationContext';

export const OrganizationSelector: React.FC = () => {
  const { organizations, activeOrganization, setActiveOrganization, isLoading } = useOrganization();

  if (isLoading) {
    return <span className="text-xs text-slate-400">Carregando organização...</span>;
  }

  if (organizations.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 shadow-inner">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant:</span>
      <select
        value={activeOrganization?.id || ''}
        onChange={(e) => {
          const selected = organizations.find((o: Organization) => o.id === Number(e.target.value));
          if (selected) setActiveOrganization(selected);
        }}
        className="bg-transparent text-sm font-medium text-slate-100 outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded"
      >
        {organizations.map((org: Organization) => (
          <option key={org.id} value={org.id} className="bg-slate-800 text-slate-100">
            {org.nome} ({org.role})
          </option>
        ))}
      </select>
    </div>
  );
};
