#!/usr/bin/env bash
# migrate-tenants.sh — Run on the Oracle Cloud server to migrate to multi-tenant
# Usage: sudo bash /tmp/migrate-tenants.sh
set -euo pipefail

BASELINE="/opt/pm-app/dist/server/database/tenant-migrations/T001_baseline.sql"
T002="/tmp/T002_missing_tables.sql"

echo "=== Multi-Tenant Migration ==="
echo ""

# Step 1: Create orgs & tenant DBs
echo "[1/5] Creating organizations and tenant databases..."
mariadb < /tmp/migrate-to-multi-tenant.sql
echo "  OK"

# Step 2: Run baseline migration on all tenant DBs
ALL_DBS=$(mariadb -N -e "SELECT db_name FROM pmassist.organizations;")
echo ""
echo "[2/5] Running baseline migrations on tenant databases..."
for db in $ALL_DBS; do
  echo "  Migrating $db..."
  mariadb "$db" < "$BASELINE" 2>&1 || echo "    WARNING: some statements may have errored (OK if tables exist)"
  # Create _migrations tracking table and mark baseline as applied
  mariadb "$db" -e "
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT IGNORE INTO _migrations (name) VALUES ('T001_baseline.sql');
  "
  # Run T002 (missing tables)
  mariadb "$db" < "$T002" 2>&1 || echo "    WARNING: T002 had some errors (OK if already applied)"
  mariadb "$db" -e "INSERT IGNORE INTO _migrations (name) VALUES ('T002_missing_tables.sql');"
done
echo "  OK"

# Step 3: Copy admin's data (5 projects) → pmassist_t_test_org
ADMIN_ID="339a0b95-12b5-11f1-8984-bc2411674fff"
ADMIN_DB="pmassist_t_test_org"
echo ""
echo "[3/5] Copying admin data to $ADMIN_DB..."

