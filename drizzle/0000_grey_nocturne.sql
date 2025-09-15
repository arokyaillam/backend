CREATE TABLE "broker_connections" (
	"connection_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"broker_name" text DEFAULT 'upstox' NOT NULL,
	"upstox_api_key_encrypted" text NOT NULL,
	"upstox_api_secret_encrypted" text NOT NULL,
	"upstox_redirect_uri" text NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_valid_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "broker_connections" ADD CONSTRAINT "broker_connections_user_id_platform_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_users"("user_id") ON DELETE cascade ON UPDATE no action;