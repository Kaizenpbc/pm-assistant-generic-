import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerProjectTools } from './tools/projects.js';
import { registerScheduleTools } from './tools/schedules.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerSprintTools } from './tools/sprints.js';
import { registerResourceTools } from './tools/resources.js';
import { registerTimeTrackingTools } from './tools/time-tracking.js';
import { registerApprovalTools } from './tools/approvals.js';
import { registerReportTools } from './tools/reports.js';
import { registerAIInsightTools } from './tools/ai-insights.js';
import { registerAutoRescheduleTools } from './tools/auto-reschedule.js';
import { registerIntakeTools } from './tools/intake.js';
import { registerCustomFieldTools } from './tools/custom-fields.js';
import { registerIntegrationTools } from './tools/integrations.js';
import { registerAdminTools } from './tools/admin.js';
import { registerTemplateTools } from './tools/templates.js';

const server = new McpServer({
  name: 'pm-assistant',
  version: '2.0.0',
});

// Register all tool groups
registerProjectTools(server);
registerScheduleTools(server);
registerTaskTools(server);
registerSprintTools(server);
registerResourceTools(server);
registerTimeTrackingTools(server);
registerApprovalTools(server);
registerReportTools(server);
registerAIInsightTools(server);
registerAutoRescheduleTools(server);
registerIntakeTools(server);
registerCustomFieldTools(server);
registerIntegrationTools(server);
registerAdminTools(server);
registerTemplateTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
