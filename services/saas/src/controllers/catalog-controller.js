const createCatalogService = require('../services/catalog-service');
const asyncHandler = require('../utils/async-handler');

module.exports = function createCatalogController(options = {}) {
  const service = createCatalogService(options);

  return {
    getOverview: asyncHandler(async (req, res) => {
      const overview = await service.getOverview();
      res.json(overview);
    }),

    listAgents: asyncHandler(async (req, res) => {
      const agents = await service.listAgents({ source: req.query.source });
      res.json({ items: agents });
    }),

    getAgent: asyncHandler(async (req, res) => {
      const agent = await service.getAgent(req.params.id, req.query.source);
      if (!agent) {
        res.status(404).json({ error: `Agent ${req.params.id} not found` });
        return;
      }
      res.json(agent);
    }),

    listTeams: asyncHandler(async (req, res) => {
      const teams = await service.listTeams({ source: req.query.source });
      res.json({ items: teams });
    }),

    getTeam: asyncHandler(async (req, res) => {
      const team = await service.getTeam(req.params.id, req.query.source);
      if (!team) {
        res.status(404).json({ error: `Team ${req.params.id} not found` });
        return;
      }
      res.json(team);
    }),

    listWorkflows: asyncHandler(async (req, res) => {
      const workflows = await service.listWorkflows({ source: req.query.source });
      res.json({ items: workflows });
    }),

    getWorkflow: asyncHandler(async (req, res) => {
      const workflow = await service.getWorkflow(req.params.id, req.query.source);
      if (!workflow) {
        res.status(404).json({ error: `Workflow ${req.params.id} not found` });
        return;
      }
      res.json(workflow);
    }),

    listExpansions: asyncHandler(async (req, res) => {
      const expansions = await service.listExpansions();
      res.json({ items: expansions });
    }),
  };
};
