import { Resend } from 'resend';
import { config } from '../config';
import logger, { maskPii } from '../utils/logger';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class EmailService {
  private resend: Resend | null = null;

  private getClient(): Resend {
    if (!this.resend) {
      if (!config.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
      }
      this.resend = new Resend(config.RESEND_API_KEY);
    }
    return this.resend;
  }

  private get isConfigured(): boolean {
    return !!config.RESEND_API_KEY;
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    if (!this.isConfigured) {
      logger.warn(`[EmailService] RESEND_API_KEY not set — skipping verification email to ${maskPii(to)}`);
      return;
    }
    logger.info(`[EmailService] Sending verification email to ${maskPii(to)}`);

    const verifyUrl = `${config.APP_URL}/verify-email?token=${token}`;

    await this.getClient().emails.send({
      from: config.RESEND_FROM_EMAIL,
      to,
      subject: 'Verify your Kovarti PM Assistant account',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #4f46e5; margin: 0;">Kovarti PM Assistant</h1>
          </div>
          <h2 style="color: #1f2937;">Verify your email address</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Thanks for signing up! Please verify your email address by clicking the button below.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Verify Email
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 14px;">
            This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Kovarti PM Assistant - AI-Powered Project Management
          </p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    if (!this.isConfigured) {
      logger.warn(`[EmailService] RESEND_API_KEY not set — skipping password reset email to ${maskPii(to)}`);
      return;
    }
    logger.info(`[EmailService] Sending password reset email to ${maskPii(to)}`);

    const resetUrl = `${config.APP_URL}/reset-password?token=${token}`;

    await this.getClient().emails.send({
      from: config.RESEND_FROM_EMAIL,
      to,
      subject: 'Reset your Kovarti PM Assistant password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #4f46e5; margin: 0;">Kovarti PM Assistant</h1>
          </div>
          <h2 style="color: #1f2937;">Reset your password</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            We received a request to reset your password. Click the button below to choose a new password.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 14px;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Kovarti PM Assistant - AI-Powered Project Management
          </p>
        </div>
      `,
    });
  }

  private wrapHtml(title: string, bodyHtml: string): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #4f46e5; margin: 0;">Kovarti PM Assistant</h1>
        </div>
        <h2 style="color: #1f2937;">${escapeHtml(title)}</h2>
        ${bodyHtml}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Kovarti PM Assistant - AI-Powered Project Management
        </p>
      </div>
    `;
  }

  async sendNotificationEmail(to: string, subject: string, title: string, message: string, ctaUrl?: string, ctaLabel?: string): Promise<void> {
    if (!this.isConfigured) {
      logger.info(`[EmailService] Notification email would be sent to ${maskPii(to)}: ${subject}`);
      return;
    }

    let bodyHtml = `<p style="color: #4b5563; line-height: 1.6;">${escapeHtml(message)}</p>`;
    if (ctaUrl) {
      bodyHtml += `
        <div style="text-align: center; margin: 32px 0;">
          <a href="${escapeHtml(ctaUrl)}" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
            ${escapeHtml(ctaLabel || 'View Details')}
          </a>
        </div>
      `;
    }

    await this.getClient().emails.send({
      from: config.RESEND_FROM_EMAIL,
      to,
      subject,
      html: this.wrapHtml(title, bodyHtml),
    });
  }

  async sendDigestEmail(to: string, name: string, digest: {
    overdueTasks: Array<{ name: string; dueDate: string }>;
    upcomingDeadlines: Array<{ name: string; dueDate: string }>;
    unreadCount: number;
    recentChanges: number;
  }): Promise<void> {
    if (!this.isConfigured) {
      logger.info(`[EmailService] Digest email would be sent to ${maskPii(to)}`);
      return;
    }

    let bodyHtml = `<p style="color: #4b5563; line-height: 1.6;">Hi ${escapeHtml(name)}, here's your project digest:</p>`;

    if (digest.overdueTasks.length > 0) {
      bodyHtml += `<h3 style="color: #dc2626; margin-top: 24px;">Overdue Tasks (${digest.overdueTasks.length})</h3><ul style="color: #4b5563;">`;
      for (const t of digest.overdueTasks.slice(0, 10)) {
        bodyHtml += `<li>${escapeHtml(t.name)} (due ${escapeHtml(t.dueDate)})</li>`;
      }
      bodyHtml += '</ul>';
    }

    if (digest.upcomingDeadlines.length > 0) {
      bodyHtml += `<h3 style="color: #f59e0b; margin-top: 24px;">Upcoming Deadlines (${digest.upcomingDeadlines.length})</h3><ul style="color: #4b5563;">`;
      for (const t of digest.upcomingDeadlines.slice(0, 10)) {
        bodyHtml += `<li>${escapeHtml(t.name)} (due ${escapeHtml(t.dueDate)})</li>`;
      }
      bodyHtml += '</ul>';
    }

    if (digest.unreadCount > 0) {
      bodyHtml += `<p style="color: #4b5563; margin-top: 16px;">You have <strong>${digest.unreadCount}</strong> unread notification${digest.unreadCount > 1 ? 's' : ''}.</p>`;
    }

    bodyHtml += `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${config.APP_URL}/dashboard" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Open Dashboard
        </a>
      </div>
    `;

    await this.getClient().emails.send({
      from: config.RESEND_FROM_EMAIL,
      to,
      subject: `Your PM Assistant Digest`,
      html: this.wrapHtml(`Your Digest`, bodyHtml),
    });
  }

  async sendReportEmail(recipients: string[], reportName: string, csvContent: string): Promise<void> {
    if (!this.isConfigured) {
      logger.info(`[EmailService] Report email would be sent to ${recipients.map(r => maskPii(r)).join(', ')}: ${reportName}`);
      return;
    }

    const bodyHtml = `
      <p style="color: #4b5563; line-height: 1.6;">
        Your scheduled report <strong>${escapeHtml(reportName)}</strong> is attached as a CSV file.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${config.APP_URL}/report-builder" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          View Reports
        </a>
      </div>
    `;

    await this.getClient().emails.send({
      from: config.RESEND_FROM_EMAIL,
      to: recipients,
      subject: `Scheduled Report: ${reportName}`,
      html: this.wrapHtml('Scheduled Report', bodyHtml),
      attachments: [
        {
          filename: `${reportName.replace(/[^a-zA-Z0-9-_]/g, '_')}.csv`,
          content: Buffer.from(csvContent).toString('base64'),
        },
      ],
    });
  }

  async sendLoginVerificationEmail(to: string, token: string, username: string): Promise<void> {
    if (!this.isConfigured) {
      logger.warn(`[EmailService] RESEND_API_KEY not set — skipping login verification email to ${maskPii(to)}`);
      return;
    }
    logger.info(`[EmailService] Sending login verification email to ${maskPii(to)}`);

    const verifyUrl = `${config.APP_URL}/api/v1/auth/verify-login?token=${token}`;

    const bodyHtml = `
      <p style="color: #4b5563; line-height: 1.6;">
        Hi ${escapeHtml(username)}, someone is trying to sign in to your account. Click the button below to confirm this login.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Confirm Login
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 14px;">
        This link expires in 10 minutes. If you didn't try to log in, you can safely ignore this email.
      </p>
    `;

    await this.getClient().emails.send({
      from: config.RESEND_FROM_EMAIL,
      to,
      subject: 'Confirm your Kovarti PM login',
      html: this.wrapHtml('Confirm your login', bodyHtml),
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    if (!this.isConfigured) {
      logger.info(`[EmailService] Welcome email would be sent to ${maskPii(to)}`);
      return;
    }

    await this.getClient().emails.send({
      from: config.RESEND_FROM_EMAIL,
      to,
      subject: 'Welcome to Kovarti PM Assistant!',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #4f46e5; margin: 0;">Kovarti PM Assistant</h1>
          </div>
          <h2 style="color: #1f2937;">Welcome, ${escapeHtml(name)}!</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Your email has been verified and your account is ready to use. Start managing your projects with AI-powered insights.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${config.APP_URL}/login" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Sign In
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Kovarti PM Assistant - AI-Powered Project Management
          </p>
        </div>
      `,
    });
  }
  async sendTrialReminderEmail(to: string, name: string, daysLeft: number): Promise<void> {
    if (!this.isConfigured) {
      logger.info(`[EmailService] Trial reminder email would be sent to ${maskPii(to)} (${daysLeft} days left)`);
      return;
    }

    const subject = daysLeft === 1
      ? 'Your Kovarti PM trial ends tomorrow'
      : `Your Kovarti PM trial ends in ${daysLeft} days`;

    const bodyHtml = `
      <p style="color: #4b5563; line-height: 1.6;">
        Hi ${escapeHtml(name)}, your free trial ends ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}.
      </p>
      <p style="color: #4b5563; line-height: 1.6;">
        Subscribe to the Consultant plan to keep access to all features — including AI insights, Gantt charts, EVM forecasting, and more.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${config.APP_URL}/pricing" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          View Plans
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 14px;">
        If you choose not to subscribe, your data will be preserved and you'll retain read-only access.
      </p>
    `;

    await this.getClient().emails.send({
      from: config.RESEND_FROM_EMAIL,
      to,
      subject,
      html: this.wrapHtml(subject, bodyHtml),
    });
  }

  async sendTrialExpiredEmail(to: string, name: string): Promise<void> {
    if (!this.isConfigured) {
      logger.info(`[EmailService] Trial expired email would be sent to ${maskPii(to)}`);
      return;
    }

    const bodyHtml = `
      <p style="color: #4b5563; line-height: 1.6;">
        Hi ${escapeHtml(name)}, your 14-day free trial has ended.
      </p>
      <p style="color: #4b5563; line-height: 1.6;">
        Your account is now in read-only mode. Subscribe to restore full access to all features.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${config.APP_URL}/pricing" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Subscribe Now
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 14px;">
        Your data is safe — subscribe anytime to pick up where you left off.
      </p>
    `;

    await this.getClient().emails.send({
      from: config.RESEND_FROM_EMAIL,
      to,
      subject: 'Your Kovarti PM trial has ended',
      html: this.wrapHtml('Your trial has ended', bodyHtml),
    });
  }

  async sendOrgInviteEmail(to: string, orgName: string, inviterName: string): Promise<void> {
    if (!this.isConfigured) {
      logger.info(`[EmailService] Org invite email would be sent to ${maskPii(to)} for org "${orgName}"`);
      return;
    }

    await this.getClient().emails.send({
      from: config.RESEND_FROM_EMAIL,
      to,
      subject: `You've been invited to join ${orgName} on Kovarti PM`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #4f46e5; margin: 0;">Kovarti PM Assistant</h1>
          </div>
          <h2 style="color: #1f2937;">You're invited!</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            ${escapeHtml(inviterName)} has invited you to join <strong>${escapeHtml(orgName)}</strong> on Kovarti PM Assistant.
          </p>
          <p style="color: #4b5563; line-height: 1.6;">
            Create your account to get started:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${config.APP_URL}/register" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Create Account
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Kovarti PM Assistant - AI-Powered Project Management
          </p>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();
