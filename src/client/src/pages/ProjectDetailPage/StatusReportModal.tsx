import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileText, ClipboardCopy, X, Download } from 'lucide-react';
import { apiService } from '../../services/api';

export function StatusReportModal({ projectId, projectName, onClose }: { projectId: string; projectName: string; onClose: () => void }) {
  const [report, setReport] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => apiService.generateReport({ reportType: 'weekly-status', projectId }),
    onSuccess: (data) => setReport(data),
  });

  useEffect(() => {
    mutation.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- fire once on open

  const content = report?.report?.content || report?.content || '';

  const sections = content.split(/^## /m).filter(Boolean).map((s: string) => {
    const nlIdx = s.indexOf('\n');
    return { title: s.slice(0, nlIdx).trim(), body: s.slice(nlIdx + 1).trim() };
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `status-report-${projectName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Status Report — {projectName}</h2>
          </div>
          <div className="flex items-center gap-2">
            {content && (
              <>
                <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded">
                  <ClipboardCopy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={handleDownload} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded">
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded">
              <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {mutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Generating status report...</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This may take a few seconds</p>
            </div>
          ) : mutation.isError ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-500">Failed to generate report</p>
              <button onClick={() => mutation.mutate()} className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline">Try again</button>
            </div>
          ) : sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map((s: any, i: number) => (
                <div key={i} className="rounded-lg border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{s.title}</h3>
                  <div className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{s.body}</div>
                </div>
              ))}
            </div>
          ) : content ? (
            <div className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{content}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
