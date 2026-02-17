import mysql from 'mysql2/promise';
import { config } from '../config';
import { createServiceLogger } from '../utils/logger';

const log = createServiceLogger('database');

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
}

class DatabaseService {
  private pool: mysql.Pool | null = null;
  private isConnected = false;

  constructor() {
    this.initializePool();
  }

  private initializePool(): void {
    try {
      const dbConfig: DatabaseConfig = {
        host: config.DB_HOST,
        port: config.DB_PORT,
        user: config.DB_USER,
        password: config.DB_PASSWORD,
        database: config.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };

      this.pool = mysql.createPool(dbConfig);
      this.isConnected = true;
      log.info('Connection pool initialized');
    } catch (error) {
      log.error({ err: error }, 'Failed to initialize connection pool');
      this.isConnected = false;
    }
  }

  public async getConnection(): Promise<mysql.PoolConnection> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool.getConnection();
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    const [rows] = await this.pool.execute(sql, params);
    return rows as T[];
  }

  public async transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      log.error({ err: error }, 'Connection test failed');
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      log.info('Connection pool closed');
    }
  }

  public isHealthy(): boolean {
    return this.isConnected && this.pool !== null;
  }
}

export const databaseService = new DatabaseService();
export default databaseService;
