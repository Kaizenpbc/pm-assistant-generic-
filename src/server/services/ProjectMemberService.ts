import { databaseService } from '../database/connection';
import { toCamelCaseKeys } from '../utils/caseConverter';

export type ProjectRole = 'owner' | 'manager' | 'editor' | 'viewer';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  email: string;
  role: ProjectRole;
  addedAt: string;
}

const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  owner: 4,
  manager: 3,
  editor: 2,
  viewer: 1,
};

export class ProjectMemberService {
  private static members: ProjectMember[] = [
    // User '1' is owner of all 3 projects
    { id: 'pm-1', projectId: '1', userId: '1', userName: 'Admin User', email: 'admin@example.com', role: 'owner', addedAt: new Date().toISOString() },
    { id: 'pm-2', projectId: '2', userId: '1', userName: 'Admin User', email: 'admin@example.com', role: 'owner', addedAt: new Date().toISOString() },
    { id: 'pm-3', projectId: '3', userId: '1', userName: 'Admin User', email: 'admin@example.com', role: 'owner', addedAt: new Date().toISOString() },
    // Sample team members
    { id: 'pm-4', projectId: '1', userId: '2', userName: 'Sarah Chen', email: 'sarah.chen@example.com', role: 'manager', addedAt: new Date().toISOString() },
    { id: 'pm-5', projectId: '1', userId: '3', userName: 'Mike Johnson', email: 'mike.j@example.com', role: 'editor', addedAt: new Date().toISOString() },
    { id: 'pm-6', projectId: '1', userId: '4', userName: 'Emily Davis', email: 'emily.d@example.com', role: 'viewer', addedAt: new Date().toISOString() },
    { id: 'pm-7', projectId: '2', userId: '5', userName: 'Tom Wilson', email: 'tom.w@example.com', role: 'editor', addedAt: new Date().toISOString() },
    { id: 'pm-8', projectId: '3', userId: '6', userName: 'Lisa Park', email: 'lisa.p@example.com', role: 'manager', addedAt: new Date().toISOString() },
    { id: 'pm-9', projectId: '3', userId: '7', userName: 'James Brown', email: 'james.b@example.com', role: 'editor', addedAt: new Date().toISOString() },
  ];

  private get useDb() { return databaseService.isHealthy(); }

  private rowToMember(row: any): ProjectMember {
    const c = toCamelCaseKeys(row);
    return {
      ...c,
      addedAt: new Date(c.addedAt).toISOString(),
    } as ProjectMember;
  }

  async findByProjectId(projectId: string): Promise<ProjectMember[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM project_members WHERE project_id = ?', [projectId]);
      return rows.map((r: any) => this.rowToMember(r));
    }
    return ProjectMemberService.members.filter(m => m.projectId === projectId);
  }

  async findByUserId(userId: string): Promise<ProjectMember[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM project_members WHERE user_id = ?', [userId]);
      return rows.map((r: any) => this.rowToMember(r));
    }
    return ProjectMemberService.members.filter(m => m.userId === userId);
  }

  async findMembership(projectId: string, userId: string): Promise<ProjectMember | undefined> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
      return rows.length > 0 ? this.rowToMember(rows[0]) : undefined;
    }
    return ProjectMemberService.members.find(m => m.projectId === projectId && m.userId === userId);
  }

  async hasAccess(projectId: string, userId: string): Promise<boolean> {
    // Admin bypass
    if (userId === '1') return true;
    return !!(await this.findMembership(projectId, userId));
  }

  async hasRole(projectId: string, userId: string, minRole: ProjectRole): Promise<boolean> {
    // Admin bypass
    if (userId === '1') return true;
    const membership = await this.findMembership(projectId, userId);
    if (!membership) return false;
    return ROLE_HIERARCHY[membership.role] >= ROLE_HIERARCHY[minRole];
  }

  async addMember(projectId: string, data: { userId: string; userName: string; email: string; role: ProjectRole }): Promise<ProjectMember> {
    // Check if already a member
    const existing = await this.findMembership(projectId, data.userId);
    if (existing) {
      if (this.useDb) {
        await databaseService.query('UPDATE project_members SET role = ? WHERE id = ?', [data.role, existing.id]);
        return { ...existing, role: data.role };
      }
      existing.role = data.role;
      return existing;
    }

    const id = `pm-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    if (this.useDb) {
      await databaseService.query(
        `INSERT INTO project_members (id, project_id, user_id, user_name, email, role, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, projectId, data.userId, data.userName, data.email, data.role, now],
      );
      return { id, projectId, userId: data.userId, userName: data.userName, email: data.email, role: data.role, addedAt: now.toISOString() };
    }

    const member: ProjectMember = {
      id,
      projectId,
      userId: data.userId,
      userName: data.userName,
      email: data.email,
      role: data.role,
      addedAt: now.toISOString(),
    };
    ProjectMemberService.members.push(member);
    return member;
  }

  async updateRole(memberId: string, role: ProjectRole): Promise<ProjectMember | null> {
    if (this.useDb) {
      await databaseService.query('UPDATE project_members SET role = ? WHERE id = ?', [role, memberId]);
      const rows = await databaseService.query('SELECT * FROM project_members WHERE id = ?', [memberId]);
      return rows.length > 0 ? this.rowToMember(rows[0]) : null;
    }
    const member = ProjectMemberService.members.find(m => m.id === memberId);
    if (!member) return null;
    member.role = role;
    return member;
  }

  async removeMember(memberId: string): Promise<boolean> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM project_members WHERE id = ?', [memberId]);
      if (rows.length === 0) return false;
      const member = this.rowToMember(rows[0]);
      if (member.role === 'owner') {
        const countRows = await databaseService.query(
          'SELECT COUNT(*) as cnt FROM project_members WHERE project_id = ? AND role = ?',
          [member.projectId, 'owner'],
        );
        const ownerCount = (countRows[0] as any).cnt ?? (countRows[0] as any).CNT;
        if (ownerCount <= 1) return false;
      }
      await databaseService.query('DELETE FROM project_members WHERE id = ?', [memberId]);
      return true;
    }

    const idx = ProjectMemberService.members.findIndex(m => m.id === memberId);
    if (idx === -1) return false;
    // Don't allow removing last owner
    const member = ProjectMemberService.members[idx];
    if (member.role === 'owner') {
      const owners = ProjectMemberService.members.filter(m => m.projectId === member.projectId && m.role === 'owner');
      if (owners.length <= 1) return false;
    }
    ProjectMemberService.members.splice(idx, 1);
    return true;
  }
}
