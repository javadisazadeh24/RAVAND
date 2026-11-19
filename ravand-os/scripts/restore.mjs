// Usage: npm run restore -- ravand-20260101-120000.sql   (file must be inside ./backups)
import { execFileSync } from 'node:child_process';
const file = process.argv[2];
if (!file || !/^[\w.-]+\.sql$/.test(file)) { console.error('Usage: npm run restore -- <file.sql from backups/>'); process.exit(1); }
execFileSync('docker', ['compose', 'exec', '-T', 'db', 'sh', '-c', `psql -U ravand -d ravand_os < /backups/${file}`], { stdio: 'inherit' });
console.log('Restore finished.');
