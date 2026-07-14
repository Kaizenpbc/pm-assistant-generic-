-- 055_vector_embeddings.sql
-- Convert embeddings column from JSON to native VECTOR type (MariaDB 11.6+)
-- Enables SQL-level VEC_DISTANCE_COSINE() instead of in-memory cosine similarity

ALTER TABLE embeddings MODIFY COLUMN embedding BLOB NOT NULL;

INSERT INTO _migrations (name) VALUES ('055_vector_embeddings');
