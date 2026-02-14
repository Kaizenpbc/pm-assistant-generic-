import { databaseService } from '../database/connection';
import { toCamelCaseKeys } from '../utils/caseConverter';

export interface Project {
  id: string;
  name: string;
  description?: string;
  category?: string;
  projectType: 'it' | 'construction' | 'infrastructure' | 'roads' | 'other';
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  budgetAllocated?: number;
  budgetSpent: number;
  currency: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  startDate?: Date;
  endDate?: Date;
  projectManagerId?: string;
  portfolioId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  category?: string;
  projectType?: 'it' | 'construction' | 'infrastructure' | 'roads' | 'other';
  status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  budgetAllocated?: number;
  currency?: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  startDate?: Date;
  endDate?: Date;
  portfolioId?: string;
  userId: string;
}

export class ProjectService {
  private static projects: Project[] = [
    {
      id: '1',
      name: 'Cloud Migration Project',
      description: 'Migrate on-premise infrastructure to AWS cloud services',
      category: 'technology',
      projectType: 'it',
      status: 'active',
      priority: 'high',
      budgetAllocated: 500000,
      budgetSpent: 175000,
      currency: 'USD',
      location: 'New York, NY',
      locationLat: 40.71,
      locationLon: -74.01,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-12-31'),
      portfolioId: 'portfolio-2',
      createdBy: '4',  // John Smith (PM)
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'Highway 101 Expansion',
      description: 'Widen Highway 101 from 4 to 6 lanes between Exit 12 and Exit 18',
      category: 'transportation',
      projectType: 'roads',
      status: 'planning',
      priority: 'high',
      budgetAllocated: 8000000,
      budgetSpent: 1200000,
      currency: 'USD',
      location: 'San Jose, CA',
      locationLat: 37.34,
      locationLon: -121.89,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2028-06-30'),
      portfolioId: 'portfolio-1',
      createdBy: '4',  // John Smith (PM)
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '3',
      name: 'Downtown Office Complex',
      description: 'Construction of a 12-story mixed-use office and retail building',
      category: 'commercial',
      projectType: 'construction',
      status: 'active',
      priority: 'urgent',
      budgetAllocated: 25000000,
      budgetSpent: 8500000,
      currency: 'USD',
      location: 'Chicago, IL',
      locationLat: 41.88,
      locationLon: -87.63,
      startDate: new Date('2025-06-01'),
      endDate: new Date('2027-12-31'),
      portfolioId: 'portfolio-1',
      createdBy: '5',  // Sarah Chen (PM)
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  private get projects() { return ProjectService.projects; }
  private get useDb() { return databaseService.isHealthy(); }

  private rowToProject(row: any): Project {
    const camel = toCamelCaseKeys(row);
    return {
      ...camel,
      budgetAllocated: camel.budgetAllocated != null ? Number(camel.budgetAllocated) : undefined,
      budgetSpent: Number(camel.budgetSpent),
      locationLat: camel.locationLat != null ? Number(camel.locationLat) : undefined,
      locationLon: camel.locationLon != null ? Number(camel.locationLon) : undefined,
      startDate: camel.startDate ? new Date(camel.startDate) : undefined,
      endDate: camel.endDate ? new Date(camel.endDate) : undefined,
      createdAt: new Date(camel.createdAt),
      updatedAt: new Date(camel.updatedAt),
    } as Project;
  }

  async findById(id: string, userId?: string): Promise<Project | null> {
    if (this.useDb) {
      const rows = userId
        ? await databaseService.query('SELECT * FROM projects WHERE id = ? AND created_by = ?', [id, userId])
        : await databaseService.query('SELECT * FROM projects WHERE id = ?', [id]);
      return rows.length > 0 ? this.rowToProject(rows[0]) : null;
    }
    if (userId) {
      return this.projects.find(p => p.id === id && p.createdBy === userId) || null;
    }
    return this.projects.find(p => p.id === id) || null;
  }

  async findByUserId(userId: string): Promise<Project[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM projects WHERE created_by = ?', [userId]);
      return rows.map((r: any) => this.rowToProject(r));
    }
    return this.projects.filter(project => project.createdBy === userId);
  }

  async findAll(): Promise<Project[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM projects');
      return rows.map((r: any) => this.rowToProject(r));
    }
    return this.projects;
  }

  async findByPortfolioIds(portfolioIds: string[]): Promise<Project[]> {
    if (portfolioIds.length === 0) return [];
    if (this.useDb) {
      const placeholders = portfolioIds.map(() => '?').join(', ');
      const rows = await databaseService.query(
        `SELECT * FROM projects WHERE portfolio_id IN (${placeholders})`,
        portfolioIds,
      );
      return rows.map((r: any) => this.rowToProject(r));
    }
    return this.projects.filter(p => p.portfolioId && portfolioIds.includes(p.portfolioId));
  }

