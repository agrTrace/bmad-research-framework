const http = require('node:http');
const path = require('node:path');

const createApp = require('./app');

async function start() {
  const port = Number.parseInt(process.env.PORT, 10) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const rootDir = process.env.BMAD_ROOT || path.resolve(__dirname, '../../..');

  const app = await createApp({ rootDir });

  const server = http.createServer(app);
  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`BMAD Research SaaS listening on http://${host}:${port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start SaaS service:', error);
  process.exit(1);
});
