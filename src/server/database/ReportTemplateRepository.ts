import { databaseService } from './connection';

export interface ReportTemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  config: string;
  is_shared: boolean | number;
  created_at: string;
  updated_at: string;
}

class ReportTemplateRepository {
  insert(id: string, userId: string, name: string, description: string | null, config: string, isShared: boolean): Promise<any> {
    return databaseService.query(
      `INSERT INTO report_templates (id, user_id, name, description, config, is_shared)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, name, description, config, isShared],
    );
  }

  async findById(id: string): Promise<ReportTemplateRow | null> {
    const rows = await databaseService.query<ReportTemplateRow>(
      'SELECT * FROM report_templates WHERE id = ?',
      [id],
    );
    return rows[0] ?? null;
  }

  async findByUserOrShared(userId: string): Promise<ReportTemplateRow[]> {
    return databaseService.query<ReportTemplateRow>(
      'SELECT * FROM report_templates WHERE user_id = ? OR is_shared = TRUE ORDER BY updated_at DESC',
      [userId],
    );
  }

  async update(id: string, sets: string[], params: unknown[]): Promise<void> {
    if (sets.length === 0) return;
    params.push(id);
    await databaseService.query(`UPDATE report_templates SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  delete(id: string): Promise<any> {
    return databaseService.query('DELETE FROM report_templates WHERE id = ?', [id]);
  }
}

export const reportTemplateRepository = new ReportTemplateRepository();
