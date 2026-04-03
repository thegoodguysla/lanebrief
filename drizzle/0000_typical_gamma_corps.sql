CREATE TABLE "briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lane_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lanes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"equipment" text DEFAULT 'dry_van' NOT NULL,
	"alert_threshold_pct" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lanes_user_origin_dest" UNIQUE("user_id","origin","destination","equipment")
);
--> statement-breakpoint
CREATE TABLE "rate_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"lane_id" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"equipment" text NOT NULL,
	"rate_per_mile" real NOT NULL,
	"market_avg_usd_per_mile" real NOT NULL,
	"delta_pct" real NOT NULL,
	"verdict" text NOT NULL,
	"disclaimer" text,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"alert_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_lane_id_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lanes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_snapshots" ADD CONSTRAINT "rate_snapshots_lane_id_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;