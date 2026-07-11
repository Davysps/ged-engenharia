import { X, Download, Maximize } from 'lucide-react';

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileName: string;
}

export function DocumentViewer({ isOpen, onClose, fileUrl, fileName }: DocumentViewerProps) {
  if (!isOpen || !fileUrl) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8">
      <div className="bg-white w-full h-full max-w-7xl rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
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

        {/* Corpo (O iframe Nativo do Navegador) */}
        <div className="flex-1 bg-gray-100 relative">
          <iframe 
            src={`${fileUrl}#toolbar=0`} // O #toolbar=0 tenta esconder a barra nativa do Chrome para um visual mais limpo
            className="w-full h-full border-none"
            title={`Visualizando ${fileName}`}
          />
        </div>
      </div>
    </div>
  );
}