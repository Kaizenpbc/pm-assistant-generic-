import { Resend } from 'resend';
import { config } from '../config';

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
      console.warn(`[EmailService] RESEND_API_KEY not set — skipping verification email to ${to}`);
      return;
    }
    console.log(`[EmailService] Sending verification email to ${to}`);

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
      console.warn(`[EmailService] RESEND_API_KEY not set — skipping password reset email to ${to}`);
      return;
    }
    console.log(`[EmailService] Sending password reset email to ${to}`);

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
        <h2 style="color: #1f2937;">${title}</h2>
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
      console.log(`[EmailService] Notification email would be sent to ${to}: ${subject}`);
      return;
    }

    let bodyHtml = `<p style="color: #4b5563; line-height: 1.6;">${message}</p>`;
    if (ctaUrl) {
      bodyHtml += `
        <div style="text-align: center; margin: 32px 0;">
          <a href="${ctaUrl}" style="background-color: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
            ${ctaLabel || 'View Details'}
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
      console.log(`[EmailService] Digest email would be sent to ${to}`);
      return;
    }

    let bodyHtml = `<p style="color: #4b5563; line-height: 1.6;">Hi ${name}, here's your project digest:</p>`;

    if (digest.overdueTasks.length > 0) {
      bodyHtml += `<h3 style="color: #dc2626; margin-top: 24px;">Overdue Tasks (${digest.overdueTasks.length})</h3><ul style="color: #4b5563;">`;
      for (const t of digest.overdueTasks.slice(0, 10)) {
        bodyHtml += `<li>${t.name} (due ${t.dueDate})</li>`;
      }
      bodyHtml += '</ul>';
    }

    if (digest.upcomingDeadlines.length > 0) {
      bodyHtml += `<h3 style="color: #f59e0b; margin-top: 24px;">Upcoming Deadlines (${digest.upcomingDeadlines.length})</h3><ul style="color: #4b5563;">`;
      for (const t of digest.upcomingDeadlines.slice(0, 10)) {
        bodyHtml += `<li>${t.name} (due ${t.dueDate})</li>`;
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
      console.log(`[EmailService] Report email would be sent to ${recipients.join(', ')}: ${reportName}`);
      return;
    }

    const bodyHtml = `
      <p style="color: #4b5563; line-height: 1.6;">
        Your scheduled report <strong>${reportName}</strong> is attached as a CSV file.
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

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    if (!this.isConfigured) {
      console.log(`[EmailService] Welcome email would be sent to ${to}`);
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
          <h2 style="color: #1f2937;">Welcome, ${name}!</h2>
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
}

export const emailService = new EmailService();
