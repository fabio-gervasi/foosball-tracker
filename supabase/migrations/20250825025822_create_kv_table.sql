-- Migration: Create KV store table (existing remote migration)
-- This file matches the remote migration that already exists

CREATE TABLE kv_store_171cbf6f (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);
