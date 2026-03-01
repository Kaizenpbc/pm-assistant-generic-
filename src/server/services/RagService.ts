import { databaseService } from '../database/connection';
import { EmbeddingService, type SimilarityResult } from './EmbeddingService';
import type { LessonLearned } from '../schemas/lessonsLearnedSchemas';
import type { MeetingAnalysis } from '../schemas/meetingSchemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RagResult {
  documentType: 'lesson' | 'meeting';
  documentId: string;
  score: number;
  document: LessonLearned | MeetingAnalysis | null;
}

export interface RagSearchOptions {
  documentType?: 'lesson' | 'meeting';
  topK?: number;
  threshold?: number;
}

// ---------------------------------------------------------------------------
// RagService
// ---------------------------------------------------------------------------

export class RagService {
  private embeddingService: EmbeddingService;

  constructor(embeddingService?: EmbeddingService) {
    this.embeddingService = embeddingService ?? new EmbeddingService();
  }

  isAvailable(): boolean {
    return this.embeddingService.isAvailable();
  }

  // -------------------------------------------------------------------------
  // Index a lesson learned
  // -------------------------------------------------------------------------

  async indexLesson(lesson: LessonLearned): Promise<void> {
    if (!this.isAvailable()) return;

    const text = this.lessonToText(lesson);
    try {
      await this.embeddingService.upsertEmbedding('lesson', lesson.id, text);
    } catch (err) {
      console.error(`Failed to index lesson ${lesson.id}:`, err);
    }
  }

  // -------------------------------------------------------------------------
  // Index a meeting analysis
  // -------------------------------------------------------------------------

  async indexMeeting(analysis: MeetingAnalysis): Promise<void> {
    if (!this.isAvailable()) return;

    const text = this.meetingToText(analysis);
    try {
      await this.embeddingService.upsertEmbedding('meeting', analysis.id, text);
    } catch (err) {
      console.error(`Failed to index meeting ${analysis.id}:`, err);
    }
  }

  // -------------------------------------------------------------------------
  // Search and enrich with full documents
  // -------------------------------------------------------------------------

  async search(query: string, options?: RagSearchOptions): Promise<RagResult[]> {
    if (!this.isAvailable()) return [];

    const similar = await this.embeddingService.searchSimilar(
      query,
      options?.documentType,
      options?.topK,
      options?.threshold,
    );

    return this.enrichResults(similar);
  }

  // -------------------------------------------------------------------------
  // Build a context string for AI prompts
  // -------------------------------------------------------------------------

  async buildContextString(query: string, topK?: number): Promise<string> {
    const results = await this.search(query, { topK });
    if (results.length === 0) return '';

    const parts: string[] = ['## Relevant Historical Context\n'];

    for (const result of results) {
      if (!result.document) continue;

      if (result.documentType === 'lesson') {
        const lesson = result.document as LessonLearned;
        parts.push(
          `### Lesson: ${lesson.title} (score: ${result.score.toFixed(2)})`,
          `- Category: ${lesson.category} | Impact: ${lesson.impact} | Project: ${lesson.projectName} (${lesson.projectType})`,
          `- ${lesson.description}`,
          `- Recommendation: ${lesson.recommendation}`,
          '',
        );
      } else {
        const meeting = result.document as MeetingAnalysis;
        parts.push(
          `### Meeting Analysis (score: ${result.score.toFixed(2)})`,
          `- Summary: ${meeting.summary}`,
          `- Decisions: ${meeting.decisions.map((d) => d.decision).join('; ') || 'None'}`,
          `- Risks: ${meeting.risks.map((r) => r.description).join('; ') || 'None'}`,
          '',
        );
      }
    }

    return parts.join('\n');
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private lessonToText(lesson: LessonLearned): string {
    return [
      lesson.category,
      lesson.impact,
      lesson.projectType,
      lesson.title,
      lesson.description,
      lesson.recommendation,
    ].join(' | ');
  }

  private meetingToText(analysis: MeetingAnalysis): string {
    return [
      analysis.summary,
      analysis.decisions.map((d) => d.decision).join('; '),
      analysis.risks.map((r) => r.description).join('; '),
      analysis.actionItems.map((a) => a.description).join('; '),
    ].join(' | ');
  }

  private async enrichResults(similar: SimilarityResult[]): Promise<RagResult[]> {
    const results: RagResult[] = [];

    for (const item of similar) {
      let document: LessonLearned | MeetingAnalysis | null = null;

      if (item.documentType === 'lesson') {
        const rows = await databaseService.query<any>(
          'SELECT * FROM lessons_learned WHERE id = ?',
          [item.documentId],
        );
        if (rows.length > 0) {
          document = this.rowToLesson(rows[0]);
        }
      } else {
        const rows = await databaseService.query<any>(
          'SELECT * FROM meeting_analyses WHERE id = ?',
          [item.documentId],
        );
        if (rows.length > 0) {
          document = this.rowToMeetingAnalysis(rows[0]);
        }
      }

      results.push({
        documentType: item.documentType,
        documentId: item.documentId,
        score: item.score,
        document,
      });
    }

    return results;
  }

  private rowToLesson(row: any): LessonLearned {
    return {
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectType: row.project_type,
      category: row.category,
      title: row.title,
      description: row.description,
      impact: row.impact,
      recommendation: row.recommendation,
      confidence: row.confidence,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private rowToMeetingAnalysis(row: any): MeetingAnalysis {
    const parseJson = (val: any) => {
      if (typeof val === 'string') return JSON.parse(val);
      return val ?? [];
    };

    return {
      id: row.id,
      projectId: row.project_id,
      scheduleId: row.schedule_id,
      transcript: row.transcript,
      summary: row.summary,
      actionItems: parseJson(row.action_items),
      decisions: parseJson(row.decisions),
      risks: parseJson(row.risks),
      taskUpdates: parseJson(row.task_updates),
      appliedItems: parseJson(row.applied_items),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }
}
