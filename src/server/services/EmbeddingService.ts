import { createHash, randomUUID } from 'crypto';
import { config } from '../config';
import { databaseService } from '../database/connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbeddingRow {
  id: string;
  document_type: 'lesson' | 'meeting';
  document_id: string;
  content_hash: string;
  embedding: string; // JSON string from DB
  model: string;
  dimensions: number;
  created_at: string;
}

export interface SimilarityResult {
  documentType: 'lesson' | 'meeting';
  documentId: string;
  score: number;
}

// ---------------------------------------------------------------------------
// EmbeddingService
// ---------------------------------------------------------------------------

export class EmbeddingService {
  private cache: Map<string, { vector: number[]; documentType: string; documentId: string }[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  isAvailable(): boolean {
    return !!(config.EMBEDDING_ENABLED && config.OPENAI_API_KEY);
  }

  // -------------------------------------------------------------------------
  // Generate an embedding vector via OpenAI
  // -------------------------------------------------------------------------

  async embed(text: string): Promise<number[]> {
    if (!this.isAvailable()) {
      throw new Error('Embedding service is not available (OPENAI_API_KEY or EMBEDDING_ENABLED missing)');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: text,
        model: config.EMBEDDING_MODEL,
        dimensions: config.EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI embeddings API error ${response.status}: ${body}`);
    }

    const json = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return json.data[0].embedding;
  }

  // -------------------------------------------------------------------------
  // Upsert an embedding (skip if content hash unchanged)
  // -------------------------------------------------------------------------

  async upsertEmbedding(
    documentType: 'lesson' | 'meeting',
    documentId: string,
    text: string,
  ): Promise<{ id: string; skipped: boolean }> {
    const contentHash = createHash('sha256').update(text).digest('hex');

    // Check for existing embedding with same content hash
    const existing = await databaseService.query<EmbeddingRow>(
      'SELECT id, content_hash FROM embeddings WHERE document_type = ? AND document_id = ?',
      [documentType, documentId],
    );

    if (existing.length > 0 && existing[0].content_hash === contentHash) {
      return { id: existing[0].id, skipped: true };
    }

    const vector = await this.embed(text);
    const id = existing.length > 0 ? existing[0].id : randomUUID();

    await databaseService.query(
      `INSERT INTO embeddings (id, document_type, document_id, content_hash, embedding, model, dimensions)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE content_hash = VALUES(content_hash), embedding = VALUES(embedding), model = VALUES(model), dimensions = VALUES(dimensions)`,
      [
        id,
        documentType,
        documentId,
        contentHash,
        JSON.stringify(vector),
        config.EMBEDDING_MODEL,
        config.EMBEDDING_DIMENSIONS,
      ],
    );

    this.clearCache();
    return { id, skipped: false };
  }

  // -------------------------------------------------------------------------
  // Search for similar documents
  // -------------------------------------------------------------------------

  async searchSimilar(
    query: string,
    documentType?: 'lesson' | 'meeting',
    topK?: number,
    threshold?: number,
  ): Promise<SimilarityResult[]> {
    const k = topK ?? config.RAG_TOP_K;
    const minScore = threshold ?? config.RAG_SIMILARITY_THRESHOLD;

    const queryVector = await this.embed(query);

    // Check cache for parsed embeddings
    const cacheKey = documentType ?? 'all';
    let entries = this.getCachedEntries(cacheKey);

    if (!entries) {
      // Cache miss — load from DB and parse JSON
      let sql = 'SELECT document_type, document_id, embedding FROM embeddings';
      const params: any[] = [];
      if (documentType) {
        sql += ' WHERE document_type = ?';
        params.push(documentType);
      }

      const rows = await databaseService.query<Pick<EmbeddingRow, 'document_type' | 'document_id' | 'embedding'>>(sql, params);

      entries = rows.map(row => ({
        vector: typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding,
        documentType: row.document_type,
        documentId: row.document_id,
      }));

      this.cache.set(cacheKey, entries);
      this.cacheTimestamps.set(cacheKey, Date.now());
    }

    // Compute cosine similarity in JS
    const scored: SimilarityResult[] = [];
    for (const entry of entries) {
      const score = EmbeddingService.cosineSimilarity(queryVector, entry.vector);
      if (score >= minScore) {
        scored.push({
          documentType: entry.documentType as 'lesson' | 'meeting',
          documentId: entry.documentId,
          score,
        });
      }
    }

    // Sort descending by score, take top-K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  // -------------------------------------------------------------------------
  // Delete an embedding
  // -------------------------------------------------------------------------

  async deleteEmbedding(documentType: 'lesson' | 'meeting', documentId: string): Promise<void> {
    await databaseService.query(
      'DELETE FROM embeddings WHERE document_type = ? AND document_id = ?',
      [documentType, documentId],
    );
    this.clearCache();
  }

  // -------------------------------------------------------------------------
  // Cache helpers
  // -------------------------------------------------------------------------

  private getCachedEntries(key: string): { vector: number[]; documentType: string; documentId: string }[] | null {
    const ts = this.cacheTimestamps.get(key);
    if (ts == null || Date.now() - ts > this.cacheTtlMs) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    return this.cache.get(key) ?? null;
  }

  private clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  // -------------------------------------------------------------------------
  // Cosine similarity (exported for testing)
  // -------------------------------------------------------------------------

  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }
}

export const embeddingService = new EmbeddingService();
