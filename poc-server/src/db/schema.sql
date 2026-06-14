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
  status TEXT NOT NULL DEFAULT 'pending',
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
  ai_value TEXT NOT NULL DEFAULT '',
  user_value TEXT,
  final_value TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  evidence_item_ids_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
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
  prompt TEXT,
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
  total_score INTEGER,
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

CREATE TABLE IF NOT EXISTS llm_audit_logs (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES stores(id) ON DELETE SET NULL,
  related_entity_type TEXT NOT NULL,
  related_entity_id TEXT,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  model TEXT,
  action TEXT NOT NULL,
  request_started_at TEXT NOT NULL,
  response_completed_at TEXT,
  duration_ms INTEGER,
  input_budget_json TEXT NOT NULL DEFAULT 'null',
  prompt_input_json TEXT NOT NULL DEFAULT 'null',
  response_format_json TEXT NOT NULL DEFAULT 'null',
  raw_requested_json TEXT NOT NULL DEFAULT 'null',
  raw_parsed_output_json TEXT NOT NULL DEFAULT 'null',
  normalized_output_json TEXT NOT NULL DEFAULT 'null',
  parsed_output_json TEXT NOT NULL DEFAULT 'null',
  status TEXT NOT NULL,
  error_json TEXT NOT NULL DEFAULT 'null',
  provider_metadata_json TEXT NOT NULL DEFAULT 'null',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_audit_logs_store_id ON llm_audit_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_llm_audit_logs_entity ON llm_audit_logs(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_llm_audit_logs_created_at ON llm_audit_logs(created_at);

CREATE TABLE IF NOT EXISTS v2_blog_formula_sets (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  formula_json TEXT NOT NULL DEFAULT '{}',
  source_post_ids_json TEXT NOT NULL DEFAULT '[]',
  model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_blog_formula_sets_store_id ON v2_blog_formula_sets(store_id);
CREATE INDEX IF NOT EXISTS idx_v2_blog_formula_sets_updated_at ON v2_blog_formula_sets(updated_at);

CREATE TABLE IF NOT EXISTS v2_blog_formula_runs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  formula_set_id TEXT REFERENCES v2_blog_formula_sets(id) ON DELETE SET NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  validation_json TEXT NOT NULL DEFAULT 'null',
  model TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_blog_formula_runs_store_id ON v2_blog_formula_runs(store_id);
CREATE INDEX IF NOT EXISTS idx_v2_blog_formula_runs_formula_set_id ON v2_blog_formula_runs(formula_set_id);

CREATE TABLE IF NOT EXISTS v2_blog_formula_source_posts (
  id TEXT PRIMARY KEY,
  formula_set_id TEXT NOT NULL REFERENCES v2_blog_formula_sets(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  collection_item_id TEXT NOT NULL REFERENCES collection_items(id) ON DELETE CASCADE,
  title TEXT,
  source_url TEXT,
  char_count INTEGER NOT NULL DEFAULT 0,
  is_truncated INTEGER NOT NULL DEFAULT 0,
  used_for_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_blog_formula_source_posts_formula_set_id ON v2_blog_formula_source_posts(formula_set_id);
CREATE INDEX IF NOT EXISTS idx_v2_blog_formula_source_posts_store_id ON v2_blog_formula_source_posts(store_id);

CREATE TABLE IF NOT EXISTS v2_blog_topic_briefs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  main_keyword TEXT NOT NULL,
  secondary_keywords_json TEXT NOT NULL DEFAULT '[]',
  target_reader TEXT,
  core_concern TEXT,
  main_angle TEXT,
  must_include_json TEXT NOT NULL DEFAULT '[]',
  must_avoid_json TEXT NOT NULL DEFAULT '[]',
  cta_direction TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_blog_topic_briefs_store_id ON v2_blog_topic_briefs(store_id);

CREATE TABLE IF NOT EXISTS v2_blog_topic_brief_sets (
  id TEXT PRIMARY KEY,
  formula_set_id TEXT NOT NULL REFERENCES v2_blog_formula_sets(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  source_post_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  main_keyword TEXT NOT NULL,
  secondary_keywords_json TEXT NOT NULL DEFAULT '[]',
  target_reader TEXT,
  core_concern TEXT,
  main_angle TEXT,
  must_include_json TEXT NOT NULL DEFAULT '[]',
  must_avoid_json TEXT NOT NULL DEFAULT '[]',
  cta_direction TEXT,
  confidence REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (formula_set_id, source_post_id)
);

CREATE INDEX IF NOT EXISTS idx_v2_blog_topic_brief_sets_formula_set_id ON v2_blog_topic_brief_sets(formula_set_id);
CREATE INDEX IF NOT EXISTS idx_v2_blog_topic_brief_sets_store_id ON v2_blog_topic_brief_sets(store_id);

CREATE TABLE IF NOT EXISTS v2_blog_retrieval_runs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  topic_brief_id TEXT NOT NULL REFERENCES v2_blog_topic_briefs(id) ON DELETE CASCADE,
  formula_set_id TEXT REFERENCES v2_blog_formula_sets(id) ON DELETE SET NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_blog_retrieval_runs_store_id ON v2_blog_retrieval_runs(store_id);
CREATE INDEX IF NOT EXISTS idx_v2_blog_retrieval_runs_topic_brief_id ON v2_blog_retrieval_runs(topic_brief_id);

CREATE TABLE IF NOT EXISTS v2_blog_retrieved_samples (
  id TEXT PRIMARY KEY,
  retrieval_run_id TEXT NOT NULL REFERENCES v2_blog_retrieval_runs(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  collection_item_id TEXT NOT NULL REFERENCES collection_items(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  total_score REAL NOT NULL,
  scoring_json TEXT NOT NULL DEFAULT '{}',
  why_selected TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_blog_retrieved_samples_retrieval_run_id ON v2_blog_retrieved_samples(retrieval_run_id);
CREATE INDEX IF NOT EXISTS idx_v2_blog_retrieved_samples_store_id ON v2_blog_retrieved_samples(store_id);

CREATE TABLE IF NOT EXISTS v2_blog_draft_generations (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  generation_mode TEXT NOT NULL,
  formula_set_id TEXT REFERENCES v2_blog_formula_sets(id) ON DELETE SET NULL,
  topic_brief_id TEXT REFERENCES v2_blog_topic_briefs(id) ON DELETE SET NULL,
  retrieval_run_id TEXT REFERENCES v2_blog_retrieval_runs(id) ON DELETE SET NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  selected_title TEXT,
  blog_draft TEXT,
  model TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_blog_draft_generations_store_id ON v2_blog_draft_generations(store_id);
CREATE INDEX IF NOT EXISTS idx_v2_blog_draft_generations_topic_brief_id ON v2_blog_draft_generations(topic_brief_id);

CREATE TABLE IF NOT EXISTS v2_blog_draft_validations (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  draft_generation_id TEXT NOT NULL REFERENCES v2_blog_draft_generations(id) ON DELETE CASCADE,
  validation_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_blog_draft_validations_store_id ON v2_blog_draft_validations(store_id);
CREATE INDEX IF NOT EXISTS idx_v2_blog_draft_validations_draft_generation_id ON v2_blog_draft_validations(draft_generation_id);
