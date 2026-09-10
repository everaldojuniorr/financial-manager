ALTER TABLE "obligations" ADD COLUMN "installment_current" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN "installment_total" integer DEFAULT 1 NOT NULL;
