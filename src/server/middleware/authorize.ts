import { ProjectService } from '../services/ProjectService';
import { ScheduleService } from '../services/ScheduleService';

const projectService = new ProjectService();
const scheduleService = new ScheduleService();

/**
 * Verify a user has access to a project (is the creator).
 * Returns the project if owned, null otherwise.
 */
export async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await projectService.findById(projectId, userId);
  return project; // null if not found or not owned
}

/**
 * Verify a user has access to a schedule by checking ownership of
 * its parent project. Returns the schedule if accessible, null otherwise.
 */
export async function verifyScheduleAccess(scheduleId: string, userId: string) {
  const schedule = await scheduleService.findById(scheduleId);
  if (!schedule) return null;

  const project = await projectService.findById(schedule.projectId, userId);
  if (!project) return null;

  return schedule;
}
