const express = require('express');

const createProjectsController = require('../controllers/projects-controller');

module.exports = function createProjectsRouter(options = {}) {
  const router = express.Router();
  const controller = createProjectsController(options);

  router.post('/', controller.createProjectPlan);

  return router;
};
