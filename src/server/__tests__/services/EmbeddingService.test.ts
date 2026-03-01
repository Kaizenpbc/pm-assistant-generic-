import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../../database/connection', () => ({
  databaseService: {
    query: vi.fn().mockResolvedValue([]),
  },
}));

// Mock config
vi.mock('../../config', () => ({
  config: {
    OPENAI_API_KEY: 'sk-test-key',
    EMBEDDING_ENABLED: true,
    EMBEDDING_MODEL: 'text-embedding-3-small',
    EMBEDDING_DIMENSIONS: 1536,
    RAG_TOP_K: 5,
    RAG_SIMILARITY_THRESHOLD: 0.3,
  },
}));

import { EmbeddingService } from '../../services/EmbeddingService';
import { databaseService } from '../../database/connection';

// Helper: create a fake embedding vector
function fakeVector(dims: number, seed: number): number[] {
  const v = [];
  for (let i = 0; i < dims; i++) {
    v.push(Math.sin(seed + i));
  }
  return v;
}

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService();
    vi.clearAllMocks();
  });

  // --- cosineSimilarity ---
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const v = [1, 2, 3];
      expect(EmbeddingService.cosineSimilarity(v, v)).toBeCloseTo(1.0);
    });

    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(EmbeddingService.cosineSimilarity(a, b)).toBeCloseTo(0.0);
    });

    it('returns -1 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      expect(EmbeddingService.cosineSimilarity(a, b)).toBeCloseTo(-1.0);
    });

    it('returns 0 for empty vectors', () => {
      expect(EmbeddingService.cosineSimilarity([], [])).toBe(0);
    });

    it('returns 0 for mismatched lengths', () => {
      expect(EmbeddingService.cosineSimilarity([1], [1, 2])).toBe(0);
    });

    it('handles zero vectors', () => {
      expect(EmbeddingService.cosineSimilarity([0, 0], [1, 1])).toBe(0);
    });
  });

  // --- isAvailable ---
  describe('isAvailable', () => {
    it('returns true when key and enabled are set', () => {
      expect(service.isAvailable()).toBe(true);
    });
  });

  // --- embed ---
  describe('embed', () => {
    it('returns vector from mocked fetch', async () => {
      const mockVector = fakeVector(8, 42);
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: mockVector }],
        }),
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

      const result = await service.embed('test text');
      expect(result).toEqual(mockVector);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on API error', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('rate limited'),
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

      await expect(service.embed('test')).rejects.toThrow('OpenAI embeddings API error 429');
    });
  });

  // --- upsertEmbedding ---
  describe('upsertEmbedding', () => {
    it('skips when content hash matches', async () => {
      const contentHash = 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f'; // sha256 of 'Hello, World!'

      vi.mocked(databaseService.query).mockResolvedValueOnce([
        { id: 'existing-id', content_hash: contentHash },
      ] as any);

      const result = await service.upsertEmbedding('lesson', 'doc-1', 'Hello, World!');
      expect(result.skipped).toBe(true);
      expect(result.id).toBe('existing-id');
    });

    it('generates embedding and upserts when hash differs', async () => {
      vi.mocked(databaseService.query)
        .mockResolvedValueOnce([]) // no existing
        .mockResolvedValueOnce([] as any); // INSERT

      const mockVector = [0.1, 0.2, 0.3];
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: mockVector }],
        }),
      } as any);

      const result = await service.upsertEmbedding('lesson', 'doc-1', 'new text');
      expect(result.skipped).toBe(false);
      // Verify INSERT was called
      expect(databaseService.query).toHaveBeenCalledTimes(2);
    });
  });

  // --- searchSimilar ---
  describe('searchSimilar', () => {
    it('returns sorted and filtered results', async () => {
      const queryVector = [1, 0, 0];
      const goodMatch = [0.9, 0.1, 0]; // high cosine similarity
      const badMatch = [0, 1, 0]; // low cosine similarity

      // Mock embed call
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: queryVector }],
        }),
      } as any);

      // Mock DB query
      vi.mocked(databaseService.query).mockResolvedValueOnce([
        { document_type: 'lesson', document_id: 'good', embedding: JSON.stringify(goodMatch) },
        { document_type: 'lesson', document_id: 'bad', embedding: JSON.stringify(badMatch) },
      ] as any);

      const results = await service.searchSimilar('test query', 'lesson', 5, 0.3);

      // Good match should be first (and only above threshold)
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].documentId).toBe('good');
      expect(results[0].score).toBeGreaterThan(0.3);
    });
  });

  // --- deleteEmbedding ---
  describe('deleteEmbedding', () => {
    it('calls DELETE query', async () => {
      vi.mocked(databaseService.query).mockResolvedValueOnce([] as any);
      await service.deleteEmbedding('lesson', 'doc-1');
      expect(databaseService.query).toHaveBeenCalledWith(
        'DELETE FROM embeddings WHERE document_type = ? AND document_id = ?',
        ['lesson', 'doc-1'],
      );
    });
  });
});
