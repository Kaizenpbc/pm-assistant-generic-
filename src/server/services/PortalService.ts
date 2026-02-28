import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { databaseService } from '../database/connection';

export interface PortalLink {
  id: string;
  projectId: string;
  token: string;
  label: string | null;
  permissions: Record<string, boolean>;
  expiresAt: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface PortalComment {
  id: string;
  portalLinkId: string;
  projectId: string;
  entityType: string;
  entityId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface PortalLinkRow {
  id: string;
  project_id: string;
  token: string;
  label: string | null;
  permissions: string | null;
  expires_at: string | null;
  is_active: boolean | number;
  created_by: string;
  created_at: string;
}

interface PortalCommentRow {
  id: string;
  portal_link_id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

function linkRowToDTO(row: PortalLinkRow): PortalLink {
  let perms: Record<string, boolean> = {};
  if (row.permissions) {
    try { perms = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions; } catch { perms = {}; }
  }
  return {
    id: row.id,
    projectId: row.project_id,
    token: row.token,
    label: row.label,
    permissions: perms,
    expiresAt: row.expires_at,
    isActive: !!row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function commentRowToDTO(row: PortalCommentRow): PortalComment {
  return {
    id: row.id,
    portalLinkId: row.portal_link_id,
    projectId: row.project_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
  };
}

class PortalService {
  async createLink(
    projectId: string,
    permissions: Record<string, boolean>,
    createdBy: string,
    label?: string,
    expiresAt?: string,
  ): Promise<PortalLink> {
    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    await databaseService.query(
      `INSERT INTO portal_links (id, project_id, token, label, permissions, expires_at, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [id, projectId, token, label || null, JSON.stringify(permissions), expiresAt || null, createdBy],
    );
    const rows = await databaseService.query<PortalLinkRow>('SELECT * FROM portal_links WHERE id = ?', [id]);
    return linkRowToDTO(rows[0]);
  }

  async getLinks(projectId: string): Promise<PortalLink[]> {
    const rows = await databaseService.query<PortalLinkRow>(
      'SELECT * FROM portal_links WHERE project_id = ? ORDER BY created_at DESC',
      [projectId],
    );
    return rows.map(linkRowToDTO);
  }

  async updateLink(id: string, data: { label?: string; permissions?: Record<string, boolean>; isActive?: boolean; expiresAt?: string | null }): Promise<PortalLink> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.label !== undefined) { sets.push('label = ?'); params.push(data.label); }
    if (data.permissions !== undefined) { sets.push('permissions = ?'); params.push(JSON.stringify(data.permissions)); }
    if (data.isActive !== undefined) { sets.push('is_active = ?'); params.push(data.isActive); }
    if (data.expiresAt !== undefined) { sets.push('expires_at = ?'); params.push(data.expiresAt); }
    if (sets.length > 0) {
      params.push(id);
      await databaseService.query(`UPDATE portal_links SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const rows = await databaseService.query<PortalLinkRow>('SELECT * FROM portal_links WHERE id = ?', [id]);
    return linkRowToDTO(rows[0]);
  }

  async deactivateLink(id: string): Promise<void> {
    await databaseService.query('UPDATE portal_links SET is_active = FALSE WHERE id = ?', [id]);
  }

  async deleteLink(id: string): Promise<void> {
    await databaseService.query('DELETE FROM portal_links WHERE id = ?', [id]);
  }

  async validateToken(token: string): Promise<(PortalLink & { projectName: string; projectStatus: string }) | null> {
    const rows = await databaseService.query<PortalLinkRow & { project_name: string; project_status: string }>(
      `SELECT pl.*, p.name AS project_name, p.status AS project_status
       FROM portal_links pl
       JOIN projects p ON p.id = pl.project_id
       WHERE pl.token = ? AND pl.is_active = TRUE AND (pl.expires_at IS NULL OR pl.expires_at > NOW())`,
      [token],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      ...linkRowToDTO(row),
      projectName: row.project_name,
      projectStatus: row.project_status,
    };
  }

  async getPortalView(token: string): Promise<{
    project: { id: string; name: string; status: string; description: string | null };
    taskStats: { total: number; completed: number; inProgress: number; notStarted: number };
    timeline: { startDate: string | null; endDate: string | null };
    permissions: Record<string, boolean>;
  } | null> {
    const link = await this.validateToken(token);
    if (!link) return null;

    const projectId = link.projectId;
    const permissions = link.permissions;

    // Get project info
    const projectRows = await databaseService.query<{ id: string; name: string; status: string; description: string | null }>(
      'SELECT id, name, status, description FROM projects WHERE id = ?',
      [projectId],
    );
    if (projectRows.length === 0) return null;
    const project = projectRows[0];

    // Get task stats
    const statRows = await databaseService.query<{ status: string; count: number }>(
      `SELECT st.status, COUNT(*) as count
       FROM schedule_tasks st
       JOIN schedules s ON s.id = st.schedule_id
       WHERE s.project_id = ?
       GROUP BY st.status`,
      [projectId],
    );
    const taskStats = { total: 0, completed: 0, inProgress: 0, notStarted: 0 };
    for (const r of statRows) {
      const cnt = Number(r.count);
      taskStats.total += cnt;
      if (r.status === 'completed' || r.status === 'done') taskStats.completed += cnt;
      else if (r.status === 'in_progress' || r.status === 'in-progress') taskStats.inProgress += cnt;
      else taskStats.notStarted += cnt;
    }

    // Get timeline
    const timelineRows = await databaseService.query<{ min_start: string | null; max_end: string | null }>(
      `SELECT MIN(st.start_date) as min_start, MAX(st.end_date) as max_end
       FROM schedule_tasks st
       JOIN schedules s ON s.id = st.schedule_id
       WHERE s.project_id = ?`,
      [projectId],
    );
    const timeline = {
      startDate: timelineRows[0]?.min_start || null,
      endDate: timelineRows[0]?.max_end || null,
    };

    return { project, taskStats, timeline, permissions };
  }

  async addComment(
    portalLinkId: string,
    projectId: string,
    entityType: string,
    entityId: string,
    authorName: string,
    content: string,
  ): Promise<PortalComment> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO portal_comments (id, portal_link_id, project_id, entity_type, entity_id, author_name, content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, portalLinkId, projectId, entityType, entityId, authorName, content],
    );
    const rows = await databaseService.query<PortalCommentRow>('SELECT * FROM portal_comments WHERE id = ?', [id]);
    return commentRowToDTO(rows[0]);
  }

  async getComments(projectId: string, entityType?: string, entityId?: string): Promise<PortalComment[]> {
    let sql = 'SELECT * FROM portal_comments WHERE project_id = ?';
    const params: any[] = [projectId];
    if (entityType) { sql += ' AND entity_type = ?'; params.push(entityType); }
    if (entityId) { sql += ' AND entity_id = ?'; params.push(entityId); }
    sql += ' ORDER BY created_at DESC';
    const rows = await databaseService.query<PortalCommentRow>(sql, params);
    return rows.map(commentRowToDTO);
  }
}

export const portalService = new PortalService();
