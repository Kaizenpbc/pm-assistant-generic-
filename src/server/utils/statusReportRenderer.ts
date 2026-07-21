/**
 * Renders a structured status report to styled HTML for UI and email.
 */

export interface RAGArea {
  name: string;
  status: 'green' | 'amber' | 'red';
  previousStatus?: 'green' | 'amber' | 'red' | null;
  trend?: 'improving' | 'stable' | 'declining';
  comments: string;
}

export interface StructuredStatusReport {
  executiveSummary: string;
  areas: RAGArea[];
  managementActions: string[];
  projectName: string;
  reportDate: string;
  aiPowered: boolean;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  green: { bg: '#dcfce7', text: '#166534', label: 'Green' },
  amber: { bg: '#fef3c7', text: '#92400e', label: 'Amber' },
  red: { bg: '#fecaca', text: '#991b1b', label: 'Red' },
};

const STATUS_CIRCLES: Record<string, string> = {
  green: '🟢',
  amber: '🟡',
  red: '🔴',
};

const TREND_ARROWS: Record<string, string> = {
  improving: '↑',
  stable: '→',
  declining: '↓',
};

const TREND_COLORS: Record<string, string> = {
  improving: '#166534',
  stable: '#6b7280',
  declining: '#991b1b',
};

export function computeTrend(current: string, previous: string | null | undefined): 'improving' | 'stable' | 'declining' {
  if (!previous) return 'stable';
  const order: Record<string, number> = { green: 0, amber: 1, red: 2 };
  const curr = order[current] ?? 1;
  const prev = order[previous] ?? 1;
  if (curr < prev) return 'improving';
  if (curr > prev) return 'declining';
  return 'stable';
}

export function renderStatusReportHtml(report: StructuredStatusReport): string {
  const { executiveSummary, areas, managementActions, projectName, reportDate, aiPowered } = report;

  const tableRows = areas.map(area => {
    const current = STATUS_COLORS[area.status] || STATUS_COLORS.amber;
    const prevCircle = area.previousStatus ? STATUS_CIRCLES[area.previousStatus] || '—' : '—';
    const currCircle = STATUS_CIRCLES[area.status] || '🟡';
    const trend = area.trend || 'stable';
    const trendArrow = TREND_ARROWS[trend];
    const trendColor = TREND_COLORS[trend];

    return `
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${escapeHtml(area.name)}</td>
        <td style="padding: 10px 14px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 18px;">${prevCircle}</td>
        <td style="padding: 10px 14px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 18px;">${currCircle}</td>
        <td style="padding: 10px 14px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 16px; font-weight: 700; color: ${trendColor};">${trendArrow}</td>
        <td style="padding: 10px 14px; color: #4b5563; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(area.comments)}</td>
      </tr>`;
  }).join('');

  const actionItems = managementActions.map(action =>
    `<li style="color: #1f2937; margin: 6px 0; line-height: 1.5;">${escapeHtml(action)}</li>`
  ).join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 700;">Project Status Report</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px;">${escapeHtml(projectName)} — ${escapeHtml(reportDate)}</p>
      </div>

      <!-- Executive Summary -->
      <div style="background: #f8fafc; padding: 20px 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
        <h2 style="color: #1f2937; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px;">Executive Summary</h2>
        <p style="color: #374151; line-height: 1.7; margin: 0; font-size: 14px;">${escapeHtml(executiveSummary)}</p>
      </div>

      <!-- Traffic Light Table -->
      <div style="padding: 0; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px 14px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0;">Area</th>
              <th style="padding: 10px 14px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0;">Prev</th>
              <th style="padding: 10px 14px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0;">Current</th>
              <th style="padding: 10px 14px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0;">Trend</th>
              <th style="padding: 10px 14px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0;">Comments</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <!-- Management Actions -->
      <div style="background: #fffbeb; padding: 20px 24px; border: 1px solid #e5e7eb; border-top: 2px solid #f59e0b; border-radius: 0 0 12px 12px;">
        <h2 style="color: #92400e; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px;">Actions for Management</h2>
        <ol style="margin: 0; padding-left: 20px;">
          ${actionItems}
        </ol>
      </div>

      <!-- Footer -->
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
        ${aiPowered ? 'AI-Generated Report' : 'Template Report (AI unavailable)'} — Kovarti PM Assistant
      </p>
    </div>`;
}
