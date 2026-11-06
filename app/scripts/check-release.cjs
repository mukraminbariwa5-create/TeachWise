// Explicit release gate: development can run locally; publishing needs real account configuration.
const fs = require('node:fs');
const path = require('node:path');
const { isIP } = require('node:net');
if (process.argv.includes('--eas') && !['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE)) {
  console.log('Development build: production release configuration checks are not required.');
  process.exit(0);
}
const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8')).expo;
const android = process.argv.includes('--android');
const errors = [];
const api = process.env.EXPO_PUBLIC_API_URL;
try {
  const url = new URL(api);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || isIP(host) || /(^|\.)(localhost|example\.(edu|com|org)|local|example|test|invalid)$/.test(host)) throw new Error();
  if (!url.pathname.endsWith('/api')) errors.push('The production API URL must end with /api.');
} catch { errors.push('Set EXPO_PUBLIC_API_URL to the real public HTTPS API address, not localhost or an example domain.'); }
if (android && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(app.extra?.eas?.projectId || '')) {
  errors.push('Link this app to your Expo account with eas init; app.json needs the real EAS project ID.');
}
if (errors.length) {
  console.error('Release configuration is incomplete:\n' + errors.map(e => `- ${e}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${android ? 'Android' : 'Web'} release configuration passed. Hosting smoke tests and device acceptance are separate checks.`);
}
