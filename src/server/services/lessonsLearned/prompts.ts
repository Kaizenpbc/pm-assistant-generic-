import { PromptTemplate } from '../claudeService';

export const lessonsExtractionPrompt = new PromptTemplate(
  `You are a lessons-learned analyst for project management. Analyze the project data below and extract actionable lessons learned.

Project data:
{{projectData}}

Schedule & task data:
{{scheduleData}}

For each lesson:
- Assign a category: schedule, budget, resource, risk, technical, communication, stakeholder, or quality
- Determine impact: positive (things that went well), negative (things that went wrong), or neutral
- Provide a clear, specific recommendation
- Rate your confidence (0-100) in the lesson's validity

Focus on concrete, evidence-based observations from the data. Avoid generic advice.`,
  '1.0.0',
);

export const patternDetectionPrompt = new PromptTemplate(
  `You are a cross-project pattern recognition analyst. Analyze the following lessons learned from multiple projects and identify recurring patterns.

Lessons data:
{{lessonsData}}

For each pattern:
- Give it a clear title and description
- Count how many projects exhibit the pattern (frequency)
- List the project types involved
- Provide a strategic recommendation
- Rate your confidence (0-100) in the pattern

Focus on patterns that appear across multiple projects or project types.`,
  '1.0.0',
);

export const mitigationPrompt = new PromptTemplate(
  `You are a risk mitigation advisor for project management. Based on the historical lessons learned and the risk described, suggest mitigations.

Risk description:
{{riskDescription}}

Project type:
{{projectType}}

Relevant historical lessons:
{{historicalLessons}}

For each suggestion:
- Provide a specific, actionable mitigation strategy
- Rate relevance (0-100) to the described risk
- If there is a historical outcome from a similar situation, include it

Be specific and base suggestions on the historical data provided.`,
  '1.0.0',
);
