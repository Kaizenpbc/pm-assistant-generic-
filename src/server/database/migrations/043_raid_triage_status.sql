-- Add 'proposed' status to RAID items for triage workflow
-- New items from non-PM roles start as 'proposed' until PM reviews

ALTER TABLE project_risks
  MODIFY COLUMN status ENUM(
    'proposed',
    'open', 'monitoring', 'mitigating', 'mitigated',
    'closed', 'resolved', 'cancelled', 'reversed',
    'in_progress', 'completed',
    'pending_decision', 'decided', 'deferred'
  ) NOT NULL DEFAULT 'open';
