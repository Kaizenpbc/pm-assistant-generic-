import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository';
import type { IntakeForm, IntakeFormField, IntakeSubmission } from '../services/IntakeFormService';

interface IntakeFormRow {
  id: string;
  name: string;
  description: string | null;
  fields: string;
  is_active: boolean | number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface IntakeSubmissionRow {
  id: string;
  form_id: string;
  submitted_by: string;
  values_json: string;
  status: string;
  reviewer_id: string | null;
  review_notes: string | null;
  converted_project_id: string | null;
  created_at: string;
  updated_at: string;
  form_name?: string;
  submitter_name?: string;
}

function formRowToDTO(row: IntakeFormRow): IntakeForm {
  let fields: IntakeFormField[] = [];
  if (row.fields) {
    try { fields = typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields; } catch { fields = []; }
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fields,
    isActive: !!row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function submissionRowToDTO(row: IntakeSubmissionRow): IntakeSubmission {
  let valuesJson: Record<string, any> = {};
  if (row.values_json) {
    try { valuesJson = typeof row.values_json === 'string' ? JSON.parse(row.values_json) : row.values_json; } catch { valuesJson = {}; }
  }
  return {
    id: row.id,
    formId: row.form_id,
    submittedBy: row.submitted_by,
    valuesJson,
    status: row.status,
    reviewerId: row.reviewer_id,
    reviewNotes: row.review_notes,
    convertedProjectId: row.converted_project_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    formName: row.form_name,
    submitterName: row.submitter_name,
  };
}

export class IntakeFormRepository extends BaseRepository<IntakeForm> {
  constructor() {
    super('intake_forms', formRowToDTO);
  }

  async createForm(data: { name: string; description?: string; fields: IntakeFormField[] }, userId: string): Promise<IntakeForm> {
    const id = uuidv4();
    await this.queryRaw(
      `INSERT INTO intake_forms (id, name, description, fields, is_active, created_by)
       VALUES (?, ?, ?, ?, TRUE, ?)`,
      [id, data.name, data.description || null, JSON.stringify(data.fields), userId],
    );
    return (await this.findById(id))!;
  }

  async findActiveForms(): Promise<IntakeForm[]> {
    const rows = await this.queryRaw(
      'SELECT * FROM intake_forms WHERE is_active = TRUE ORDER BY created_at DESC',
    );
    return this.mapRows(rows);
  }

  async updateForm(id: string, data: { name?: string; description?: string; fields?: IntakeFormField[]; isActive?: boolean }): Promise<IntakeForm> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (data.fields !== undefined) { sets.push('fields = ?'); params.push(JSON.stringify(data.fields)); }
    if (data.isActive !== undefined) { sets.push('is_active = ?'); params.push(data.isActive); }
    if (sets.length > 0) {
      params.push(id);
      await this.queryRaw(`UPDATE intake_forms SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return (await this.findById(id))!;
  }

  async deleteForm(id: string): Promise<void> {
    await this.queryRaw('DELETE FROM intake_forms WHERE id = ?', [id]);
  }

  // --- Submissions ---

  async createSubmission(formId: string, values: Record<string, any>, userId: string): Promise<IntakeSubmission> {
    const id = uuidv4();
    await this.queryRaw(
      `INSERT INTO intake_submissions (id, form_id, submitted_by, values_json, status)
       VALUES (?, ?, ?, ?, 'submitted')`,
      [id, formId, userId, JSON.stringify(values)],
    );
    const rows = await this.queryRaw('SELECT * FROM intake_submissions WHERE id = ?', [id]);
    return submissionRowToDTO(rows[0]);
  }

  async findSubmissions(formId?: string, status?: string): Promise<IntakeSubmission[]> {
    let sql = `SELECT s.*, f.name as form_name, u.full_name as submitter_name
               FROM intake_submissions s
               JOIN intake_forms f ON s.form_id = f.id
               LEFT JOIN users u ON s.submitted_by = u.id`;
    const conditions: string[] = [];
    const params: any[] = [];
    if (formId) { conditions.push('s.form_id = ?'); params.push(formId); }
    if (status) { conditions.push('s.status = ?'); params.push(status); }
    if (conditions.length > 0) { sql += ' WHERE ' + conditions.join(' AND '); }
    sql += ' ORDER BY s.created_at DESC';
    const rows = await this.queryRaw(sql, params);
    return rows.map(submissionRowToDTO);
  }

  async findSubmissionById(id: string): Promise<IntakeSubmission | null> {
    const rows = await this.queryRaw(
      `SELECT s.*, f.name as form_name, u.full_name as submitter_name
       FROM intake_submissions s
       JOIN intake_forms f ON s.form_id = f.id
       LEFT JOIN users u ON s.submitted_by = u.id
       WHERE s.id = ?`,
      [id],
    );
    return rows.length > 0 ? submissionRowToDTO(rows[0]) : null;
  }

  async reviewSubmission(id: string, status: string, notes: string, reviewerId: string): Promise<IntakeSubmission> {
    await this.queryRaw(
      `UPDATE intake_submissions SET status = ?, review_notes = ?, reviewer_id = ? WHERE id = ?`,
      [status, notes, reviewerId, id],
    );
    const rows = await this.queryRaw('SELECT * FROM intake_submissions WHERE id = ?', [id]);
    return submissionRowToDTO(rows[0]);
  }

  async markConverted(submissionId: string, projectId: string): Promise<void> {
    await this.queryRaw(
      `UPDATE intake_submissions SET status = 'converted', converted_project_id = ? WHERE id = ?`,
      [projectId, submissionId],
    );
  }
}

export const intakeFormRepository = new IntakeFormRepository();
