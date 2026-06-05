CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  naver_place_url TEXT,
  naver_place_id TEXT,
  category TEXT,
  address TEXT,
  phone TEXT,
  description TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS store_channels (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL,
  provider_mode TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_store_channels_store_id ON store_channels(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_channels_store_channel ON store_channels(store_id, channel);

CREATE TABLE IF NOT EXISTS training_settings (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_settings_store_id ON training_settings(store_id);

CREATE TABLE IF NOT EXISTS collection_runs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collection_runs_store_id ON collection_runs(store_id);

CREATE TABLE IF NOT EXISTS collection_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES collection_runs(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  body_text TEXT,
  selected_for_analysis INTEGER NOT NULL DEFAULT 0,
  selection_reason TEXT,
  selected_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collection_items_run_id ON collection_items(run_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_store_id ON collection_items(store_id);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  collection_run_id TEXT NOT NULL REFERENCES collection_runs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  result_json TEXT NOT NULL DEFAULT '{}',
  error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_store_id ON analysis_runs(store_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_collection_run_id ON analysis_runs(collection_run_id);

CREATE TABLE IF NOT EXISTS analysis_evidence (
  id TEXT PRIMARY KEY,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  collection_item_id TEXT REFERENCES collection_items(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  score REAL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_evidence_analysis_run_id ON analysis_evidence(analysis_run_id);

CREATE TABLE IF NOT EXISTS learning_snapshots (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_snapshots_store_id ON learning_snapshots(store_id);

CREATE TABLE IF NOT EXISTS marketing_rulesets (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  learning_snapshot_id TEXT REFERENCES learning_snapshots(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL,
  ruleset_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_rulesets_store_id ON marketing_rulesets(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_rulesets_store_version ON marketing_rulesets(store_id, version);

CREATE TABLE IF NOT EXISTS ruleset_fields (
  id TEXT PRIMARY KEY,
  ruleset_id TEXT NOT NULL REFERENCES marketing_rulesets(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_value TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ruleset_fields_ruleset_id ON ruleset_fields(ruleset_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ruleset_fields_ruleset_key ON ruleset_fields(ruleset_id, field_key);

CREATE TABLE IF NOT EXISTS content_generations (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  ruleset_id TEXT REFERENCES marketing_rulesets(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  content_type TEXT NOT NULL,
  prompt_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_generations_store_id ON content_generations(store_id);
CREATE INDEX IF NOT EXISTS idx_content_generations_ruleset_id ON content_generations(ruleset_id);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  content_generation_id TEXT REFERENCES content_generations(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  article_json TEXT NOT NULL DEFAULT '{}',
  published_url TEXT,
  scheduled_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_store_id ON blog_posts(store_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_content_generation_id ON blog_posts(content_generation_id);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  blog_post_id TEXT REFERENCES blog_posts(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  status TEXT NOT NULL,
  url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_store_id ON media_assets(store_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_blog_post_id ON media_assets(blog_post_id);

CREATE TABLE IF NOT EXISTS seo_scores (
  id TEXT PRIMARY KEY,
  blog_post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  status TEXT NOT NULL,
  rubric_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seo_scores_blog_post_id ON seo_scores(blog_post_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES stores(id) ON DELETE SET NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_store_id ON audit_events(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
