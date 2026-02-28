import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pm_assistant',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }
  return pool;
}

export async function query<T extends RowDataPacket>(sql: string, params?: (string | number | null | boolean)[]): Promise<T[]> {
  const [rows] = await getPool().execute<T[]>(sql, params);
  return rows;
}
