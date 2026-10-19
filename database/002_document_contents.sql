-- Durable private document storage for serverless deployments.
CREATE TABLE IF NOT EXISTS bc.document_contents (
  document_id uuid PRIMARY KEY REFERENCES bc.documents(id) ON DELETE CASCADE,
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 10485760)
);
CREATE TABLE IF NOT EXISTS bc.rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON bc.rate_limits(expires_at);
