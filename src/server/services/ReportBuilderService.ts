import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { auditLedgerService } from './AuditLedgerService';
import { policyEngineService } from './PolicyEngineService';

export interface ReportTemplate {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  config: ReportConfig;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportConfig {
  sections: ReportSectionConfig[];
}

export interface ReportSectionConfig {
  title?: string;
  type: 'kpi' | 'table' | 'bar_chart' | 'line_chart' | 'pie_chart';
  dataSource: 'projects' | 'tasks' | 'time_entries' | 'budgets';
  filters?: {
    dateRange?: { start: string; end: string };
    projectId?: string;
    status?: string;
  };
  groupBy?: string;
}

export interface ReportSection {
  title: string;
  type: string;
  data: any;
}

export interface GeneratedReport {
  sections: ReportSection[];
}

interface ReportTemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  config: string;
  is_shared: boolean | number;
  created_at: string;
  updated_at: string;
}

function rowToDTO(row: ReportTemplateRow): ReportTemplate {
  let config: ReportConfig = { sections: [] };
  if (row.config) {
    try { config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config; } catch { config = { sections: [] }; }
  }
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    config,
    isShared: !!row.is_shared,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class ReportBuilderService {
  async createTemplate(userId: string, data: {
    name: string;
    description?: string;
    config: ReportConfig;
    isShared?: boolean;
  }): Promise<ReportTemplate> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO report_templates (id, user_id, name, description, config, is_shared)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, data.name, data.description || null, JSON.stringify(data.config), data.isShared || false],
    );
    const rows = await databaseService.query<ReportTemplateRow>('SELECT * FROM report_templates WHERE id = ?', [id]);
    return rowToDTO(rows[0]);
  }

  async getTemplates(userId: string): Promise<ReportTemplate[]> {
    const rows = await databaseService.query<ReportTemplateRow>(
      'SELECT * FROM report_templates WHERE user_id = ? OR is_shared = TRUE ORDER BY updated_at DESC',
      [userId],
    );
    return rows.map(rowToDTO);
  }

  async getTemplateById(id: string): Promise<ReportTemplate | null> {
    const rows = await databaseService.query<ReportTemplateRow>('SELECT * FROM report_templates WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return rowToDTO(rows[0]);
  }

  async updateTemplate(id: string, data: {
    name?: string;
    description?: string;
    config?: ReportConfig;
    isShared?: boolean;
  }): Promise<ReportTemplate> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (data.config !== undefined) { sets.push('config = ?'); params.push(JSON.stringify(data.config)); }
    if (data.isShared !== undefined) { sets.push('is_shared = ?'); params.push(data.isShared); }
    if (sets.length > 0) {
      params.push(id);
      await databaseService.query(`UPDATE report_templates SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const rows = await databaseService.query<ReportTemplateRow>('SELECT * FROM report_templates WHERE id = ?', [id]);
    return rowToDTO(rows[0]);
  }

  async deleteTemplate(id: string): Promise<void> {
    await databaseService.query('DELETE FROM report_templates WHERE id = ?', [id]);
  }

  async generateReport(templateId: string, params?: {
    dateRange?: { start: string; end: string };
    projectId?: string;
  }): Promise<GeneratedReport> {
    const template = await this.getTemplateById(templateId);
    if (!template) throw new Error('Report template not found');

    const sections: ReportSection[] = [];

    for (const section of template.config.sections) {
      const mergedFilters = {
        ...section.filters,
        ...(params?.dateRange ? { dateRange: params.dateRange } : {}),
        ...(params?.projectId ? { projectId: params.projectId } : {}),
      };

      const data = await this.executeSectionQuery(section.type, section.dataSource, mergedFilters, section.groupBy);
      sections.push({
        title: section.title || `${section.dataSource} ${section.type}`,
        type: section.type,
        data,
      });
    }

    return { sections };
  }

  private async executeSectionQuery(
    type: ReportSectionConfig['type'],
    dataSource: ReportSectionConfig['dataSource'],
    filters: ReportSectionConfig['filters'],
    groupBy?: string,
  ): Promise<any> {
    const tableName = this.getTableName(dataSource);
    const { whereClause, whereParams } = this.buildWhereClause(dataSource, filters);

    if (type === 'kpi') {
      return this.executeKpiQuery(dataSource, tableName, whereClause, whereParams);
    }

    if (type === 'table') {
      return this.executeTableQuery(tableName, whereClause, whereParams);
    }

    // Chart types: bar_chart, line_chart, pie_chart
    return this.executeChartQuery(tableName, whereClause, whereParams, groupBy || this.getDefaultGroupBy(dataSource));
  }

  private getTableName(dataSource: ReportSectionConfig['dataSource']): string {
    switch (dataSource) {
      case 'projects': return 'projects';
      case 'tasks': return 'schedule_tasks';
      case 'time_entries': return 'time_entries';
      case 'budgets': return 'projects';
      default: return 'projects';
    }
  }

  private getDefaultGroupBy(dataSource: ReportSectionConfig['dataSource']): string {
    switch (dataSource) {
      case 'projects': return 'status';
      case 'tasks': return 'status';
      case 'time_entries': return 'project_id';
      case 'budgets': return 'status';
      default: return 'status';
    }
  }

  private buildWhereClause(
    dataSource: ReportSectionConfig['dataSource'],
    filters?: ReportSectionConfig['filters'],
  ): { whereClause: string; whereParams: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (!filters) return { whereClause: '', whereParams: [] };

    if (filters.projectId) {
      if (dataSource === 'projects' || dataSource === 'budgets') {
        conditions.push('id = ?');
      } else {
        conditions.push('project_id = ?');
      }
      params.push(filters.projectId);
    }

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.dateRange) {
      const dateField = dataSource === 'time_entries' ? 'date' : 'created_at';
      if (filters.dateRange.start) {
        conditions.push(`${dateField} >= ?`);
        params.push(filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        conditions.push(`${dateField} <= ?`);
        params.push(filters.dateRange.end);
      }
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, whereParams: params };
  }

  private async executeKpiQuery(
    dataSource: ReportSectionConfig['dataSource'],
    tableName: string,
    whereClause: string,
    whereParams: any[],
  ): Promise<any> {
    if (dataSource === 'budgets') {
      const rows = await databaseService.query<any>(
        `SELECT COUNT(*) as total_projects, COALESCE(SUM(budget), 0) as total_budget, COALESCE(AVG(budget), 0) as avg_budget FROM ${tableName}${whereClause}`,
        whereParams,
      );
      return {
        totalProjects: Number(rows[0].total_projects),
        totalBudget: Number(rows[0].total_budget),
        avgBudget: Number(rows[0].avg_budget),
      };
    }

    if (dataSource === 'projects') {
      const rows = await databaseService.query<any>(
        `SELECT COUNT(*) as total, COALESCE(AVG(progress), 0) as avg_progress FROM ${tableName}${whereClause}`,
        whereParams,
      );
      return {
        total: Number(rows[0].total),
        avgProgress: Number(rows[0].avg_progress),
      };
    }

    if (dataSource === 'tasks') {
      const rows = await databaseService.query<any>(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM ${tableName}${whereClause}`,
        whereParams,
      );
      return {
        total: Number(rows[0].total),
        completed: Number(rows[0].completed),
        completionRate: rows[0].total > 0 ? Number(rows[0].completed) / Number(rows[0].total) : 0,
      };
    }

    if (dataSource === 'time_entries') {
      const rows = await databaseService.query<any>(
        `SELECT COUNT(*) as total_entries, COALESCE(SUM(hours), 0) as total_hours, COALESCE(AVG(hours), 0) as avg_hours FROM ${tableName}${whereClause}`,
        whereParams,
      );
      return {
        totalEntries: Number(rows[0].total_entries),
        totalHours: Number(rows[0].total_hours),
        avgHours: Number(rows[0].avg_hours),
      };
    }

    return {};
  }

  private async executeTableQuery(
    tableName: string,
    whereClause: string,
    whereParams: any[],
  ): Promise<any> {
    const rows = await databaseService.query<any>(
      `SELECT * FROM ${tableName}${whereClause} ORDER BY created_at DESC LIMIT 500`,
      whereParams,
    );
    return { rows };
  }

  private async executeChartQuery(
    tableName: string,
    whereClause: string,
    whereParams: any[],
    groupBy: string,
  ): Promise<any> {
    const rows = await databaseService.query<any>(
      `SELECT ${groupBy} as label, COUNT(*) as value FROM ${tableName}${whereClause} GROUP BY ${groupBy} ORDER BY value DESC`,
      whereParams,
    );
    return {
      labels: rows.map((r: any) => r.label || 'N/A'),
      datasets: [{
        data: rows.map((r: any) => Number(r.value)),
      }],
    };
  }

  /**
   * Generate a compliance audit report for a project.
   */
  async generateComplianceReport(projectId: string, params?: {
    dateRange?: { start: string; end: string };
    actions?: string;
  }): Promise<GeneratedReport> {
    const sections: ReportSection[] = [];

    // Chain verification
    const chainStatus = await auditLedgerService.verifyChain(projectId);
    sections.push({
      title: 'Chain Integrity',
      type: 'kpi',
      data: {
        status: chainStatus.valid ? 'VERIFIED' : 'BROKEN',
        entriesChecked: chainStatus.checkedCount,
        brokenAtId: chainStatus.brokenAtId || null,
      },
    });

    // Audit entries
    const auditResult = await auditLedgerService.getEntries({
      projectId,
      since: params?.dateRange?.start,
      until: params?.dateRange?.end,
      action: params?.actions,
      limit: 1000,
      offset: 0,
    });

    // Activity by actor type
    const actorTypeCounts: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    for (const entry of auditResult.entries) {
      actorTypeCounts[entry.actorType] = (actorTypeCounts[entry.actorType] || 0) + 1;
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    }

    sections.push({
      title: 'Activity by Actor Type',
      type: 'pie_chart',
      data: {
        labels: Object.keys(actorTypeCounts),
        datasets: [{ data: Object.values(actorTypeCounts) }],
      },
    });

    sections.push({
      title: 'Actions Summary',
      type: 'bar_chart',
      data: {
        labels: Object.keys(actionCounts),
        datasets: [{ data: Object.values(actionCounts) }],
      },
    });

    // Policy evaluation stats
    const policyStats = await policyEngineService.getEvaluationStats(
      projectId,
      params?.dateRange?.start,
    );
    sections.push({
      title: 'Policy Enforcement Summary',
      type: 'kpi',
      data: {
        totalEvaluations: policyStats.total,
        allowed: policyStats.allowed,
        blocked: policyStats.blocked,
        pendingApproval: policyStats.pendingApproval,
      },
    });

    // Recent audit entries as table
    sections.push({
      title: 'Audit Trail',
      type: 'table',
      data: {
        rows: auditResult.entries.slice(0, 200).map(e => ({
          timestamp: e.createdAt,
          action: e.action,
          actorId: e.actorId,
          actorType: e.actorType,
          entityType: e.entityType,
          entityId: e.entityId,
          source: e.source,
        })),
      },
    });

    return { sections };
  }

  async exportReport(templateId: string, format: 'csv' | 'pdf', params?: {
    dateRange?: { start: string; end: string };
    projectId?: string;
  }): Promise<{ data: string | GeneratedReport; contentType: string }> {
    const report = await this.generateReport(templateId, params);

    if (format === 'csv') {
      const csvString = this.reportToCsv(report);
      return { data: csvString, contentType: 'text/csv' };
    }

    // For PDF, return the report data for client-side rendering
    return { data: report, contentType: 'application/json' };
  }

  private reportToCsv(report: GeneratedReport): string {
    const lines: string[] = [];

    for (const section of report.sections) {
      lines.push(`"${section.title}"`);
      lines.push('');

      if (section.type === 'kpi') {
        const data = section.data;
        for (const [key, value] of Object.entries(data)) {
          lines.push(`"${key}","${value}"`);
        }
      } else if (section.type === 'table') {
        const rows = section.data.rows || [];
        if (rows.length > 0) {
          const headers = Object.keys(rows[0]);
          lines.push(headers.map((h: string) => `"${h}"`).join(','));
          for (const row of rows) {
            lines.push(headers.map((h: string) => `"${String(row[h] ?? '')}"`).join(','));
          }
        }
      } else {
        // Chart types
        const labels = section.data.labels || [];
        const values = section.data.datasets?.[0]?.data || [];
        lines.push('"Label","Value"');
        for (let i = 0; i < labels.length; i++) {
          lines.push(`"${labels[i]}","${values[i] ?? 0}"`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}

export const reportBuilderService = new ReportBuilderService();
