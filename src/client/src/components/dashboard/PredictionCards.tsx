import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';

interface ProjectHealth {
  projectId: string;
  projectName: string;
  healthScore: number;
  riskLevel: string;
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreRingColor(score: number): string {
  if (score >= 75) return 'border-green-400 bg-green-50';
  if (score >= 50) return 'border-yellow-400 bg-yellow-50';
  return 'border-red-400 bg-red-50';
}

const riskBadgeStyles: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

export function PredictionCards({ projects }: { projects: ProjectHealth[] }) {
  if (!projects || projects.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-900">Project Health Scores</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {projects.map((project) => {
          const badgeStyle = riskBadgeStyles[project.riskLevel] || riskBadgeStyles.medium;

          return (
            <div
              key={project.projectId}
              className="rounded-lg border border-gray-200 bg-white p-3 flex items-center gap-3"
            >
              {/* Health score circle */}
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 ${getScoreRingColor(project.healthScore)}`}
              >
                <span className={`text-sm font-bold ${getScoreColor(project.healthScore)}`}>
                  {project.healthScore}
                </span>
              </div>

              {/* Project info */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-900 truncate" title={project.projectName}>
                  {project.projectName}
                </p>
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${badgeStyle}`}
                >
                  {project.riskLevel === 'critical' || project.riskLevel === 'high' ? (
                    <AlertTriangle className="h-2.5 w-2.5" />
                  ) : null}
                  {project.riskLevel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
