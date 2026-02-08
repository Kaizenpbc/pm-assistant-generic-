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
  private users: User[] = [
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

  async findById(id: string): Promise<User | null> {
    return this.users.find(user => user.id === id) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.users.find(user => user.username === username) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(user => user.email === email) || null;
  }

  async create(data: CreateUserData): Promise<User> {
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      role: data.role || 'member',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | null> {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return null;
    this.users[userIndex] = { ...this.users[userIndex], ...data, updatedAt: new Date() };
    return this.users[userIndex];
  }

  async delete(id: string): Promise<boolean> {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return false;
    this.users.splice(userIndex, 1);
    return true;
  }

  async list(): Promise<User[]> {
    return this.users;
  }
}
