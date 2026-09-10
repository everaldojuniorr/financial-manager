ALTER TABLE "invoices" ADD COLUMN "stated_total" double precision;
--> statement-breakpoint
CREATE TABLE "obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"segment" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obligation_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"obligation_id" uuid NOT NULL,
	"competence" text NOT NULL,
	"amount" double precision,
	"paid" boolean DEFAULT false NOT NULL,
	"paid_at" text
);
--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "obligation_entries" ADD CONSTRAINT "obligation_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "obligation_entries" ADD CONSTRAINT "obligation_entries_obligation_id_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."obligations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "obligations_user_kind_idx" ON "obligations" USING btree ("user_id","kind");
--> statement-breakpoint
CREATE INDEX "obligations_user_idx" ON "obligations" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "obligation_entries_obligation_competence_idx" ON "obligation_entries" USING btree ("obligation_id","competence");
--> statement-breakpoint
CREATE INDEX "obligation_entries_user_competence_idx" ON "obligation_entries" USING btree ("user_id","competence");
