import { databaseService } from './connection';
import { EmbeddingRow } from '../services/EmbeddingService';

class EmbeddingRepository {
  async findByDocument(documentType: string, documentId: string): Promise<EmbeddingRow[]> {
    return databaseService.query<EmbeddingRow>(
      'SELECT id, content_hash FROM embeddings WHERE document_type = ? AND document_id = ?',
      [documentType, documentId],
    );
  }

  upsert(
    id: string, documentType: string, documentId: string, contentHash: string,
    embedding: string, model: string, dimensions: number,
  ): Promise<any> {
    return databaseService.query(
      `INSERT INTO embeddings (id, document_type, document_id, content_hash, embedding, model, dimensions)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE content_hash = VALUES(content_hash), embedding = VALUES(embedding), model = VALUES(model), dimensions = VALUES(dimensions)`,
      [id, documentType, documentId, contentHash, embedding, model, dimensions],
    );
  }

  async findAll(documentType?: string, limit = 5000): Promise<Array<Pick<EmbeddingRow, 'document_type' | 'document_id' | 'embedding'>>> {
    let sql = 'SELECT document_type, document_id, embedding FROM embeddings';
    const params: any[] = [];
    if (documentType) {
      sql += ' WHERE document_type = ?';
      params.push(documentType);
    }
    sql += ` LIMIT ${Math.min(limit, 10000)}`;
    return databaseService.query(sql, params);
  }

  delete(documentType: string, documentId: string): Promise<any> {
    return databaseService.query(
      'DELETE FROM embeddings WHERE document_type = ? AND document_id = ?',
      [documentType, documentId],
    );
  }
}

export const embeddingRepository = new EmbeddingRepository();
