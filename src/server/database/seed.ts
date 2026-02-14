/**
 * Database Seed Script
 *
 * Populates all tables with the same demo data that is currently
 * hardcoded in the service static arrays.
 *
 * Truncates existing data before inserting (idempotent).
 * Runs inside a transaction for atomicity.
 *
 * Usage:
 *   npx tsx src/server/database/seed.ts
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env['DB_HOST'] || 'localhost',
  port: Number(process.env['DB_PORT'] || 3306),
  user: process.env['DB_USER'] || 'root',
  password: process.env['DB_PASSWORD'] || 'rootpassword',
  database: process.env['DB_NAME'] || 'pm_assistant_generic',
};

// ---------------------------------------------------------------------------
// Seed data — mirrors the static arrays in each service
// ---------------------------------------------------------------------------

const USERS = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    password_hash: '$2b$12$57JV8D4fZCCQPwL7gmJ6n.ar5spwtsb2aYjgfiKho8C9KJh8bFrcW', // admin123
    full_name: 'Administrator',
    role: 'admin',
    is_active: true,
  },
  {
    id: '2',
    username: 'pmo_manager',
    email: 'pmo@example.com',
    password_hash: '$2b$12$57JV8D4fZCCQPwL7gmJ6n.ar5spwtsb2aYjgfiKho8C9KJh8bFrcW', // admin123
    full_name: 'Maria Lopez',
    role: 'pmo_manager',
    is_active: true,
  },
  {
    id: '3',
    username: 'portfolio_mgr',
    email: 'portfolio@example.com',
    password_hash: '$2b$12$57JV8D4fZCCQPwL7gmJ6n.ar5spwtsb2aYjgfiKho8C9KJh8bFrcW', // admin123
    full_name: 'David Kim',
    role: 'portfolio_manager',
    is_active: true,
  },
  {
    id: '4',
    username: 'john_pm',
    email: 'john@example.com',
    password_hash: '$2b$12$57JV8D4fZCCQPwL7gmJ6n.ar5spwtsb2aYjgfiKho8C9KJh8bFrcW', // admin123
    full_name: 'John Smith',
    role: 'pm',
    is_active: true,
  },
  {
    id: '5',
    username: 'sarah_pm',
    email: 'sarah@example.com',
    password_hash: '$2b$12$57JV8D4fZCCQPwL7gmJ6n.ar5spwtsb2aYjgfiKho8C9KJh8bFrcW', // admin123
    full_name: 'Sarah Chen',
    role: 'pm',
    is_active: true,
  },
];

const PORTFOLIOS = [
  {
    id: 'portfolio-1',
    name: 'Road Infrastructure 2026',
    description: 'All road and infrastructure projects for fiscal year 2026',
    created_by: '1',
    is_active: true,
  },
  {
    id: 'portfolio-2',
    name: 'IT Modernization',
    description: 'Technology modernization and cloud migration initiatives',
    created_by: '1',
    is_active: true,
  },
];

const USER_PORTFOLIO_ASSIGNMENTS = [
  // David Kim (portfolio_manager) manages both portfolios
  { id: 'upa-1', user_id: '3', portfolio_id: 'portfolio-1' },
  { id: 'upa-2', user_id: '3', portfolio_id: 'portfolio-2' },
  // John Smith (PM) is in both portfolios
  { id: 'upa-3', user_id: '4', portfolio_id: 'portfolio-1' },
  { id: 'upa-4', user_id: '4', portfolio_id: 'portfolio-2' },
  // Sarah Chen (PM) is in Road Infrastructure portfolio
  { id: 'upa-5', user_id: '5', portfolio_id: 'portfolio-1' },
];

const PROJECTS = [
  {
    id: '1',
    name: 'Cloud Migration Project',
    description: 'Migrate on-premise infrastructure to AWS cloud services',
    category: 'technology',
    project_type: 'it',
    status: 'active',
    priority: 'high',
    budget_allocated: 500000,
    budget_spent: 175000,
    currency: 'USD',
    location: 'New York, NY',
    location_lat: 40.71,
    location_lon: -74.01,
    start_date: '2026-01-15',
    end_date: '2026-12-31',
    portfolio_id: 'portfolio-2',
    created_by: '4',  // John Smith (PM)
  },
  {
    id: '2',
    name: 'Highway 101 Expansion',
    description: 'Widen Highway 101 from 4 to 6 lanes between Exit 12 and Exit 18',
    category: 'transportation',
    project_type: 'roads',
    status: 'planning',
    priority: 'high',
    budget_allocated: 8000000,
    budget_spent: 1200000,
    currency: 'USD',
    location: 'San Jose, CA',
    location_lat: 37.34,
    location_lon: -121.89,
    start_date: '2026-03-01',
    end_date: '2028-06-30',
    portfolio_id: 'portfolio-1',
    created_by: '4',  // John Smith (PM)
  },
  {
    id: '3',
    name: 'Downtown Office Complex',
    description: 'Construction of a 12-story mixed-use office and retail building',
    category: 'commercial',
    project_type: 'construction',
    status: 'active',
    priority: 'urgent',
    budget_allocated: 25000000,
    budget_spent: 8500000,
    currency: 'USD',
    location: 'Chicago, IL',
    location_lat: 41.88,
    location_lon: -87.63,
    start_date: '2025-06-01',
    end_date: '2027-12-31',
    portfolio_id: 'portfolio-1',
    created_by: '5',  // Sarah Chen (PM)
  },
];

const PROJECT_MEMBERS = [
  { id: 'pm-1', project_id: '1', user_id: '4', user_name: 'John Smith', email: 'john@example.com', role: 'owner' },
  { id: 'pm-2', project_id: '2', user_id: '4', user_name: 'John Smith', email: 'john@example.com', role: 'owner' },
  { id: 'pm-3', project_id: '3', user_id: '5', user_name: 'Sarah Chen', email: 'sarah@example.com', role: 'owner' },
];

const SCHEDULES = [
  {
    id: 'sch-1',
    project_id: '3',
    name: 'Construction Master Schedule',
    description: 'Primary construction timeline for Downtown Office Complex',
    start_date: '2025-06-01',
    end_date: '2027-12-31',
    status: 'active',
    created_by: '1',
  },
  {
    id: 'sch-2',
    project_id: '1',
    name: 'Cloud Migration Plan',
    description: 'Phased migration of on-premise systems to AWS',
    start_date: '2026-01-15',
    end_date: '2026-12-31',
    status: 'active',
    created_by: '1',
  },
  {
    id: 'sch-3',
    project_id: '2',
    name: 'Highway Expansion Schedule',
    description: 'Construction timeline for Highway 101 widening project',
    start_date: '2026-03-01',
    end_date: '2028-06-30',
    status: 'pending',
    created_by: '1',
  },
];

const TASKS = [
  // --- Construction schedule (sch-1) ---
  { id: 'task-1', schedule_id: 'sch-1', name: 'Phase 1: Planning & Design', description: 'Initial planning and architectural design phase', status: 'completed', priority: 'high', start_date: '2025-06-01', end_date: '2025-08-30', progress_percentage: 100, parent_task_id: null, dependency: null, dependency_type: null, created_by: '1' },
  { id: 'task-1-1', schedule_id: 'sch-1', name: 'Site Survey & Geotechnical Analysis', description: 'Topographical survey and soil testing', status: 'completed', priority: 'high', start_date: '2025-06-01', end_date: '2025-06-30', progress_percentage: 100, parent_task_id: 'task-1', dependency: null, dependency_type: null, created_by: '1' },
  { id: 'task-1-2', schedule_id: 'sch-1', name: 'Architectural Drawings & Permits', description: 'Detailed architectural plans and building permit applications', status: 'completed', priority: 'high', start_date: '2025-07-01', end_date: '2025-08-30', progress_percentage: 100, parent_task_id: 'task-1', dependency: null, dependency_type: null, created_by: '1' },
  { id: 'task-2', schedule_id: 'sch-1', name: 'Phase 2: Foundation & Structure', description: 'Foundation work and structural framework', status: 'in_progress', priority: 'urgent', start_date: '2025-09-01', end_date: '2026-06-30', progress_percentage: 35, parent_task_id: null, dependency: 'task-1', dependency_type: 'FS', created_by: '1' },
  { id: 'task-2-1', schedule_id: 'sch-1', name: 'Excavation & Foundation', description: 'Deep excavation and foundation laying', status: 'completed', priority: 'urgent', start_date: '2025-09-01', end_date: '2025-12-31', progress_percentage: 100, parent_task_id: 'task-2', dependency: null, dependency_type: null, created_by: '1' },
  { id: 'task-2-2', schedule_id: 'sch-1', name: 'Steel Framework (Floors 1-6)', description: 'Erecting steel columns and beams for lower floors', status: 'in_progress', priority: 'high', start_date: '2026-01-01', end_date: '2026-06-30', progress_percentage: 40, parent_task_id: 'task-2', dependency: 'task-2-1', dependency_type: 'FS', created_by: '1' },
  { id: 'task-3', schedule_id: 'sch-1', name: 'Phase 3: Exterior & Interior', description: 'Building envelope and interior finishing', status: 'pending', priority: 'high', start_date: '2026-07-01', end_date: '2027-09-30', progress_percentage: 0, parent_task_id: null, dependency: 'task-2', dependency_type: 'FS', created_by: '1' },
  { id: 'task-4', schedule_id: 'sch-1', name: 'Phase 4: Final Inspection & Handover', description: 'Quality inspection and project completion', status: 'pending', priority: 'high', start_date: '2027-10-01', end_date: '2027-12-31', progress_percentage: 0, parent_task_id: null, dependency: 'task-3', dependency_type: 'FS', created_by: '1' },

  // --- Cloud Migration tasks (sch-2) ---
  { id: 'task-c1', schedule_id: 'sch-2', name: 'Assessment & Planning', description: 'Audit existing infrastructure and design cloud architecture', status: 'completed', priority: 'high', start_date: '2026-01-15', end_date: '2026-02-28', progress_percentage: 100, parent_task_id: null, dependency: null, dependency_type: null, created_by: '1' },
  { id: 'task-c1-1', schedule_id: 'sch-2', name: 'Infrastructure Audit', description: 'Inventory all servers, databases, and services', status: 'completed', priority: 'high', start_date: '2026-01-15', end_date: '2026-02-07', progress_percentage: 100, parent_task_id: 'task-c1', dependency: null, dependency_type: null, created_by: '1' },
  { id: 'task-c1-2', schedule_id: 'sch-2', name: 'AWS Architecture Design', description: 'Design target cloud architecture with VPC, subnets, and security groups', status: 'completed', priority: 'high', start_date: '2026-02-08', end_date: '2026-02-28', progress_percentage: 100, parent_task_id: 'task-c1', dependency: 'task-c1-1', dependency_type: 'FS', created_by: '1' },
  { id: 'task-c2', schedule_id: 'sch-2', name: 'Database Migration', description: 'Migrate databases to RDS/Aurora', status: 'in_progress', priority: 'urgent', start_date: '2026-03-01', end_date: '2026-05-31', progress_percentage: 30, parent_task_id: null, dependency: 'task-c1', dependency_type: 'FS', created_by: '1' },
  { id: 'task-c3', schedule_id: 'sch-2', name: 'Application Migration', description: 'Containerize and deploy applications to ECS/EKS', status: 'pending', priority: 'high', start_date: '2026-06-01', end_date: '2026-09-30', progress_percentage: 0, parent_task_id: null, dependency: 'task-c2', dependency_type: 'FS', created_by: '1' },
  { id: 'task-c4', schedule_id: 'sch-2', name: 'Testing & Cutover', description: 'Integration testing, performance testing, and final cutover', status: 'pending', priority: 'high', start_date: '2026-10-01', end_date: '2026-12-31', progress_percentage: 0, parent_task_id: null, dependency: 'task-c3', dependency_type: 'FS', created_by: '1' },

  // --- Highway Expansion tasks (sch-3) ---
  { id: 'task-h1', schedule_id: 'sch-3', name: 'Environmental & Permits', description: 'Environmental impact assessment and permit acquisition', status: 'in_progress', priority: 'high', start_date: '2026-03-01', end_date: '2026-08-31', progress_percentage: 45, parent_task_id: null, dependency: null, dependency_type: null, created_by: '1' },
  { id: 'task-h1-1', schedule_id: 'sch-3', name: 'Environmental Impact Study', description: 'Complete EIS per federal requirements', status: 'in_progress', priority: 'high', start_date: '2026-03-01', end_date: '2026-06-30', progress_percentage: 60, parent_task_id: 'task-h1', dependency: null, dependency_type: null, created_by: '1' },
  { id: 'task-h1-2', schedule_id: 'sch-3', name: 'Right-of-Way Acquisition', description: 'Acquire additional land parcels for highway widening', status: 'pending', priority: 'high', start_date: '2026-05-01', end_date: '2026-08-31', progress_percentage: 0, parent_task_id: 'task-h1', dependency: null, dependency_type: null, created_by: '1' },
  { id: 'task-h2', schedule_id: 'sch-3', name: 'Utility Relocation', description: 'Relocate underground utilities and overhead lines', status: 'pending', priority: 'medium', start_date: '2026-09-01', end_date: '2027-02-28', progress_percentage: 0, parent_task_id: null, dependency: 'task-h1', dependency_type: 'FS', created_by: '1' },
  { id: 'task-h3', schedule_id: 'sch-3', name: 'Earthwork & Grading', description: 'Major earthmoving and road grading operations', status: 'pending', priority: 'high', start_date: '2027-03-01', end_date: '2027-10-31', progress_percentage: 0, parent_task_id: null, dependency: 'task-h2', dependency_type: 'FS', created_by: '1' },
  { id: 'task-h4', schedule_id: 'sch-3', name: 'Paving & Finishing', description: 'Road paving, lane markings, signage, and barriers', status: 'pending', priority: 'high', start_date: '2027-11-01', end_date: '2028-06-30', progress_percentage: 0, parent_task_id: null, dependency: 'task-h3', dependency_type: 'FS', created_by: '1' },
];

const RESOURCES = [
  { id: 'res-1', name: 'Alice Chen', role: 'Project Manager', email: 'alice.chen@example.com', capacity_hours_per_week: 40, skills: JSON.stringify(['Planning', 'Scheduling', 'Risk Management']), is_active: true },
  { id: 'res-2', name: 'Bob Martinez', role: 'Lead Engineer', email: 'bob.martinez@example.com', capacity_hours_per_week: 40, skills: JSON.stringify(['Structural Engineering', 'Design', 'Inspection']), is_active: true },
  { id: 'res-3', name: 'Carol Davis', role: 'Site Supervisor', email: 'carol.davis@example.com', capacity_hours_per_week: 45, skills: JSON.stringify(['Construction', 'Safety', 'Equipment']), is_active: true },
  { id: 'res-4', name: 'David Kim', role: 'Software Developer', email: 'david.kim@example.com', capacity_hours_per_week: 40, skills: JSON.stringify(['AWS', 'Docker', 'Node.js', 'React']), is_active: true },
  { id: 'res-5', name: 'Emily Johnson', role: 'QA Engineer', email: 'emily.j@example.com', capacity_hours_per_week: 40, skills: JSON.stringify(['Testing', 'Automation', 'Performance Testing']), is_active: true },
];

const RESOURCE_ASSIGNMENTS = [
  { id: 'asgn-1', resource_id: 'res-1', task_id: 'task-2', schedule_id: 'sch-1', hours_per_week: 20, start_date: '2025-09-01', end_date: '2026-06-30' },
  { id: 'asgn-2', resource_id: 'res-2', task_id: 'task-2-2', schedule_id: 'sch-1', hours_per_week: 35, start_date: '2026-01-01', end_date: '2026-06-30' },
  { id: 'asgn-3', resource_id: 'res-3', task_id: 'task-2-1', schedule_id: 'sch-1', hours_per_week: 40, start_date: '2025-09-01', end_date: '2025-12-31' },
  { id: 'asgn-4', resource_id: 'res-3', task_id: 'task-3', schedule_id: 'sch-1', hours_per_week: 45, start_date: '2026-07-01', end_date: '2027-09-30' },
  { id: 'asgn-5', resource_id: 'res-4', task_id: 'task-c2', schedule_id: 'sch-2', hours_per_week: 40, start_date: '2026-03-01', end_date: '2026-05-31' },
  { id: 'asgn-6', resource_id: 'res-4', task_id: 'task-c3', schedule_id: 'sch-2', hours_per_week: 35, start_date: '2026-06-01', end_date: '2026-09-30' },
  { id: 'asgn-7', resource_id: 'res-5', task_id: 'task-c4', schedule_id: 'sch-2', hours_per_week: 40, start_date: '2026-10-01', end_date: '2026-12-31' },
  { id: 'asgn-8', resource_id: 'res-1', task_id: 'task-c1', schedule_id: 'sch-2', hours_per_week: 15, start_date: '2026-01-15', end_date: '2026-02-28' },
  { id: 'asgn-9', resource_id: 'res-2', task_id: 'task-h2', schedule_id: 'sch-3', hours_per_week: 20, start_date: '2026-09-01', end_date: '2027-02-28' },
];

const WORKFLOW_RULES = [
  {
    id: 'wf-1',
    name: 'Auto-complete on 100% progress',
    description: 'When a task reaches 100% progress, automatically set status to completed',
    enabled: true,
    trigger_config: JSON.stringify({ type: 'progress_threshold', progressThreshold: 100, progressDirection: 'above' }),
    action_config: JSON.stringify({ type: 'update_field', field: 'status', value: 'completed' }),
  },
  {
    id: 'wf-2',
    name: 'Log when task starts',
    description: 'Log activity when a task moves to in_progress',
    enabled: true,
    trigger_config: JSON.stringify({ type: 'status_change', toStatus: 'in_progress' }),
    action_config: JSON.stringify({ type: 'log_activity', message: 'Task work has started' }),
  },
  {
    id: 'wf-3',
    name: 'Notify on cancellation',
    description: 'Send notification when a task is cancelled',
    enabled: false,
    trigger_config: JSON.stringify({ type: 'status_change', toStatus: 'cancelled' }),
    action_config: JSON.stringify({ type: 'send_notification', message: 'A task has been cancelled' }),
  },
];

// Note: project_templates are NOT seeded here because the 10 built-in templates
// are defined in TemplateService.ts and are quite large. They remain in-memory only
// unless the user creates custom templates (which then get saved to DB).
// In a full production migration we'd seed them, but for now the in-memory fallback handles it.

// ---------------------------------------------------------------------------
// Helper: bulk insert
// ---------------------------------------------------------------------------

async function bulkInsert(
  conn: mysql.PoolConnection,
  table: string,
  rows: Record<string, any>[],
): Promise<void> {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  for (const row of rows) {
    const values = columns.map((col) => row[col] ?? null);
    await conn.execute(sql, values);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  console.log('Starting database seed...');
  console.log(`Connecting to ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);

  const pool = mysql.createPool({ ...DB_CONFIG, connectionLimit: 1 });
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Disable FK checks just in case and truncate all tables
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'workflow_executions', 'resource_assignments', 'task_activities', 'task_comments',
      'meeting_analyses', 'reschedule_proposals', 'baselines', 'tasks',
      'patterns', 'lessons_learned', 'schedules', 'project_members',
      'audit_events', 'chat_conversations', 'projects',
      'user_portfolio_assignments', 'portfolios',
      'workflow_rules', 'resources', 'project_templates', 'users',
    ];

    for (const table of tables) {
      await conn.execute(`TRUNCATE TABLE ${table}`);
    }

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Insert in dependency order
    console.log('  Seeding users...');
    await bulkInsert(conn, 'users', USERS);

    console.log('  Seeding portfolios...');
    await bulkInsert(conn, 'portfolios', PORTFOLIOS);

    console.log('  Seeding user_portfolio_assignments...');
    await bulkInsert(conn, 'user_portfolio_assignments', USER_PORTFOLIO_ASSIGNMENTS);

    console.log('  Seeding projects...');
    await bulkInsert(conn, 'projects', PROJECTS);

    console.log('  Seeding project_members...');
    await bulkInsert(conn, 'project_members', PROJECT_MEMBERS);

    console.log('  Seeding schedules...');
    await bulkInsert(conn, 'schedules', SCHEDULES);

    console.log('  Seeding tasks...');
    await bulkInsert(conn, 'tasks', TASKS);

    console.log('  Seeding resources...');
    await bulkInsert(conn, 'resources', RESOURCES);

    console.log('  Seeding resource_assignments...');
    await bulkInsert(conn, 'resource_assignments', RESOURCE_ASSIGNMENTS);

    console.log('  Seeding workflow_rules...');
    await bulkInsert(conn, 'workflow_rules', WORKFLOW_RULES);

    await conn.commit();

    console.log('\nSeed complete:');
    console.log(`  ${USERS.length} users`);
    console.log(`  ${PORTFOLIOS.length} portfolios`);
    console.log(`  ${USER_PORTFOLIO_ASSIGNMENTS.length} portfolio assignments`);
    console.log(`  ${PROJECTS.length} projects`);
    console.log(`  ${PROJECT_MEMBERS.length} project members`);
    console.log(`  ${SCHEDULES.length} schedules`);
    console.log(`  ${TASKS.length} tasks`);
    console.log(`  ${RESOURCES.length} resources`);
    console.log(`  ${RESOURCE_ASSIGNMENTS.length} resource assignments`);
    console.log(`  ${WORKFLOW_RULES.length} workflow rules`);
  } catch (err) {
    await conn.rollback();
    console.error('\nSeed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();
