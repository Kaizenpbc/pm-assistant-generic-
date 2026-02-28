export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
}

export class SlackAdapter {
  async testConnection(config: SlackConfig): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Kovarti PM Assistant integration test - connection successful!',
          ...(config.channel ? { channel: config.channel } : {}),
        }),
      });
      if (response.ok) return { success: true, message: 'Connected to Slack successfully' };
      return { success: false, message: `Slack returned ${response.status}` };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to connect' };
    }
  }

  async sendNotification(
    config: SlackConfig,
    message: {
      text: string;
      blocks?: any[];
    },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const payload: Record<string, any> = {
        text: message.text,
        ...(config.channel ? { channel: config.channel } : {}),
      };
      if (message.blocks) {
        payload.blocks = message.blocks;
      }

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) return { success: true, message: 'Notification sent' };
      return { success: false, message: `Slack returned ${response.status}` };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to send notification' };
    }
  }

  async sendFormattedProjectUpdate(
    config: SlackConfig,
    data: {
      projectName: string;
      status: string;
      summary: string;
      url?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `Project Update: ${data.projectName}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Status:*\n${data.status}` },
          { type: 'mrkdwn', text: `*Summary:*\n${data.summary}` },
        ],
      },
    ];

    if (data.url) {
      blocks.push({
        type: 'section',
        fields: [{ type: 'mrkdwn', text: `<${data.url}|View Project>` }],
      });
    }

    return this.sendNotification(config, {
      text: `Project Update: ${data.projectName} - ${data.status}`,
      blocks,
    });
  }
}

export const slackAdapter = new SlackAdapter();
