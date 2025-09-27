const express = require('express');

const createCatalogController = require('../controllers/catalog-controller');

module.exports = function createCatalogRouter(options = {}) {
  const router = express.Router();
  const controller = createCatalogController(options);

  router.get('/', controller.getOverview);
  router.get('/agents', controller.listAgents);
  router.get('/agents/:id', controller.getAgent);
  router.get('/teams', controller.listTeams);
  router.get('/teams/:id', controller.getTeam);
  router.get('/workflows', controller.listWorkflows);
  router.get('/workflows/:id', controller.getWorkflow);
  router.get('/expansions', controller.listExpansions);

  return router;
};
