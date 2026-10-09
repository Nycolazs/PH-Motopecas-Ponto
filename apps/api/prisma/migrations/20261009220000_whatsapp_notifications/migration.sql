-- WhatsApp notifications: administrator contacts and a durable delivery outbox.

CREATE TYPE "NotificationKind" AS ENUM ('LATE_ARRIVAL', 'TEST');

CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "admin_notification_preferences" (
    "user_id" UUID NOT NULL,
    "whatsapp_phone" VARCHAR(20) NOT NULL,
    "late_arrival_alerts" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_notification_preferences_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "admin_notification_preferences_phone_digits" CHECK ("whatsapp_phone" ~ '^[0-9]{10,15}$')
);

CREATE TABLE "notification_outbox" (
    "id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "dedupe_key" VARCHAR(200) NOT NULL,
    "recipient_user_id" UUID,
    "subject_user_id" UUID,
    "phone" VARCHAR(20) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" VARCHAR(500),
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_outbox_attempts_non_negative" CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "notification_outbox_dedupe_key_key" ON "notification_outbox"("dedupe_key");
CREATE INDEX "notification_outbox_status_next_attempt_at_idx" ON "notification_outbox"("status", "next_attempt_at");
CREATE INDEX "notification_outbox_created_at_idx" ON "notification_outbox"("created_at");

ALTER TABLE "admin_notification_preferences" ADD CONSTRAINT "admin_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
