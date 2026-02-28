-- 008_seed_data.sql
-- Seed demo data for projects, schedules, tasks, resources, and assignments.
-- Uses INSERT IGNORE so re-running is idempotent.
-- created_by references the first admin user via a variable.

SET @admin_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1);

-- ============================================================================
-- Projects
-- ============================================================================

INSERT IGNORE INTO projects (id, name, description, category, project_type, status, priority, budget_allocated, budget_spent, currency, location, location_lat, location_lon, start_date, end_date, created_by)
VALUES
  ('1', 'Cloud Migration Project', 'Migrate on-premise infrastructure to AWS cloud services', 'technology', 'it', 'active', 'high', 500000.00, 175000.00, 'USD', 'New York, NY', 40.7100000, -74.0100000, '2026-01-15', '2026-12-31', @admin_id),
  ('2', 'Highway 101 Expansion', 'Widen Highway 101 from 4 to 6 lanes between Exit 12 and Exit 18', 'transportation', 'roads', 'planning', 'high', 8000000.00, 1200000.00, 'USD', 'San Jose, CA', 37.3400000, -121.8900000, '2026-03-01', '2028-06-30', @admin_id),
  ('3', 'Downtown Office Complex', 'Construction of a 12-story mixed-use office and retail building', 'commercial', 'construction', 'active', 'urgent', 25000000.00, 8500000.00, 'USD', 'Chicago, IL', 41.8800000, -87.6300000, '2025-06-01', '2027-12-31', @admin_id);

-- ============================================================================
-- Schedules
-- ============================================================================

INSERT IGNORE INTO schedules (id, project_id, name, description, start_date, end_date, status, created_by)
VALUES
  ('sch-1', '3', 'Construction Master Schedule', 'Primary construction timeline for Downtown Office Complex', '2025-06-01', '2027-12-31', 'active', @admin_id),
  ('sch-2', '1', 'Cloud Migration Plan', 'Phased migration of on-premise systems to AWS', '2026-01-15', '2026-12-31', 'active', @admin_id),
  ('sch-3', '2', 'Highway Expansion Schedule', 'Construction timeline for Highway 101 widening project', '2026-03-01', '2028-06-30', 'pending', @admin_id);

-- ============================================================================
-- Tasks — Construction (sch-1)
-- ============================================================================

INSERT IGNORE INTO tasks (id, schedule_id, name, description, status, priority, start_date, end_date, progress_percentage, dependency, dependency_type, parent_task_id, created_by)
VALUES
  ('task-1',   'sch-1', 'Phase 1: Planning & Design', 'Initial planning and architectural design phase', 'completed', 'high', '2025-06-01', '2025-08-30', 100, NULL, NULL, NULL, @admin_id),
  ('task-1-1', 'sch-1', 'Site Survey & Geotechnical Analysis', 'Topographical survey and soil testing', 'completed', 'high', '2025-06-01', '2025-06-30', 100, NULL, NULL, 'task-1', @admin_id),
  ('task-1-2', 'sch-1', 'Architectural Drawings & Permits', 'Detailed architectural plans and building permit applications', 'completed', 'high', '2025-07-01', '2025-08-30', 100, NULL, NULL, 'task-1', @admin_id),
  ('task-2',   'sch-1', 'Phase 2: Foundation & Structure', 'Foundation work and structural framework', 'in_progress', 'urgent', '2025-09-01', '2026-06-30', 35, 'task-1', 'FS', NULL, @admin_id),
  ('task-2-1', 'sch-1', 'Excavation & Foundation', 'Deep excavation and foundation laying', 'completed', 'urgent', '2025-09-01', '2025-12-31', 100, NULL, NULL, 'task-2', @admin_id),
  ('task-2-2', 'sch-1', 'Steel Framework (Floors 1-6)', 'Erecting steel columns and beams for lower floors', 'in_progress', 'high', '2026-01-01', '2026-06-30', 40, 'task-2-1', 'FS', 'task-2', @admin_id),
  ('task-3',   'sch-1', 'Phase 3: Exterior & Interior', 'Building envelope and interior finishing', 'pending', 'high', '2026-07-01', '2027-09-30', 0, 'task-2', 'FS', NULL, @admin_id),
  ('task-4',   'sch-1', 'Phase 4: Final Inspection & Handover', 'Quality inspection and project completion', 'pending', 'high', '2027-10-01', '2027-12-31', 0, 'task-3', 'FS', NULL, @admin_id);

-- ============================================================================
-- Tasks — Cloud Migration (sch-2)
-- ============================================================================

