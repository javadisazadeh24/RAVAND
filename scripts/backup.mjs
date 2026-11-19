// Usage: npm run backup
// Creates backups/ravand-YYYYMMDD-HHMMSS.sql using the local PostgreSQL tools.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function envValue(key) {
  const file = join(root, '.env');
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`));
    if (match) return match[1].trim().replace(/^"(.*)"$/, '$1');
  }
  return null;
}

function findTool(name) {
  if (process.env.PG_BIN) {
    const candidate = join(process.env.PG_BIN, `${name}.exe`);
    if (existsSync(candidate)) return candidate;
  }
  const base = 'C:\\Program Files\\PostgreSQL';
  if (existsSync(base)) {
    const versions = readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const candidate = join(base, version, 'bin', `${name}.exe`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return `${name}.exe`;
}

const databaseUrl = process.env.DATABASE_URL || envValue('DATABASE_URL');
if (!databaseUrl) {
  console.error('DATABASE_URL was not found. Create .env first (npm run setup:env).');
  process.exit(1);
}

const parsed = new URL(databaseUrl);
const database = parsed.pathname.replace(/^\//, '');
const user = decodeURIComponent(parsed.username);
const password = decodeURIComponent(parsed.password);
const host = parsed.hostname || 'localhost';
const port = parsed.port || '5432';

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const file = join(root, 'backups', `ravand-${stamp.slice(0, 8)}-${stamp.slice(8)}.sql`);
mkdirSync(dirname(file), { recursive: true });

execFileSync(findTool('pg_dump'), [
  '-h', host,
  '-p', port,
  '-U', user,
  '-d', database,
  '--clean',
  '--if-exists',
  '-f', file,
], { stdio: 'inherit', env: { ...process.env, PGPASSWORD: password } });

console.log(`Backup written: ${file}`);
