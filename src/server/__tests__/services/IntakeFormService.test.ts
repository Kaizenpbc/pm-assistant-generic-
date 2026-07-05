import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/IntakeFormRepository', () => {
  const mockRepo = {
    createForm: vi.fn(),
    findActiveForms: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    updateForm: vi.fn(),
    deleteForm: vi.fn(),
    createSubmission: vi.fn(),
    findSubmissions: vi.fn().mockResolvedValue([]),
    findSubmissionById: vi.fn().mockResolvedValue(null),
    reviewSubmission: vi.fn(),
    markConverted: vi.fn(),
  };
  return { intakeFormRepository: mockRepo };
});

vi.mock('../../services/ProjectService', () => {
  const mockProjectService = {
    create: vi.fn(),
  };
  return { projectService: mockProjectService, Project: {} };
});

import { intakeFormService } from '../../services/IntakeFormService';
import { intakeFormRepository } from '../../database/IntakeFormRepository';
import { projectService } from '../../services/ProjectService';
import type { IntakeForm, IntakeSubmission, IntakeFormField } from '../../services/IntakeFormService';

const mockRepo = intakeFormRepository as any;
const mockProjectService = projectService as any;

const sampleFields: IntakeFormField[] = [
  { id: 'f1', label: 'Project Name', type: 'text', required: true },
  { id: 'f2', label: 'Description', type: 'textarea', required: false },
  { id: 'f3', label: 'Priority', type: 'select', required: true, options: ['High', 'Medium', 'Low'] },
];

const sampleForm: IntakeForm = {
  id: 'form-1',
  name: 'Project Request',
  description: 'Standard project intake form',
  fields: sampleFields,
  isActive: true,
  createdBy: 'user-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const sampleSubmission: IntakeSubmission = {
  id: 'sub-1',
  formId: 'form-1',
  submittedBy: 'user-2',
  valuesJson: { f1: 'My New Project', f2: 'A great project', f3: 'High' },
  status: 'submitted',
  reviewerId: null,
  reviewNotes: null,
  convertedProjectId: null,
  createdAt: '2026-01-02',
  updatedAt: '2026-01-02',
  formName: 'Project Request',
  submitterName: 'Jane Doe',
};

