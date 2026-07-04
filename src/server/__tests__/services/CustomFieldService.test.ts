import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/CustomFieldRepository', () => {
  const mockRepo = {
    insertField: vi.fn(),
    findByProject: vi.fn().mockResolvedValue([]),
    updateField: vi.fn(),
    deleteField: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
    findValues: vi.fn().mockResolvedValue([]),
    upsertValue: vi.fn(),
  };
  return { customFieldRepository: mockRepo };
});

import { CustomFieldService } from '../../services/CustomFieldService';
import { customFieldRepository } from '../../database/CustomFieldRepository';

const mockRepo = customFieldRepository as any;

const sampleField = {
  id: 'cf1', projectId: 'p1', entityType: 'task', fieldName: 'priority_score',
  fieldLabel: 'Priority Score', fieldType: 'number', options: null,
  isRequired: false, sortOrder: 0, createdBy: 'u1', createdAt: '2026-01-01',
};

describe('CustomFieldService', () => {
  let service: CustomFieldService;

  beforeEach(() => {
    service = new CustomFieldService();
    vi.clearAllMocks();
  });

  describe('createField', () => {
    it('delegates to repository', async () => {
      mockRepo.insertField.mockResolvedValueOnce(sampleField);
      const field = await service.createField({
        projectId: 'p1', entityType: 'task', fieldName: 'priority_score',
        fieldLabel: 'Priority Score', fieldType: 'number', createdBy: 'u1',
      });
      expect(field.fieldName).toBe('priority_score');
    });
  });

  describe('getFieldsByProject', () => {
    it('returns fields for project', async () => {
      mockRepo.findByProject.mockResolvedValueOnce([sampleField]);
      const fields = await service.getFieldsByProject('p1');
      expect(fields).toHaveLength(1);
    });

    it('filters by entityType', async () => {
      mockRepo.findByProject.mockResolvedValueOnce([]);
      await service.getFieldsByProject('p1', 'task');
      expect(mockRepo.findByProject).toHaveBeenCalledWith('p1', 'task');
    });
  });

  describe('getValues', () => {
    it('returns fields with values merged', async () => {
      mockRepo.findByProject.mockResolvedValueOnce([sampleField]);
      mockRepo.findValues.mockResolvedValueOnce([
        { fieldId: 'cf1', entityId: 't1', textValue: null, numberValue: 85, dateValue: null, booleanValue: null },
      ]);

      const result = await service.getValues('task', 't1', 'p1');
      expect(result).toHaveLength(1);
      expect(result[0].fieldName).toBe('priority_score');
      expect(result[0].value).not.toBeNull();
      expect(result[0].value!.fieldId).toBe('cf1');
    });

    it('returns null value when no value set', async () => {
      mockRepo.findByProject.mockResolvedValueOnce([sampleField]);
      mockRepo.findValues.mockResolvedValueOnce([]);

      const result = await service.getValues('task', 't1', 'p1');
      expect(result[0].value).toBeNull();
    });

    it('returns empty when no fields defined', async () => {
      const result = await service.getValues('task', 't1', 'p1');
      expect(result).toHaveLength(0);
    });
  });

  describe('setValue', () => {
    it('validates field exists before setting', async () => {
      await expect(service.setValue('nonexistent', 't1', { number: 42 }))
        .rejects.toThrow('Field not found');
    });

    it('upserts value when field exists', async () => {
      mockRepo.findById.mockResolvedValueOnce(sampleField);
      mockRepo.upsertValue.mockResolvedValueOnce({ fieldId: 'cf1', entityId: 't1', numberValue: 42 });
      await service.setValue('cf1', 't1', { number: 42 });
      expect(mockRepo.upsertValue).toHaveBeenCalledWith('cf1', 't1', { number: 42 });
    });
  });

  describe('bulkSetValues', () => {
    it('sets multiple values sequentially', async () => {
      mockRepo.findById.mockResolvedValue(sampleField);
      mockRepo.upsertValue.mockResolvedValue({});

      await service.bulkSetValues('t1', [
        { fieldId: 'cf1', number: 10 },
        { fieldId: 'cf2', text: 'hello' },
      ]);

      expect(mockRepo.upsertValue).toHaveBeenCalledTimes(2);
    });
  });
});
