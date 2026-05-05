-- +goose Up
-- +goose StatementBegin
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
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_canvas_oauth_configs_facility_id;
DROP TABLE IF EXISTS canvas_oauth_configs;
-- +goose StatementEnd
