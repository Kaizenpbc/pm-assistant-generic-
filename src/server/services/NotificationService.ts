import { v4 as uuidv4 } from 'uuid';
import { notificationRepository, NotificationDTO } from '../database/NotificationRepository';
import { WebSocketService } from './WebSocketService';
import { emailService } from './EmailService';
import { userService } from './UserService';
import logger from '../utils/logger';
import { config } from '../config';

export type { NotificationDTO } from '../database/NotificationRepository';

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

export class NotificationService {
  async create(data: CreateNotificationData): Promise<NotificationDTO> {
    const id = uuidv4();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const type = data.type || 'info';
    const severity = data.severity || 'medium';

    await notificationRepository.insert(
      id, data.userId, type, severity, data.title, data.message,
      data.projectId || null, data.scheduleId || null,
      data.linkType || null, data.linkId || null, now,
    );

    const dto: NotificationDTO = {
      id, userId: data.userId, type, severity, title: data.title,
      message: data.message, projectId: data.projectId || null,
      scheduleId: data.scheduleId || null, linkType: data.linkType || null,
      linkId: data.linkId || null, isRead: false, createdAt: now,
    };

    WebSocketService.broadcast({ type: 'notification', payload: dto });

    if (data.severity === 'critical' || data.severity === 'high') {
      (async () => {
        try {
          const user = await userService.findById(data.userId);
          if (user && user.emailNotificationsEnabled && user.emailVerified && user.email) {
            const ctaUrl = data.linkType && data.linkId
              ? `${config.APP_URL}/${data.linkType}s/${data.linkId}`
              : undefined;
            await emailService.sendNotificationEmail(
              user.email,
              `[${data.severity?.toUpperCase()}] ${data.title}`,
              data.title, data.message, ctaUrl, 'View Details',
            );
          }
        } catch (err) {
          logger.error('[NotificationService] Failed to send email notification:', err);
        }
      })();
    }

    return dto;
  }

  async getByUserId(userId: string, limit = 50, offset = 0): Promise<NotificationDTO[]> {
    return notificationRepository.findByUser(userId, limit, offset);
  }

  async markRead(id: string): Promise<void> {
    return notificationRepository.markRead(id);
  }

  async markAllRead(userId: string): Promise<void> {
    return notificationRepository.markAllRead(userId);
  }

  async countByUserId(userId: string): Promise<number> {
    return notificationRepository.countByUser(userId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return notificationRepository.countUnread(userId);
  }
}

export const notificationService = new NotificationService();