describe('IntakeFormService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Form CRUD ---

  describe('createForm', () => {
    it('delegates to repository with correct arguments', async () => {
      mockRepo.createForm.mockResolvedValueOnce(sampleForm);
      const data = { name: 'Project Request', description: 'Standard form', fields: sampleFields };
      const result = await intakeFormService.createForm(data, 'user-1');
      expect(mockRepo.createForm).toHaveBeenCalledWith(data, 'user-1');
      expect(result).toEqual(sampleForm);
    });

    it('passes through when description is omitted', async () => {
      mockRepo.createForm.mockResolvedValueOnce({ ...sampleForm, description: null });
      const data = { name: 'Simple Form', fields: [] };
      await intakeFormService.createForm(data, 'user-1');
      expect(mockRepo.createForm).toHaveBeenCalledWith(data, 'user-1');
    });
  });

  describe('getForms', () => {
    it('returns active forms from repository', async () => {
      mockRepo.findActiveForms.mockResolvedValueOnce([sampleForm]);
      const result = await intakeFormService.getForms();
      expect(result).toEqual([sampleForm]);
      expect(mockRepo.findActiveForms).toHaveBeenCalledOnce();
    });

    it('returns empty array when no forms exist', async () => {
      mockRepo.findActiveForms.mockResolvedValueOnce([]);
      const result = await intakeFormService.getForms();
      expect(result).toEqual([]);
    });
  });

  describe('getFormById', () => {
    it('returns form when found', async () => {
      mockRepo.findById.mockResolvedValueOnce(sampleForm);
      const result = await intakeFormService.getFormById('form-1');
      expect(result).toEqual(sampleForm);
      expect(mockRepo.findById).toHaveBeenCalledWith('form-1');
    });

    it('returns null when not found', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      const result = await intakeFormService.getFormById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateForm', () => {
    it('delegates partial updates to repository', async () => {
      const updated = { ...sampleForm, name: 'Updated Form' };
      mockRepo.updateForm.mockResolvedValueOnce(updated);
      const result = await intakeFormService.updateForm('form-1', { name: 'Updated Form' });
      expect(mockRepo.updateForm).toHaveBeenCalledWith('form-1', { name: 'Updated Form' });
      expect(result.name).toBe('Updated Form');
    });

    it('can deactivate a form', async () => {
      const deactivated = { ...sampleForm, isActive: false };
      mockRepo.updateForm.mockResolvedValueOnce(deactivated);
      const result = await intakeFormService.updateForm('form-1', { isActive: false });
      expect(mockRepo.updateForm).toHaveBeenCalledWith('form-1', { isActive: false });
      expect(result.isActive).toBe(false);
    });
  });

  describe('deleteForm', () => {
    it('delegates to repository', async () => {
      mockRepo.deleteForm.mockResolvedValueOnce(undefined);
      await intakeFormService.deleteForm('form-1');
      expect(mockRepo.deleteForm).toHaveBeenCalledWith('form-1');
    });
  });

  // --- Submissions ---

  describe('submitForm', () => {
    it('delegates to repository with correct arguments', async () => {
      mockRepo.createSubmission.mockResolvedValueOnce(sampleSubmission);
      const values = { f1: 'My New Project', f2: 'A great project', f3: 'High' };
      const result = await intakeFormService.submitForm('form-1', values, 'user-2');
      expect(mockRepo.createSubmission).toHaveBeenCalledWith('form-1', values, 'user-2');
      expect(result).toEqual(sampleSubmission);
    });
  });

  describe('getSubmissions', () => {
    it('returns all submissions when no filters provided', async () => {
      mockRepo.findSubmissions.mockResolvedValueOnce([sampleSubmission]);
      const result = await intakeFormService.getSubmissions();
      expect(mockRepo.findSubmissions).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toHaveLength(1);
    });

    it('passes formId filter to repository', async () => {
      mockRepo.findSubmissions.mockResolvedValueOnce([sampleSubmission]);
      await intakeFormService.getSubmissions('form-1');
      expect(mockRepo.findSubmissions).toHaveBeenCalledWith('form-1', undefined);
    });

    it('passes both formId and status filters', async () => {
      mockRepo.findSubmissions.mockResolvedValueOnce([]);
      await intakeFormService.getSubmissions('form-1', 'approved');
      expect(mockRepo.findSubmissions).toHaveBeenCalledWith('form-1', 'approved');
    });

    it('passes status filter without formId', async () => {
      mockRepo.findSubmissions.mockResolvedValueOnce([]);
      await intakeFormService.getSubmissions(undefined, 'submitted');
      expect(mockRepo.findSubmissions).toHaveBeenCalledWith(undefined, 'submitted');
    });
  });

  describe('getSubmissionById', () => {
    it('returns submission when found', async () => {
      mockRepo.findSubmissionById.mockResolvedValueOnce(sampleSubmission);
      const result = await intakeFormService.getSubmissionById('sub-1');
      expect(result).toEqual(sampleSubmission);
      expect(mockRepo.findSubmissionById).toHaveBeenCalledWith('sub-1');
    });

    it('returns null when not found', async () => {
      mockRepo.findSubmissionById.mockResolvedValueOnce(null);
      const result = await intakeFormService.getSubmissionById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('reviewSubmission', () => {
    it('delegates to repository with correct arguments', async () => {
      const reviewed = { ...sampleSubmission, status: 'approved', reviewerId: 'user-3', reviewNotes: 'Looks good' };
      mockRepo.reviewSubmission.mockResolvedValueOnce(reviewed);
      const result = await intakeFormService.reviewSubmission('sub-1', 'approved', 'Looks good', 'user-3');
      expect(mockRepo.reviewSubmission).toHaveBeenCalledWith('sub-1', 'approved', 'Looks good', 'user-3');
      expect(result.status).toBe('approved');
      expect(result.reviewerId).toBe('user-3');
    });
  });

  // --- convertToProject ---

  describe('convertToProject', () => {
    it('creates project using "Project Name" field from submission values', async () => {
      mockRepo.findSubmissionById.mockResolvedValueOnce(sampleSubmission);
      mockRepo.findById.mockResolvedValueOnce(sampleForm);
      const createdProject = { id: 'proj-1', name: 'My New Project', description: 'Project Name: My New Project\nDescription: A great project\nPriority: High', status: 'planning' };
      mockProjectService.create.mockResolvedValueOnce(createdProject);

      const result = await intakeFormService.convertToProject('sub-1', 'user-1');

      expect(mockProjectService.create).toHaveBeenCalledWith({
        name: 'My New Project',
        description: 'Project Name: My New Project\nDescription: A great project\nPriority: High',
        status: 'planning',
        userId: 'user-1',
      });
      expect(mockRepo.markConverted).toHaveBeenCalledWith('sub-1', 'proj-1');
      expect(result).toEqual(createdProject);
    });

    it('uses "Name" label as project name', async () => {
      const formWithNameLabel: IntakeForm = {
        ...sampleForm,
        fields: [
          { id: 'f1', label: 'Name', type: 'text', required: true },
          { id: 'f2', label: 'Budget', type: 'number', required: false },
        ],
      };
      const submission: IntakeSubmission = {
        ...sampleSubmission,
        valuesJson: { f1: 'Alpha Project', f2: 50000 },
      };
      mockRepo.findSubmissionById.mockResolvedValueOnce(submission);
      mockRepo.findById.mockResolvedValueOnce(formWithNameLabel);
      mockProjectService.create.mockResolvedValueOnce({ id: 'proj-2', name: 'Alpha Project' });

      await intakeFormService.convertToProject('sub-1', 'user-1');

      expect(mockProjectService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Alpha Project' }),
      );
    });

    it('falls back to first text field when no name field exists', async () => {
      const formNoNameField: IntakeForm = {
        ...sampleForm,
        fields: [
          { id: 'f1', label: 'Title', type: 'text', required: true },
          { id: 'f2', label: 'Notes', type: 'textarea', required: false },
        ],
      };
      const submission: IntakeSubmission = {
        ...sampleSubmission,
        valuesJson: { f1: 'Fallback Title', f2: 'Some notes' },
      };
      mockRepo.findSubmissionById.mockResolvedValueOnce(submission);
      mockRepo.findById.mockResolvedValueOnce(formNoNameField);
      mockProjectService.create.mockResolvedValueOnce({ id: 'proj-3', name: 'Fallback Title' });

      await intakeFormService.convertToProject('sub-1', 'user-1');

      expect(mockProjectService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Fallback Title' }),
      );
    });

    it('falls back to form name when no text fields have values', async () => {
      const formNoTextFields: IntakeForm = {
        ...sampleForm,
        name: 'Special Request Form',
        fields: [
          { id: 'f1', label: 'Priority', type: 'select', required: true, options: ['High', 'Low'] },
        ],
      };
      const submission: IntakeSubmission = {
        ...sampleSubmission,
        valuesJson: { f1: 'High' },
      };
      mockRepo.findSubmissionById.mockResolvedValueOnce(submission);
      mockRepo.findById.mockResolvedValueOnce(formNoTextFields);
      mockProjectService.create.mockResolvedValueOnce({ id: 'proj-4', name: 'Project from Special Request Form' });

      await intakeFormService.convertToProject('sub-1', 'user-1');

      expect(mockProjectService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Project from Special Request Form' }),
      );
    });

    it('falls back to form name when first text field value is empty', async () => {
      const form: IntakeForm = {
        ...sampleForm,
        name: 'Intake',
        fields: [
          { id: 'f1', label: 'Title', type: 'text', required: false },
        ],
      };
      const submission: IntakeSubmission = {
        ...sampleSubmission,
        valuesJson: {},
      };
      mockRepo.findSubmissionById.mockResolvedValueOnce(submission);
      mockRepo.findById.mockResolvedValueOnce(form);
      mockProjectService.create.mockResolvedValueOnce({ id: 'proj-5', name: 'Project from Intake' });

      await intakeFormService.convertToProject('sub-1', 'user-1');

      expect(mockProjectService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Project from Intake' }),
      );
    });

    it('builds description from all non-empty field values', async () => {
      const form: IntakeForm = {
        ...sampleForm,
        fields: [
          { id: 'f1', label: 'Name', type: 'text', required: true },
          { id: 'f2', label: 'Empty Field', type: 'text', required: false },
          { id: 'f3', label: 'Budget', type: 'number', required: false },
        ],
      };
      const submission: IntakeSubmission = {
        ...sampleSubmission,
        valuesJson: { f1: 'Test', f2: '', f3: 1000 },
      };
      mockRepo.findSubmissionById.mockResolvedValueOnce(submission);
      mockRepo.findById.mockResolvedValueOnce(form);
      mockProjectService.create.mockResolvedValueOnce({ id: 'proj-6', name: 'Test' });

      await intakeFormService.convertToProject('sub-1', 'user-1');

      // f2 is empty string so should be excluded from description
      expect(mockProjectService.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Name: Test\nBudget: 1000' }),
      );
    });

    it('excludes null and undefined values from description', async () => {
      const form: IntakeForm = {
        ...sampleForm,
        fields: [
          { id: 'f1', label: 'Name', type: 'text', required: true },
          { id: 'f2', label: 'Optional', type: 'text', required: false },
        ],
      };
      const submission: IntakeSubmission = {
        ...sampleSubmission,
        valuesJson: { f1: 'Proj', f2: null },
      };
      mockRepo.findSubmissionById.mockResolvedValueOnce(submission);
      mockRepo.findById.mockResolvedValueOnce(form);
      mockProjectService.create.mockResolvedValueOnce({ id: 'proj-7', name: 'Proj' });

      await intakeFormService.convertToProject('sub-1', 'user-1');

      expect(mockProjectService.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Name: Proj' }),
      );
    });

    it('throws error when submission not found', async () => {
      mockRepo.findSubmissionById.mockResolvedValueOnce(null);
      await expect(intakeFormService.convertToProject('nonexistent', 'user-1'))
        .rejects.toThrow('Submission not found');
      expect(mockProjectService.create).not.toHaveBeenCalled();
      expect(mockRepo.markConverted).not.toHaveBeenCalled();
    });

    it('throws error when form not found', async () => {
      mockRepo.findSubmissionById.mockResolvedValueOnce(sampleSubmission);
      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(intakeFormService.convertToProject('sub-1', 'user-1'))
        .rejects.toThrow('Form not found');
      expect(mockProjectService.create).not.toHaveBeenCalled();
      expect(mockRepo.markConverted).not.toHaveBeenCalled();
    });

    it('always creates project with status planning', async () => {
      mockRepo.findSubmissionById.mockResolvedValueOnce(sampleSubmission);
      mockRepo.findById.mockResolvedValueOnce(sampleForm);
      mockProjectService.create.mockResolvedValueOnce({ id: 'proj-8', name: 'Test' });

      await intakeFormService.convertToProject('sub-1', 'user-1');

      expect(mockProjectService.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'planning' }),
      );
    });

    it('marks submission as converted after project creation', async () => {
      mockRepo.findSubmissionById.mockResolvedValueOnce(sampleSubmission);
      mockRepo.findById.mockResolvedValueOnce(sampleForm);
      mockProjectService.create.mockResolvedValueOnce({ id: 'proj-9', name: 'Test' });

      await intakeFormService.convertToProject('sub-1', 'user-1');

      expect(mockRepo.markConverted).toHaveBeenCalledWith('sub-1', 'proj-9');
      // Ensure markConverted is called after create
      const createOrder = mockProjectService.create.mock.invocationCallOrder[0];
      const convertOrder = mockRepo.markConverted.mock.invocationCallOrder[0];
      expect(convertOrder).toBeGreaterThan(createOrder);
    });
  });
});
