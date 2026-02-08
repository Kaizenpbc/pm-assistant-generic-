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
      createdBy: '1',
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
      createdBy: '1',
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
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  private get projects() { return ProjectService.projects; }

  async findById(id: string, userId?: string): Promise<Project | null> {
    if (userId) {
      return this.projects.find(p => p.id === id && p.createdBy === userId) || null;
    }
    return this.projects.find(p => p.id === id) || null;
  }

  async findByUserId(userId: string): Promise<Project[]> {
    return this.projects.filter(project => project.createdBy === userId);
  }

  async findAll(): Promise<Project[]> {
    return this.projects;
  }

  async create(data: CreateProjectData): Promise<Project> {
    const project: Project = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name,
      description: data.description,
      category: data.category,
      projectType: data.projectType || 'other',
      status: data.status || 'planning',
      priority: data.priority || 'medium',
      budgetAllocated: data.budgetAllocated,
      budgetSpent: 0,
      currency: data.currency || 'USD',
      location: data.location,
      locationLat: data.locationLat,
      locationLon: data.locationLon,
      startDate: data.startDate,
      endDate: data.endDate,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    ProjectService.projects.push(project);
    return project;
  }

  async update(id: string, data: Partial<Omit<Project, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>>, userId?: string): Promise<Project | null> {
    const projectIndex = userId
      ? this.projects.findIndex(p => p.id === id && p.createdBy === userId)
      : this.projects.findIndex(p => p.id === id);
    if (projectIndex === -1) return null;
    ProjectService.projects[projectIndex] = { ...this.projects[projectIndex], ...data, updatedAt: new Date() };
    return ProjectService.projects[projectIndex];
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    const projectIndex = userId
      ? this.projects.findIndex(p => p.id === id && p.createdBy === userId)
      : this.projects.findIndex(p => p.id === id);
    if (projectIndex === -1) return false;
    ProjectService.projects.splice(projectIndex, 1);
    return true;
  }
}
