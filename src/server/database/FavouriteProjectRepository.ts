import { databaseService } from './connection';

export class FavouriteProjectRepository {
  async getByUserId(userId: string): Promise<string[]> {
    const rows = await databaseService.query(
      'SELECT project_id FROM user_favourite_projects WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
    );
    return rows.map((r: any) => r.project_id);
  }

  async add(userId: string, projectId: string): Promise<void> {
    await databaseService.query(
      'INSERT IGNORE INTO user_favourite_projects (user_id, project_id) VALUES (?, ?)',
      [userId, projectId],
    );
  }

  async remove(userId: string, projectId: string): Promise<void> {
    await databaseService.query(
      'DELETE FROM user_favourite_projects WHERE user_id = ? AND project_id = ?',
      [userId, projectId],
    );
  }

  async isFavouriteMap(userId: string, projectIds: string[]): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    if (projectIds.length === 0) return result;
    for (const id of projectIds) result[id] = false;
    const placeholders = projectIds.map(() => '?').join(',');
    const rows = await databaseService.query(
      `SELECT project_id FROM user_favourite_projects WHERE user_id = ? AND project_id IN (${placeholders})`,
      [userId, ...projectIds],
    );
    for (const row of rows) {
      result[(row as any).project_id] = true;
    }
    return result;
  }
}

export const favouriteProjectRepository = new FavouriteProjectRepository();
