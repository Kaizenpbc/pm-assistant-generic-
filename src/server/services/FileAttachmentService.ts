import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { databaseService } from '../database/connection';
import { config } from '../config';

export interface FileAttachment {
  id: string;
  entityType: string;
  entityId: string;
  uploadedBy: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  version: number;
  parentId: string | null;
  createdAt: string;
}

interface FileAttachmentRow {
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

function rowToDTO(row: FileAttachmentRow): FileAttachment {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    uploadedBy: row.uploaded_by,
    fileName: row.file_name,
    originalName: row.original_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    filePath: row.file_path,
    version: row.version,
    parentId: row.parent_id,
    createdAt: row.created_at,
  };
}

class FileAttachmentService {
  private getUploadDir(entityType: string, entityId: string): string {
    return path.join(config.UPLOAD_DIR, entityType, entityId);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async upload(
    entityType: string,
    entityId: string,
    uploadedBy: string,
    originalName: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<FileAttachment> {
    const id = uuidv4();
    const ext = path.extname(originalName);
    const storedName = `${id}${ext}`;
    const dir = this.getUploadDir(entityType, entityId);
    this.ensureDir(dir);
    const filePath = path.join(dir, storedName);
    fs.writeFileSync(filePath, buffer);

    await databaseService.query(
      `INSERT INTO file_attachments (id, entity_type, entity_id, uploaded_by, file_name, original_name, mime_type, file_size, file_path, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, entityType, entityId, uploadedBy, storedName, originalName, mimeType, buffer.length, filePath],
    );

    const rows = await databaseService.query<FileAttachmentRow>(
      'SELECT * FROM file_attachments WHERE id = ?',
      [id],
    );
    return rowToDTO(rows[0]);
  }

  async getByEntity(entityType: string, entityId: string): Promise<FileAttachment[]> {
    const rows = await databaseService.query<FileAttachmentRow>(
      'SELECT * FROM file_attachments WHERE entity_type = ? AND entity_id = ? AND parent_id IS NULL ORDER BY created_at DESC',
      [entityType, entityId],
    );
    return rows.map(rowToDTO);
  }

  async getById(id: string): Promise<FileAttachment | null> {
    const rows = await databaseService.query<FileAttachmentRow>(
      'SELECT * FROM file_attachments WHERE id = ?',
      [id],
    );
    return rows.length > 0 ? rowToDTO(rows[0]) : null;
  }

  async delete(id: string): Promise<void> {
    const attachment = await this.getById(id);
    if (attachment && fs.existsSync(attachment.filePath)) {
      fs.unlinkSync(attachment.filePath);
    }
    // Also delete all versions
    const versions = await databaseService.query<FileAttachmentRow>(
      'SELECT * FROM file_attachments WHERE parent_id = ?',
      [id],
    );
    for (const v of versions) {
      if (fs.existsSync(v.file_path)) {
        fs.unlinkSync(v.file_path);
      }
    }
    await databaseService.query('DELETE FROM file_attachments WHERE id = ? OR parent_id = ?', [id, id]);
  }

  async uploadNewVersion(
    parentId: string,
    uploadedBy: string,
    originalName: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<FileAttachment> {
    const parent = await this.getById(parentId);
    if (!parent) throw new Error('Parent attachment not found');

    // Get max version for this file lineage
    const rootId = parent.parentId || parent.id;
    const rows = await databaseService.query<{ maxVer: number }>(
      'SELECT MAX(version) as maxVer FROM file_attachments WHERE id = ? OR parent_id = ?',
      [rootId, rootId],
    );
    const nextVersion = (rows[0]?.maxVer || 1) + 1;

    const id = uuidv4();
    const ext = path.extname(originalName);
    const storedName = `${id}${ext}`;
    const dir = this.getUploadDir(parent.entityType, parent.entityId);
    this.ensureDir(dir);
    const filePath = path.join(dir, storedName);
    fs.writeFileSync(filePath, buffer);

    await databaseService.query(
      `INSERT INTO file_attachments (id, entity_type, entity_id, uploaded_by, file_name, original_name, mime_type, file_size, file_path, version, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, parent.entityType, parent.entityId, uploadedBy, storedName, originalName, mimeType, buffer.length, filePath, nextVersion, rootId],
    );

    const result = await databaseService.query<FileAttachmentRow>(
      'SELECT * FROM file_attachments WHERE id = ?',
      [id],
    );
    return rowToDTO(result[0]);
  }

  async getVersionHistory(id: string): Promise<FileAttachment[]> {
    const attachment = await this.getById(id);
    if (!attachment) return [];
    const rootId = attachment.parentId || attachment.id;

    const rows = await databaseService.query<FileAttachmentRow>(
      'SELECT * FROM file_attachments WHERE id = ? OR parent_id = ? ORDER BY version DESC',
      [rootId, rootId],
    );
    return rows.map(rowToDTO);
  }
}

export const fileAttachmentService = new FileAttachmentService();
