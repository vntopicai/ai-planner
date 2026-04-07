import 'dotenv/config';
import { db } from '../db';
import { stockPrices } from '../db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse';
import { parse as dateParse } from 'date-fns';
const dataDir = path.join(process.cwd(), 'data');
const runImport = async () => {
    console.log('⏳ Starting CSV import process...');
    const start = Date.now();
    try {
        const files = await fs.readdir(dataDir);
        const csvFiles = files.filter((file) => path.extname(file).toLowerCase() === '.csv');
        if (csvFiles.length === 0) {
            console.log('🟡 No CSV files found in the data directory.');
            return;
        }
        for (const file of csvFiles) {
            const symbol = path.basename(file, '.csv').toUpperCase();
            console.log(`  - Processing file for symbol: ${symbol}`);
            const filePath = path.join(dataDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            // Clean old data for this symbol before importing
            console.log(`    - Deleting old data for symbol: ${symbol}`);
            await db.delete(stockPrices).where(eq(stockPrices.symbol, symbol));
            const parser = parse(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                cast: (value, context) => {
                    if (context.column === 'Date' || context.column === '<DTYYYYMMDD>') {
                        // Try parsing multiple common date formats
                        const formats = ['yyyyMMdd', 'yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy/MM/dd'];
                        for (const fmt of formats) {
                            try {
                                const parsedDate = dateParse(value, fmt, new Date());
                                if (!isNaN(parsedDate.getTime())) {
                                    return parsedDate;
                                }
                            }
                            catch (e) {
                                // Ignore parsing errors and try the next format
                            }
                        }
                        // If all formats fail, return an invalid date
                        return new Date(NaN);
                    }
                    if (['Open', 'High', 'Low', 'Close', 'Adj Close', '<Open>', '<High>', '<Low>', '<Close>'].includes(context.column)) {
                        return parseFloat(value);
                    }
                    if (context.column === 'Volume' || context.column === '<Volume>') {
                        return parseInt(value, 10);
                    }
                    return value;
                },
            });
            const batchSize = 1000;
            let batch = [];
            for await (const record of parser) {
                const dateValue = record.Date || record['<DTYYYYMMDD>'];
                if (!dateValue || isNaN(dateValue.getTime())) {
                    console.log(`    ⚠️ Skipping row with invalid date: ${JSON.stringify(record)}`);
                    continue;
                }
                batch.push({
                    symbol: symbol,
                    time: dateValue,
                    open: (record.Open ?? record['<Open>'])?.toFixed(2),
                    high: (record.High ?? record['<High>'])?.toFixed(2),
                    low: (record.Low ?? record['<Low>'])?.toFixed(2),
                    close: (record.Close ?? record['<Close>'])?.toFixed(2),
                    volume: record.Volume ?? record['<Volume>'],
                });
                if (batch.length >= batchSize) {
                    await db.insert(stockPrices).values(batch).onConflictDoNothing();
                    console.log(`    ... Imported ${batch.length} records for ${symbol}.`);
                    batch = [];
                }
            }
            if (batch.length > 0) {
                await db.insert(stockPrices).values(batch).onConflictDoNothing();
                console.log(`    ✅ Imported final ${batch.length} records for ${symbol}.`);
            }
            else if (parser.info.records === 0) {
                console.log(`    🟡 No records to import for ${symbol}.`);
            }
        }
    }
    catch (error) {
        console.error('❌ CSV import failed:', error);
        process.exit(1);
    }
    const end = Date.now();
    console.log(`✅ CSV import completed in ${end - start}ms`);
    process.exit(0);
};
runImport();
//# sourceMappingURL=import-csv.js.map