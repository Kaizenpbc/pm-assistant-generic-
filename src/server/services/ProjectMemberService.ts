import { randomUUID } from 'crypto';
import { UserService } from './UserService';

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
  private userService = new UserService();

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

  findByProjectId(projectId: string): ProjectMember[] {
    return ProjectMemberService.members.filter(m => m.projectId === projectId);
  }

  findByUserId(userId: string): ProjectMember[] {
    return ProjectMemberService.members.filter(m => m.userId === userId);
  }

  findMembership(projectId: string, userId: string): ProjectMember | undefined {
    return ProjectMemberService.members.find(m => m.projectId === projectId && m.userId === userId);
  }

  async hasAccess(projectId: string, userId: string): Promise<boolean> {
    // Admin bypass
    const user = await this.userService.findById(userId);
    if (user?.role === 'admin') return true;
    return !!this.findMembership(projectId, userId);
  }

  async hasRole(projectId: string, userId: string, minRole: ProjectRole): Promise<boolean> {
    // Admin bypass
    const user = await this.userService.findById(userId);
    if (user?.role === 'admin') return true;
    const membership = this.findMembership(projectId, userId);
    if (!membership) return false;
    return ROLE_HIERARCHY[membership.role] >= ROLE_HIERARCHY[minRole];
  }

  addMember(projectId: string, data: { userId: string; userName: string; email: string; role: ProjectRole }): ProjectMember {
    // Check if already a member
    const existing = this.findMembership(projectId, data.userId);
    if (existing) {
      existing.role = data.role;
      return existing;
    }

    const member: ProjectMember = {
      id: randomUUID(),
      projectId,
      userId: data.userId,
      userName: data.userName,
      email: data.email,
      role: data.role,
      addedAt: new Date().toISOString(),
    };
    ProjectMemberService.members.push(member);
    return member;
  }

  updateRole(memberId: string, role: ProjectRole): ProjectMember | null {
    const member = ProjectMemberService.members.find(m => m.id === memberId);
    if (!member) return null;
    member.role = role;
    return member;
  }

  removeMember(memberId: string): boolean {
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
