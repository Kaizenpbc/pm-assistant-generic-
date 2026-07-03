import type { ActionType } from '../ActionProposalService';
import type { SuggestedAction } from './types';

/** Strip markdown code fences (```json ... ```) that Claude sometimes wraps around JSON responses */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return trimmed;
}

/** Map Claude's raw suggestedActions to the standard SuggestedAction shape */
export function mapSuggestedActions(
  actions: Array<{ actionType: string; targetEntityType: string; targetEntityId: string; description: string; reasoning: string }>,
): SuggestedAction[] {
  return actions.map(a => ({
    actionType: a.actionType as ActionType,
    targetEntityType: a.targetEntityType,
    targetEntityId: a.targetEntityId,
    oldValue: {},
    newValue: { description: a.description },
    reasoning: a.reasoning,
  }));
}
