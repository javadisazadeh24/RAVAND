// Usage: npm run backup  -> backups/ravand-YYYYMMDD-HHMMSS.sql (requires the db container running)
import { execFileSync } from 'node:child_process';
const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/^(\d{8})(\d{6})$/, '$1-$2');
const file = `ravand-${ts}.sql`;
execFileSync('docker', ['compose', 'exec', '-T', 'db', 'sh', '-c', `pg_dump -U ravand -d ravand_os --clean --if-exists > /backups/${file}`], { stdio: 'inherit' });
console.log(`Backup written: backups/${file}`);
