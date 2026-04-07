import 'dotenv/config';
import { execSync } from 'child_process';

execSync('npx drizzle-kit generate', { stdio: 'inherit' });
