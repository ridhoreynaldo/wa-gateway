CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'running', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."recipient_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."msg_direction" AS ENUM('out', 'in');--> statement-breakpoint
CREATE TYPE "public"."msg_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('superadmin', 'admin');--> statement-breakpoint
CREATE TYPE "public"."wa_status" AS ENUM('disconnected', 'connecting', 'qr', 'connected', 'logged_out');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"ip" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaign_recipients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"campaign_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "recipient_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	CONSTRAINT "campaign_recipients_uq" UNIQUE("campaign_id","phone")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template" text NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"pause_reason" text,
	"min_delay_sec" integer DEFAULT 25 NOT NULL,
	"max_delay_sec" integer DEFAULT 60 NOT NULL,
	"hourly_limit" integer DEFAULT 40 NOT NULL,
	"daily_limit" integer DEFAULT 200 NOT NULL,
	"batch_size" integer DEFAULT 20 NOT NULL,
	"batch_pause_min_sec" integer DEFAULT 180 NOT NULL,
	"batch_pause_max_sec" integer DEFAULT 420 NOT NULL,
	"window_start_hour" integer DEFAULT 8 NOT NULL,
	"window_end_hour" integer DEFAULT 20 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"batch_progress" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_contacts" (
	"session_id" uuid NOT NULL,
	"jid" text NOT NULL,
	"name" text,
	"notify" text,
	"phone" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_contacts_session_id_jid_pk" PRIMARY KEY("session_id","jid")
);
--> statement-breakpoint
CREATE TABLE "wa_group_participants" (
	"session_id" uuid NOT NULL,
	"group_jid" text NOT NULL,
	"jid" text NOT NULL,
	"phone" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "wa_group_participants_session_id_group_jid_jid_pk" PRIMARY KEY("session_id","group_jid","jid")
);
--> statement-breakpoint
CREATE TABLE "wa_groups" (
	"session_id" uuid NOT NULL,
	"jid" text NOT NULL,
	"subject" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_groups_session_id_jid_pk" PRIMARY KEY("session_id","jid")
);
--> statement-breakpoint
CREATE TABLE "blacklist" (
	"owner_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blacklist_owner_id_phone_pk" PRIMARY KEY("owner_id","phone")
);
--> statement-breakpoint
CREATE TABLE "recipient_list_items" (
	"list_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "recipient_list_items_list_id_phone_pk" PRIMARY KEY("list_id","phone")
);
--> statement-breakpoint
CREATE TABLE "recipient_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" uuid NOT NULL,
	"direction" "msg_direction" NOT NULL,
	"phone" text NOT NULL,
	"wa_message_id" text,
	"body" text NOT NULL,
	"status" "msg_status" DEFAULT 'queued' NOT NULL,
	"campaign_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wa_auth" (
	"session_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "wa_auth_session_id_key_pk" PRIMARY KEY("session_id","key")
);
--> statement-breakpoint
CREATE TABLE "wa_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"status" "wa_status" DEFAULT 'disconnected' NOT NULL,
	"warmup_started_at" timestamp with time zone,
	"last_connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_contacts" ADD CONSTRAINT "wa_contacts_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_group_participants" ADD CONSTRAINT "wa_group_participants_session_id_group_jid_wa_groups_session_id_jid_fk" FOREIGN KEY ("session_id","group_jid") REFERENCES "public"."wa_groups"("session_id","jid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_groups" ADD CONSTRAINT "wa_groups_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklist" ADD CONSTRAINT "blacklist_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_list_items" ADD CONSTRAINT "recipient_list_items_list_id_recipient_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."recipient_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_lists" ADD CONSTRAINT "recipient_lists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_auth" ADD CONSTRAINT "wa_auth_session_id_wa_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wa_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_sessions" ADD CONSTRAINT "wa_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_owner_idx" ON "api_keys" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_exp_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "campaign_recipients_next_idx" ON "campaign_recipients" USING btree ("campaign_id","status","id");--> statement-breakpoint
CREATE INDEX "campaigns_owner_idx" ON "campaigns" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "campaigns_session_idx" ON "campaigns" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_contacts_phone_idx" ON "wa_contacts" USING btree ("session_id","phone");--> statement-breakpoint
CREATE INDEX "wa_gp_group_idx" ON "wa_group_participants" USING btree ("session_id","group_jid");--> statement-breakpoint
CREATE INDEX "recipient_lists_owner_idx" ON "recipient_lists" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "messages_session_created_idx" ON "messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_wa_id_idx" ON "messages" USING btree ("wa_message_id");--> statement-breakpoint
CREATE INDEX "wa_sessions_owner_idx" ON "wa_sessions" USING btree ("owner_id");