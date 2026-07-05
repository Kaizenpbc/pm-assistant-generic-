import { databaseService } from './connection';

export interface FileAttachmentRow {
  id: string;
  entity_type: string;
  entity_id: string;
  uploaded_by: string;
  file_name: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_path: string;
  version: number;
  parent_id: string | null;
  created_at: string;
}

class FileAttachmentRepository {
  insert(
    id: string, entityType: string, entityId: string, uploadedBy: string,
    fileName: string, originalName: string, mimeType: string, fileSize: number,
    filePath: string, version: number, parentId: string | null,
  ): Promise<any> {
    return databaseService.query(
      `INSERT INTO file_attachments (id, entity_type, entity_id, uploaded_by, file_name, original_name, mime_type, file_size, file_path, version, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, entityType, entityId, uploadedBy, fileName, originalName, mimeType, fileSize, filePath, version, parentId],
    );
  }

  async findById(id: string): Promise<FileAttachmentRow | null> {
    const rows = await databaseService.query<FileAttachmentRow>(
      'SELECT * FROM file_attachments WHERE id = ?',
      [id],
    );
    return rows[0] ?? null;
  }

  async findByEntity(entityType: string, entityId: string): Promise<FileAttachmentRow[]> {
    return databaseService.query<FileAttachmentRow>(
      'SELECT * FROM file_attachments WHERE entity_type = ? AND entity_id = ? AND parent_id IS NULL ORDER BY created_at DESC',
      [entityType, entityId],
    );
  }

  async findVersions(parentId: string): Promise<FileAttachmentRow[]> {
    return databaseService.query<FileAttachmentRow>(
      'SELECT * FROM file_attachments WHERE parent_id = ?',
      [parentId],
    );
  }

  async findVersionHistory(rootId: string): Promise<FileAttachmentRow[]> {
    return databaseService.query<FileAttachmentRow>(
      'SELECT * FROM file_attachments WHERE id = ? OR parent_id = ? ORDER BY version DESC',
      [rootId, rootId],
    );
  }

  async getMaxVersion(rootId: string): Promise<number> {
    const rows = await databaseService.query<{ maxVer: number }>(
      'SELECT MAX(version) as maxVer FROM file_attachments WHERE id = ? OR parent_id = ?',
      [rootId, rootId],
    );
    return rows[0]?.maxVer || 1;
  }

  deleteWithVersions(id: string): Promise<any> {
    return databaseService.query(
      'DELETE FROM file_attachments WHERE id = ? OR parent_id = ?',
      [id, id],
    );
  }
}

export const fileAttachmentRepository = new FileAttachmentRepository();
