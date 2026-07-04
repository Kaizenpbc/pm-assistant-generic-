-- Rollback 014_event_driven_workflows
-- Remove seed workflows added by this migration
DELETE FROM workflow_edges WHERE workflow_id IN ('wf-seed-4','wf-seed-5');
DELETE FROM workflow_nodes WHERE workflow_id IN ('wf-seed-4','wf-seed-5');
DELETE FROM workflow_definitions WHERE id IN ('wf-seed-4','wf-seed-5');

-- Revert wf-seed-3 back to disabled
UPDATE workflow_definitions SET is_enabled = 0 WHERE id = 'wf-seed-3';

-- Revert node_type ENUM to remove 'agent'
ALTER TABLE workflow_nodes MODIFY COLUMN node_type ENUM('trigger','condition','action','approval','delay') NOT NULL;

DELETE FROM _migrations WHERE name = '014_event_driven_workflows';