mariadb -e "
  -- Projects
  INSERT IGNORE INTO \`$ADMIN_DB\`.projects SELECT * FROM pmassist.projects WHERE created_by = '$ADMIN_ID';

  -- Project members
  INSERT IGNORE INTO \`$ADMIN_DB\`.project_members SELECT * FROM pmassist.project_members WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');

  -- Schedules
  INSERT IGNORE INTO \`$ADMIN_DB\`.schedules SELECT * FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');

  -- Tasks
  INSERT IGNORE INTO \`$ADMIN_DB\`.tasks SELECT * FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID'));

  -- Task dependencies
  INSERT IGNORE INTO \`$ADMIN_DB\`.task_dependencies SELECT * FROM pmassist.task_dependencies WHERE task_id IN (SELECT id FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID')));

  -- Project risks
  INSERT IGNORE INTO \`$ADMIN_DB\`.project_risks SELECT * FROM pmassist.project_risks WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');

  -- RAID sequence counter
  INSERT IGNORE INTO \`$ADMIN_DB\`.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');

  -- RAID activity log
  INSERT IGNORE INTO \`$ADMIN_DB\`.raid_activity_log SELECT * FROM pmassist.raid_activity_log WHERE risk_id IN (SELECT id FROM pmassist.project_risks WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID'));

  -- Time entries
  INSERT IGNORE INTO \`$ADMIN_DB\`.time_entries SELECT * FROM pmassist.time_entries WHERE task_id IN (SELECT id FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID')));

  -- Project health history
  INSERT IGNORE INTO \`$ADMIN_DB\`.project_health_history SELECT * FROM pmassist.project_health_history WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');

  -- Project expenses
  INSERT IGNORE INTO \`$ADMIN_DB\`.project_expenses SELECT * FROM pmassist.project_expenses WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');

  -- Sprints
  INSERT IGNORE INTO \`$ADMIN_DB\`.sprints SELECT * FROM pmassist.sprints WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID'));

  -- Sprint tasks
  INSERT IGNORE INTO \`$ADMIN_DB\`.sprint_tasks SELECT * FROM pmassist.sprint_tasks WHERE sprint_id IN (SELECT id FROM pmassist.sprints WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID')));

  -- Task comments
  INSERT IGNORE INTO \`$ADMIN_DB\`.task_comments SELECT * FROM pmassist.task_comments WHERE task_id IN (SELECT id FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID')));

  -- Task activities
  INSERT IGNORE INTO \`$ADMIN_DB\`.task_activities SELECT * FROM pmassist.task_activities WHERE task_id IN (SELECT id FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID')));

  -- Audit ledger (project-scoped entries)
  INSERT IGNORE INTO \`$ADMIN_DB\`.audit_ledger SELECT * FROM pmassist.audit_ledger WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');

  -- Chat conversations + messages
  INSERT IGNORE INTO \`$ADMIN_DB\`.chat_conversations SELECT * FROM pmassist.chat_conversations WHERE user_id = '$ADMIN_ID';
  INSERT IGNORE INTO \`$ADMIN_DB\`.chat_messages SELECT * FROM pmassist.chat_messages WHERE conversation_id IN (SELECT id FROM pmassist.chat_conversations WHERE user_id = '$ADMIN_ID');

  -- Notifications
  INSERT IGNORE INTO \`$ADMIN_DB\`.notifications SELECT * FROM pmassist.notifications WHERE user_id = '$ADMIN_ID';

  -- Webhooks + deliveries
  INSERT IGNORE INTO \`$ADMIN_DB\`.webhooks SELECT * FROM pmassist.webhooks WHERE user_id = '$ADMIN_ID';

  -- Report templates
  INSERT IGNORE INTO \`$ADMIN_DB\`.report_templates SELECT * FROM pmassist.report_templates WHERE user_id = '$ADMIN_ID';

  -- Custom fields + values
  INSERT IGNORE INTO \`$ADMIN_DB\`.custom_fields SELECT * FROM pmassist.custom_fields WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');
  INSERT IGNORE INTO \`$ADMIN_DB\`.custom_field_values SELECT * FROM pmassist.custom_field_values WHERE field_id IN (SELECT id FROM pmassist.custom_fields WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID'));

  -- Portal links + comments
  INSERT IGNORE INTO \`$ADMIN_DB\`.portal_links SELECT * FROM pmassist.portal_links WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');

  -- Resources
  INSERT IGNORE INTO \`$ADMIN_DB\`.resources SELECT * FROM pmassist.resources WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');

  -- Resource availability
  INSERT IGNORE INTO \`$ADMIN_DB\`.resource_availability SELECT * FROM pmassist.resource_availability WHERE resource_id IN (SELECT id FROM pmassist.resources WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID'));

  -- File attachments (project-scoped)
  INSERT IGNORE INTO \`$ADMIN_DB\`.file_attachments SELECT * FROM pmassist.file_attachments WHERE entity_type = 'project' AND entity_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');
  INSERT IGNORE INTO \`$ADMIN_DB\`.file_attachments SELECT * FROM pmassist.file_attachments WHERE entity_type = 'task' AND entity_id IN (SELECT id FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID')));

  -- User favourite projects
  INSERT IGNORE INTO \`$ADMIN_DB\`.user_favourite_projects SELECT * FROM pmassist.user_favourite_projects WHERE user_id = '$ADMIN_ID';

  -- Agents (seed data — copy for all tenants)
  INSERT IGNORE INTO \`$ADMIN_DB\`.agents SELECT * FROM pmassist.agents;

  -- Templates (shared seed data)
  INSERT IGNORE INTO \`$ADMIN_DB\`.templates SELECT * FROM pmassist.templates;

  -- Baselines
  INSERT IGNORE INTO \`$ADMIN_DB\`.baselines SELECT * FROM pmassist.baselines WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID'));

  -- Resource assignments
  INSERT IGNORE INTO \`$ADMIN_DB\`.resource_assignments SELECT * FROM pmassist.resource_assignments WHERE resource_id IN (SELECT id FROM pmassist.resources WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID'));

  -- Workflow rules
  INSERT IGNORE INTO \`$ADMIN_DB\`.workflow_rules SELECT * FROM pmassist.workflow_rules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$ADMIN_ID');
  INSERT IGNORE INTO \`$ADMIN_DB\`.workflow_rules SELECT * FROM pmassist.workflow_rules WHERE project_id IS NULL;
"
echo "  OK"

# Step 4: Copy Mike_todo's data (3 projects) → pmassist_t_george_jones
MIKE_ID="17de1179-c61b-423c-a8cd-f435dc5f9d70"
MIKE_DB="pmassist_t_george_jones"
echo ""
echo "[4/5] Copying Mike_todo data to $MIKE_DB..."

mariadb -e "
  INSERT IGNORE INTO \`$MIKE_DB\`.projects SELECT * FROM pmassist.projects WHERE created_by = '$MIKE_ID';
  INSERT IGNORE INTO \`$MIKE_DB\`.project_members SELECT * FROM pmassist.project_members WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.schedules SELECT * FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.tasks SELECT * FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID'));
  INSERT IGNORE INTO \`$MIKE_DB\`.task_dependencies SELECT * FROM pmassist.task_dependencies WHERE task_id IN (SELECT id FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID')));
  INSERT IGNORE INTO \`$MIKE_DB\`.project_risks SELECT * FROM pmassist.project_risks WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.raid_activity_log SELECT * FROM pmassist.raid_activity_log WHERE risk_id IN (SELECT id FROM pmassist.project_risks WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID'));
  INSERT IGNORE INTO \`$MIKE_DB\`.time_entries SELECT * FROM pmassist.time_entries WHERE task_id IN (SELECT id FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID')));
  INSERT IGNORE INTO \`$MIKE_DB\`.project_health_history SELECT * FROM pmassist.project_health_history WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.project_expenses SELECT * FROM pmassist.project_expenses WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.sprints SELECT * FROM pmassist.sprints WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID'));
  INSERT IGNORE INTO \`$MIKE_DB\`.sprint_tasks SELECT * FROM pmassist.sprint_tasks WHERE sprint_id IN (SELECT id FROM pmassist.sprints WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID')));
  INSERT IGNORE INTO \`$MIKE_DB\`.task_comments SELECT * FROM pmassist.task_comments WHERE task_id IN (SELECT id FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID')));
  INSERT IGNORE INTO \`$MIKE_DB\`.task_activities SELECT * FROM pmassist.task_activities WHERE task_id IN (SELECT id FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID')));
  INSERT IGNORE INTO \`$MIKE_DB\`.audit_ledger SELECT * FROM pmassist.audit_ledger WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.chat_conversations SELECT * FROM pmassist.chat_conversations WHERE user_id = '$MIKE_ID';
  INSERT IGNORE INTO \`$MIKE_DB\`.chat_messages SELECT * FROM pmassist.chat_messages WHERE conversation_id IN (SELECT id FROM pmassist.chat_conversations WHERE user_id = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.notifications SELECT * FROM pmassist.notifications WHERE user_id = '$MIKE_ID';
  INSERT IGNORE INTO \`$MIKE_DB\`.webhooks SELECT * FROM pmassist.webhooks WHERE user_id = '$MIKE_ID';
  INSERT IGNORE INTO \`$MIKE_DB\`.report_templates SELECT * FROM pmassist.report_templates WHERE user_id = '$MIKE_ID';
  INSERT IGNORE INTO \`$MIKE_DB\`.custom_fields SELECT * FROM pmassist.custom_fields WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.custom_field_values SELECT * FROM pmassist.custom_field_values WHERE field_id IN (SELECT id FROM pmassist.custom_fields WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID'));
  INSERT IGNORE INTO \`$MIKE_DB\`.portal_links SELECT * FROM pmassist.portal_links WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.resources SELECT * FROM pmassist.resources WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.resource_availability SELECT * FROM pmassist.resource_availability WHERE resource_id IN (SELECT id FROM pmassist.resources WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID'));
  INSERT IGNORE INTO \`$MIKE_DB\`.file_attachments SELECT * FROM pmassist.file_attachments WHERE entity_type = 'project' AND entity_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.file_attachments SELECT * FROM pmassist.file_attachments WHERE entity_type = 'task' AND entity_id IN (SELECT id FROM pmassist.tasks WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID')));
  INSERT IGNORE INTO \`$MIKE_DB\`.user_favourite_projects SELECT * FROM pmassist.user_favourite_projects WHERE user_id = '$MIKE_ID';
  INSERT IGNORE INTO \`$MIKE_DB\`.agents SELECT * FROM pmassist.agents;
  INSERT IGNORE INTO \`$MIKE_DB\`.templates SELECT * FROM pmassist.templates;
  INSERT IGNORE INTO \`$MIKE_DB\`.baselines SELECT * FROM pmassist.baselines WHERE schedule_id IN (SELECT id FROM pmassist.schedules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID'));
  INSERT IGNORE INTO \`$MIKE_DB\`.resource_assignments SELECT * FROM pmassist.resource_assignments WHERE resource_id IN (SELECT id FROM pmassist.resources WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID'));
  INSERT IGNORE INTO \`$MIKE_DB\`.workflow_rules SELECT * FROM pmassist.workflow_rules WHERE project_id IN (SELECT id FROM pmassist.projects WHERE created_by = '$MIKE_ID');
  INSERT IGNORE INTO \`$MIKE_DB\`.workflow_rules SELECT * FROM pmassist.workflow_rules WHERE project_id IS NULL;
"
echo "  OK"

# Seed agents into all other (empty) tenant DBs
echo ""
echo "[4b/5] Seeding agents + templates into empty tenant DBs..."
for db in pmassist_t_gerogebailoo pmassist_t_test_finance pmassist_t_kpbcma pmassist_t_test_pm pmassist_t_manjot pmassist_t_test_scrum pmassist_t_ichanna pmassist_t_test_exec pmassist_t_test_risk pmassist_t_sumantab; do
  mariadb -e "
    INSERT IGNORE INTO \`$db\`.agents SELECT * FROM pmassist.agents;
    INSERT IGNORE INTO \`$db\`.templates SELECT * FROM pmassist.templates;
    INSERT IGNORE INTO \`$db\`.workflow_rules SELECT * FROM pmassist.workflow_rules WHERE project_id IS NULL;
  " 2>/dev/null || true
done
echo "  OK"

# Step 5: Mark all orgs as provisioned
echo ""
echo "[5/5] Marking all organizations as provisioned..."
mariadb pmassist -e "UPDATE organizations SET is_provisioned = 1;"
echo "  OK"

echo ""
echo "=== Verifying ==="
mariadb pmassist -e "SELECT name, slug, db_name, is_provisioned FROM organizations;"

echo ""
# Count data in tenant DBs
for db in pmassist_t_test_org pmassist_t_george_jones; do
  PROJ=$(mariadb -N "$db" -e "SELECT COUNT(*) FROM projects;" 2>/dev/null || echo "0")
  TASK=$(mariadb -N "$db" -e "SELECT COUNT(*) FROM tasks;" 2>/dev/null || echo "0")
  echo "  $db: $PROJ projects, $TASK tasks"
done

echo ""
echo "=== Migration complete ==="
echo "Next: set MULTI_TENANT_ENABLED=true in /opt/pm-app/.env and restart pm-app"
