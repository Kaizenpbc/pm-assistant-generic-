-- Migration 034: Add accessibility preferences column to users
-- Stores JSON: { highContrast, fontSize, reducedMotion, simplificationLevel, narrationEnabled }

ALTER TABLE users ADD COLUMN accessibility_preferences JSON DEFAULT NULL;
