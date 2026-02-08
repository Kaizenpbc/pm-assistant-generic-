import React from 'react';
import { FileText } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate and view project reports.
        </p>
      </div>

      {/* Placeholder */}
      <div className="card text-center py-16">
        <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-sm font-semibold text-gray-900">Reports Coming Soon</h3>
        <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
          AI-powered report generation will be available in a future phase. You will be able to
          generate status reports, budget analyses, and risk assessments.
        </p>
      </div>
    </div>
  );
};
