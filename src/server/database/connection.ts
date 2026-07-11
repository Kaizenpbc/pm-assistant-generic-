import mysql from 'mysql2/promise';
import { config } from '../config';
import logger from '../utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  waitForConnections: boolean;
  connectionLimit: number;
  connectTimeout: number;
  idleTimeout: number;
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
        connectTimeout: config.DB_CONNECT_TIMEOUT,
        idleTimeout: config.DB_IDLE_TIMEOUT,
        queueLimit: config.DB_QUEUE_LIMIT,
      };

      this.pool = mysql.createPool({ ...dbConfig, dateStrings: true, charset: 'utf8mb4' });
      this.isConnected = true;
      logger.info('Database connection pool initialized');
    } catch (error) {
      logger.error('Failed to initialize database connection pool', { error });
      this.isConnected = false;
    }
  }

  private getTenantDbName(): string | undefined {
    if (!config.MULTI_TENANT_ENABLED) return undefined;
    // Lazy import to avoid circular dependency at module load time
    const { getRequestContext } = require('../middleware/requestContext');
    const ctx = getRequestContext();
    return ctx?.tenantDbName;
  }

  public async getConnection(): Promise<mysql.PoolConnection> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    const conn = await this.pool.getConnection();
    const tenantDb = this.getTenantDbName();
    if (tenantDb) {
      await conn.query(`USE \`${tenantDb}\``);
    }
    return conn;
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    const tenantDb = this.getTenantDbName();
    if (tenantDb) {
      const conn = await this.pool.getConnection();
      try {
        await conn.query(`USE \`${tenantDb}\``);
        const [rows] = await conn.execute(sql, params);
        return rows as T[];
      } finally {
        conn.release();
      }
    }
    const [rows] = await this.pool.execute(sql, params);
    return rows as T[];
  }

  public async queryOn<T = any>(connection: mysql.PoolConnection, sql: string, params: any[] = []): Promise<T[]> {
    const [rows] = await connection.execute(sql, params);
    return rows as T[];
  }

  /**
   * Execute a query explicitly against the control plane database,
   * bypassing any tenant context from AsyncLocalStorage.
   */
  public async queryControlPlane<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    if (config.MULTI_TENANT_ENABLED) {
      const conn = await this.pool.getConnection();
      try {
        await conn.query(`USE \`${config.DB_NAME}\``);
        const [rows] = await conn.execute(sql, params);
        return rows as T[];
      } finally {
        conn.release();
      }
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
      logger.error('Database connection test failed', { error });
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }

  public isHealthy(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Get the underlying pool for direct connection management (e.g., tenant provisioning).
   * Use with caution — prefer query() or getConnection() for normal operations.
   */
  public getPool(): mysql.Pool | null {
    return this.pool;
  }
}

export const databaseService = new DatabaseService();
export default databaseService;
