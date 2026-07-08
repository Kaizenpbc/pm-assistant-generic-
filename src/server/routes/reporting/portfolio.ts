import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { projectService } from '../../services/ProjectService';
import { scheduleService } from '../../services/ScheduleService';
import { resourceService } from '../../services/ResourceService';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';

export async function portfolioRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get portfolio overview with all projects and tasks', tags: ['portfolio'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      const userId = user.userId;
      const projects = await projectService.findByUserId(userId);

      // Batch: 3 queries total instead of 1 + N + N×M
      const projectIds = projects.map(p => p.id);
      const allSchedules = await scheduleService.findByProjectIds(projectIds);
      const scheduleIds = allSchedules.map(s => s.id);
      const allTasks = await scheduleService.findTasksByScheduleIds(scheduleIds);

      // Group schedules by projectId, tasks by scheduleId
      const schedulesByProject = new Map<string, string[]>();
      for (const s of allSchedules) {
        let ids = schedulesByProject.get(s.projectId);
        if (!ids) { ids = []; schedulesByProject.set(s.projectId, ids); }
        ids.push(s.id);
      }

      const tasksBySchedule = new Map<string, typeof allTasks>();
      for (const t of allTasks) {
        let arr = tasksBySchedule.get(t.scheduleId);
        if (!arr) { arr = []; tasksBySchedule.set(t.scheduleId, arr); }
        arr.push(t);
      }

      const portfolioItems = projects.map(project => {
        const projScheduleIds = schedulesByProject.get(project.id) ?? [];
        const projectTasks = projScheduleIds.flatMap(sid => tasksBySchedule.get(sid) ?? []);

        const totalTasks = projectTasks.length;
        const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
        const avgProgress = totalTasks > 0 ? Math.round(projectTasks.reduce((s, t) => s + (t.progressPercentage || 0), 0) / totalTasks) : 0;

        return {
          projectId: project.id,
          projectName: project.name,
          status: project.status,
          priority: project.priority,
          startDate: project.startDate,
          endDate: project.endDate,
          budgetAllocated: project.budgetAllocated || 0,
          budgetSpent: project.budgetSpent || 0,
          progressPercentage: avgProgress,
          totalTasks,
          completedTasks,
          tasks: projectTasks.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            priority: t.priority,
            startDate: t.startDate,
            endDate: t.endDate,
            progressPercentage: t.progressPercentage,
            parentTaskId: t.parentTaskId,
            assignedTo: t.assignedTo,
            dependency: t.dependency,
            dependencyType: t.dependencyType,
            dependencies: t.dependencies.map(d => ({ id: d.dependencyId, type: d.dependencyType, lag: d.lagDays })),
          })),
        };
      });

      return { portfolioItems };
    } catch (error) {
      console.error('Get portfolio error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch portfolio' });
    }
  });

  // GET /portfolio/resources — cross-project resource view
  fastify.get('/resources', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get portfolio-level resource utilization across all projects', tags: ['portfolio'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      const projects = await projectService.findByUserId(user.userId);
      const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning');

      // Fetch workload for each active project in parallel
      const workloadResults = await Promise.all(
        activeProjects.map(async (p) => ({
          projectId: p.id,
          projectName: p.name,
          workload: await resourceService.computeWorkload(p.id),
        }))
      );

      // Aggregate per resource across projects
      interface AggResource {
        resourceId: string;
        resourceName: string;
        role: string;
        costRateHourly: number | null;
        projects: { projectId: string; projectName: string; averageUtilization: number }[];
        combinedUtilization: number;
        isOverAllocated: boolean;
      }

      const resourceMap = new Map<string, AggResource>();

      for (const { projectId, projectName, workload } of workloadResults) {
        for (const w of workload) {
          let agg = resourceMap.get(w.resourceId);
          if (!agg) {
            // Look up cost rate
            const resource = await resourceService.findResourceById(w.resourceId);
            agg = {
              resourceId: w.resourceId,
              resourceName: w.resourceName,
              role: w.role,
              costRateHourly: resource?.costRateHourly ?? null,
              projects: [],
              combinedUtilization: 0,
              isOverAllocated: false,
            };
            resourceMap.set(w.resourceId, agg);
          }
          agg.projects.push({ projectId, projectName, averageUtilization: w.averageUtilization });
        }
      }

      // Calculate combined utilization and detect contention
      const resources: AggResource[] = [];
      const contentions: { resourceId: string; resourceName: string; role: string; projects: { projectId: string; projectName: string; averageUtilization: number }[]; combinedUtilization: number }[] = [];

      for (const agg of resourceMap.values()) {
        agg.combinedUtilization = agg.projects.reduce((s, p) => s + p.averageUtilization, 0);
        agg.isOverAllocated = agg.combinedUtilization > 100;
        resources.push(agg);

        if (agg.projects.length >= 2 && agg.combinedUtilization > 100) {
          contentions.push({
            resourceId: agg.resourceId,
            resourceName: agg.resourceName,
            role: agg.role,
            projects: agg.projects,
            combinedUtilization: agg.combinedUtilization,
          });
        }
      }

      // Sort by utilization desc
      resources.sort((a, b) => b.combinedUtilization - a.combinedUtilization);
      contentions.sort((a, b) => b.combinedUtilization - a.combinedUtilization);

      // Summary stats
      const totalResources = resources.length;
      const overAllocatedCount = resources.filter(r => r.isOverAllocated).length;
      const avgUtilization = totalResources > 0
        ? Math.round(resources.reduce((s, r) => s + r.combinedUtilization, 0) / totalResources)
        : 0;
      const totalWeeklyCost = resources.reduce((s, r) => {
        if (r.costRateHourly == null) return s;
        return s + r.costRateHourly * 40; // assume 40h/week for cost estimate
      }, 0);

      return {
        resources,
        contentions,
        summary: { totalResources, overAllocatedCount, avgUtilization, totalWeeklyCost: Math.round(totalWeeklyCost * 100) / 100 },
      };
    } catch (error) {
      console.error('Get portfolio resources error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch portfolio resources' });
    }
  });
}
