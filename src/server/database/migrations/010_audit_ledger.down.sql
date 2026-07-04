-- Rollback 010_audit_ledger
DROP TRIGGER IF EXISTS audit_ledger_no_update;
DROP TRIGGER IF EXISTS audit_ledger_no_delete;
DROP TABLE IF EXISTS audit_ledger;
