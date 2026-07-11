import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/axios';

// Tipagem rigorosa para o RBAC
export type ContractRole = 'GESTOR' | 'ENGENHEIRO' | 'APROVADOR' | 'LEITOR';

export interface Contract {
  id: string;
  name: string;
  status: string;
  // Expanda conforme o seu schema Prisma
}

interface ContractContextData {
  contract: Contract | null;
  role: ContractRole | null;
  isLoading: boolean;
  error: string | null;
}

const ContractContext = createContext<ContractContextData>({} as ContractContextData);

interface ContractProviderProps {
  contractId: string;
  children: React.ReactNode;
}

export const ContractProvider: React.FC<ContractProviderProps> = ({ contractId, children }) => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [role, setRole] = useState<ContractRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchContractData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // 1. CORREÇÃO: A rota da API atual é /projects, e não /contracts
            const response = await api.get(`/projects/${contractId}`);
            const data = response.data;

            // 2. CORREÇÃO: Mapeando os dados exatamente como o seu backend devolve
            setContract({
            id: data.id.toString(), // Garantindo que seja string para a URL
            name: data.nome,        // O seu backend chama de 'nome', não 'name'
            status: 'Ativo', 
            });

            // 3. CORREÇÃO: A role vem de memberships (igual fizemos no Dashboard)
            const userRole = data.memberships?.[0]?.role || 'LEITOR';
            setRole(userRole as ContractRole);

        } catch (err: any) {
            console.error('Erro ao carregar contexto do contrato:', err);
            setError(err.response?.data?.message || 'Erro ao carregar os dados do contrato. Verifique suas permissões.');
        } finally {
            setIsLoading(false);
        }
        };

        if (contractId) {
        fetchContractData();
        }
    }, [contractId]);

  return (
    <ContractContext.Provider value={{ contract, role, isLoading, error }}>
      {children}
    </ContractContext.Provider>
  );
};

export const useContract = (): ContractContextData => {
  const context = useContext(ContractContext);
  if (Object.keys(context).length === 0) {
    throw new Error('useContract deve ser usado dentro de um ContractProvider');
  }
  return context;
};