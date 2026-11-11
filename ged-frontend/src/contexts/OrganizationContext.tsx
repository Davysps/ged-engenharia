import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/axios';

export interface Organization {
  id: number;
  nome: string;
  slug: string;
  cnpj?: string | null;
  role: 'ORG_ADMIN' | 'ORG_MEMBER' | 'ORG_BILLING';
}

interface OrganizationContextData {
  organizations: Organization[];
  activeOrganization: Organization | null;
  setActiveOrganization: (org: Organization) => void;
  isLoading: boolean;
  reloadOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextData>({} as OrganizationContextData);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrgState] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('@GED:token');
      if (!token) {
        setOrganizations([]);
        setActiveOrgState(null);
        setIsLoading(false);
        return;
      }

      const res = await api.get('/organizations');
      const list: Organization[] = res.data?.organizations ?? [];
      setOrganizations(list);

      const storedOrgId = localStorage.getItem('@GED:activeOrganizationId');
      if (storedOrgId) {
        const found = list.find((o) => o.id === Number(storedOrgId));
        if (found) {
          setActiveOrgState(found);
          return;
        }
      }

      // Se não havia ou não achou a selecionada, seleciona a primeira da lista
      if (list.length > 0) {
        setActiveOrgState(list[0]);
        localStorage.setItem('@GED:activeOrganizationId', String(list[0].id));
      } else {
        setActiveOrgState(null);
        localStorage.removeItem('@GED:activeOrganizationId');
      }
    } catch (error) {
      console.error('[OrganizationContext] Erro ao carregar organizações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const setActiveOrganization = (org: Organization) => {
    setActiveOrgState(org);
    localStorage.setItem('@GED:activeOrganizationId', String(org.id));
    // Forçar recarga para que todas as queries adotem o novo tenant context
    window.location.reload();
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrganization,
        setActiveOrganization,
        isLoading,
        reloadOrganizations: fetchOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
