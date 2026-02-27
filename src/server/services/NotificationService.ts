import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { WebSocketService } from './WebSocketService';

export interface CreateNotificationData {
  userId: string;
  type?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  projectId?: string;
  scheduleId?: string;
  linkType?: string;
  linkId?: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  project_id: string | null;
  schedule_id: string | null;
  link_type: string | null;
  link_id: string | null;
  is_read: boolean | number;
  created_at: string;
}

export interface NotificationDTO {
  id: string;
  userId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  projectId: string | null;
  scheduleId: string | null;
  linkType: string | null;
  linkId: string | null;
  isRead: boolean;
  createdAt: string;
}

function rowToDTO(row: NotificationRow): NotificationDTO {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    projectId: row.project_id,
    scheduleId: row.schedule_id,
    linkType: row.link_type,
    linkId: row.link_id,
    isRead: !!row.is_read,
    createdAt: row.created_at,
  };
}

export class NotificationService {
  async create(data: CreateNotificationData): Promise<NotificationDTO> {
    const id = uuidv4();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    await databaseService.query(
      `INSERT INTO notifications (id, user_id, type, severity, title, message, project_id, schedule_id, link_type, link_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?)`,
      [
        id,
        data.userId,
        data.type || 'info',
        data.severity || 'medium',
        data.title,
        data.message,
        data.projectId || null,
        data.scheduleId || null,
        data.linkType || null,
        data.linkId || null,
        now,
      ],
    );

    const dto: NotificationDTO = {
      id,
      userId: data.userId,
      type: data.type || 'info',
      severity: data.severity || 'medium',
      title: data.title,
      message: data.message,
      projectId: data.projectId || null,
      scheduleId: data.scheduleId || null,
      linkType: data.linkType || null,
      linkId: data.linkId || null,
      isRead: false,
      createdAt: now,
    };

    // Broadcast via WebSocket
    WebSocketService.broadcast({ type: 'notification', payload: dto });

    return dto;
  }

  async getByUserId(userId: string, limit = 50, offset = 0): Promise<NotificationDTO[]> {
    const rows = await databaseService.query<NotificationRow>(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );
    return rows.map(rowToDTO);
  }

  async markRead(id: string): Promise<void> {
    await databaseService.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = ?`,
      [id],
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await databaseService.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE`,
      [userId],
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    const rows = await databaseService.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = FALSE`,
      [userId],
    );
    return rows[0]?.cnt ?? 0;
  }
}

export const notificationService = new NotificationService();
