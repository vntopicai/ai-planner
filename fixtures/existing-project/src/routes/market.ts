import { Elysia, t } from 'elysia';
import { db } from '../db';
import { companies, stockPrices } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const marketRoutes = new Elysia({ prefix: '/market' })
  .get('/companies', async () => {
    return db.select().from(companies);
  })
  .get('/companies/:symbol', async ({ params }) => {
    const { symbol } = params;
    const result = await db.select().from(companies).where(eq(companies.symbol, symbol.toUpperCase()));
    if (result.length === 0) {
      return { error: 'Company not found' };
    }
    return result[0];
  })
  .get('/stock-prices/:symbol', async ({ params, query }) => {
    const { symbol } = params;
    const limit = query.limit ? parseInt(query.limit, 10) : 30;

    const result = await db
      .select()
      .from(stockPrices)
      .where(eq(stockPrices.symbol, symbol.toUpperCase()))
      .orderBy(desc(stockPrices.time))
      .limit(limit);

    return result;
  });
