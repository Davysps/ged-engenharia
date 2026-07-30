import { X, Download, Maximize, Cpu, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DocumentData {
  ocrStatus: string;
  projectNumber: string | null;
  extractedRevision: string | null;
  disciplina: string | null;
}

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileName: string;
  documentData: DocumentData | null;
}

export function DocumentViewer({ isOpen, onClose, fileUrl, fileName, documentData }: DocumentViewerProps) {
  if (!isOpen || !fileUrl) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8">
      <div className="bg-white w-full h-full max-w-[90rem] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabeçalho do Visualizador */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-900 text-white border-b border-gray-800">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold tracking-wide">{fileName}</h3>
            <span className="px-2 py-0.5 bg-blue-600 text-xs rounded font-bold">
              PREVIEW NATIVO
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
              title="Abrir em nova aba"
            >
              <Maximize className="w-4 h-4" />
            </a>
            <a 
              href={fileUrl} 
              download
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors border-r border-gray-700 pr-4"
              title="Baixar Arquivo Físico"
            >
              <Download className="w-4 h-4" />
            </a>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-red-400 transition-colors"
              title="Fechar Visualizador"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Corpo: Iframe Nativo + Sidebar de Metadados */}
        <div className="flex-1 flex overflow-hidden relative bg-gray-100">
          
          {/* Iframe */}
          <div className="flex-1 relative h-full">
            <iframe 
              src={`${fileUrl}#toolbar=0`} 
              className="w-full h-full border-none"
              title={`Visualizando ${fileName}`}
            />
          </div>

          {/* Sidebar de Extração RPA */}
          {documentData && (
            <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]">
              <div className="p-5 border-b border-gray-100 bg-slate-50 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-600" />
                <h4 className="font-semibold text-gray-800">Leitura RPA (Selo)</h4>
              </div>

              <div className="p-5 flex flex-col gap-6">
                
                {/* Status do Worker */}
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                    Status da Extração
                  </span>
                  {(documentData.ocrStatus === 'PENDING' || documentData.ocrStatus === 'PROCESSING') && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded border border-amber-200">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">Processando S3...</span>
                    </div>
                  )}
                  {documentData.ocrStatus === 'COMPLETED' && (
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Dados Lidos com Sucesso</span>
                    </div>
                  )}
                  {documentData.ocrStatus === 'FAILED' && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">Falha de Leitura</span>
                    </div>
                  )}
                </div>

                {/* Campos Extraídos */}
                {documentData.ocrStatus === 'COMPLETED' && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                        Número do Projeto
                      </span>
                      <p className="text-sm text-gray-900 font-medium mt-1 bg-gray-50 p-2 rounded border border-gray-100">
                        {documentData.projectNumber || 'Não identificado'}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                        Revisão Extraída (Planta)
                      </span>
                      <p className="text-sm text-gray-900 font-medium mt-1 bg-gray-50 p-2 rounded border border-gray-100">
                        {documentData.extractedRevision || 'Não identificado'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                        Disciplina (Carimbo)
                      </span>
                      <p className="text-sm text-gray-900 font-medium mt-1 bg-gray-50 p-2 rounded border border-gray-100">
                        {documentData.disciplina || 'Não identificada'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}