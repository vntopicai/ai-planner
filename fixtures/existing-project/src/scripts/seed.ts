import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { companies, stockPrices, foreignTrading } from '../db/schema';
import { subDays, format } from 'date-fns';

const runSeed = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  console.log('⏳ Ensuring database schema exists...');
  // Create tables directly
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "companies" (
      "id" serial PRIMARY KEY NOT NULL,
      "symbol" text NOT NULL UNIQUE,
      "name" text NOT NULL,
      "exchange" text,
      "industry" text,
      "website" text
    );
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
    CREATE TABLE IF NOT EXISTS "foreign_trading" (
      "id" serial PRIMARY KEY NOT NULL,
      "symbol" text NOT NULL,
      "date" date NOT NULL,
      "buy_volume" integer,
      "sell_volume" integer,
      "net_volume" integer
    );
  `);
  console.log('✅ Schema is ready.');

  console.log('⏳ Seeding database...');
  const start = Date.now();

  // Clear existing data
  await db.delete(stockPrices);
  await db.delete(foreignTrading);
  await db.delete(companies);

  // Seed companies
  const seededCompanies = await db.insert(companies).values([
    { symbol: 'FPT', name: 'FPT Corporation', exchange: 'HOSE', industry: 'Technology' },
    { symbol: 'VCB', name: 'Vietcombank', exchange: 'HOSE', industry: 'Banking' },
    { symbol: 'HPG', name: 'Hoa Phat Group', exchange: 'HOSE', industry: 'Steel' },
    { symbol: 'VIC', name: 'Vingroup', exchange: 'HOSE', industry: 'Real Estate' },
    { symbol: 'VNM', name: 'Vinamilk', exchange: 'HOSE', industry: 'Food & Beverage' },
  ]).returning();

  // Seed stock prices and foreign trading for the last 30 days
  const today = new Date();
  for (const company of seededCompanies) {
    const prices = [];
    const foreignTrades = [];
    for (let i = 0; i < 30; i++) {
      const date = subDays(today, i);
      const open = Math.random() * 100 + 50;
      const close = open + (Math.random() - 0.5) * 10;
      prices.push({
        symbol: company.symbol,
        time: date,
        open: open.toFixed(2),
        high: (open + Math.random() * 5).toFixed(2),
        low: (open - Math.random() * 5).toFixed(2),
        close: close.toFixed(2),
        volume: Math.floor(Math.random() * 1000000) + 100000,
      });

      const buyVolume = Math.floor(Math.random() * 100000);
      const sellVolume = Math.floor(Math.random() * 100000);
      foreignTrades.push({
        symbol: company.symbol,
        date: format(date, 'yyyy-MM-dd'),
        buyVolume: buyVolume,
        sellVolume: sellVolume,
        netVolume: buyVolume - sellVolume,
      });
    }
    await db.insert(stockPrices).values(prices);
    await db.insert(foreignTrading).values(foreignTrades);
  }

  const end = Date.now();
  console.log(`✅ Seeding completed in ${end - start}ms`);

  process.exit(0);
};

runSeed().catch((err) => {
  console.error('❌ Seeding failed');
  console.error(err);
  process.exit(1);
});
