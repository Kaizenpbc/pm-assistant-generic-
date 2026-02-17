/**
 * Database Seed Script
 *
 * Usage:
 *   npx tsx src/server/database/seed.ts          # Seed with demo data
 *   npx tsx src/server/database/seed.ts --clean   # Truncate all tables then seed
 *
 * Populates the database with demo data matching the in-memory seed data
 * from the service files. Idempotent — uses INSERT IGNORE to skip existing rows.
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const dbConfig = {
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '3306', 10),
  user: process.env['DB_USER'] || 'root',
  password: process.env['DB_PASSWORD'] || 'rootpassword',
  database: process.env['DB_NAME'] || 'pm_assistant_generic',
  multipleStatements: true,
};

// ============================================================================
// Seed Data
// ============================================================================

function buildUsers() {
  const adminHash = bcrypt.hashSync(process.env['ADMIN_PASSWORD'] || 'admin123', 12);
  return [
    { id: '1', username: 'admin', email: 'admin@example.com', password_hash: adminHash, full_name: 'Administrator', role: 'admin' },
  ];
}

const PROJECTS = [
  {
    id: '1', name: 'Cloud Migration Project',
    description: 'Migrate on-premise infrastructure to AWS cloud services',
    category: 'technology', project_type: 'it', status: 'active', priority: 'high',
    budget_allocated: 500000, budget_spent: 175000, currency: 'USD',
    location: 'New York, NY', location_lat: 40.71, location_lon: -74.01,
    start_date: '2026-01-15', end_date: '2026-12-31', created_by: '1',
  },
  {
    id: '2', name: 'Highway 101 Expansion',
    description: 'Widen Highway 101 from 4 to 6 lanes between Exit 12 and Exit 18',
    category: 'transportation', project_type: 'roads', status: 'planning', priority: 'high',
    budget_allocated: 8000000, budget_spent: 1200000, currency: 'USD',
    location: 'San Jose, CA', location_lat: 37.34, location_lon: -121.89,
    start_date: '2026-03-01', end_date: '2028-06-30', created_by: '1',
  },
  {
    id: '3', name: 'Downtown Office Complex',
    description: 'Construction of a 12-story mixed-use office and retail building',
    category: 'commercial', project_type: 'construction', status: 'active', priority: 'urgent',
    budget_allocated: 25000000, budget_spent: 8500000, currency: 'USD',
    location: 'Chicago, IL', location_lat: 41.88, location_lon: -87.63,
    start_date: '2025-06-01', end_date: '2027-12-31', created_by: '1',
  },
];

const SCHEDULES = [
  { id: 'sch-1', project_id: '3', name: 'Construction Master Schedule', description: 'Primary construction timeline for Downtown Office Complex', start_date: '2025-06-01', end_date: '2027-12-31', status: 'active', created_by: '1' },
  { id: 'sch-2', project_id: '1', name: 'Cloud Migration Plan', description: 'Phased migration of on-premise systems to AWS', start_date: '2026-01-15', end_date: '2026-12-31', status: 'active', created_by: '1' },
  { id: 'sch-3', project_id: '2', name: 'Highway Expansion Schedule', description: 'Construction timeline for Highway 101 widening project', start_date: '2026-03-01', end_date: '2028-06-30', status: 'pending', created_by: '1' },
];

const TASKS = [
  // Construction (sch-1)
  { id: 'task-1', schedule_id: 'sch-1', name: 'Phase 1: Planning & Design', description: 'Initial planning and architectural design phase', status: 'completed', priority: 'high', start_date: '2025-06-01', end_date: '2025-08-30', progress_percentage: 100, created_by: '1' },
  { id: 'task-1-1', schedule_id: 'sch-1', parent_task_id: 'task-1', name: 'Site Survey & Geotechnical Analysis', description: 'Topographical survey and soil testing', status: 'completed', priority: 'high', start_date: '2025-06-01', end_date: '2025-06-30', progress_percentage: 100, created_by: '1' },
  { id: 'task-1-2', schedule_id: 'sch-1', parent_task_id: 'task-1', name: 'Architectural Drawings & Permits', description: 'Detailed architectural plans and building permit applications', status: 'completed', priority: 'high', start_date: '2025-07-01', end_date: '2025-08-30', progress_percentage: 100, created_by: '1' },
  { id: 'task-2', schedule_id: 'sch-1', name: 'Phase 2: Foundation & Structure', description: 'Foundation work and structural framework', status: 'in_progress', priority: 'urgent', dependency: 'task-1', dependency_type: 'FS', start_date: '2025-09-01', end_date: '2026-06-30', progress_percentage: 35, created_by: '1' },
  { id: 'task-2-1', schedule_id: 'sch-1', parent_task_id: 'task-2', name: 'Excavation & Foundation', description: 'Deep excavation and foundation laying', status: 'completed', priority: 'urgent', start_date: '2025-09-01', end_date: '2025-12-31', progress_percentage: 100, created_by: '1' },
  { id: 'task-2-2', schedule_id: 'sch-1', parent_task_id: 'task-2', name: 'Steel Framework (Floors 1-6)', description: 'Erecting steel columns and beams for lower floors', status: 'in_progress', priority: 'high', dependency: 'task-2-1', dependency_type: 'FS', start_date: '2026-01-01', end_date: '2026-06-30', progress_percentage: 40, created_by: '1' },
  { id: 'task-3', schedule_id: 'sch-1', name: 'Phase 3: Exterior & Interior', description: 'Building envelope and interior finishing', status: 'pending', priority: 'high', dependency: 'task-2', dependency_type: 'FS', start_date: '2026-07-01', end_date: '2027-09-30', progress_percentage: 0, created_by: '1' },
  { id: 'task-4', schedule_id: 'sch-1', name: 'Phase 4: Final Inspection & Handover', description: 'Quality inspection and project completion', status: 'pending', priority: 'high', dependency: 'task-3', dependency_type: 'FS', start_date: '2027-10-01', end_date: '2027-12-31', progress_percentage: 0, created_by: '1' },
  // Cloud Migration (sch-2)
  { id: 'task-c1', schedule_id: 'sch-2', name: 'Assessment & Planning', description: 'Audit existing infrastructure and design cloud architecture', status: 'completed', priority: 'high', start_date: '2026-01-15', end_date: '2026-02-28', progress_percentage: 100, created_by: '1' },
  { id: 'task-c1-1', schedule_id: 'sch-2', parent_task_id: 'task-c1', name: 'Infrastructure Audit', description: 'Inventory all servers, databases, and services', status: 'completed', priority: 'high', start_date: '2026-01-15', end_date: '2026-02-07', progress_percentage: 100, created_by: '1' },
  { id: 'task-c1-2', schedule_id: 'sch-2', parent_task_id: 'task-c1', name: 'AWS Architecture Design', description: 'Design target cloud architecture with VPC, subnets, and security groups', status: 'completed', priority: 'high', dependency: 'task-c1-1', dependency_type: 'FS', start_date: '2026-02-08', end_date: '2026-02-28', progress_percentage: 100, created_by: '1' },
  { id: 'task-c2', schedule_id: 'sch-2', name: 'Database Migration', description: 'Migrate databases to RDS/Aurora', status: 'in_progress', priority: 'urgent', dependency: 'task-c1', dependency_type: 'FS', start_date: '2026-03-01', end_date: '2026-05-31', progress_percentage: 30, created_by: '1' },
  { id: 'task-c3', schedule_id: 'sch-2', name: 'Application Migration', description: 'Containerize and deploy applications to ECS/EKS', status: 'pending', priority: 'high', dependency: 'task-c2', dependency_type: 'FS', start_date: '2026-06-01', end_date: '2026-09-30', progress_percentage: 0, created_by: '1' },
  { id: 'task-c4', schedule_id: 'sch-2', name: 'Testing & Cutover', description: 'Integration testing, performance testing, and final cutover', status: 'pending', priority: 'high', dependency: 'task-c3', dependency_type: 'FS', start_date: '2026-10-01', end_date: '2026-12-31', progress_percentage: 0, created_by: '1' },
  // Highway (sch-3)
  { id: 'task-h1', schedule_id: 'sch-3', name: 'Environmental & Permits', description: 'Environmental impact assessment and permit acquisition', status: 'in_progress', priority: 'high', start_date: '2026-03-01', end_date: '2026-08-31', progress_percentage: 45, created_by: '1' },
  { id: 'task-h1-1', schedule_id: 'sch-3', parent_task_id: 'task-h1', name: 'Environmental Impact Study', description: 'Complete EIS per federal requirements', status: 'in_progress', priority: 'high', start_date: '2026-03-01', end_date: '2026-06-30', progress_percentage: 60, created_by: '1' },
  { id: 'task-h1-2', schedule_id: 'sch-3', parent_task_id: 'task-h1', name: 'Right-of-Way Acquisition', description: 'Acquire additional land parcels for highway widening', status: 'pending', priority: 'high', start_date: '2026-05-01', end_date: '2026-08-31', progress_percentage: 0, created_by: '1' },
  { id: 'task-h2', schedule_id: 'sch-3', name: 'Utility Relocation', description: 'Relocate underground utilities and overhead lines', status: 'pending', priority: 'medium', dependency: 'task-h1', dependency_type: 'FS', start_date: '2026-09-01', end_date: '2027-02-28', progress_percentage: 0, created_by: '1' },
  { id: 'task-h3', schedule_id: 'sch-3', name: 'Earthwork & Grading', description: 'Major earthmoving and road grading operations', status: 'pending', priority: 'high', dependency: 'task-h2', dependency_type: 'FS', start_date: '2027-03-01', end_date: '2027-10-31', progress_percentage: 0, created_by: '1' },
  { id: 'task-h4', schedule_id: 'sch-3', name: 'Paving & Finishing', description: 'Road paving, lane markings, signage, and barriers', status: 'pending', priority: 'high', dependency: 'task-h3', dependency_type: 'FS', start_date: '2027-11-01', end_date: '2028-06-30', progress_percentage: 0, created_by: '1' },
];

const PROJECT_MEMBERS = [
  { id: 'pm-1', project_id: '1', user_id: '1', user_name: 'Admin User', email: 'admin@example.com', role: 'owner' },
  { id: 'pm-2', project_id: '2', user_id: '1', user_name: 'Admin User', email: 'admin@example.com', role: 'owner' },
  { id: 'pm-3', project_id: '3', user_id: '1', user_name: 'Admin User', email: 'admin@example.com', role: 'owner' },
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

// ============================================================================
// Insert Helpers
// ============================================================================

async function insertRow(
  pool: mysql.Pool,
  table: string,
  row: Record<string, any>,
): Promise<void> {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT IGNORE INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;
  await pool.execute(sql, cols.map(c => row[c] ?? null));
}

async function insertRows(
  pool: mysql.Pool,
  table: string,
  rows: Record<string, any>[],
): Promise<void> {
  for (const row of rows) {
    await insertRow(pool, table, row);
  }
  console.log(`  [OK] ${table}: ${rows.length} row(s)`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isClean = args.includes('--clean');

  const pool = mysql.createPool(dbConfig);

  try {
    if (isClean) {
      console.log('\nCleaning tables before seeding...\n');
      const tables = [
        'resource_assignments', 'resource_assignments',
        'task_activities', 'task_comments',
        'reschedule_proposals', 'baselines',
        'workflow_executions', 'workflow_rules',
        'meeting_analyses', 'lessons_learned',
        'ai_accuracy_tracking', 'ai_feedback', 'ai_usage_log', 'ai_conversations',
        'project_members', 'tasks', 'schedules',
        'resources', 'templates',
        'projects', 'users',
      ];
      await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of tables) {
        try {
          await pool.execute(`TRUNCATE TABLE \`${table}\``);
        } catch { /* table may not exist */ }
      }
      await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
      console.log('  Tables truncated.\n');
    }

    console.log('Seeding database...\n');

    await insertRows(pool, 'users', buildUsers());
    await insertRows(pool, 'projects', PROJECTS);
    await insertRows(pool, 'schedules', SCHEDULES);
    await insertRows(pool, 'tasks', TASKS);
    await insertRows(pool, 'project_members', PROJECT_MEMBERS);
    await insertRows(pool, 'resources', RESOURCES);
    await insertRows(pool, 'resource_assignments', RESOURCE_ASSIGNMENTS);

    console.log('\nDone.\n');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
