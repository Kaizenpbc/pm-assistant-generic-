import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'admin' | 'executive' | 'manager' | 'member';
  isActive: boolean;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  stripeCustomerId: string | null;
  subscriptionTier: 'free' | 'pro' | 'business';
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'none';
  trialEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role?: 'admin' | 'executive' | 'manager' | 'member';
  emailVerified?: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  stripeCustomerId?: string;
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    role: row.role,
    isActive: Boolean(row.is_active),
    emailVerified: Boolean(row.email_verified),
    emailVerificationToken: row.email_verification_token,
    emailVerificationExpires: row.email_verification_expires,
    passwordResetToken: row.password_reset_token,
    passwordResetExpires: row.password_reset_expires,
    stripeCustomerId: row.stripe_customer_id,
    subscriptionTier: row.subscription_tier || 'free',
    subscriptionStatus: row.subscription_status || 'none',
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserService {
  async findById(id: string): Promise<User | null> {
    const rows = await databaseService.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows.length > 0 ? rowToUser(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const rows = await databaseService.query('SELECT * FROM users WHERE username = ?', [username]);
    return rows.length > 0 ? rowToUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await databaseService.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows.length > 0 ? rowToUser(rows[0]) : null;
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    const rows = await databaseService.query(
      'SELECT * FROM users WHERE email_verification_token = ? AND email_verification_expires > NOW()',
      [token]
    );
    return rows.length > 0 ? rowToUser(rows[0]) : null;
  }

  async findByResetToken(token: string): Promise<User | null> {
    const rows = await databaseService.query(
      'SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()',
      [token]
    );
    return rows.length > 0 ? rowToUser(rows[0]) : null;
  }

  async findByStripeCustomerId(customerId: string): Promise<User | null> {
    const rows = await databaseService.query('SELECT * FROM users WHERE stripe_customer_id = ?', [customerId]);
    return rows.length > 0 ? rowToUser(rows[0]) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, email_verified, email_verification_token, email_verification_expires, stripe_customer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.username,
        data.email,
        data.passwordHash,
        data.fullName,
        data.role || 'member',
        true,
        data.emailVerified ?? false,
        data.emailVerificationToken || null,
        data.emailVerificationExpires || null,
        data.stripeCustomerId || null,
      ]
    );
    return (await this.findById(id))!;
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    const columnMap: Record<string, string> = {
      username: 'username',
      email: 'email',
      passwordHash: 'password_hash',
      fullName: 'full_name',
      role: 'role',
      isActive: 'is_active',
      emailVerified: 'email_verified',
      emailVerificationToken: 'email_verification_token',
      emailVerificationExpires: 'email_verification_expires',
      passwordResetToken: 'password_reset_token',
      passwordResetExpires: 'password_reset_expires',
      stripeCustomerId: 'stripe_customer_id',
      subscriptionTier: 'subscription_tier',
      subscriptionStatus: 'subscription_status',
      trialEndsAt: 'trial_ends_at',
    };

    for (const [key, column] of Object.entries(columnMap)) {
      if (key in data) {
        fields.push(`${column} = ?`);
        values.push((data as any)[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await databaseService.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result: any = await databaseService.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  async list(): Promise<User[]> {
    const rows = await databaseService.query('SELECT * FROM users ORDER BY created_at DESC');
    return rows.map(rowToUser);
  }
}
