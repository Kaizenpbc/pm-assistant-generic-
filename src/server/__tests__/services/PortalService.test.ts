import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/PortalRepository', () => {
  const mockRepo = {
    insertLink: vi.fn(),
    findLinksByProject: vi.fn().mockResolvedValue([]),
    findLinkById: vi.fn().mockResolvedValue(null),
    updateLink: vi.fn(),
    deactivateLink: vi.fn(),
    deleteLink: vi.fn(),
    validateToken: vi.fn().mockResolvedValue(null),
    getProjectInfo: vi.fn().mockResolvedValue(null),
    getTaskStats: vi.fn().mockResolvedValue([]),
    getTimeline: vi.fn().mockResolvedValue({ min_start: null, max_end: null }),
    insertComment: vi.fn(),
    findComments: vi.fn().mockResolvedValue([]),
  };
  return { portalRepository: mockRepo };
});

import { portalService } from '../../services/PortalService';
import { portalRepository } from '../../database/PortalRepository';

const mockRepo = portalRepository as any;

const sampleLink = {
  id: 'link-1',
  projectId: 'proj-1',
  token: 'abc123token',
  label: 'Stakeholder view',
  permissions: { viewTasks: true, addComments: true },
  expiresAt: '2026-12-31T23:59:59Z',
  isActive: true,
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
};

const sampleComment = {
  id: 'comment-1',
  portalLinkId: 'link-1',
  projectId: 'proj-1',
  entityType: 'task',
  entityId: 'task-1',
  authorName: 'Jane Doe',
  content: 'Looks good!',
  createdAt: '2026-01-02T00:00:00Z',
};

