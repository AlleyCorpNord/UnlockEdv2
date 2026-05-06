-- +goose Up
-- +goose StatementBegin
CREATE TABLE canvas_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id INTEGER NOT NULL,
    canvas_url VARCHAR NOT NULL,
    api_key TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    CONSTRAINT unique_facility_canvas_url UNIQUE(facility_id, canvas_url)
);

CREATE INDEX idx_canvas_api_keys_facility_id ON canvas_api_keys(facility_id);
CREATE INDEX idx_canvas_api_keys_canvas_url ON canvas_api_keys(canvas_url);

COMMENT ON TABLE canvas_api_keys IS 'Stores Canvas API keys per facility and Canvas instance';
COMMENT ON COLUMN canvas_api_keys.api_key IS 'Encrypted Canvas API access token generated in Canvas Admin';

DROP TABLE IF EXISTS canvas_oauth_configs;
DROP TABLE IF EXISTS canvas_oauth_state;
DROP INDEX IF EXISTS idx_canvas_oauth_tokens_canvas_url;
DROP INDEX IF EXISTS idx_canvas_oauth_tokens_facility_id;
DROP INDEX IF EXISTS idx_canvas_oauth_tokens_provider_platform_id;
DROP TABLE IF EXISTS canvas_oauth_tokens;
-- +goose StatementEnd

-- +goose Down
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

CREATE TABLE canvas_oauth_state (
    state_token VARCHAR(100) PRIMARY KEY,
    facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    canvas_url VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes'
);

CREATE INDEX idx_canvas_oauth_state_facility_id ON canvas_oauth_state(facility_id);
CREATE INDEX idx_canvas_oauth_state_expires_at ON canvas_oauth_state(expires_at);

CREATE TABLE canvas_oauth_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id INTEGER NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    CONSTRAINT unique_facility_config UNIQUE(facility_id)
);

CREATE INDEX idx_canvas_oauth_configs_facility_id ON canvas_oauth_configs(facility_id);

DROP INDEX IF EXISTS idx_canvas_api_keys_canvas_url;
DROP INDEX IF EXISTS idx_canvas_api_keys_facility_id;
DROP TABLE IF EXISTS canvas_api_keys;
-- +goose StatementEnd
