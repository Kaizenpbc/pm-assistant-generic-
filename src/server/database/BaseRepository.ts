import { databaseService } from './connection';

export type RowMapper<T> = (row: any) => T;

export class BaseRepository<T> {
  constructor(
    protected readonly tableName: string,
    protected readonly rowMapper: RowMapper<T>,
  ) {}

  async findById(id: string): Promise<T | null> {
    const rows = await databaseService.query(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id],
    );
    return rows.length > 0 ? this.rowMapper(rows[0]) : null;
  }

  async findAll(limit = 1000): Promise<T[]> {
    const rows = await databaseService.query(
      `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map(this.rowMapper);
  }

  async deleteById(id: string, ...extraWhere: { column: string; value: any }[]): Promise<boolean> {
    let sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const params: any[] = [id];
    for (const w of extraWhere) {
      sql += ` AND ${w.column} = ?`;
      params.push(w.value);
    }
    const result: any = await databaseService.query(sql, params);
    return (result.affectedRows ?? 0) > 0;
  }

  async countWhere(where: string, params: any[]): Promise<number> {
    const rows = await databaseService.query(
      `SELECT COUNT(*) AS cnt FROM ${this.tableName} WHERE ${where}`,
      params,
    );
    return Number(rows[0].cnt);
  }

  async queryPaginated(
    where: string,
    params: any[],
    orderBy: string,
    limit: number,
    offset: number,
  ): Promise<{ rows: T[]; total: number }> {
    const [countResult, dataRows] = await Promise.all([
      databaseService.query(
        `SELECT COUNT(*) AS cnt FROM ${this.tableName} WHERE ${where}`,
        params,
      ),
      databaseService.query(
        `SELECT * FROM ${this.tableName} WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
    ]);
    return {
      rows: dataRows.map(this.rowMapper),
      total: Number(countResult[0].cnt),
    };
  }

  buildUpdate(
    data: Record<string, any>,
    columnMap: Record<string, string>,
    valueTransform?: (key: string, value: any) => any,
  ): { sql: string; values: any[] } | null {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, column] of Object.entries(columnMap)) {
      if (key in data) {
        fields.push(`${column} = ?`);
        let val = data[key];
        if (valueTransform) {
          val = valueTransform(key, val);
        }
        values.push(val ?? null);
      }
    }

    if (fields.length === 0) return null;

    return {
      sql: `UPDATE ${this.tableName} SET ${fields.join(', ')} WHERE id = ?`,
      values,
    };
  }

  protected async queryRaw(sql: string, params: any[] = []): Promise<any[]> {
    return databaseService.query(sql, params);
  }

  protected mapRows(rows: any[]): T[] {
    return rows.map(this.rowMapper);
  }
}
