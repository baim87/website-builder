import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test variables BEFORE any tests run
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
