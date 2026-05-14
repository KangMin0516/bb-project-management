-- Transactional outbox for at-least-once delivery of side-effects
-- (Slack DMs, future webhooks, etc.). Rows are written INSIDE the same
-- $transaction as the business write, then a cron publisher polls and
-- dispatches them. See docs/architecture/backend/refactor-plan.md §5.

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    -- Logical event type (e.g. "IssueAssigned"). The publisher dispatches
    -- to a handler registered under this key.
    "event_type" TEXT NOT NULL,
    -- Owning aggregate — denormalized for batch lookups + idempotency
    -- checks on deliver. NOT a real FK (cross-domain).
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    -- Event payload. Whatever shape the producer agreed with the handler
    -- — kept opaque to the publisher.
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Delivery tracking
    "delivered_at" TIMESTAMPTZ,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Per-aggregate ordering. Cross-aggregate ordering is NOT guaranteed.
    "sequence_no" BIGSERIAL NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- Partial index: publisher only scans undelivered rows.
CREATE INDEX "idx_outbox_undelivered"
    ON "outbox_events" ("next_retry_at")
    WHERE "delivered_at" IS NULL;

-- Per-aggregate ordering lookups + idempotency checks.
CREATE INDEX "idx_outbox_aggregate"
    ON "outbox_events" ("aggregate_type", "aggregate_id", "sequence_no");

-- For periodic prune of delivered rows (retention job).
CREATE INDEX "idx_outbox_cleanup"
    ON "outbox_events" ("delivered_at")
    WHERE "delivered_at" IS NOT NULL;
