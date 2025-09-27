const createProjectService = require('../services/project-service');
const asyncHandler = require('../utils/async-handler');

module.exports = function createProjectsController(options = {}) {
  const service = createProjectService(options);

  return {
    createProjectPlan: asyncHandler(async (req, res) => {
      const plan = await service.createProjectPlan(req.body || {});
      res.status(201).json(plan);
    }),
  };
};
