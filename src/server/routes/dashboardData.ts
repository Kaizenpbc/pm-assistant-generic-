import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth';
import { dataScopeMiddleware } from '../middleware/dataScope';
import { ProjectService } from '../services/ProjectService';
import { PortfolioService } from '../services/PortfolioService';
import { UserService } from '../services/UserService';

export interface PMSummary {
  userId: string;
  fullName: string;
  email: string;
  projectCount: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
  totalBudget: number;
  totalSpent: number;
}

export interface PortfolioSummary {
  portfolioId: string;
  portfolioName: string;
  description?: string;
  pmCount: number;
  projectCount: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
  totalBudget: number;
  totalSpent: number;
}

function categorizeProject(p: { status: string; budgetAllocated?: number; budgetSpent: number }): 'on_track' | 'at_risk' | 'delayed' {
  if (p.status === 'completed' || p.status === 'cancelled') return 'on_track';
  if (p.status === 'on_hold') return 'at_risk';
  if (p.budgetAllocated && p.budgetSpent > p.budgetAllocated * 0.9) return 'at_risk';
  if (p.status === 'active') return 'on_track';
  return 'on_track';
}

export async function dashboardDataRoutes(fastify: FastifyInstance) {
  const projectService = new ProjectService();
  const portfolioService = new PortfolioService();
  const userService = new UserService();

  /**
   * GET /api/v1/dashboard/pm-summaries
   * Returns PM summary cards for portfolio_manager and above.
   * Respects dataScope — portfolio_manager sees PMs in their portfolios only.
   */
  fastify.get('/pm-summaries', {
    preHandler: [authMiddleware, dataScopeMiddleware, requireRole('admin', 'pmo_manager', 'portfolio_manager')],
    schema: { description: 'Get PM summary cards', tags: ['dashboard'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const scope = request.dataScope!;
      const query = request.query as Record<string, string | undefined>;
      const filterPortfolioId = query.portfolioId || undefined;

      // Get projects within scope
      const projects = await projectService.findByScope({
        ...scope,
        filterPortfolioId,
      });

      // Group by createdBy (PM)
      const pmProjectMap = new Map<string, typeof projects>();
      for (const p of projects) {
        const existing = pmProjectMap.get(p.createdBy) || [];
        existing.push(p);
        pmProjectMap.set(p.createdBy, existing);
      }

      // Build summary cards
      const summaries: PMSummary[] = [];
      for (const [pmUserId, pmProjects] of pmProjectMap) {
        const user = await userService.findById(pmUserId);
        if (!user || user.role !== 'pm') continue;

        let onTrack = 0, atRisk = 0, delayed = 0;
        let totalBudget = 0, totalSpent = 0;

        for (const p of pmProjects) {
          const cat = categorizeProject(p);
          if (cat === 'on_track') onTrack++;
          else if (cat === 'at_risk') atRisk++;
          else delayed++;
          totalBudget += p.budgetAllocated || 0;
          totalSpent += p.budgetSpent;
        }

        summaries.push({
          userId: pmUserId,
          fullName: user.fullName,
          email: user.email,
          projectCount: pmProjects.length,
          onTrack, atRisk, delayed,
          totalBudget, totalSpent,
        });
      }

      return { summaries };
    } catch (error) {
      console.error('PM summaries error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/dashboard/portfolio-summaries
   * Returns portfolio summary cards for pmo_manager and admin.
   */
  fastify.get('/portfolio-summaries', {
    preHandler: [authMiddleware, dataScopeMiddleware, requireRole('admin', 'pmo_manager')],
    schema: { description: 'Get portfolio summary cards', tags: ['dashboard'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const portfolios = await portfolioService.findAll();
      const allProjects = await projectService.findAll();

      const summaries: PortfolioSummary[] = [];

      for (const portfolio of portfolios) {
        const portfolioProjects = allProjects.filter(p => p.portfolioId === portfolio.id);

        // Count unique PMs in this portfolio
        const pmIds = new Set(portfolioProjects.map(p => p.createdBy));

        let onTrack = 0, atRisk = 0, delayed = 0;
        let totalBudget = 0, totalSpent = 0;

        for (const p of portfolioProjects) {
          const cat = categorizeProject(p);
          if (cat === 'on_track') onTrack++;
          else if (cat === 'at_risk') atRisk++;
          else delayed++;
          totalBudget += p.budgetAllocated || 0;
          totalSpent += p.budgetSpent;
        }

        summaries.push({
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          description: portfolio.description,
          pmCount: pmIds.size,
          projectCount: portfolioProjects.length,
          onTrack, atRisk, delayed,
          totalBudget, totalSpent,
        });
      }

      return { summaries };
    } catch (error) {
      console.error('Portfolio summaries error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
