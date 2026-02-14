import { databaseService } from '../database/connection';
import { toCamelCaseKeys } from '../utils/caseConverter';

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioAssignment {
  id: string;
  userId: string;
  portfolioId: string;
  assignedAt: Date;
}

export class PortfolioService {
  // In-memory data mirrors seed.ts
  private static portfolios: Portfolio[] = [
    {
      id: 'portfolio-1',
      name: 'Road Infrastructure 2026',
      description: 'All road and infrastructure projects for fiscal year 2026',
      createdBy: '1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'portfolio-2',
      name: 'IT Modernization',
      description: 'Technology modernization and cloud migration initiatives',
      createdBy: '1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  private static assignments: PortfolioAssignment[] = [
    { id: 'upa-1', userId: '3', portfolioId: 'portfolio-1', assignedAt: new Date() },
    { id: 'upa-2', userId: '3', portfolioId: 'portfolio-2', assignedAt: new Date() },
    { id: 'upa-3', userId: '4', portfolioId: 'portfolio-1', assignedAt: new Date() },
    { id: 'upa-4', userId: '4', portfolioId: 'portfolio-2', assignedAt: new Date() },
    { id: 'upa-5', userId: '5', portfolioId: 'portfolio-1', assignedAt: new Date() },
  ];

  private get useDb() { return databaseService.isHealthy(); }

  private rowToPortfolio(row: any): Portfolio {
    const camel = toCamelCaseKeys(row);
    return {
      ...camel,
      isActive: Boolean(camel.isActive),
      createdAt: new Date(camel.createdAt),
      updatedAt: new Date(camel.updatedAt),
    } as Portfolio;
  }

  private rowToAssignment(row: any): PortfolioAssignment {
    const camel = toCamelCaseKeys(row);
    return {
      ...camel,
      assignedAt: new Date(camel.assignedAt),
    } as PortfolioAssignment;
  }

  // ── Portfolio CRUD ──────────────────────────────────────────────────────

  async findAll(): Promise<Portfolio[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM portfolios WHERE is_active = TRUE');
      return rows.map((r: any) => this.rowToPortfolio(r));
    }
    return PortfolioService.portfolios.filter(p => p.isActive);
  }

