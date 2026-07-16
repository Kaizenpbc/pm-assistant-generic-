-- copy-data.sql — Copy project data from shared DB to tenant DBs
-- Uses CONVERT() to handle mixed charsets (latin1 vs utf8mb4)

USE pmassist;
SET @ADMIN_ID = '339a0b95-12b5-11f1-8984-bc2411674fff';
SET @MIKE_ID = '17de1179-c61b-423c-a8cd-f435dc5f9d70';

-- Build temp tables with project/schedule/task IDs
CREATE TEMPORARY TABLE tmp_admin_pids (id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY);
INSERT INTO tmp_admin_pids SELECT CONVERT(id USING utf8mb4) FROM pmassist.projects WHERE CONVERT(created_by USING utf8mb4) = @ADMIN_ID;

CREATE TEMPORARY TABLE tmp_admin_sids (id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY);
INSERT INTO tmp_admin_sids SELECT CONVERT(id USING utf8mb4) FROM pmassist.schedules WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_admin_pids);

CREATE TEMPORARY TABLE tmp_admin_tids (id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY);
INSERT INTO tmp_admin_tids SELECT CONVERT(id USING utf8mb4) FROM pmassist.tasks WHERE CONVERT(schedule_id USING utf8mb4) IN (SELECT id FROM tmp_admin_sids);

CREATE TEMPORARY TABLE tmp_mike_pids (id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY);
INSERT INTO tmp_mike_pids SELECT CONVERT(id USING utf8mb4) FROM pmassist.projects WHERE CONVERT(created_by USING utf8mb4) = @MIKE_ID;

CREATE TEMPORARY TABLE tmp_mike_sids (id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY);
INSERT INTO tmp_mike_sids SELECT CONVERT(id USING utf8mb4) FROM pmassist.schedules WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_mike_pids);

CREATE TEMPORARY TABLE tmp_mike_tids (id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY);
INSERT INTO tmp_mike_tids SELECT CONVERT(id USING utf8mb4) FROM pmassist.tasks WHERE CONVERT(schedule_id USING utf8mb4) IN (SELECT id FROM tmp_mike_sids);

-- ============================================================
-- Admin → pmassist_t_test_org
-- ============================================================
INSERT IGNORE INTO pmassist_t_test_org.projects SELECT * FROM pmassist.projects WHERE CONVERT(id USING utf8mb4) IN (SELECT id FROM tmp_admin_pids);
INSERT IGNORE INTO pmassist_t_test_org.project_members SELECT * FROM pmassist.project_members WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_admin_pids);
INSERT IGNORE INTO pmassist_t_test_org.schedules SELECT * FROM pmassist.schedules WHERE CONVERT(id USING utf8mb4) IN (SELECT id FROM tmp_admin_sids);
INSERT IGNORE INTO pmassist_t_test_org.tasks SELECT * FROM pmassist.tasks WHERE CONVERT(id USING utf8mb4) IN (SELECT id FROM tmp_admin_tids);
INSERT IGNORE INTO pmassist_t_test_org.task_dependencies SELECT * FROM pmassist.task_dependencies WHERE CONVERT(task_id USING utf8mb4) IN (SELECT id FROM tmp_admin_tids);
INSERT IGNORE INTO pmassist_t_test_org.project_risks SELECT * FROM pmassist.project_risks WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_admin_pids);
INSERT IGNORE INTO pmassist_t_test_org.time_entries SELECT * FROM pmassist.time_entries WHERE CONVERT(task_id USING utf8mb4) IN (SELECT id FROM tmp_admin_tids);
INSERT IGNORE INTO pmassist_t_test_org.project_health_history SELECT * FROM pmassist.project_health_history WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_admin_pids);
INSERT IGNORE INTO pmassist_t_test_org.project_expenses SELECT * FROM pmassist.project_expenses WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_admin_pids);
INSERT IGNORE INTO pmassist_t_test_org.audit_ledger SELECT * FROM pmassist.audit_ledger WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_admin_pids);
INSERT IGNORE INTO pmassist_t_test_org.chat_conversations SELECT * FROM pmassist.chat_conversations WHERE CONVERT(user_id USING utf8mb4) = @ADMIN_ID;
INSERT IGNORE INTO pmassist_t_test_org.chat_messages SELECT cm.* FROM pmassist.chat_messages cm JOIN pmassist.chat_conversations cc ON CONVERT(cm.conversation_id USING utf8mb4) = CONVERT(cc.id USING utf8mb4) WHERE CONVERT(cc.user_id USING utf8mb4) = @ADMIN_ID;
INSERT IGNORE INTO pmassist_t_test_org.notifications SELECT * FROM pmassist.notifications WHERE CONVERT(user_id USING utf8mb4) = @ADMIN_ID;
INSERT IGNORE INTO pmassist_t_test_org.webhooks SELECT * FROM pmassist.webhooks WHERE CONVERT(user_id USING utf8mb4) = @ADMIN_ID;
INSERT IGNORE INTO pmassist_t_test_org.report_templates SELECT * FROM pmassist.report_templates WHERE CONVERT(user_id USING utf8mb4) = @ADMIN_ID;
INSERT IGNORE INTO pmassist_t_test_org.custom_fields SELECT * FROM pmassist.custom_fields WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_admin_pids);
INSERT IGNORE INTO pmassist_t_test_org.portal_links SELECT * FROM pmassist.portal_links WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_admin_pids);
INSERT IGNORE INTO pmassist_t_test_org.resources SELECT * FROM pmassist.resources;
INSERT IGNORE INTO pmassist_t_test_org.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_test_org.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_test_org.templates SELECT * FROM pmassist.templates;

