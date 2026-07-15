import { userRepository } from '../database/UserRepository';

export interface NotificationCategoryPref {
  inApp: boolean;
  email: boolean;
}

export type NotificationTypePreferences = Record<string, NotificationCategoryPref>;

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'admin' | 'executive' | 'project_manager' | 'team_member' | 'scrum_master' | 'finance_officer' | 'risk_manager' | 'pmo' | 'ba' | 'qa' | 'tester' | 'devops' | 'claude_sme';
  isActive: boolean;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  stripeCustomerId: string | null;
  subscriptionTier: 'free' | 'pro' | 'business' | 'consultant';
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'none';
  trialEndsAt: Date | null;
  trialStartedAt: Date | null;
  emailNotificationsEnabled: boolean;
  digestFrequency: 'none' | 'daily' | 'weekly';
  digestLastSentAt: Date | null;
  lastLoginAt: Date | null;
  timezone: string;
  locale: string;
  loginVerificationToken: string | null;
  loginVerificationExpires: Date | null;
  notificationTypePreferences: NotificationTypePreferences | null;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role?: 'admin' | 'executive' | 'project_manager' | 'team_member' | 'scrum_master' | 'finance_officer' | 'risk_manager' | 'pmo' | 'ba' | 'qa' | 'tester' | 'devops' | 'claude_sme';
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

  async findByLoginVerificationToken(token: string): Promise<User | null> {
    return userRepository.findByLoginVerificationToken(token);
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

  async listByOrganization(orgId: string): Promise<User[]> {
    return userRepository.listByOrganization(orgId);
  }

  async getAccessibilityPrefs(userId: string): Promise<Record<string, unknown> | null> {
    return userRepository.getAccessibilityPrefs(userId);
  }

  async updateAccessibilityPrefs(userId: string, prefs: Record<string, unknown>): Promise<void> {
    await userRepository.updateAccessibilityPrefs(userId, prefs);
  }
}

export const userService = new UserService();
