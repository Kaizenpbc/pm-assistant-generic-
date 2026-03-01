import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { projectService, Project } from './ProjectService';

export interface IntakeFormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface IntakeForm {
  id: string;
  name: string;
  description: string | null;
  fields: IntakeFormField[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeSubmission {
  id: string;
  formId: string;
  submittedBy: string;
  valuesJson: Record<string, any>;
  status: string;
  reviewerId: string | null;
  reviewNotes: string | null;
  convertedProjectId: string | null;
  createdAt: string;
  updatedAt: string;
  formName?: string;
  submitterName?: string;
}

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

class IntakeFormService {
  async createForm(data: { name: string; description?: string; fields: IntakeFormField[] }, userId: string): Promise<IntakeForm> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO intake_forms (id, name, description, fields, is_active, created_by)
       VALUES (?, ?, ?, ?, TRUE, ?)`,
      [id, data.name, data.description || null, JSON.stringify(data.fields), userId],
    );
    const rows = await databaseService.query<IntakeFormRow>('SELECT * FROM intake_forms WHERE id = ?', [id]);
    return formRowToDTO(rows[0]);
  }

  async getForms(): Promise<IntakeForm[]> {
    const rows = await databaseService.query<IntakeFormRow>(
      'SELECT * FROM intake_forms WHERE is_active = TRUE ORDER BY created_at DESC',
    );
    return rows.map(formRowToDTO);
  }

  async getFormById(id: string): Promise<IntakeForm | null> {
    const rows = await databaseService.query<IntakeFormRow>('SELECT * FROM intake_forms WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return formRowToDTO(rows[0]);
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
      await databaseService.query(`UPDATE intake_forms SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const rows = await databaseService.query<IntakeFormRow>('SELECT * FROM intake_forms WHERE id = ?', [id]);
    return formRowToDTO(rows[0]);
  }

  async deleteForm(id: string): Promise<void> {
    await databaseService.query('DELETE FROM intake_forms WHERE id = ?', [id]);
  }

  async submitForm(formId: string, values: Record<string, any>, userId: string): Promise<IntakeSubmission> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO intake_submissions (id, form_id, submitted_by, values_json, status)
       VALUES (?, ?, ?, ?, 'submitted')`,
      [id, formId, userId, JSON.stringify(values)],
    );
    const rows = await databaseService.query<IntakeSubmissionRow>('SELECT * FROM intake_submissions WHERE id = ?', [id]);
    return submissionRowToDTO(rows[0]);
  }

  async getSubmissions(formId?: string, status?: string): Promise<IntakeSubmission[]> {
    let sql = `SELECT s.*, f.name as form_name, u.name as submitter_name
               FROM intake_submissions s
               JOIN intake_forms f ON s.form_id = f.id
               LEFT JOIN users u ON s.submitted_by = u.id`;
    const conditions: string[] = [];
    const params: any[] = [];
    if (formId) { conditions.push('s.form_id = ?'); params.push(formId); }
    if (status) { conditions.push('s.status = ?'); params.push(status); }
    if (conditions.length > 0) { sql += ' WHERE ' + conditions.join(' AND '); }
    sql += ' ORDER BY s.created_at DESC';
    const rows = await databaseService.query<IntakeSubmissionRow>(sql, params);
    return rows.map(submissionRowToDTO);
  }

  async getSubmissionById(id: string): Promise<IntakeSubmission | null> {
    const rows = await databaseService.query<IntakeSubmissionRow>(
      `SELECT s.*, f.name as form_name, u.name as submitter_name
       FROM intake_submissions s
       JOIN intake_forms f ON s.form_id = f.id
       LEFT JOIN users u ON s.submitted_by = u.id
       WHERE s.id = ?`,
      [id],
    );
    if (rows.length === 0) return null;
    return submissionRowToDTO(rows[0]);
  }

  async reviewSubmission(id: string, status: string, notes: string, reviewerId: string): Promise<IntakeSubmission> {
    await databaseService.query(
      `UPDATE intake_submissions SET status = ?, review_notes = ?, reviewer_id = ? WHERE id = ?`,
      [status, notes, reviewerId, id],
    );
    const rows = await databaseService.query<IntakeSubmissionRow>('SELECT * FROM intake_submissions WHERE id = ?', [id]);
    return submissionRowToDTO(rows[0]);
  }

  async convertToProject(submissionId: string, userId: string): Promise<Project> {
    // 1. Get submission + form fields
    const submission = await this.getSubmissionById(submissionId);
    if (!submission) throw new Error('Submission not found');

    const form = await this.getFormById(submission.formId);
    if (!form) throw new Error('Form not found');

    // 2. Extract project name from values (use first text field or field labeled 'name'/'project name')
    const values = submission.valuesJson;
    let projectName = '';
    let projectDescription = '';

    // Try to find a field labeled 'name' or 'project name' first
    const nameField = form.fields.find(f =>
      f.label.toLowerCase() === 'name' || f.label.toLowerCase() === 'project name',
    );
    if (nameField && values[nameField.id]) {
      projectName = String(values[nameField.id]);
    } else {
      // Fall back to first text field
      const firstTextField = form.fields.find(f => f.type === 'text');
      if (firstTextField && values[firstTextField.id]) {
        projectName = String(values[firstTextField.id]);
      } else {
        projectName = `Project from ${form.name}`;
      }
    }

    // Build description from all submitted values
    const descriptionParts = form.fields
      .filter(f => values[f.id] !== undefined && values[f.id] !== null && values[f.id] !== '')
      .map(f => `${f.label}: ${values[f.id]}`);
    projectDescription = descriptionParts.join('\n');

    // 3. Create the project
    const project = await projectService.create({
      name: projectName,
      description: projectDescription,
      status: 'planning',
      userId,
    });

    // 4. Update submission: status='converted', converted_project_id=newProjectId
    await databaseService.query(
      `UPDATE intake_submissions SET status = 'converted', converted_project_id = ? WHERE id = ?`,
      [project.id, submissionId],
    );

    // 5. Return the new project
    return project;
  }
}

export const intakeFormService = new IntakeFormService();
