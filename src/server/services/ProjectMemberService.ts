import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';

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

function rowToMember(row: any): ProjectMember {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    userName: row.user_name,
    email: row.email,
    role: row.role,
    addedAt: String(row.added_at),
  };
}

export class ProjectMemberService {
  async findByProjectId(projectId: string): Promise<ProjectMember[]> {
    const rows = await databaseService.query(
      'SELECT * FROM project_members WHERE project_id = ? ORDER BY added_at',
      [projectId],
    );
    return rows.map(rowToMember);
  }

  async findByUserId(userId: string): Promise<ProjectMember[]> {
    const rows = await databaseService.query(
      'SELECT * FROM project_members WHERE user_id = ? ORDER BY added_at',
      [userId],
    );
    return rows.map(rowToMember);
  }

  async findMembership(projectId: string, userId: string): Promise<ProjectMember | undefined> {
    const rows = await databaseService.query(
      'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId],
    );
    return rows.length > 0 ? rowToMember(rows[0]) : undefined;
  }

  async hasAccess(projectId: string, userId: string): Promise<boolean> {
    const rows = await databaseService.query(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1',
      [projectId, userId],
    );
    return rows.length > 0;
  }

  async hasRole(projectId: string, userId: string, minRole: ProjectRole): Promise<boolean> {
    const membership = await this.findMembership(projectId, userId);
    if (!membership) return false;
    return ROLE_HIERARCHY[membership.role] >= ROLE_HIERARCHY[minRole];
  }

  async addMember(projectId: string, data: { userId: string; userName: string; email: string; role: ProjectRole }): Promise<ProjectMember> {
    // Check if already a member
    const existing = await this.findMembership(projectId, data.userId);
    if (existing) {
      await databaseService.query(
        'UPDATE project_members SET role = ? WHERE id = ?',
        [data.role, existing.id],
      );
      return { ...existing, role: data.role };
    }

    const id = uuidv4();
    await databaseService.query(
      'INSERT INTO project_members (id, project_id, user_id, user_name, email, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, projectId, data.userId, data.userName, data.email, data.role],
    );

    return {
      id,
      projectId,
      userId: data.userId,
      userName: data.userName,
      email: data.email,
      role: data.role,
      addedAt: new Date().toISOString(),
    };
  }

  async updateRole(memberId: string, role: ProjectRole): Promise<ProjectMember | null> {
    const rows = await databaseService.query(
      'SELECT * FROM project_members WHERE id = ?',
      [memberId],
    );
    if (rows.length === 0) return null;

    await databaseService.query(
      'UPDATE project_members SET role = ? WHERE id = ?',
      [role, memberId],
    );

    return rowToMember({ ...rows[0], role });
  }

  async removeMember(memberId: string): Promise<boolean> {
    const rows = await databaseService.query(
      'SELECT * FROM project_members WHERE id = ?',
      [memberId],
    );
    if (rows.length === 0) return false;

    const member = rowToMember(rows[0]);

    // Don't allow removing last owner
    if (member.role === 'owner') {
      const owners = await databaseService.query(
        'SELECT COUNT(*) as cnt FROM project_members WHERE project_id = ? AND role = ?',
        [member.projectId, 'owner'],
      );
      if (Number(owners[0]?.cnt) <= 1) return false;
    }

    const result: any = await databaseService.query(
      'DELETE FROM project_members WHERE id = ?',
      [memberId],
    );
    return result.affectedRows > 0;
  }

  /**
   * Look up a user by email and return their id, full_name, and email.
   * Used by the add-member flow to resolve email → real user.
   */
  async findUserByEmail(email: string): Promise<{ id: string; fullName: string; email: string } | null> {
    const rows = await databaseService.query(
      'SELECT id, full_name, email FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    if (rows.length === 0) return null;
    return { id: rows[0].id, fullName: rows[0].full_name, email: rows[0].email };
  }
}

export const projectMemberService = new ProjectMemberService();
