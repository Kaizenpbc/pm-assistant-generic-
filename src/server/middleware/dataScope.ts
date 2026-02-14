import { FastifyRequest, FastifyReply } from 'fastify';
import { PortfolioService } from '../services/PortfolioService';
import { UserService, UserRole } from '../services/UserService';

export interface DataScope {
  role: UserRole;
  userId: string;
  portfolioIds: string[] | 'all';
  pmUserIds: string[] | 'all';
  filterPortfolioId?: string;
  filterPmUserId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    dataScope?: DataScope;
  }
}

const portfolioService = new PortfolioService();
const userService = new UserService();

/**
 * Middleware that computes the data scope for the current user based on their role.
 * Must run AFTER authMiddleware (requires request.user to be set).
 *
 * Attaches request.dataScope with:
 * - pm: can only see own projects
 * - portfolio_manager: can see all projects in assigned portfolios
 * - pmo_manager / admin: can see everything
 *
 * Respects optional query params ?portfolioId and ?pmUserId for filter bar narrowing.
 */
export async function dataScopeMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'User context not found' });
  }

  const { userId, role } = user as { userId: string; role: UserRole };
  const query = request.query as Record<string, string | undefined>;
  const filterPortfolioId = query.portfolioId || undefined;
  const filterPmUserId = query.pmUserId || undefined;

  let portfolioIds: string[] | 'all';
  let pmUserIds: string[] | 'all';

  switch (role) {
    case 'admin':
    case 'pmo_manager':
      portfolioIds = 'all';
      pmUserIds = 'all';
      break;

    case 'portfolio_manager': {
      // Portfolio manager sees all projects in their assigned portfolios
      const assignedPortfolioIds = await portfolioService.getUserPortfolioIds(userId);
      portfolioIds = assignedPortfolioIds;
      // All PMs assigned to those portfolios
      const pmIds = await portfolioService.getPortfolioUserIds(assignedPortfolioIds);
      // Filter to only users with 'pm' role
      const allPmUsers: string[] = [];
      for (const pmId of pmIds) {
        const u = await userService.findById(pmId);
        if (u && u.role === 'pm') allPmUsers.push(pmId);
      }
      pmUserIds = allPmUsers;
      break;
    }

    case 'pm':
    default:
      // PM only sees own projects
      const userPortfolioIds = await portfolioService.getUserPortfolioIds(userId);
      portfolioIds = userPortfolioIds;
      pmUserIds = [userId];
      break;
  }

  // Validate filter params — user can only filter to things within their scope
  if (filterPortfolioId && portfolioIds !== 'all') {
    if (!portfolioIds.includes(filterPortfolioId)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'No access to requested portfolio' });
    }
  }

  if (filterPmUserId && pmUserIds !== 'all') {
    if (!pmUserIds.includes(filterPmUserId)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'No access to requested user data' });
    }
  }

  request.dataScope = {
    role,
    userId,
    portfolioIds,
    pmUserIds,
    filterPortfolioId,
    filterPmUserId,
  };
}
