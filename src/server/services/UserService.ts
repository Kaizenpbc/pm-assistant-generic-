import { userRepository } from '../database/UserRepository';

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
  emailNotificationsEnabled: boolean;
  digestFrequency: 'none' | 'daily' | 'weekly';
  digestLastSentAt: Date | null;
  lastLoginAt: Date | null;
  timezone: string;
  locale: string;
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

export class UserService {
  async findById(id: string): Promise<User | null> {
    return userRepository.findById(id);
  }

  async findByUsername(username: string): Promise<User | null> {
    return userRepository.findByUsername(username);
  }

  async findByEmail(email: string): Promise<User | null> {
    return userRepository.findByEmail(email);
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return userRepository.findByVerificationToken(token);
  }

  async findByResetToken(token: string): Promise<User | null> {
    return userRepository.findByResetToken(token);
  }

  async findByStripeCustomerId(customerId: string): Promise<User | null> {
    return userRepository.findByStripeCustomerId(customerId);
  }

  async create(data: CreateUserData): Promise<User> {
    return userRepository.create(data);
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | null> {
    return userRepository.update(id, data as Record<string, any>);
  }

  async delete(id: string): Promise<boolean> {
    return userRepository.deleteById(id);
  }

  async list(): Promise<User[]> {
    return userRepository.list();
  }
}

export const userService = new UserService();
