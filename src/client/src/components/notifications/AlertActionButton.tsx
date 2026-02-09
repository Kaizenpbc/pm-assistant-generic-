import React, { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { apiService } from '../../services/api';

interface AlertActionButtonProps {
  toolName: string;
  params: Record<string, any>;
  label: string;
  onComplete?: (result: any) => void;
}

export function AlertActionButton({ toolName, params, label, onComplete }: AlertActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiService.executeAlertAction({ toolName, params });
      onComplete?.(result);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Action failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={handleClick}
        disabled={loading}
        className="
          inline-flex items-center gap-1.5 px-2.5 py-1
          text-xs font-medium text-indigo-700 bg-indigo-50
          border border-indigo-200 rounded-md
          hover:bg-indigo-100 hover:border-indigo-300
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-150
        "
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Zap className="w-3 h-3" />
        )}
        {label}
      </button>
      {error && (
        <span className="text-[10px] text-red-500 mt-1 max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
