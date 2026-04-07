import { pgTable, serial, text, timestamp, integer, date, decimal } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().unique(),
  name: text('name').notNull(),
  exchange: text('exchange'), // HOSE, HNX, UPCOM
  industry: text('industry'),
  website: text('website'),
});

export const stockPrices = pgTable('stock_prices', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull(),
  time: timestamp('time', { withTimezone: true }).notNull(),
  open: decimal('open', { precision: 10, scale: 2 }),
  high: decimal('high', { precision: 10, scale: 2 }),
  low: decimal('low', { precision: 10, scale: 2 }),
  close: decimal('close', { precision: 10, scale: 2 }),
  volume: integer('volume'),
});

export const foreignTrading = pgTable('foreign_trading', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull(),
  date: date('date').notNull(),
  buyVolume: integer('buy_volume'),
  sellVolume: integer('sell_volume'),
  netVolume: integer('net_volume'),
});
