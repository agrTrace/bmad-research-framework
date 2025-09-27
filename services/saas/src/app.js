const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const createCatalogRouter = require('./routes/catalog');
const createProjectsRouter = require('./routes/projects');

async function createApp(options = {}) {
  const {
    rootDir = process.cwd(),
    corsOrigin = '*',
    trustProxy = false,
  } = options;

  const app = express();
  if (trustProxy) {
    app.set('trust proxy', trustProxy === true ? 1 : trustProxy);
  }

  app.use(helmet());
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  const routerOptions = { rootDir };

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'bmad-research-saas' });
  });

  app.use('/api/catalog', createCatalogRouter(routerOptions));
  app.use('/api/projects', createProjectsRouter(routerOptions));

  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
  });

  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error('SaaS service error:', err);
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Unexpected error',
      details: err.details,
    });
  });

  return app;
}

module.exports = createApp;