  /**
   * Scope-aware query: returns projects based on role-based data scope.
   * - pmUserIds = specific user IDs → filter by created_by
   * - pmUserIds = 'all' → no user filter (but may still filter by portfolio)
   * - portfolioIds = specific IDs → filter by portfolio_id
   * - portfolioIds = 'all' → no portfolio filter
   */
  async findByScope(scope: {
    portfolioIds: string[] | 'all';
    pmUserIds: string[] | 'all';
    filterPortfolioId?: string;
    filterPmUserId?: string;
  }): Promise<Project[]> {
    // Start with all projects and narrow down
    let projects: Project[];

    if (scope.pmUserIds !== 'all' && scope.pmUserIds.length > 0) {
      // PM or limited scope — filter by user IDs
      if (this.useDb) {
        const placeholders = scope.pmUserIds.map(() => '?').join(', ');
        const rows = await databaseService.query(
          `SELECT * FROM projects WHERE created_by IN (${placeholders})`,
          scope.pmUserIds,
        );
        projects = rows.map((r: any) => this.rowToProject(r));
      } else {
        projects = this.projects.filter(p => (scope.pmUserIds as string[]).includes(p.createdBy));
      }
    } else if (scope.portfolioIds !== 'all' && scope.portfolioIds.length > 0) {
      // Portfolio manager — filter by portfolio IDs
      projects = await this.findByPortfolioIds(scope.portfolioIds);
    } else {
      // PMO / Admin — see all
      projects = await this.findAll();
    }

    // Apply optional filter bar narrowing
    if (scope.filterPortfolioId) {
      projects = projects.filter(p => p.portfolioId === scope.filterPortfolioId);
    }
    if (scope.filterPmUserId) {
      projects = projects.filter(p => p.createdBy === scope.filterPmUserId);
    }

    return projects;
  }

  async create(data: CreateProjectData): Promise<Project> {
    const id = Math.random().toString(36).substr(2, 9);
    const now = new Date();
    const projectType = data.projectType || 'other';
    const status = data.status || 'planning';
    const priority = data.priority || 'medium';
    const currency = data.currency || 'USD';

    if (this.useDb) {
      await databaseService.query(
        `INSERT INTO projects (id, name, description, category, project_type, status, priority, budget_allocated, budget_spent, currency, location, location_lat, location_lon, start_date, end_date, portfolio_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.name, data.description ?? null, data.category ?? null, projectType, status, priority, data.budgetAllocated ?? null, 0, currency, data.location ?? null, data.locationLat ?? null, data.locationLon ?? null, data.startDate ?? null, data.endDate ?? null, data.portfolioId ?? null, data.userId, now, now],
      );
      return {
        id,
        name: data.name,
        description: data.description,
        category: data.category,
        projectType,
        status,
        priority,
        budgetAllocated: data.budgetAllocated,
        budgetSpent: 0,
        currency,
        location: data.location,
        locationLat: data.locationLat,
        locationLon: data.locationLon,
        startDate: data.startDate,
        endDate: data.endDate,
        portfolioId: data.portfolioId,
        createdBy: data.userId,
        createdAt: now,
        updatedAt: now,
      };
    }

    const project: Project = {
      id,
      name: data.name,
      description: data.description,
      category: data.category,
      projectType,
      status,
      priority,
      budgetAllocated: data.budgetAllocated,
      budgetSpent: 0,
      currency,
      location: data.location,
      locationLat: data.locationLat,
      locationLon: data.locationLon,
      startDate: data.startDate,
      endDate: data.endDate,
      portfolioId: data.portfolioId,
      createdBy: data.userId,
      createdAt: now,
      updatedAt: now,
    };
    ProjectService.projects.push(project);
    return project;
  }

  async update(id: string, data: Partial<Omit<Project, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>>, userId?: string): Promise<Project | null> {
    if (this.useDb) {
      const setClauses: string[] = [];
      const values: any[] = [];
      const fieldMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        category: 'category',
        projectType: 'project_type',
        status: 'status',
        priority: 'priority',
        budgetAllocated: 'budget_allocated',
        budgetSpent: 'budget_spent',
        currency: 'currency',
        location: 'location',
        locationLat: 'location_lat',
        locationLon: 'location_lon',
        startDate: 'start_date',
        endDate: 'end_date',
        projectManagerId: 'project_manager_id',
        portfolioId: 'portfolio_id',
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if ((data as any)[key] !== undefined) {
          setClauses.push(`${col} = ?`);
          values.push((data as any)[key]);
        }
      }
      if (setClauses.length === 0) return this.findById(id, userId);
      setClauses.push('updated_at = ?');
      values.push(new Date());
      if (userId) {
        values.push(id, userId);
        await databaseService.query(`UPDATE projects SET ${setClauses.join(', ')} WHERE id = ? AND created_by = ?`, values);
      } else {
        values.push(id);
        await databaseService.query(`UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`, values);
      }
      return this.findById(id, userId);
    }

    const projectIndex = userId
      ? this.projects.findIndex(p => p.id === id && p.createdBy === userId)
      : this.projects.findIndex(p => p.id === id);
    if (projectIndex === -1) return null;
    ProjectService.projects[projectIndex] = { ...this.projects[projectIndex], ...data, updatedAt: new Date() };
    return ProjectService.projects[projectIndex];
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    if (this.useDb) {
      if (userId) {
        await databaseService.query('DELETE FROM projects WHERE id = ? AND created_by = ?', [id, userId]);
      } else {
        await databaseService.query('DELETE FROM projects WHERE id = ?', [id]);
      }
      return true;
    }
    const projectIndex = userId
      ? this.projects.findIndex(p => p.id === id && p.createdBy === userId)
      : this.projects.findIndex(p => p.id === id);
    if (projectIndex === -1) return false;
    ProjectService.projects.splice(projectIndex, 1);
    return true;
  }
}
