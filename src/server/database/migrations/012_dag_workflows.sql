-- 012_dag_workflows.sql
-- Declarative DAG workflow engine: definitions, nodes, edges, executions

-- Workflow definitions (replaces in-memory WorkflowRule[])
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) DEFAULT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  version INT NOT NULL DEFAULT 1,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project (project_id, is_enabled)
);

-- Nodes in the DAG
CREATE TABLE IF NOT EXISTS workflow_nodes (
  id VARCHAR(36) PRIMARY KEY,
  workflow_id VARCHAR(36) NOT NULL,
  node_type ENUM('trigger','condition','action','approval','delay') NOT NULL,
  name VARCHAR(200) NOT NULL,
  config JSON NOT NULL,
  position_x INT NOT NULL DEFAULT 0,
  position_y INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workflow (workflow_id),
  FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE
);

-- Directed edges between nodes
CREATE TABLE IF NOT EXISTS workflow_edges (
  id VARCHAR(36) PRIMARY KEY,
  workflow_id VARCHAR(36) NOT NULL,
  source_node_id VARCHAR(36) NOT NULL,
  target_node_id VARCHAR(36) NOT NULL,
  condition_expr JSON DEFAULT NULL,
  label VARCHAR(100) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  INDEX idx_workflow (workflow_id),
  FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_node_id) REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES workflow_nodes(id) ON DELETE CASCADE
);

-- Execution instances
CREATE TABLE IF NOT EXISTS workflow_executions (
  id VARCHAR(36) PRIMARY KEY,
  workflow_id VARCHAR(36) NOT NULL,
  trigger_node_id VARCHAR(36) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  status ENUM('running','completed','failed','cancelled','waiting') NOT NULL DEFAULT 'running',
  context JSON NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  INDEX idx_workflow (workflow_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_status (status),
  FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE
);

-- Per-node execution state
CREATE TABLE IF NOT EXISTS workflow_node_executions (
  id VARCHAR(36) PRIMARY KEY,
  execution_id VARCHAR(36) NOT NULL,
  node_id VARCHAR(36) NOT NULL,
  status ENUM('pending','running','completed','failed','skipped','waiting') NOT NULL DEFAULT 'pending',
  input_data JSON DEFAULT NULL,
  output_data JSON DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  INDEX idx_execution (execution_id),
  INDEX idx_node (node_id),
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES workflow_nodes(id) ON DELETE CASCADE
);

-- Seed data: convert the 3 hardcoded rules into DAG workflows

-- Rule 1: Auto-complete on 100% progress
INSERT INTO workflow_definitions (id, project_id, name, description, is_enabled, version, created_by)
VALUES ('wf-seed-1', NULL, 'Auto-complete on 100% progress',
        'When a task reaches 100% progress, automatically set status to completed',
        1, 1, 'system');

INSERT INTO workflow_nodes (id, workflow_id, node_type, name, config, position_x, position_y) VALUES
  ('wf-seed-1-trigger', 'wf-seed-1', 'trigger', 'Progress reaches 100%',
   '{"triggerType":"progress_threshold","progressThreshold":100,"progressDirection":"above"}', 0, 0),
  ('wf-seed-1-action', 'wf-seed-1', 'action', 'Set status to completed',
   '{"actionType":"update_field","field":"status","value":"completed"}', 0, 100);

INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, sort_order) VALUES
  ('wf-seed-1-edge', 'wf-seed-1', 'wf-seed-1-trigger', 'wf-seed-1-action', 0);

-- Rule 2: Log when task starts
INSERT INTO workflow_definitions (id, project_id, name, description, is_enabled, version, created_by)
VALUES ('wf-seed-2', NULL, 'Log when task starts',
        'Log activity when a task moves to in_progress',
        1, 1, 'system');

INSERT INTO workflow_nodes (id, workflow_id, node_type, name, config, position_x, position_y) VALUES
  ('wf-seed-2-trigger', 'wf-seed-2', 'trigger', 'Status changes to in_progress',
   '{"triggerType":"status_change","toStatus":"in_progress"}', 0, 0),
  ('wf-seed-2-action', 'wf-seed-2', 'action', 'Log activity',
   '{"actionType":"log_activity","message":"Task work has started"}', 0, 100);

INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, sort_order) VALUES
  ('wf-seed-2-edge', 'wf-seed-2', 'wf-seed-2-trigger', 'wf-seed-2-action', 0);

-- Rule 3: Notify on cancellation (disabled)
INSERT INTO workflow_definitions (id, project_id, name, description, is_enabled, version, created_by)
VALUES ('wf-seed-3', NULL, 'Notify on cancellation',
        'Send notification when a task is cancelled',
        0, 1, 'system');

INSERT INTO workflow_nodes (id, workflow_id, node_type, name, config, position_x, position_y) VALUES
  ('wf-seed-3-trigger', 'wf-seed-3', 'trigger', 'Status changes to cancelled',
   '{"triggerType":"status_change","toStatus":"cancelled"}', 0, 0),
  ('wf-seed-3-action', 'wf-seed-3', 'action', 'Send notification',
   '{"actionType":"send_notification","message":"A task has been cancelled"}', 0, 100);

INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, sort_order) VALUES
  ('wf-seed-3-edge', 'wf-seed-3', 'wf-seed-3-trigger', 'wf-seed-3-action', 0);

-- Track migration
INSERT INTO _migrations (name) VALUES ('012_dag_workflows');