INSERT IGNORE INTO tasks (id, schedule_id, name, description, status, priority, start_date, end_date, progress_percentage, dependency, dependency_type, parent_task_id, created_by)
VALUES
  ('task-c1',   'sch-2', 'Assessment & Planning', 'Audit existing infrastructure and design cloud architecture', 'completed', 'high', '2026-01-15', '2026-02-28', 100, NULL, NULL, NULL, @admin_id),
  ('task-c1-1', 'sch-2', 'Infrastructure Audit', 'Inventory all servers, databases, and services', 'completed', 'high', '2026-01-15', '2026-02-07', 100, NULL, NULL, 'task-c1', @admin_id),
  ('task-c1-2', 'sch-2', 'AWS Architecture Design', 'Design target cloud architecture with VPC, subnets, and security groups', 'completed', 'high', '2026-02-08', '2026-02-28', 100, 'task-c1-1', 'FS', 'task-c1', @admin_id),
  ('task-c2',   'sch-2', 'Database Migration', 'Migrate databases to RDS/Aurora', 'in_progress', 'urgent', '2026-03-01', '2026-05-31', 30, 'task-c1', 'FS', NULL, @admin_id),
  ('task-c3',   'sch-2', 'Application Migration', 'Containerize and deploy applications to ECS/EKS', 'pending', 'high', '2026-06-01', '2026-09-30', 0, 'task-c2', 'FS', NULL, @admin_id),
  ('task-c4',   'sch-2', 'Testing & Cutover', 'Integration testing, performance testing, and final cutover', 'pending', 'high', '2026-10-01', '2026-12-31', 0, 'task-c3', 'FS', NULL, @admin_id);

-- ============================================================================
-- Tasks — Highway Expansion (sch-3)
-- ============================================================================

INSERT IGNORE INTO tasks (id, schedule_id, name, description, status, priority, start_date, end_date, progress_percentage, dependency, dependency_type, parent_task_id, created_by)
VALUES
  ('task-h1',   'sch-3', 'Environmental & Permits', 'Environmental impact assessment and permit acquisition', 'in_progress', 'high', '2026-03-01', '2026-08-31', 45, NULL, NULL, NULL, @admin_id),
  ('task-h1-1', 'sch-3', 'Environmental Impact Study', 'Complete EIS per federal requirements', 'in_progress', 'high', '2026-03-01', '2026-06-30', 60, NULL, NULL, 'task-h1', @admin_id),
  ('task-h1-2', 'sch-3', 'Right-of-Way Acquisition', 'Acquire additional land parcels for highway widening', 'pending', 'high', '2026-05-01', '2026-08-31', 0, NULL, NULL, 'task-h1', @admin_id),
  ('task-h2',   'sch-3', 'Utility Relocation', 'Relocate underground utilities and overhead lines', 'pending', 'medium', '2026-09-01', '2027-02-28', 0, 'task-h1', 'FS', NULL, @admin_id),
  ('task-h3',   'sch-3', 'Earthwork & Grading', 'Major earthmoving and road grading operations', 'pending', 'high', '2027-03-01', '2027-10-31', 0, 'task-h2', 'FS', NULL, @admin_id),
  ('task-h4',   'sch-3', 'Paving & Finishing', 'Road paving, lane markings, signage, and barriers', 'pending', 'high', '2027-11-01', '2028-06-30', 0, 'task-h3', 'FS', NULL, @admin_id);

-- ============================================================================
-- Resources
-- ============================================================================

INSERT IGNORE INTO resources (id, name, role, email, capacity_hours_per_week, skills, is_active)
VALUES
  ('res-1', 'Alice Chen', 'Project Manager', 'alice.chen@example.com', 40, '["Planning","Scheduling","Risk Management"]', TRUE),
  ('res-2', 'Bob Martinez', 'Lead Engineer', 'bob.martinez@example.com', 40, '["Structural Engineering","Design","Inspection"]', TRUE),
  ('res-3', 'Carol Davis', 'Site Supervisor', 'carol.davis@example.com', 45, '["Construction","Safety","Equipment"]', TRUE),
  ('res-4', 'David Kim', 'Software Developer', 'david.kim@example.com', 40, '["AWS","Docker","Node.js","React"]', TRUE),
  ('res-5', 'Emily Johnson', 'QA Engineer', 'emily.j@example.com', 40, '["Testing","Automation","Performance Testing"]', TRUE);

-- ============================================================================
-- Resource Assignments
-- ============================================================================

INSERT IGNORE INTO resource_assignments (id, resource_id, task_id, schedule_id, hours_per_week, start_date, end_date)
VALUES
  ('asgn-1', 'res-1', 'task-2',   'sch-1', 20, '2025-09-01', '2026-06-30'),
  ('asgn-2', 'res-2', 'task-2-2', 'sch-1', 35, '2026-01-01', '2026-06-30'),
  ('asgn-3', 'res-3', 'task-2-1', 'sch-1', 40, '2025-09-01', '2025-12-31'),
  ('asgn-4', 'res-3', 'task-3',   'sch-1', 45, '2026-07-01', '2027-09-30'),
  ('asgn-5', 'res-4', 'task-c2',  'sch-2', 40, '2026-03-01', '2026-05-31'),
  ('asgn-6', 'res-4', 'task-c3',  'sch-2', 35, '2026-06-01', '2026-09-30'),
  ('asgn-7', 'res-5', 'task-c4',  'sch-2', 40, '2026-10-01', '2026-12-31'),
  ('asgn-8', 'res-1', 'task-c1',  'sch-2', 15, '2026-01-15', '2026-02-28'),
  ('asgn-9', 'res-2', 'task-h2',  'sch-3', 20, '2026-09-01', '2027-02-28');
