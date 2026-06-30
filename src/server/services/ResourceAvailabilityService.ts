import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';

export interface ResourceAvailability {
  id: string;
  resourceId: string;
  dateFrom: string;
  dateTo: string;
  type: 'vacation' | 'holiday' | 'unavailable' | 'reduced';
  hoursAvailable: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToAvailability(row: any): ResourceAvailability {
  return {
    id: row.id,
    resourceId: row.resource_id,
    dateFrom: String(row.date_from).slice(0, 10),
    dateTo: String(row.date_to).slice(0, 10),
    type: row.type,
    hoursAvailable: row.hours_available != null ? Number(row.hours_available) : null,
    note: row.note ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class ResourceAvailabilityService {
  async findByResource(resourceId: string, dateFrom?: string, dateTo?: string): Promise<ResourceAvailability[]> {
    let sql = 'SELECT * FROM resource_availability WHERE resource_id = ?';
    const params: any[] = [resourceId];
    if (dateFrom) {
      sql += ' AND date_to >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND date_from <= ?';
      params.push(dateTo);
    }
    sql += ' ORDER BY date_from';
    const rows = await databaseService.query(sql, params);
    return rows.map(rowToAvailability);
  }

  async findById(id: string): Promise<ResourceAvailability | null> {
    const rows = await databaseService.query('SELECT * FROM resource_availability WHERE id = ?', [id]);
    return rows.length > 0 ? rowToAvailability(rows[0]) : null;
  }

  async create(data: {
    resourceId: string;
    dateFrom: string;
    dateTo: string;
    type: 'vacation' | 'holiday' | 'unavailable' | 'reduced';
    hoursAvailable?: number;
    note?: string;
  }): Promise<ResourceAvailability> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO resource_availability (id, resource_id, date_from, date_to, type, hours_available, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.resourceId, data.dateFrom, data.dateTo, data.type, data.hoursAvailable ?? null, data.note || null]
    );
    return (await this.findById(id))!;
  }

  async update(id: string, data: {
    dateFrom?: string;
    dateTo?: string;
    type?: 'vacation' | 'holiday' | 'unavailable' | 'reduced';
    hoursAvailable?: number | null;
    note?: string | null;
  }): Promise<ResourceAvailability | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    if (data.dateFrom !== undefined) { fields.push('date_from = ?'); values.push(data.dateFrom); }
    if (data.dateTo !== undefined) { fields.push('date_to = ?'); values.push(data.dateTo); }
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
    if (data.hoursAvailable !== undefined) { fields.push('hours_available = ?'); values.push(data.hoursAvailable); }
    if (data.note !== undefined) { fields.push('note = ?'); values.push(data.note); }

    if (fields.length === 0) return existing;
    values.push(id);
    await databaseService.query(`UPDATE resource_availability SET ${fields.join(', ')} WHERE id = ?`, values);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<boolean> {
    const result = await databaseService.query('DELETE FROM resource_availability WHERE id = ?', [id]);
    return (result as any).affectedRows > 0;
  }

  /**
   * Get effective capacity for a resource during a given week.
   * Returns hours available accounting for availability blocks.
   */
  async getEffectiveCapacity(resourceId: string, weekStart: Date, baseCapacity: number): Promise<number> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const rows = await databaseService.query(
      `SELECT * FROM resource_availability
       WHERE resource_id = ? AND date_from <= ? AND date_to >= ?`,
      [resourceId, weekEnd.toISOString().slice(0, 10), weekStart.toISOString().slice(0, 10)]
    );

    if (rows.length === 0) return baseCapacity;

    // Calculate overlap days and reduce capacity
    let unavailableDays = 0;
    let reducedHoursTotal = 0;
    let reducedDays = 0;

    for (const row of rows) {
      const blockStart = new Date(Math.max(new Date(row.date_from).getTime(), weekStart.getTime()));
      const blockEnd = new Date(Math.min(new Date(row.date_to).getTime(), weekEnd.getTime()));
      const overlapDays = Math.max(0, Math.ceil((blockEnd.getTime() - blockStart.getTime()) / 86400000) + 1);

      if (row.type === 'reduced' && row.hours_available != null) {
        reducedDays += overlapDays;
        reducedHoursTotal += Number(row.hours_available) * overlapDays;
      } else {
        unavailableDays += overlapDays;
      }
    }

    const hoursPerDay = baseCapacity / 5; // Assume 5 working days per week
    const available = Math.max(0, baseCapacity - (unavailableDays * hoursPerDay));

    if (reducedDays > 0) {
      // Replace those days' normal hours with reduced hours
      return Math.max(0, available - (reducedDays * hoursPerDay) + reducedHoursTotal);
    }

    return available;
  }
}

export const resourceAvailabilityService = new ResourceAvailabilityService();
