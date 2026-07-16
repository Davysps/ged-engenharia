import { api } from '../../../lib/axios';

export interface TransmittalItem {
  id: number;
  revisionId: number;
}

export interface Transmittal {
  id: number;
  codigo: string;
  assunto: string;
  mensagem: string | null;
  destinatario: string | null;
  proposito: string;
  status: 'EM_PROCESSAMENTO' | 'CONCLUIDO' | 'ERRO';
  zipUrl: string | null;
  pdfCapaUrl: string | null;
  createdAt: string;
  createdBy: { id: number; nome: string; };
  _count: { items: number; };
}

export interface CreateTransmittalDTO {
  assunto: string;
  mensagem?: string;
  destinatario?: string;
  proposito: string;
  revisionIds: number[];
}

export interface RealApprovedRevision {
  id: number;
  codigoDocumento: string;
  titulo: string;
  versionLabel: string;
  disciplina: string;
}

export const transmittalService = {
  async create(contractId: number, data: CreateTransmittalDTO): Promise<Transmittal> {
    const response = await api.post(`/contracts/${contractId}/transmittals`, data);
    return response.data.transmittal;
  },

  async list(contractId: number): Promise<Transmittal[]> {
    const response = await api.get(`/contracts/${contractId}/transmittals`);
    return response.data;
  },

  // Novo método blindado
  async getApprovedRevisions(contractId: number): Promise<RealApprovedRevision[]> {
    const response = await api.get(`/contracts/${contractId}/transmittals/approved-revisions`);
    return response.data;
  }
};