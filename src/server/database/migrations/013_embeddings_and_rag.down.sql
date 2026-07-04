-- Rollback 013_embeddings_and_rag
DROP TABLE IF EXISTS embeddings;
DROP TABLE IF EXISTS meeting_analyses;
DROP TABLE IF EXISTS lessons_learned;

DELETE FROM _migrations WHERE name = '013_embeddings_and_rag';
