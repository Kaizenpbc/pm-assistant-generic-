-- Rollback 012_dag_workflows
DELETE FROM workflow_node_executions WHERE execution_id IN (SELECT id FROM workflow_executions WHERE workflow_id IN ('wf-seed-1','wf-seed-2','wf-seed-3'));
DELETE FROM workflow_executions WHERE workflow_id IN ('wf-seed-1','wf-seed-2','wf-seed-3');
DELETE FROM workflow_edges WHERE workflow_id IN ('wf-seed-1','wf-seed-2','wf-seed-3');
DELETE FROM workflow_nodes WHERE workflow_id IN ('wf-seed-1','wf-seed-2','wf-seed-3');
DELETE FROM workflow_definitions WHERE id IN ('wf-seed-1','wf-seed-2','wf-seed-3');

DROP TABLE IF EXISTS workflow_node_executions;
DROP TABLE IF EXISTS workflow_executions;
DROP TABLE IF EXISTS workflow_edges;
DROP TABLE IF EXISTS workflow_nodes;
DROP TABLE IF EXISTS workflow_definitions;

DELETE FROM _migrations WHERE name = '012_dag_workflows';