describe('PortalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLink', () => {
    it('creates a link with generated id and token', async () => {
      mockRepo.insertLink.mockResolvedValueOnce(sampleLink);

      const result = await portalService.createLink(
        'proj-1',
        { viewTasks: true },
        'user-1',
        'Stakeholder view',
        '2026-12-31T23:59:59Z',
      );

      expect(mockRepo.insertLink).toHaveBeenCalledWith(
        expect.any(String),    // generated uuid
        'proj-1',
        expect.any(String),    // generated token (64 hex chars)
        'Stakeholder view',
        { viewTasks: true },
        '2026-12-31T23:59:59Z',
        'user-1',
      );
      expect(result).toEqual(sampleLink);
    });

    it('passes null for optional label and expiresAt when not provided', async () => {
      mockRepo.insertLink.mockResolvedValueOnce(sampleLink);

      await portalService.createLink('proj-1', { viewTasks: true }, 'user-1');

      expect(mockRepo.insertLink).toHaveBeenCalledWith(
        expect.any(String),
        'proj-1',
        expect.any(String),
        null,   // label defaults to null
        { viewTasks: true },
        null,   // expiresAt defaults to null
        'user-1',
      );
    });

    it('generates a 64-character hex token', async () => {
      mockRepo.insertLink.mockResolvedValueOnce(sampleLink);

      await portalService.createLink('proj-1', {}, 'user-1');

      const token = mockRepo.insertLink.mock.calls[0][2];
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('getLinks', () => {
    it('returns links for a project', async () => {
      mockRepo.findLinksByProject.mockResolvedValueOnce([sampleLink]);

      const result = await portalService.getLinks('proj-1');

      expect(mockRepo.findLinksByProject).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual([sampleLink]);
    });

    it('returns empty array when no links exist', async () => {
      const result = await portalService.getLinks('proj-none');
      expect(result).toEqual([]);
    });
  });

  describe('updateLink', () => {
    it('updates label only', async () => {
      mockRepo.findLinkById.mockResolvedValueOnce({ ...sampleLink, label: 'New label' });

      const result = await portalService.updateLink('link-1', { label: 'New label' });

      expect(mockRepo.updateLink).toHaveBeenCalledWith(
        'link-1',
        ['label = ?'],
        ['New label'],
      );
      expect(result.label).toBe('New label');
    });

    it('updates permissions with JSON stringified value', async () => {
      const newPerms = { viewTasks: true, addComments: false };
      mockRepo.findLinkById.mockResolvedValueOnce({ ...sampleLink, permissions: newPerms });

      await portalService.updateLink('link-1', { permissions: newPerms });

      expect(mockRepo.updateLink).toHaveBeenCalledWith(
        'link-1',
        ['permissions = ?'],
        [JSON.stringify(newPerms)],
      );
    });

    it('updates isActive', async () => {
      mockRepo.findLinkById.mockResolvedValueOnce({ ...sampleLink, isActive: false });

      await portalService.updateLink('link-1', { isActive: false });

      expect(mockRepo.updateLink).toHaveBeenCalledWith(
        'link-1',
        ['is_active = ?'],
        [false],
      );
    });

    it('updates expiresAt', async () => {
      mockRepo.findLinkById.mockResolvedValueOnce({ ...sampleLink, expiresAt: '2027-01-01' });

      await portalService.updateLink('link-1', { expiresAt: '2027-01-01' });

      expect(mockRepo.updateLink).toHaveBeenCalledWith(
        'link-1',
        ['expires_at = ?'],
        ['2027-01-01'],
      );
    });

    it('updates multiple fields at once', async () => {
      mockRepo.findLinkById.mockResolvedValueOnce({
        ...sampleLink,
        label: 'Updated',
        isActive: false,
      });

      await portalService.updateLink('link-1', { label: 'Updated', isActive: false });

      expect(mockRepo.updateLink).toHaveBeenCalledWith(
        'link-1',
        ['label = ?', 'is_active = ?'],
        ['Updated', false],
      );
    });

    it('handles expiresAt set to null', async () => {
      mockRepo.findLinkById.mockResolvedValueOnce({ ...sampleLink, expiresAt: null });

      await portalService.updateLink('link-1', { expiresAt: null });

      expect(mockRepo.updateLink).toHaveBeenCalledWith(
        'link-1',
        ['expires_at = ?'],
        [null],
      );
    });

    it('calls updateLink with empty sets when no data fields provided', async () => {
      mockRepo.findLinkById.mockResolvedValueOnce(sampleLink);

      await portalService.updateLink('link-1', {});

      expect(mockRepo.updateLink).toHaveBeenCalledWith('link-1', [], []);
    });
  });

  describe('deactivateLink', () => {
    it('delegates to repository', async () => {
      await portalService.deactivateLink('link-1');
      expect(mockRepo.deactivateLink).toHaveBeenCalledWith('link-1');
    });
  });

  describe('deleteLink', () => {
    it('delegates to repository', async () => {
      await portalService.deleteLink('link-1');
      expect(mockRepo.deleteLink).toHaveBeenCalledWith('link-1');
    });
  });

  describe('validateToken', () => {
    it('returns link with project info when token is valid', async () => {
      const validatedLink = { ...sampleLink, projectName: 'My Project', projectStatus: 'active' };
      mockRepo.validateToken.mockResolvedValueOnce(validatedLink);

      const result = await portalService.validateToken('abc123token');

      expect(mockRepo.validateToken).toHaveBeenCalledWith('abc123token');
      expect(result).toEqual(validatedLink);
      expect(result!.projectName).toBe('My Project');
    });

    it('returns null for invalid or expired token', async () => {
      const result = await portalService.validateToken('bad-token');
      expect(result).toBeNull();
    });
  });

  describe('getPortalView', () => {
    const validatedLink = {
      ...sampleLink,
      projectName: 'My Project',
      projectStatus: 'active',
    };

    const projectInfo = {
      id: 'proj-1',
      name: 'My Project',
      status: 'active',
      description: 'A cool project',
    };

    it('returns full portal view for a valid token', async () => {
      mockRepo.validateToken.mockResolvedValueOnce(validatedLink);
      mockRepo.getProjectInfo.mockResolvedValueOnce(projectInfo);
      mockRepo.getTaskStats.mockResolvedValueOnce([
        { status: 'completed', count: 5 },
        { status: 'in_progress', count: 3 },
        { status: 'not_started', count: 2 },
      ]);
      mockRepo.getTimeline.mockResolvedValueOnce({
        min_start: '2026-01-01',
        max_end: '2026-06-30',
      });

      const result = await portalService.getPortalView('abc123token');

      expect(result).not.toBeNull();
      expect(result!.project).toEqual(projectInfo);
      expect(result!.taskStats).toEqual({
        total: 10,
        completed: 5,
        inProgress: 3,
        notStarted: 2,
      });
      expect(result!.timeline).toEqual({
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      });
      expect(result!.permissions).toEqual(sampleLink.permissions);
    });

    it('returns null when token is invalid', async () => {
      const result = await portalService.getPortalView('bad-token');

      expect(result).toBeNull();
      expect(mockRepo.getProjectInfo).not.toHaveBeenCalled();
    });

    it('returns null when project is not found', async () => {
      mockRepo.validateToken.mockResolvedValueOnce(validatedLink);
      mockRepo.getProjectInfo.mockResolvedValueOnce(null);

      const result = await portalService.getPortalView('abc123token');

      expect(result).toBeNull();
    });

    it('counts "done" status as completed', async () => {
      mockRepo.validateToken.mockResolvedValueOnce(validatedLink);
      mockRepo.getProjectInfo.mockResolvedValueOnce(projectInfo);
      mockRepo.getTaskStats.mockResolvedValueOnce([
        { status: 'done', count: 4 },
      ]);
      mockRepo.getTimeline.mockResolvedValueOnce({ min_start: null, max_end: null });

      const result = await portalService.getPortalView('abc123token');

      expect(result!.taskStats.completed).toBe(4);
      expect(result!.taskStats.total).toBe(4);
    });

    it('counts "in-progress" (hyphenated) as inProgress', async () => {
      mockRepo.validateToken.mockResolvedValueOnce(validatedLink);
      mockRepo.getProjectInfo.mockResolvedValueOnce(projectInfo);
      mockRepo.getTaskStats.mockResolvedValueOnce([
        { status: 'in-progress', count: 7 },
      ]);
      mockRepo.getTimeline.mockResolvedValueOnce({ min_start: null, max_end: null });

      const result = await portalService.getPortalView('abc123token');

      expect(result!.taskStats.inProgress).toBe(7);
    });

    it('counts unknown statuses as notStarted', async () => {
      mockRepo.validateToken.mockResolvedValueOnce(validatedLink);
      mockRepo.getProjectInfo.mockResolvedValueOnce(projectInfo);
      mockRepo.getTaskStats.mockResolvedValueOnce([
        { status: 'blocked', count: 2 },
        { status: 'pending', count: 1 },
      ]);
      mockRepo.getTimeline.mockResolvedValueOnce({ min_start: null, max_end: null });

      const result = await portalService.getPortalView('abc123token');

      expect(result!.taskStats.notStarted).toBe(3);
      expect(result!.taskStats.total).toBe(3);
    });

    it('handles empty task stats', async () => {
      mockRepo.validateToken.mockResolvedValueOnce(validatedLink);
      mockRepo.getProjectInfo.mockResolvedValueOnce(projectInfo);
      mockRepo.getTaskStats.mockResolvedValueOnce([]);
      mockRepo.getTimeline.mockResolvedValueOnce({ min_start: null, max_end: null });

      const result = await portalService.getPortalView('abc123token');

      expect(result!.taskStats).toEqual({
        total: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
      });
    });

    it('handles null timeline dates', async () => {
      mockRepo.validateToken.mockResolvedValueOnce(validatedLink);
      mockRepo.getProjectInfo.mockResolvedValueOnce(projectInfo);
      mockRepo.getTaskStats.mockResolvedValueOnce([]);
      mockRepo.getTimeline.mockResolvedValueOnce({ min_start: null, max_end: null });

      const result = await portalService.getPortalView('abc123token');

      expect(result!.timeline).toEqual({ startDate: null, endDate: null });
    });
  });

  describe('addComment', () => {
    it('creates a comment with generated id', async () => {
      mockRepo.insertComment.mockResolvedValueOnce(sampleComment);

      const result = await portalService.addComment(
        'link-1', 'proj-1', 'task', 'task-1', 'Jane Doe', 'Looks good!',
      );

      expect(mockRepo.insertComment).toHaveBeenCalledWith(
        expect.any(String),  // generated uuid
        'link-1',
        'proj-1',
        'task',
        'task-1',
        'Jane Doe',
        'Looks good!',
      );
      expect(result).toEqual(sampleComment);
    });
  });

  describe('getComments', () => {
    it('returns comments for a project', async () => {
      mockRepo.findComments.mockResolvedValueOnce([sampleComment]);

      const result = await portalService.getComments('proj-1');

      expect(mockRepo.findComments).toHaveBeenCalledWith('proj-1', undefined, undefined);
      expect(result).toEqual([sampleComment]);
    });

    it('passes entityType filter when provided', async () => {
      mockRepo.findComments.mockResolvedValueOnce([sampleComment]);

      await portalService.getComments('proj-1', 'task');

      expect(mockRepo.findComments).toHaveBeenCalledWith('proj-1', 'task', undefined);
    });

    it('passes entityType and entityId filters when both provided', async () => {
      mockRepo.findComments.mockResolvedValueOnce([sampleComment]);

      await portalService.getComments('proj-1', 'task', 'task-1');

      expect(mockRepo.findComments).toHaveBeenCalledWith('proj-1', 'task', 'task-1');
    });

    it('returns empty array when no comments exist', async () => {
      const result = await portalService.getComments('proj-empty');
      expect(result).toEqual([]);
    });
  });
});
