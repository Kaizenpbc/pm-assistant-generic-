import { databaseService } from './connection';
import { runTenantMigrations } from './tenantMigrationRunner';
import { organizationRepository } from './OrganizationRepository';
import logger from '../utils/logger';

export async function provisionTenantDatabase(orgId: string): Promise<void> {
  const org = await organizationRepository.findById(orgId);
  if (!org) throw new Error(`Organization ${orgId} not found`);
  if (org.isProvisioned) {
    logger.info(`[provisioner] Tenant ${org.slug} already provisioned — skipping`);
    return;
  }

  const dbName = org.dbName;
  logger.info(`[provisioner] Provisioning tenant database: ${dbName}`);

  const pool = databaseService.getPool();
  if (!pool) throw new Error('Database pool not initialized');

  const conn = await pool.getConnection();
  try {
    // Create the tenant database
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    logger.info(`[provisioner] Created database ${dbName}`);
  } finally {
    conn.release();
  }

  // Run tenant baseline migration
  await runTenantMigrations(dbName);

  // Mark as provisioned
  await organizationRepository.update(orgId, { isProvisioned: true });
  logger.info(`[provisioner] Tenant ${org.slug} provisioned successfully`);
}
