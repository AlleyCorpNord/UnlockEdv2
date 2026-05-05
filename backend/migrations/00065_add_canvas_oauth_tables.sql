-- +goose Up
-- +goose StatementBegin
CREATE TABLE canvas_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_platform_id INTEGER NOT NULL REFERENCES provider_platforms(id) ON DELETE CASCADE,
    facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    canvas_url VARCHAR NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    state VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider_platform_id, facility_id, canvas_url)
);

CREATE INDEX idx_canvas_oauth_tokens_provider_platform_id ON canvas_oauth_tokens(provider_platform_id);
CREATE INDEX idx_canvas_oauth_tokens_facility_id ON canvas_oauth_tokens(facility_id);
CREATE INDEX idx_canvas_oauth_tokens_canvas_url ON canvas_oauth_tokens(canvas_url);

COMMENT ON TABLE canvas_oauth_tokens IS 'Stores encrypted Canvas OAuth access tokens per facility';
COMMENT ON COLUMN canvas_oauth_tokens.access_token IS 'Encrypted Canvas API access token';
COMMENT ON COLUMN canvas_oauth_tokens.refresh_token IS 'Encrypted Canvas refresh token if available';
COMMENT ON COLUMN canvas_oauth_tokens.state IS 'OAuth state for tracking in-flight requests';

CREATE TABLE canvas_oauth_state (
    state_token VARCHAR(100) PRIMARY KEY,
    facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    canvas_url VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes'
);

CREATE INDEX idx_canvas_oauth_state_facility_id ON canvas_oauth_state(facility_id);
CREATE INDEX idx_canvas_oauth_state_expires_at ON canvas_oauth_state(expires_at);

COMMENT ON TABLE canvas_oauth_state IS 'Temporary storage for OAuth state tokens (auto-expires after 10 minutes)';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_canvas_oauth_state_expires_at;
DROP INDEX IF EXISTS idx_canvas_oauth_state_facility_id;
DROP TABLE IF EXISTS canvas_oauth_state;

DROP INDEX IF EXISTS idx_canvas_oauth_tokens_canvas_url;
DROP INDEX IF EXISTS idx_canvas_oauth_tokens_facility_id;
DROP INDEX IF EXISTS idx_canvas_oauth_tokens_provider_platform_id;
DROP TABLE IF EXISTS canvas_oauth_tokens;
-- +goose StatementEnd
