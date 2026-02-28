import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { File, Image, FileText, Trash2, Download, Clock, UploadCloud } from 'lucide-react';
import { apiService } from '../../services/api';
import { AttachmentVersionHistory } from './AttachmentVersionHistory';

interface AttachmentPanelProps {
  entityType: 'task' | 'project';
  entityId: string;
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image className="w-5 h-5 text-purple-500" />;
  if (mime === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-gray-500" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPanel({ entityType, entityId }: AttachmentPanelProps) {
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [versionHistoryId, setVersionHistoryId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['attachments', entityType, entityId],
    queryFn: () => apiService.getAttachments(entityType, entityId),
    enabled: !!entityId,
  });

  const attachments: any[] = data?.attachments || [];

  const uploadMutation = useMutation({
    mutationFn: (file: File) => apiService.uploadAttachment(entityType, entityId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteAttachment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] }),
  });

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => uploadMutation.mutate(file));
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDownload = async (att: any) => {
    try {
      const blob = await apiService.downloadAttachment(att.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handlePreview = async (att: any) => {
    if (!att.mimeType.startsWith('image/') && att.mimeType !== 'application/pdf') return;
    try {
      const blob = await apiService.downloadAttachment(att.id);
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Preview failed:', err);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Attachments</h4>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
          ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
        onClick={() => document.getElementById(`file-input-${entityId}`)?.click()}
      >
        <UploadCloud className={`w-6 h-6 mx-auto mb-1 ${dragOver ? 'text-indigo-500' : 'text-gray-400'}`} />
        <p className="text-xs text-gray-500">
          {uploadMutation.isPending ? 'Uploading...' : 'Drop files here or click to upload'}
        </p>
        <input
          id={`file-input-${entityId}`}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {isLoading ? (
        <div className="flex justify-center py-3">
          <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">No attachments yet</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att: any) => (
            <div key={att.id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 group">
              <button
                onClick={() => handlePreview(att)}
                className="flex-shrink-0"
                title={att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf' ? 'Preview' : ''}
              >
                {fileIcon(att.mimeType)}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{att.originalName}</p>
                <p className="text-[10px] text-gray-400">
                  {formatSize(att.fileSize)} &middot; v{att.version} &middot; {new Date(att.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setVersionHistoryId(att.id)} className="p-1 text-gray-400 hover:text-gray-600" title="Version history">
                  <Clock className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDownload(att)} className="p-1 text-gray-400 hover:text-indigo-600" title="Download">
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { if (confirm('Delete this file?')) deleteMutation.mutate(att.id); }}
                  className="p-1 text-gray-400 hover:text-red-600" title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Version history modal */}
      {versionHistoryId && (
        <AttachmentVersionHistory
          attachmentId={versionHistoryId}
          onClose={() => setVersionHistoryId(null)}
        />
      )}

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setPreviewUrl(null); }}>
          <div className="bg-white rounded-xl p-2 max-w-3xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="Preview" className="max-w-full" onError={() => setPreviewUrl(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
