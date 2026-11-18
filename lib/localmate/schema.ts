/** Additive local schema. The V2 handoff will determine production table mapping. */
export const LOCALMATE_PHASE1_SQL = `
CREATE TABLE IF NOT EXISTS localmate_missions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('product_to_market', 'market_to_product')),
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  markets_json TEXT NOT NULL CHECK (json_valid(markets_json)),
  goal TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('awaiting_product', 'research_ready')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status = 'research_ready' AND product_id IS NOT NULL
      OR status = 'awaiting_product' AND product_id IS NULL AND direction = 'market_to_product')
);
CREATE INDEX IF NOT EXISTS localmate_missions_updated ON localmate_missions (updated_at DESC, id);

CREATE TABLE IF NOT EXISTS localmate_benchmarks (
  mission_id TEXT NOT NULL REFERENCES localmate_missions(id) ON DELETE CASCADE,
  market TEXT NOT NULL,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  PRIMARY KEY (mission_id, market)
);

CREATE TABLE IF NOT EXISTS localmate_cost_checks (
  mission_id TEXT NOT NULL REFERENCES localmate_missions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  market TEXT NOT NULL,
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  contribution_minor INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (mission_id, version)
);

CREATE TABLE IF NOT EXISTS localmate_proposals (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES localmate_missions(id) ON DELETE CASCADE,
  market TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  created_at TEXT NOT NULL,
  UNIQUE (mission_id, market, version)
);

CREATE TABLE IF NOT EXISTS localmate_approvals (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE REFERENCES localmate_proposals(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope = 'internal_preparation'),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS localmate_work_items (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL REFERENCES localmate_approvals(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  owner TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'done')),
  UNIQUE (approval_id, ordinal)
);

CREATE TABLE IF NOT EXISTS localmate_listing_drafts (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL REFERENCES localmate_approvals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (approval_id, version)
);

CREATE TABLE IF NOT EXISTS localmate_shopify_drafts (
  draft_id TEXT PRIMARY KEY REFERENCES localmate_listing_drafts(id) ON DELETE CASCADE,
  shop TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('requested', 'verified')),
  remote_id TEXT,
  requested_at TEXT NOT NULL,
  checked_at TEXT
);
CREATE TABLE IF NOT EXISTS localmate_instructions (
  mission_id TEXT NOT NULL REFERENCES localmate_missions(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  input_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  budget_minor INTEGER,
  created_at TEXT NOT NULL,
  PRIMARY KEY (mission_id, request_id)
);
CREATE TABLE IF NOT EXISTS localmate_agent_tasks (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  agent TEXT NOT NULL CHECK(agent IN ('Scout','Margin','Guard','Localizer')),
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  markets_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','waiting','failed')),
  result_json TEXT,
  claim TEXT,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(mission_id, request_id, agent),
  FOREIGN KEY(mission_id, request_id) REFERENCES localmate_instructions(mission_id, request_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS localmate_agent_tasks_queue ON localmate_agent_tasks(status, created_at);
CREATE INDEX IF NOT EXISTS localmate_agent_tasks_mission ON localmate_agent_tasks(mission_id, created_at DESC);

CREATE TABLE IF NOT EXISTS localmate_observations (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES localmate_missions(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  market TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  excerpt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS localmate_observations_mission ON localmate_observations(mission_id, observed_at DESC);
CREATE TABLE IF NOT EXISTS localmate_project_plans (
  mission_id TEXT PRIMARY KEY REFERENCES localmate_missions(id) ON DELETE CASCADE,
  procurement_limit REAL,
  sourcing TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS localmate_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  instructions TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
`;

export const HANDOFF_SQL = `
CREATE TABLE IF NOT EXISTS localmate_listing_variants (
  scope TEXT PRIMARY KEY,
  variants TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS localmate_handoffs (
  scope TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS localmate_handoff_files (
  scope TEXT NOT NULL,
  id TEXT NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (scope, id)
);
`;
