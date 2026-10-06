CREATE TABLE jobs (
    id UUID PRIMARY KEY,

    type VARCHAR(100) NOT NULL,

    payload JSONB NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    priority INTEGER NOT NULL DEFAULT 0,

    attempts INTEGER NOT NULL DEFAULT 0,

    max_attempts INTEGER NOT NULL DEFAULT 3,

    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    locked_at TIMESTAMPTZ,

    locked_by VARCHAR(100),

    last_error TEXT,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_ready
ON jobs (priority DESC, run_at ASC)
WHERE status = 'PENDING';

CREATE INDEX idx_jobs_processing
ON jobs (locked_at)
WHERE status = 'PROCESSING';

CREATE INDEX idx_jobs_status
ON jobs (status);