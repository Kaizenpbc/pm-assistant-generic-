import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';

export interface CustomField {
  id: string;
  projectId: string;
  entityType: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  options: string[] | null;
  isRequired: boolean;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
}

export interface CustomFieldValue {
  id: string;
  fieldId: string;
  entityId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueBoolean: boolean | null;
  createdAt: string;
  updatedAt: string;
}

interface CustomFieldRow {
  id: string;
  project_id: string;
  entity_type: string;
  field_name: string;
  field_label: string;
  field_type: string;
  options: string | null;
  is_required: boolean | number;
  sort_order: number;
  created_by: string;
  created_at: string;
}

interface CustomFieldValueRow {
  id: string;
  field_id: string;
  entity_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | number | null;
  created_at: string;
  updated_at: string;
}

function fieldRowToDTO(row: CustomFieldRow): CustomField {
  let opts: string[] | null = null;
  if (row.options) {
    try { opts = typeof row.options === 'string' ? JSON.parse(row.options) : row.options; } catch { opts = null; }
  }
  return {
    id: row.id,
    projectId: row.project_id,
    entityType: row.entity_type,
    fieldName: row.field_name,
    fieldLabel: row.field_label,
    fieldType: row.field_type,
    options: opts,
    isRequired: !!row.is_required,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function valueRowToDTO(row: CustomFieldValueRow): CustomFieldValue {
  return {
    id: row.id,
    fieldId: row.field_id,
    entityId: row.entity_id,
    valueText: row.value_text,
    valueNumber: row.value_number != null ? Number(row.value_number) : null,
    valueDate: row.value_date ? (typeof row.value_date === 'string' ? row.value_date : new Date(row.value_date).toISOString().slice(0, 10)) : null,
    valueBoolean: row.value_boolean != null ? !!row.value_boolean : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class CustomFieldService {
  async createField(data: {
    projectId: string;
    entityType: string;
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    options?: string[];
    isRequired?: boolean;
    sortOrder?: number;
    createdBy: string;
  }): Promise<CustomField> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO custom_fields (id, project_id, entity_type, field_name, field_label, field_type, options, is_required, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.projectId, data.entityType, data.fieldName, data.fieldLabel, data.fieldType,
       data.options ? JSON.stringify(data.options) : null, data.isRequired || false, data.sortOrder || 0, data.createdBy],
    );
    const rows = await databaseService.query<CustomFieldRow>('SELECT * FROM custom_fields WHERE id = ?', [id]);
    return fieldRowToDTO(rows[0]);
  }

  async getFieldsByProject(projectId: string, entityType?: string): Promise<CustomField[]> {
    let sql = 'SELECT * FROM custom_fields WHERE project_id = ?';
    const params: any[] = [projectId];
    if (entityType) { sql += ' AND entity_type = ?'; params.push(entityType); }
    sql += ' ORDER BY sort_order, created_at';
    const rows = await databaseService.query<CustomFieldRow>(sql, params);
    return rows.map(fieldRowToDTO);
  }

  async updateField(id: string, data: { fieldLabel?: string; fieldType?: string; options?: string[]; isRequired?: boolean; sortOrder?: number }): Promise<CustomField> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.fieldLabel !== undefined) { sets.push('field_label = ?'); params.push(data.fieldLabel); }
    if (data.fieldType !== undefined) { sets.push('field_type = ?'); params.push(data.fieldType); }
    if (data.options !== undefined) { sets.push('options = ?'); params.push(JSON.stringify(data.options)); }
    if (data.isRequired !== undefined) { sets.push('is_required = ?'); params.push(data.isRequired); }
    if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(data.sortOrder); }
    if (sets.length > 0) {
      params.push(id);
      await databaseService.query(`UPDATE custom_fields SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const rows = await databaseService.query<CustomFieldRow>('SELECT * FROM custom_fields WHERE id = ?', [id]);
    return fieldRowToDTO(rows[0]);
  }

  async deleteField(id: string): Promise<void> {
    await databaseService.query('DELETE FROM custom_fields WHERE id = ?', [id]);
  }

  async getValues(entityType: string, entityId: string, projectId: string): Promise<Array<CustomField & { value: CustomFieldValue | null }>> {
    const fields = await this.getFieldsByProject(projectId, entityType);
    if (fields.length === 0) return [];

    const fieldIds = fields.map(f => f.id);
    const placeholders = fieldIds.map(() => '?').join(',');
    const valueRows = await databaseService.query<CustomFieldValueRow>(
      `SELECT * FROM custom_field_values WHERE field_id IN (${placeholders}) AND entity_id = ?`,
      [...fieldIds, entityId],
    );
    const valueMap = new Map(valueRows.map(r => [r.field_id, valueRowToDTO(r)]));

    return fields.map(f => ({
      ...f,
      value: valueMap.get(f.id) || null,
    }));
  }

  async setValue(fieldId: string, entityId: string, value: { text?: string; number?: number; date?: string; boolean?: boolean }): Promise<CustomFieldValue> {
    // Get field to determine type
    const fieldRows = await databaseService.query<CustomFieldRow>('SELECT * FROM custom_fields WHERE id = ?', [fieldId]);
    if (fieldRows.length === 0) throw new Error('Field not found');

    const existing = await databaseService.query<CustomFieldValueRow>(
      'SELECT * FROM custom_field_values WHERE field_id = ? AND entity_id = ?',
      [fieldId, entityId],
    );

    if (existing.length > 0) {
      await databaseService.query(
        `UPDATE custom_field_values SET value_text = ?, value_number = ?, value_date = ?, value_boolean = ? WHERE field_id = ? AND entity_id = ?`,
        [value.text ?? null, value.number ?? null, value.date ?? null, value.boolean ?? null, fieldId, entityId],
      );
    } else {
      const id = uuidv4();
      await databaseService.query(
        `INSERT INTO custom_field_values (id, field_id, entity_id, value_text, value_number, value_date, value_boolean)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, fieldId, entityId, value.text ?? null, value.number ?? null, value.date ?? null, value.boolean ?? null],
      );
    }

    const rows = await databaseService.query<CustomFieldValueRow>(
      'SELECT * FROM custom_field_values WHERE field_id = ? AND entity_id = ?',
      [fieldId, entityId],
    );
    return valueRowToDTO(rows[0]);
  }

  async bulkSetValues(entityId: string, values: Array<{ fieldId: string; text?: string; number?: number; date?: string; boolean?: boolean }>): Promise<void> {
    for (const v of values) {
      await this.setValue(v.fieldId, entityId, v);
    }
  }
}

export const customFieldService = new CustomFieldService();
