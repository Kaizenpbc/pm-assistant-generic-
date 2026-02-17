import { randomUUID } from 'crypto';

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

/**
 * Default admin seed — uses ADMIN_PASSWORD env var when set.
 * Falls back to a dev-only hash ('admin123') in development/test mode.
 * In production without ADMIN_PASSWORD, no seed admin is created.
 */
function buildSeedUsers(): User[] {
  const env = process.env['NODE_ENV'] || 'development';
  const adminPassword = process.env['ADMIN_PASSWORD'];

  let hash: string | null = null;

  if (adminPassword) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcryptjs');
    hash = bcrypt.hashSync(adminPassword, 12);
  } else if (env === 'development' || env === 'test') {
    // ONLY in dev/test — never ship a known hash to production
    hash = '$2b$12$57JV8D4fZCCQPwL7gmJ6n.ar5spwtsb2aYjgfiKho8C9KJh8bFrcW'; // admin123
  }

  if (!hash) return [];

  return [{
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    passwordHash: hash,
    fullName: 'Administrator',
    role: 'admin' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }];
}

export class UserService {
  private static users: User[] = buildSeedUsers();

  private get users() { return UserService.users; }

  async findById(id: string): Promise<User | null> {
    return this.users.find(user => user.id === id) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const normalized = username.toLowerCase();
    return this.users.find(user => user.username.toLowerCase() === normalized) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    return this.users.find(user => user.email.toLowerCase() === normalized) || null;
  }

  async create(data: CreateUserData): Promise<User> {
    const user: User = {
      id: randomUUID(),
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      role: data.role || 'member',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    UserService.users.push(user);
    return user;
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | null> {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return null;
    UserService.users[userIndex] = { ...this.users[userIndex], ...data, updatedAt: new Date() };
    return UserService.users[userIndex];
  }

  async delete(id: string): Promise<boolean> {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return false;
    UserService.users.splice(userIndex, 1);
    return true;
  }

  async list(): Promise<User[]> {
    return this.users;
  }
}
