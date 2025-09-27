const fs = require('node:fs/promises');
const path = require('node:path');
const yaml = require('js-yaml');

const { extractYamlFromAgent } = require('../../../../tools/lib/yaml-utils');
const { toCamelCase, sortByLocale } = require('../utils/object-utils');

module.exports = function createCatalogService(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '../../../..');
  const coreDir = path.join(rootDir, 'bmad-core');
  const expansionsDir = path.join(rootDir, 'expansion-packs');

  const caches = {
    expansions: null,
    agents: new Map(),
    teams: new Map(),
    workflows: new Map(),
  };

  async function fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async function safeReadDir(dirPath) {
    try {
      return await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }
  }

  async function loadExpansionPacks() {
    if (caches.expansions) return caches.expansions;

    const entries = await safeReadDir(expansionsDir);
    const packs = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const packPath = path.join(expansionsDir, entry.name);
      const configPath = path.join(packPath, 'config.yaml');
      let config = {};
      if (await fileExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf8');
        config = yaml.load(content) || {};
      }
      packs.push({
        id: entry.name,
        name: config.name || entry.name,
        version: config.version || null,
        description: config.description || null,
        compatibility: config.compatibility || {},
        extends: config.extends || [],
        agents: config.agents || [],
        workflows: config.workflows || [],
        templates: config.templates || [],
        dependencies: config.dependencies || [],
        teams: config.teams || [],
        path: packPath,
        config,
      });
    }

    caches.expansions = packs;
    return packs;
  }

  function normaliseSource(source) {
    if (!source) return null;
    if (source === 'core') {
      return { type: 'core', source: 'core' };
    }
    if (source.startsWith('expansion:')) {
      const packId = source.split(':')[1];
      return { type: 'expansion', source, packId };
    }
    // allow passing the folder or config name directly
    return { type: 'expansion', source: `expansion:${source}`, packId: source };
  }

  function buildAgentSummary(agent) {
    return {
      id: agent.id,
      name: agent.name,
      title: agent.title,
      role: agent.role,
      focus: agent.focus,
      whenToUse: agent.whenToUse,
      icon: agent.icon,
      source: agent.source,
      expansionPack: agent.expansionPack,
      summary: agent.summary,
      commandCount: agent.commands.length,
      dependencyTotals: agent.dependencySummary.totalCount,
    };
  }

  function parseCommands(rawCommands) {
    if (!Array.isArray(rawCommands)) return [];
    const commands = [];
    for (const item of rawCommands) {
      if (!item) continue;
      if (typeof item === 'string') {
        const parts = item.split(' - ');
        const command = parts.shift();
        commands.push({
          command: command?.trim() || item.trim(),
          description: parts.length ? parts.join(' - ').trim() : null,
        });
        continue;
      }
      if (typeof item === 'object') {
        const [commandKey, description] = Object.entries(item)[0] || [];
        if (commandKey) {
          commands.push({
            command: String(commandKey).trim(),
            description: typeof description === 'string' ? description.trim() : null,
          });
        }
      }
    }
    return commands;
  }

  function summariseDependencies(dependencies = {}) {
    const summary = { totalCount: 0 };
    for (const [key, values] of Object.entries(dependencies)) {
      const normalisedKey = toCamelCase(key);
      const items = Array.isArray(values) ? values.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))) : [];
      summary[normalisedKey] = {
        items,
        count: items.length,
      };
      summary.totalCount += items.length;
    }
    return summary;
  }

  async function loadAgentFromPath(filePath, sourceMeta) {
    const cacheKey = `${sourceMeta.source}|${filePath}`;
    if (caches.agents.has(cacheKey)) {
      return caches.agents.get(cacheKey);
    }

    const content = await fs.readFile(filePath, 'utf8');
    const yamlContent = extractYamlFromAgent(content);
    const config = yamlContent ? yaml.load(yamlContent) || {} : {};

    const agentInfo = config.agent || {};
    const persona = config.persona || {};
    const rootPrinciples = Array.isArray(config.core_principles) ? config.core_principles : [];
    const personaPrinciples = Array.isArray(persona.core_principles) ? persona.core_principles : [];
    const commands = parseCommands(config.commands);
    const dependencySummary = summariseDependencies(config.dependencies);

    const agent = {
      id: agentInfo.id || path.basename(filePath, path.extname(filePath)),
      name: agentInfo.name || agentInfo.title || persona.role || agentInfo.id,
      title: agentInfo.title || null,
      icon: agentInfo.icon || null,
      role: persona.role || null,
      style: persona.style || null,
      identity: persona.identity || null,
      focus: persona.focus || null,
      whenToUse: agentInfo.whenToUse || null,
      summary: agentInfo.whenToUse || persona.focus || persona.role || null,
      activationInstructions: config['activation-instructions'] || config.activationInstructions || [],
      requestResolution: config['REQUEST-RESOLUTION'] || config.requestResolution || null,
      ideFileResolution: config['IDE-FILE-RESOLUTION'] || config.ideFileResolution || null,
      commands,
      dependencySummary,
      content,
      config,
      source: sourceMeta.source,
      expansionPack: sourceMeta.packId || null,
      relativePath: path.relative(rootDir, filePath),
      corePrinciples: [...new Set([...rootPrinciples, ...personaPrinciples])],
    };

    caches.agents.set(cacheKey, agent);
    return agent;
  }

  async function loadAgentsFromDir(dirPath, sourceMeta) {
    const entries = await safeReadDir(dirPath);
    const agents = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filePath = path.join(dirPath, entry.name);
      try {
        const agent = await loadAgentFromPath(filePath, sourceMeta);
        agents.push(buildAgentSummary(agent));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to load agent ${entry.name}:`, error.message);
      }
    }
    return sortByLocale(agents, (item) => item.name || item.id);
  }

  async function findAgent(agentId, sourceHint) {
    if (sourceHint) {
      const sourceMeta = normaliseSource(sourceHint);
      if (sourceMeta?.type === 'core') {
        const filePath = path.join(coreDir, 'agents', `${agentId}.md`);
        if (await fileExists(filePath)) {
          return { filePath, sourceMeta };
        }
        return null;
      }
      if (sourceMeta?.type === 'expansion') {
        const packs = await loadExpansionPacks();
        const pack = packs.find((item) => item.id === sourceMeta.packId);
        if (!pack) return null;
        const filePath = path.join(pack.path, 'agents', `${agentId}.md`);
        if (await fileExists(filePath)) {
          return { filePath, sourceMeta };
        }
        return null;
      }
    }

    // search expansion packs first
    const packs = await loadExpansionPacks();
    for (const pack of packs) {
      const filePath = path.join(pack.path, 'agents', `${agentId}.md`);
      if (await fileExists(filePath)) {
        return { filePath, sourceMeta: { type: 'expansion', source: `expansion:${pack.id}`, packId: pack.id } };
      }
    }

    // fallback to core
    const corePath = path.join(coreDir, 'agents', `${agentId}.md`);
    if (await fileExists(corePath)) {
      return { filePath: corePath, sourceMeta: { type: 'core', source: 'core' } };
    }

    return null;
  }

  function buildTeamSummary(team) {
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      domain: team.domain,
      useCase: team.useCase,
      source: team.source,
      expansionPack: team.expansionPack,
      hierarchy: team.hierarchy,
      totalMembers: team.members.length,
    };
  }

  function normaliseTeamScaling(rawScaling = {}) {
    const result = {};
    for (const [key, value] of Object.entries(rawScaling)) {
      const camelKey = toCamelCase(key);
      result[camelKey] = {
        key,
        totalAgents: value?.total_agents ?? null,
        description: value?.description || null,
        specialistInstances: value?.specialist_instances ?? null,
        reviewerInstances: value?.reviewer_instances ?? null,
      };
    }
    return result;
  }

  function normaliseTeam(data, sourceMeta) {
    const teamInfo = data.team || {};
    return {
      id: teamInfo.id,
      name: teamInfo.name,
      version: teamInfo.version || null,
      description: teamInfo.description || null,
      domain: teamInfo.domain || null,
      useCase: teamInfo.use_case || null,
      members: Array.isArray(data.members) ? data.members : [],
      hierarchy: Array.isArray(data.hierarchy) ? data.hierarchy : [],
      collaborationPatterns: data.collaboration_patterns || {},
      teamScaling: normaliseTeamScaling(data.team_scaling || {}),
      qualityAssurance: data.quality_assurance || {},
      setupGuide: data.setup_guide || {},
      source: sourceMeta.source,
      expansionPack: sourceMeta.packId || null,
      relativePath: path.relative(rootDir, sourceMeta.filePath),
    };
  }

  async function loadTeamFromPath(filePath, sourceMeta) {
    const cacheKey = `${sourceMeta.source}|${filePath}`;
    if (caches.teams.has(cacheKey)) return caches.teams.get(cacheKey);

    const content = await fs.readFile(filePath, 'utf8');
    const data = yaml.load(content) || {};
    const team = normaliseTeam({ ...data, content }, { ...sourceMeta, filePath });
    team.content = content;
    caches.teams.set(cacheKey, team);
    return team;
  }

  async function loadTeamsFromDir(dirPath, sourceMeta) {
    const entries = await safeReadDir(dirPath);
    const teams = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.yaml')) continue;
      const filePath = path.join(dirPath, entry.name);
      try {
        const team = await loadTeamFromPath(filePath, sourceMeta);
        teams.push(buildTeamSummary(team));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to load team ${entry.name}:`, error.message);
      }
    }
    return sortByLocale(teams, (item) => item.name || item.id);
  }

  async function findTeam(teamId, sourceHint) {
    if (sourceHint) {
      const sourceMeta = normaliseSource(sourceHint);
      if (sourceMeta?.type === 'core') {
        const filePath = path.join(coreDir, 'agent-teams', `${teamId}.yaml`);
        if (await fileExists(filePath)) return { filePath, sourceMeta };
        return null;
      }
      if (sourceMeta?.type === 'expansion') {
        const packs = await loadExpansionPacks();
        const pack = packs.find((item) => item.id === sourceMeta.packId);
        if (!pack) return null;
        const filePath = path.join(pack.path, 'agent-teams', `${teamId}.yaml`);
        if (await fileExists(filePath)) return { filePath, sourceMeta };
        return null;
      }
    }

    const packs = await loadExpansionPacks();
    for (const pack of packs) {
      const filePath = path.join(pack.path, 'agent-teams', `${teamId}.yaml`);
      if (await fileExists(filePath)) {
        return { filePath, sourceMeta: { type: 'expansion', source: `expansion:${pack.id}`, packId: pack.id } };
      }
    }

    const corePath = path.join(coreDir, 'agent-teams', `${teamId}.yaml`);
    if (await fileExists(corePath)) {
      return { filePath: corePath, sourceMeta: { type: 'core', source: 'core' } };
    }

    return null;
  }

  function buildWorkflowSummary(workflow) {
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      domain: workflow.metadata?.domain || null,
      phases: workflow.phases,
      source: workflow.source,
      expansionPack: workflow.expansionPack,
    };
  }

  function normaliseWorkflow(data, sourceMeta) {
    const workflowInfo = data.workflow || {};
    const normalisedSteps = Array.isArray(data.steps)
      ? data.steps.map((step) => {
          const normalisedStep = {};
          for (const [key, value] of Object.entries(step)) {
            normalisedStep[toCamelCase(key)] = value;
          }
          return normalisedStep;
        })
      : [];

    const normalisedPhases = Array.isArray(data.phases)
      ? data.phases.map((phase) => {
          const normalisedPhase = {};
          for (const [key, value] of Object.entries(phase)) {
            normalisedPhase[toCamelCase(key)] = value;
          }
          return normalisedPhase;
        })
      : [];

    const normalisedQualityGates = Array.isArray(data.quality_gates)
      ? data.quality_gates.map((gate) => {
          const normalisedGate = {};
          for (const [key, value] of Object.entries(gate)) {
            normalisedGate[toCamelCase(key)] = value;
          }
          return normalisedGate;
        })
      : [];

    return {
      id: workflowInfo.id,
      name: workflowInfo.name,
      version: workflowInfo.version || null,
      description: workflowInfo.description || null,
      metadata: data.metadata || {},
      phases: normalisedPhases,
      steps: normalisedSteps,
      qualityGates: normalisedQualityGates,
      riskManagement: data.risk_management || [],
      successCriteria: data.success_criteria || [],
      source: sourceMeta.source,
      expansionPack: sourceMeta.packId || null,
      relativePath: path.relative(rootDir, sourceMeta.filePath),
      content: data.content,
    };
  }

  async function loadWorkflowFromPath(filePath, sourceMeta) {
    const cacheKey = `${sourceMeta.source}|${filePath}`;
    if (caches.workflows.has(cacheKey)) return caches.workflows.get(cacheKey);

    const content = await fs.readFile(filePath, 'utf8');
    const data = yaml.load(content) || {};
    const workflow = normaliseWorkflow({ ...data, content }, { ...sourceMeta, filePath });
    caches.workflows.set(cacheKey, workflow);
    return workflow;
  }

  async function loadWorkflowsFromDir(dirPath, sourceMeta) {
    const entries = await safeReadDir(dirPath);
    const workflows = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.yaml')) continue;
      const filePath = path.join(dirPath, entry.name);
      try {
        const workflow = await loadWorkflowFromPath(filePath, sourceMeta);
        workflows.push(buildWorkflowSummary(workflow));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to load workflow ${entry.name}:`, error.message);
      }
    }
    return sortByLocale(workflows, (item) => item.name || item.id);
  }

  async function findWorkflow(workflowId, sourceHint) {
    if (sourceHint) {
      const sourceMeta = normaliseSource(sourceHint);
      if (sourceMeta?.type === 'core') {
        const filePath = path.join(coreDir, 'workflows', `${workflowId}.yaml`);
        if (await fileExists(filePath)) return { filePath, sourceMeta };
        return null;
      }
      if (sourceMeta?.type === 'expansion') {
        const packs = await loadExpansionPacks();
        const pack = packs.find((item) => item.id === sourceMeta.packId);
        if (!pack) return null;
        const filePath = path.join(pack.path, 'workflows', `${workflowId}.yaml`);
        if (await fileExists(filePath)) return { filePath, sourceMeta };
        return null;
      }
    }

    const packs = await loadExpansionPacks();
    for (const pack of packs) {
      const filePath = path.join(pack.path, 'workflows', `${workflowId}.yaml`);
      if (await fileExists(filePath)) {
        return { filePath, sourceMeta: { type: 'expansion', source: `expansion:${pack.id}`, packId: pack.id } };
      }
    }

    const corePath = path.join(coreDir, 'workflows', `${workflowId}.yaml`);
    if (await fileExists(corePath)) {
      return { filePath: corePath, sourceMeta: { type: 'core', source: 'core' } };
    }

    return null;
  }

  return {
    async getOverview() {
      const [agents, teams, workflows, expansions] = await Promise.all([
        this.listAgents(),
        this.listTeams(),
        this.listWorkflows(),
        this.listExpansions(),
      ]);

      const coreAgents = agents.filter((agent) => agent.source === 'core').length;
      const expansionAgents = agents.length - coreAgents;

      return {
        message: 'BMAD Research Framework SaaS catalog overview',
        stats: {
          totalAgents: agents.length,
          coreAgents,
          expansionAgents,
          totalTeams: teams.length,
          totalWorkflows: workflows.length,
          expansionPacks: expansions.length,
        },
        endpoints: {
          health: '/health',
          catalog: '/api/catalog',
          agents: '/api/catalog/agents',
          teams: '/api/catalog/teams',
          workflows: '/api/catalog/workflows',
          expansions: '/api/catalog/expansions',
          projectPlanning: '/api/projects',
        },
      };
    },

    async listAgents({ source } = {}) {
      if (source) {
        const sourceMeta = normaliseSource(source);
        if (sourceMeta?.type === 'core') {
          return loadAgentsFromDir(path.join(coreDir, 'agents'), sourceMeta);
        }
        if (sourceMeta?.type === 'expansion') {
          const packs = await loadExpansionPacks();
          const pack = packs.find((item) => item.id === sourceMeta.packId);
          if (!pack) return [];
          return loadAgentsFromDir(path.join(pack.path, 'agents'), { ...sourceMeta });
        }
      }

      const coreAgents = await loadAgentsFromDir(path.join(coreDir, 'agents'), { type: 'core', source: 'core' });
      const packs = await loadExpansionPacks();
      const expansionAgents = [];
      for (const pack of packs) {
        const agents = await loadAgentsFromDir(path.join(pack.path, 'agents'), {
          type: 'expansion',
          source: `expansion:${pack.id}`,
          packId: pack.id,
        });
        expansionAgents.push(...agents);
      }

      return sortByLocale([...coreAgents, ...expansionAgents], (item) => item.name || item.id);
    },

    async getAgent(agentId, source) {
      const location = await findAgent(agentId, source);
      if (!location) return null;
      const agent = await loadAgentFromPath(location.filePath, location.sourceMeta);

      return {
        ...agent,
        dependencySummary: agent.dependencySummary,
      };
    },

    async listTeams({ source } = {}) {
      if (source) {
        const sourceMeta = normaliseSource(source);
        if (sourceMeta?.type === 'core') {
          return loadTeamsFromDir(path.join(coreDir, 'agent-teams'), sourceMeta);
        }
        if (sourceMeta?.type === 'expansion') {
          const packs = await loadExpansionPacks();
          const pack = packs.find((item) => item.id === sourceMeta.packId);
          if (!pack) return [];
          return loadTeamsFromDir(path.join(pack.path, 'agent-teams'), { ...sourceMeta });
        }
      }

      const teams = [];
      const coreTeamsDir = path.join(coreDir, 'agent-teams');
      if (await fileExists(coreTeamsDir)) {
        teams.push(
          ...(await loadTeamsFromDir(coreTeamsDir, { type: 'core', source: 'core' })),
        );
      }
      const packs = await loadExpansionPacks();
      for (const pack of packs) {
        const dir = path.join(pack.path, 'agent-teams');
        if (!(await fileExists(dir))) continue;
        const packTeams = await loadTeamsFromDir(dir, {
          type: 'expansion',
          source: `expansion:${pack.id}`,
          packId: pack.id,
        });
        teams.push(...packTeams);
      }
      return sortByLocale(teams, (item) => item.name || item.id);
    },

    async getTeam(teamId, source) {
      const location = await findTeam(teamId, source);
      if (!location) return null;
      const team = await loadTeamFromPath(location.filePath, location.sourceMeta);
      return team;
    },

    async listWorkflows({ source } = {}) {
      if (source) {
        const sourceMeta = normaliseSource(source);
        if (sourceMeta?.type === 'core') {
          return loadWorkflowsFromDir(path.join(coreDir, 'workflows'), sourceMeta);
        }
        if (sourceMeta?.type === 'expansion') {
          const packs = await loadExpansionPacks();
          const pack = packs.find((item) => item.id === sourceMeta.packId);
          if (!pack) return [];
          return loadWorkflowsFromDir(path.join(pack.path, 'workflows'), { ...sourceMeta });
        }
      }

      const workflows = [];
      const coreWorkflowDir = path.join(coreDir, 'workflows');
      if (await fileExists(coreWorkflowDir)) {
        workflows.push(
          ...(await loadWorkflowsFromDir(coreWorkflowDir, { type: 'core', source: 'core' })),
        );
      }
      const packs = await loadExpansionPacks();
      for (const pack of packs) {
        const dir = path.join(pack.path, 'workflows');
        if (!(await fileExists(dir))) continue;
        const packWorkflows = await loadWorkflowsFromDir(dir, {
          type: 'expansion',
          source: `expansion:${pack.id}`,
          packId: pack.id,
        });
        workflows.push(...packWorkflows);
      }
      return sortByLocale(workflows, (item) => item.name || item.id);
    },

    async getWorkflow(workflowId, source) {
      const location = await findWorkflow(workflowId, source);
      if (!location) return null;
      const workflow = await loadWorkflowFromPath(location.filePath, location.sourceMeta);
      return workflow;
    },

    async listExpansions() {
      const packs = await loadExpansionPacks();
      return packs.map((pack) => ({
        id: pack.id,
        name: pack.name,
        version: pack.version,
        description: pack.description,
        compatibility: pack.compatibility,
        agents: pack.agents,
        workflows: pack.workflows,
        templates: pack.templates,
        dependencies: pack.dependencies,
        teams: pack.teams,
      }));
    },
  };
};
