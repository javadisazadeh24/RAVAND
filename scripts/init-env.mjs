// Creates .env with a random DB password and AUTH_SECRET.
// Safe to re-run: never overwrites an existing .env.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.env')) {
  console.log('.env already exists - left untouched.');
  process.exit(0);
}

const dbPass = randomBytes(18).toString('hex');
const secret = randomBytes(32).toString('base64');
const out = readFileSync('.env.example', 'utf8')
  .replace(/^DB_PASSWORD=.*$/m, `DB_PASSWORD="${dbPass}"`)
  .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="postgresql://ravand:${dbPass}@127.0.0.1:5432/ravand_os?schema=public"`)
  .replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET="${secret}"`);

writeFileSync('.env', out);
console.log('.env created with random secrets. Do not share or commit it.');