-- ============================================================
-- Mike → pmassist_t_george_jones
-- ============================================================
INSERT IGNORE INTO pmassist_t_george_jones.projects SELECT * FROM pmassist.projects WHERE CONVERT(id USING utf8mb4) IN (SELECT id FROM tmp_mike_pids);
INSERT IGNORE INTO pmassist_t_george_jones.project_members SELECT * FROM pmassist.project_members WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_mike_pids);
INSERT IGNORE INTO pmassist_t_george_jones.schedules SELECT * FROM pmassist.schedules WHERE CONVERT(id USING utf8mb4) IN (SELECT id FROM tmp_mike_sids);
INSERT IGNORE INTO pmassist_t_george_jones.tasks SELECT * FROM pmassist.tasks WHERE CONVERT(id USING utf8mb4) IN (SELECT id FROM tmp_mike_tids);
INSERT IGNORE INTO pmassist_t_george_jones.task_dependencies SELECT * FROM pmassist.task_dependencies WHERE CONVERT(task_id USING utf8mb4) IN (SELECT id FROM tmp_mike_tids);
INSERT IGNORE INTO pmassist_t_george_jones.project_risks SELECT * FROM pmassist.project_risks WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_mike_pids);
INSERT IGNORE INTO pmassist_t_george_jones.time_entries SELECT * FROM pmassist.time_entries WHERE CONVERT(task_id USING utf8mb4) IN (SELECT id FROM tmp_mike_tids);
INSERT IGNORE INTO pmassist_t_george_jones.project_health_history SELECT * FROM pmassist.project_health_history WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_mike_pids);
INSERT IGNORE INTO pmassist_t_george_jones.project_expenses SELECT * FROM pmassist.project_expenses WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_mike_pids);
INSERT IGNORE INTO pmassist_t_george_jones.audit_ledger SELECT * FROM pmassist.audit_ledger WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_mike_pids);
INSERT IGNORE INTO pmassist_t_george_jones.chat_conversations SELECT * FROM pmassist.chat_conversations WHERE CONVERT(user_id USING utf8mb4) = @MIKE_ID;
INSERT IGNORE INTO pmassist_t_george_jones.chat_messages SELECT cm.* FROM pmassist.chat_messages cm JOIN pmassist.chat_conversations cc ON CONVERT(cm.conversation_id USING utf8mb4) = CONVERT(cc.id USING utf8mb4) WHERE CONVERT(cc.user_id USING utf8mb4) = @MIKE_ID;
INSERT IGNORE INTO pmassist_t_george_jones.notifications SELECT * FROM pmassist.notifications WHERE CONVERT(user_id USING utf8mb4) = @MIKE_ID;
INSERT IGNORE INTO pmassist_t_george_jones.webhooks SELECT * FROM pmassist.webhooks WHERE CONVERT(user_id USING utf8mb4) = @MIKE_ID;
INSERT IGNORE INTO pmassist_t_george_jones.report_templates SELECT * FROM pmassist.report_templates WHERE CONVERT(user_id USING utf8mb4) = @MIKE_ID;
INSERT IGNORE INTO pmassist_t_george_jones.custom_fields SELECT * FROM pmassist.custom_fields WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_mike_pids);
INSERT IGNORE INTO pmassist_t_george_jones.portal_links SELECT * FROM pmassist.portal_links WHERE CONVERT(project_id USING utf8mb4) IN (SELECT id FROM tmp_mike_pids);
INSERT IGNORE INTO pmassist_t_george_jones.resources SELECT * FROM pmassist.resources;
INSERT IGNORE INTO pmassist_t_george_jones.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_george_jones.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_george_jones.templates SELECT * FROM pmassist.templates;

-- ============================================================
-- Seed empty tenant DBs
-- ============================================================
INSERT IGNORE INTO pmassist_t_gerogebailoo.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_gerogebailoo.templates SELECT * FROM pmassist.templates;
INSERT IGNORE INTO pmassist_t_gerogebailoo.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_test_finance.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_test_finance.templates SELECT * FROM pmassist.templates;
INSERT IGNORE INTO pmassist_t_test_finance.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_kpbcma.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_kpbcma.templates SELECT * FROM pmassist.templates;
INSERT IGNORE INTO pmassist_t_kpbcma.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_test_pm.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_test_pm.templates SELECT * FROM pmassist.templates;
INSERT IGNORE INTO pmassist_t_test_pm.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_manjot.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_manjot.templates SELECT * FROM pmassist.templates;
INSERT IGNORE INTO pmassist_t_manjot.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_test_scrum.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_test_scrum.templates SELECT * FROM pmassist.templates;
INSERT IGNORE INTO pmassist_t_test_scrum.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_ichanna.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_ichanna.templates SELECT * FROM pmassist.templates;
INSERT IGNORE INTO pmassist_t_ichanna.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_test_exec.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_test_exec.templates SELECT * FROM pmassist.templates;
INSERT IGNORE INTO pmassist_t_test_exec.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_test_risk.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_test_risk.templates SELECT * FROM pmassist.templates;
INSERT IGNORE INTO pmassist_t_test_risk.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;
INSERT IGNORE INTO pmassist_t_sumantab.agents SELECT * FROM pmassist.agents;
INSERT IGNORE INTO pmassist_t_sumantab.templates SELECT * FROM pmassist.templates;
INSERT IGNORE INTO pmassist_t_sumantab.raid_sequence_counter SELECT * FROM pmassist.raid_sequence_counter;

-- Mark all provisioned
UPDATE pmassist.organizations SET is_provisioned = 1;

-- Cleanup
DROP TEMPORARY TABLE IF EXISTS tmp_admin_pids, tmp_admin_sids, tmp_admin_tids;
DROP TEMPORARY TABLE IF EXISTS tmp_mike_pids, tmp_mike_sids, tmp_mike_tids;
