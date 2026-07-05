-- Rollback 008_seed_data
DELETE FROM resource_assignments WHERE id IN ('asgn-1','asgn-2','asgn-3','asgn-4','asgn-5','asgn-6','asgn-7','asgn-8','asgn-9');
DELETE FROM tasks WHERE id IN ('task-1','task-2','task-3','task-4','task-5','task-6','task-7','task-8','task-9','task-10','task-h1','task-h2','task-h3','task-h4','task-c1','task-c2','task-c3','task-c4','task-c5','task-c6');
DELETE FROM resources WHERE id IN ('res-1','res-2','res-3','res-4','res-5');
DELETE FROM schedules WHERE id IN ('sch-1','sch-2','sch-3');
DELETE FROM projects WHERE id IN ('1','2','3');
