-- Photo or PDF of an atestado médico, stored encrypted on the server.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ABSENCE_JUSTIFICATION_ATTACHMENT_ADDED';

CREATE TABLE "absence_justification_attachments" (
    "id" UUID NOT NULL,
    "justification_id" UUID NOT NULL,
    "file_name" VARCHAR(160) NOT NULL,
    "mime_type" VARCHAR(40) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "storage_path" VARCHAR(255) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "absence_justification_attachments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "absence_justification_attachments_mime_type" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
    CONSTRAINT "absence_justification_attachments_size" CHECK ("byte_size" > 0 AND "byte_size" <= 10485760),
    CONSTRAINT "absence_justification_attachments_checksum" CHECK ("checksum_sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "absence_justification_attachments_file_name" CHECK (length(btrim("file_name")) >= 1)
);

CREATE UNIQUE INDEX "absence_justification_attachments_storage_path_key"
    ON "absence_justification_attachments"("storage_path");
CREATE INDEX "absence_justification_attachments_justification_id_created_at_idx"
    ON "absence_justification_attachments"("justification_id", "created_at");

ALTER TABLE "absence_justification_attachments"
    ADD CONSTRAINT "absence_justification_attachments_justification_id_fkey" FOREIGN KEY ("justification_id") REFERENCES "absence_justifications"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "absence_justification_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Attachments are evidence: they are never deleted or altered.
CREATE FUNCTION prevent_justification_attachment_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'absence_justification_attachments rows are immutable'
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER absence_justification_attachments_immutable
    BEFORE UPDATE OR DELETE ON "absence_justification_attachments"
    FOR EACH ROW EXECUTE FUNCTION prevent_justification_attachment_change();
