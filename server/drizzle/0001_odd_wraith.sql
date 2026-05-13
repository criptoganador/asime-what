CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"nickname" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text DEFAULT 'text',
	"content" text NOT NULL,
	"background_color" text DEFAULT '#6b21a8',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD COLUMN "role" text DEFAULT 'member';--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "avatar" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "type" text DEFAULT 'text';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "file_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "file_type" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "duration" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reply_to_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reactions" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_for" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen" timestamp;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contact_id_users_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;