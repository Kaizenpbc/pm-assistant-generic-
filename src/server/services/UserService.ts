import { databaseService } from '../database/connection';
import { toCamelCaseKeys } from '../utils/caseConverter';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'admin' | 'executive' | 'manager' | 'member';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role?: 'admin' | 'executive' | 'manager' | 'member';
}

export class UserService {
  private static users: User[] = [
    {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: '$2b$12$57JV8D4fZCCQPwL7gmJ6n.ar5spwtsb2aYjgfiKho8C9KJh8bFrcW', // admin123
      fullName: 'Administrator',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  private get users() { return UserService.users; }
  private get useDb() { return databaseService.isHealthy(); }

  private rowToUser(row: any): User {
    const camel = toCamelCaseKeys(row);
    return {
      ...camel,
      isActive: Boolean(camel.isActive),
      createdAt: new Date(camel.createdAt),
      updatedAt: new Date(camel.updatedAt),
    } as User;
  }

  async findById(id: string): Promise<User | null> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM users WHERE id = ?', [id]);
      return rows.length > 0 ? this.rowToUser(rows[0]) : null;
    }
    return this.users.find(user => user.id === id) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM users WHERE username = ?', [username]);
      return rows.length > 0 ? this.rowToUser(rows[0]) : null;
    }
    return this.users.find(user => user.username === username) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM users WHERE email = ?', [email]);
      return rows.length > 0 ? this.rowToUser(rows[0]) : null;
    }
    return this.users.find(user => user.email === email) || null;
  }

  async create(data: CreateUserData): Promise<User> {
    const id = Math.random().toString(36).substr(2, 9);
    const now = new Date();
    const role = data.role || 'member';

    if (this.useDb) {
      await databaseService.query(
        `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.username, data.email, data.passwordHash, data.fullName, role, true, now, now],
      );
      return { id, username: data.username, email: data.email, passwordHash: data.passwordHash, fullName: data.fullName, role, isActive: true, createdAt: now, updatedAt: now };
    }

    const user: User = { id, username: data.username, email: data.email, passwordHash: data.passwordHash, fullName: data.fullName, role, isActive: true, createdAt: now, updatedAt: now };
    UserService.users.push(user);
    return user;
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | null> {
    if (this.useDb) {
      const setClauses: string[] = [];
      const values: any[] = [];
      const fieldMap: Record<string, string> = { username: 'username', email: 'email', passwordHash: 'password_hash', fullName: 'full_name', role: 'role', isActive: 'is_active' };
      for (const [key, col] of Object.entries(fieldMap)) {
        if ((data as any)[key] !== undefined) {
          setClauses.push(`${col} = ?`);
          values.push((data as any)[key]);
        }
      }
      if (setClauses.length === 0) return this.findById(id);
      setClauses.push('updated_at = ?');
      values.push(new Date());
      values.push(id);
      await databaseService.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`, values);
      return this.findById(id);
    }

    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return null;
    UserService.users[userIndex] = { ...this.users[userIndex], ...data, updatedAt: new Date() };
    return UserService.users[userIndex];
  }

  async delete(id: string): Promise<boolean> {
    if (this.useDb) {
      await databaseService.query('DELETE FROM users WHERE id = ?', [id]);
      return true;
    }
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return false;
    UserService.users.splice(userIndex, 1);
    return true;
  }

  async list(): Promise<User[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM users');
      return rows.map((r: any) => this.rowToUser(r));
    }
    return this.users;
  }
}