  async findById(id: string): Promise<Portfolio | null> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM portfolios WHERE id = ?', [id]);
      return rows.length > 0 ? this.rowToPortfolio(rows[0]) : null;
    }
    return PortfolioService.portfolios.find(p => p.id === id) || null;
  }

  async create(data: { name: string; description?: string; createdBy: string }): Promise<Portfolio> {
    const id = 'portfolio-' + Math.random().toString(36).substr(2, 9);
    const now = new Date();

    if (this.useDb) {
      await databaseService.query(
        'INSERT INTO portfolios (id, name, description, created_by, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, data.name, data.description ?? null, data.createdBy, true, now, now],
      );
    } else {
      PortfolioService.portfolios.push({
        id, name: data.name, description: data.description, createdBy: data.createdBy,
        isActive: true, createdAt: now, updatedAt: now,
      });
    }

    return { id, name: data.name, description: data.description, createdBy: data.createdBy, isActive: true, createdAt: now, updatedAt: now };
  }

  async update(id: string, data: { name?: string; description?: string }): Promise<Portfolio | null> {
    if (this.useDb) {
      const setClauses: string[] = [];
      const values: any[] = [];
      if (data.name !== undefined) { setClauses.push('name = ?'); values.push(data.name); }
      if (data.description !== undefined) { setClauses.push('description = ?'); values.push(data.description); }
      if (setClauses.length === 0) return this.findById(id);
      setClauses.push('updated_at = ?');
      values.push(new Date());
      values.push(id);
      await databaseService.query(`UPDATE portfolios SET ${setClauses.join(', ')} WHERE id = ?`, values);
      return this.findById(id);
    }

    const idx = PortfolioService.portfolios.findIndex(p => p.id === id);
    if (idx === -1) return null;
    if (data.name !== undefined) PortfolioService.portfolios[idx].name = data.name;
    if (data.description !== undefined) PortfolioService.portfolios[idx].description = data.description;
    PortfolioService.portfolios[idx].updatedAt = new Date();
    return PortfolioService.portfolios[idx];
  }

  async deactivate(id: string): Promise<boolean> {
    if (this.useDb) {
      await databaseService.query('UPDATE portfolios SET is_active = FALSE, updated_at = ? WHERE id = ?', [new Date(), id]);
      return true;
    }
    const p = PortfolioService.portfolios.find(p => p.id === id);
    if (!p) return false;
    p.isActive = false;
    return true;
  }

  // ── Assignments ─────────────────────────────────────────────────────────

  async getAssignments(portfolioId: string): Promise<PortfolioAssignment[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM user_portfolio_assignments WHERE portfolio_id = ?', [portfolioId]);
      return rows.map((r: any) => this.rowToAssignment(r));
    }
    return PortfolioService.assignments.filter(a => a.portfolioId === portfolioId);
  }

  async getUserAssignments(userId: string): Promise<PortfolioAssignment[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM user_portfolio_assignments WHERE user_id = ?', [userId]);
      return rows.map((r: any) => this.rowToAssignment(r));
    }
    return PortfolioService.assignments.filter(a => a.userId === userId);
  }

  async getUserPortfolioIds(userId: string): Promise<string[]> {
    const assignments = await this.getUserAssignments(userId);
    return assignments.map(a => a.portfolioId);
  }

  async getPortfolioUserIds(portfolioIds: string[]): Promise<string[]> {
    if (portfolioIds.length === 0) return [];
    if (this.useDb) {
      const placeholders = portfolioIds.map(() => '?').join(', ');
      const rows = await databaseService.query(
        `SELECT DISTINCT user_id FROM user_portfolio_assignments WHERE portfolio_id IN (${placeholders})`,
        portfolioIds,
      );
      return rows.map((r: any) => r.user_id);
    }
    const userIds = new Set<string>();
    for (const a of PortfolioService.assignments) {
      if (portfolioIds.includes(a.portfolioId)) userIds.add(a.userId);
    }
    return Array.from(userIds);
  }

  async assignUser(portfolioId: string, userId: string): Promise<PortfolioAssignment> {
    const id = 'upa-' + Math.random().toString(36).substr(2, 9);
    const now = new Date();

    if (this.useDb) {
      await databaseService.query(
        'INSERT INTO user_portfolio_assignments (id, user_id, portfolio_id, assigned_at) VALUES (?, ?, ?, ?)',
        [id, userId, portfolioId, now],
      );
    } else {
      PortfolioService.assignments.push({ id, userId, portfolioId, assignedAt: now });
    }

    return { id, userId, portfolioId, assignedAt: now };
  }

  async removeUser(portfolioId: string, userId: string): Promise<boolean> {
    if (this.useDb) {
      await databaseService.query(
        'DELETE FROM user_portfolio_assignments WHERE portfolio_id = ? AND user_id = ?',
        [portfolioId, userId],
      );
      return true;
    }
    const idx = PortfolioService.assignments.findIndex(a => a.portfolioId === portfolioId && a.userId === userId);
    if (idx === -1) return false;
    PortfolioService.assignments.splice(idx, 1);
    return true;
  }

  async findByUserId(userId: string): Promise<Portfolio[]> {
    const portfolioIds = await this.getUserPortfolioIds(userId);
    if (portfolioIds.length === 0) return [];

    if (this.useDb) {
      const placeholders = portfolioIds.map(() => '?').join(', ');
      const rows = await databaseService.query(
        `SELECT * FROM portfolios WHERE id IN (${placeholders}) AND is_active = TRUE`,
        portfolioIds,
      );
      return rows.map((r: any) => this.rowToPortfolio(r));
    }
    return PortfolioService.portfolios.filter(p => portfolioIds.includes(p.id) && p.isActive);
  }
}
