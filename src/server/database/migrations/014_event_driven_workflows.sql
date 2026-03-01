-- 014_event_driven_workflows.sql
-- Add 'agent' node type and seed event-driven workflow definitions

-- Add 'agent' to workflow_nodes node_type enum
ALTER TABLE workflow_nodes
  MODIFY COLUMN node_type ENUM('trigger','condition','action','approval','delay','agent') NOT NULL;

-- Workflow: On task overdue → run reschedule agent + notify
INSERT INTO workflow_definitions (id, project_id, name, description, is_enabled, version, created_by)
VALUES ('wf-seed-4', NULL, 'On task overdue — reschedule agent',
        'When a task passes its end date, invoke the auto-reschedule agent and notify the PM',
        1, 1, 'system');

INSERT INTO workflow_nodes (id, workflow_id, node_type, name, config, position_x, position_y) VALUES
  ('wf-seed-4-trigger', 'wf-seed-4', 'trigger', 'Task overdue',
   '{"triggerType":"date_passed"}', 0, 0),
  ('wf-seed-4-agent', 'wf-seed-4', 'agent', 'Run reschedule agent',
   '{"capabilityId":"auto-reschedule-v1","input":{"scheduleId":"{{task.scheduleId}}"},"retries":1,"backoffMs":2000}', 0, 100),
  ('wf-seed-4-notify', 'wf-seed-4', 'action', 'Notify PM',
   '{"actionType":"send_notification","severity":"high","message":"Agent detected overdue task and generated a reschedule proposal."}', 0, 200);

INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, sort_order) VALUES
  ('wf-seed-4-edge1', 'wf-seed-4', 'wf-seed-4-trigger', 'wf-seed-4-agent', 0),
  ('wf-seed-4-edge2', 'wf-seed-4', 'wf-seed-4-agent', 'wf-seed-4-notify', 0);

-- Workflow: On task marked urgent → notify PM
INSERT INTO workflow_definitions (id, project_id, name, description, is_enabled, version, created_by)
VALUES ('wf-seed-5', NULL, 'On task marked urgent — notify PM',
        'When a task priority changes to urgent, send a high-severity notification',
        1, 1, 'system');

INSERT INTO workflow_nodes (id, workflow_id, node_type, name, config, position_x, position_y) VALUES
  ('wf-seed-5-trigger', 'wf-seed-5', 'trigger', 'Priority changed to urgent',
   '{"triggerType":"priority_change","toPriority":"urgent"}', 0, 0),
  ('wf-seed-5-action', 'wf-seed-5', 'action', 'Notify PM of urgent task',
   '{"actionType":"send_notification","severity":"high","message":"Task priority escalated to urgent: {{task.name}}"}', 0, 100);

INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, sort_order) VALUES
  ('wf-seed-5-edge', 'wf-seed-5', 'wf-seed-5-trigger', 'wf-seed-5-action', 0);

-- Workflow: On task cancelled → notify + log
-- Enable the existing wf-seed-3 (was disabled) instead of creating a duplicate
UPDATE workflow_definitions SET is_enabled = 1 WHERE id = 'wf-seed-3';

-- Track migration
INSERT INTO _migrations (name) VALUES ('014_event_driven_workflows');
