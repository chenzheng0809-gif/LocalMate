export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  source_platform TEXT NOT NULL,
  source_url TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  images_json TEXT NOT NULL,
  attributes_json TEXT NOT NULL,
  sourcing_json TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  missing_fields_json TEXT NOT NULL,
  extraction_status TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  confirmed_at TEXT,
  mode TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_worker (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS research_jobs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  countries_json TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  current_stage TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_queue ON research_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_product ON research_jobs(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
  country TEXT,
  level TEXT NOT NULL,
  phase TEXT NOT NULL,
  message TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_job ON job_events(job_id, created_at);

CREATE TABLE IF NOT EXISTS market_research (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  status TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(product_id, country)
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  country TEXT,
  kind TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  relevant_excerpt TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  claim_supported TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  origin TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_product ON evidence(product_id, country, kind);

CREATE TABLE IF NOT EXISTS compliance_checks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  scope_status TEXT NOT NULL,
  status TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(product_id, country)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS simulations (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  overrides_json TEXT NOT NULL,
  impacts_json TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_simulations_product ON simulations(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS launch_pages (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(product_id, country)
);

CREATE TABLE IF NOT EXISTS passports (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(product_id, version)
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  operation TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  request_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_product ON ai_usage(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS search_cache (
  cache_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  query TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fetch_cache (
  url TEXT PRIMARY KEY,
  status INTEGER NOT NULL,
  content_text TEXT NOT NULL,
  content_title TEXT,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS ai_daily_limits (
  day TEXT NOT NULL,
  bucket TEXT NOT NULL,
  used INTEGER NOT NULL,
  PRIMARY KEY (day, bucket)
);
`;

export type DbRow = Record<string, unknown>;