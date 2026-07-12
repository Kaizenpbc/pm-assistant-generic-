import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    });
  });

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setUser sets user and marks authenticated', () => {
    useAuthStore.getState().setUser({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'team_member',
    });
    const state = useAuthStore.getState();
    expect(state.user?.username).toBe('testuser');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('logout clears user and auth state', () => {
    useAuthStore.getState().setUser({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'admin',
    });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setError stores error and stops loading', () => {
    useAuthStore.getState().setError('Invalid credentials');
    const state = useAuthStore.getState();
    expect(state.error).toBe('Invalid credentials');
    expect(state.isLoading).toBe(false);
  });

  it('clearError removes error', () => {
    useAuthStore.getState().setError('Something failed');
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
