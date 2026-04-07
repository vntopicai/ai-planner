CREATE TABLE IF NOT EXISTS "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"exchange" text,
	"industry" text,
	"website" text,
	CONSTRAINT "companies_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "foreign_trading" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"date" date NOT NULL,
	"buy_volume" integer,
	"sell_volume" integer,
	"net_volume" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"open" numeric(10, 2),
	"high" numeric(10, 2),
	"low" numeric(10, 2),
	"close" numeric(10, 2),
	"volume" integer
);
