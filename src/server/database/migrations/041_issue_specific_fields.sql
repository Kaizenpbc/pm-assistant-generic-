-- Migration 041: Issue-specific fields
-- Issues are materialized risks — they need root cause analysis, impact assessment,
-- workaround, and resolution tracking instead of risk-oriented trigger/mitigation fields.

ALTER TABLE project_risks ADD COLUMN root_cause TEXT NULL;
ALTER TABLE project_risks ADD COLUMN impact_assessment TEXT NULL;
ALTER TABLE project_risks ADD COLUMN workaround TEXT NULL;
