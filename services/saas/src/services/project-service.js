const path = require('node:path');

const createCatalogService = require('./catalog-service');

const RESEARCH_PROFILES = [
  {
    id: 'fundamental',
    labels: ['基础研究', '基础理论研究', 'fundamental'],
    summary: '关注理论创新与方法论验证，需要严谨的研究设计与知识积累。',
    emphasis: {
      planning_configuration: '聚焦理论框架的清晰化与研究边界界定。',
      research_preparation: '加强文献综述和知识图谱构建，确保理论扎实。',
      execution_phase: '强调实验设计的可重复性与数据可信度。',
    },
    metrics: ['理论创新度', '方法论严谨性', '学术影响力'],
    riskFocus: ['模型假设偏差', '实验验证困难'],
    knowledgeFocus: '加强基础理论文献与前沿研究成果的整合。',
    recommendedTeamScaling: 'standardConfig',
  },
  {
    id: 'applied',
    labels: ['应用研究', '工程技术攻关', 'applied research', '工程研究'],
    summary: '面向实际应用问题，强调跨专业协作与成果转化。',
    emphasis: {
      planning_configuration: '突出需求分析与应用场景定义。',
      execution_phase: '强化多专业团队的协同执行与进度管理。',
      reporting_phase: '聚焦成果转化方案与可实施性评估。',
    },
    metrics: ['解决方案成熟度', '成果转化潜力', '项目交付及时性'],
    riskFocus: ['需求变更', '资源协调', '技术集成风险'],
    knowledgeFocus: '结合行业标准、专利与应用案例库。',
    recommendedTeamScaling: 'fullConfig',
  },
  {
    id: 'social-science',
    labels: ['社会科学', '社会科学研究', 'social science'],
    summary: '强调定性与定量结合，注重研究对象与伦理合规。',
    emphasis: {
      planning_configuration: '完善研究问题界定与样本设计。',
      research_preparation: '强化数据收集方案与伦理审查流程。',
      reporting_phase: '突出洞察解读与政策建议。',
    },
    metrics: ['样本代表性', '研究伦理合规', '社会影响力'],
    riskFocus: ['样本偏差', '数据隐私风险'],
    knowledgeFocus: '补充领域调研报告、问卷与案例研究模板。',
    recommendedTeamScaling: 'standardConfig',
  },
  {
    id: 'default',
    labels: ['default'],
    summary: '通用科研项目配置，兼顾规划、执行与成果产出。',
    emphasis: {
      planning_configuration: '确保目标明确与资源配置到位。',
      research_preparation: '构建充足的知识支撑体系。',
      execution_phase: '保持多团队协作节奏。',
      reporting_phase: '形成标准化成果交付物。',
    },
    metrics: ['里程碑达成度', '知识积累完整性', '成果交付质量'],
    riskFocus: ['跨团队协作', '时间进度控制'],
    knowledgeFocus: '保持知识库、模板与任务的持续更新。',
    recommendedTeamScaling: 'standardConfig',
  },
];

function selectProfile(researchType) {
  const input = (researchType || '').trim().toLowerCase();
  if (!input) return RESEARCH_PROFILES.find((profile) => profile.id === 'default');
  return (
    RESEARCH_PROFILES.find((profile) =>
      profile.labels.some((label) => input.includes(label.toLowerCase())),
    ) || RESEARCH_PROFILES.find((profile) => profile.id === 'default')
  );
}

function normaliseObjectives(objectives) {
  if (!objectives) return [];
  if (Array.isArray(objectives)) return objectives.filter(Boolean);
  return String(objectives)
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractInitializationSteps(setupGuide = {}) {
  const { project_initialization: projectInit } = setupGuide;
  if (!projectInit) return [];
  if (Array.isArray(projectInit)) return projectInit;
  if (typeof projectInit === 'object') {
    return Object.keys(projectInit)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => projectInit[key])
      .filter(Boolean);
  }
  return [];
}

function chooseTeamScaling(teamScaling = {}, requestedSize, preferredKey) {
  const entries = Object.entries(teamScaling).map(([key, value]) => ({ key, ...value }));
  if (!entries.length) {
    return { selected: null, options: teamScaling, rationale: '团队配置没有预设规模建议。' };
  }

  let selected = null;
  if (preferredKey && teamScaling[preferredKey]) {
    selected = { key: preferredKey, ...teamScaling[preferredKey] };
  }

  if (!selected && Number.isFinite(requestedSize)) {
    const candidates = entries
      .filter((entry) => Number.isFinite(entry.totalAgents))
      .sort((a, b) => a.totalAgents - b.totalAgents);
    for (const option of candidates) {
      if (requestedSize <= option.totalAgents) {
        selected = option;
        break;
      }
    }
    if (!selected && candidates.length) {
      selected = candidates[candidates.length - 1];
    }
  }

  if (!selected) {
    selected = entries[0];
  }

  const rationaleParts = [];
  if (preferredKey && selected.key === preferredKey) {
    rationaleParts.push('按研究类型建议选择该团队规模。');
  }
  if (Number.isFinite(requestedSize)) {
    rationaleParts.push(`根据期望团队规模≈${requestedSize}人进行匹配。`);
  }

  return {
    selected,
    options: teamScaling,
    rationale: rationaleParts.length ? rationaleParts.join(' ') : '采用默认团队规模配置。',
  };
}

function buildPhasePlan(workflow, profile) {
  const stepsByPhase = workflow.steps.reduce((acc, step) => {
    const key = step.phase;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(step);
    return acc;
  }, new Map());

  return workflow.phases.map((phase) => {
    const phaseSteps = stepsByPhase.get(phase.id) || [];
    const emphasis = profile.emphasis?.[phase.id] || profile.emphasis?.[phase.name];
    return {
      ...phase,
      steps: phaseSteps,
      emphasis: emphasis || null,
      priority: emphasis ? 'high' : 'standard',
    };
  });
}

function gatherDeliverables(workflow) {
  const deliverables = [];
  for (const step of workflow.steps) {
    if (!Array.isArray(step.outputs) || !step.outputs.length) continue;
    for (const output of step.outputs) {
      deliverables.push({
        phase: step.phase,
        stepId: step.id,
        stepName: step.name,
        agent: step.agent,
        output,
      });
    }
  }
  return deliverables;
}

function gatherInteractionPoints(workflow) {
  return workflow.steps
    .filter((step) => step.interactionRequired)
    .map((step) => ({
      phase: step.phase,
      stepId: step.id,
      stepName: step.name,
      agent: step.agent,
      description: step.description,
    }));
}

function parseAgentReference(reference) {
  if (typeof reference !== 'string') return null;
  const match = reference.match(/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

function normaliseId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'object' && value.id) return String(value.id).trim() || null;
  return null;
}

function buildResolutionQueue({
  requestedId,
  requestedSource,
  fallbackId,
  fallbackSources = [],
}) {
  const queue = [];
  if (requestedId) {
    queue.push({ id: requestedId, source: requestedSource });
    if (!requestedSource) {
      fallbackSources.forEach((source) => {
        queue.push({ id: requestedId, source });
      });
    }
    queue.push({ id: requestedId });
  }

  if (fallbackId) {
    fallbackSources.forEach((source) => {
      queue.push({ id: fallbackId, source });
    });
    queue.push({ id: fallbackId });
  }

  return queue;
}

async function resolveCatalogEntity(fetcher, candidates) {
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate?.id) continue;
    const source = candidate.source || undefined;
    const key = `${candidate.id}|${source || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // eslint-disable-next-line no-await-in-loop
    const entity = await fetcher(candidate.id, source);
    if (entity) return entity;
  }
  return null;
}

module.exports = function createProjectService(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '../../../..');
  const catalogService = options.catalogService || createCatalogService({ rootDir });
  const defaultPackId = options.defaultPackId || 'bmad-research-framework';
  const defaultTeamId = options.defaultTeamId || 'research-full-team';
  const defaultWorkflowId = options.defaultWorkflowId || 'universal-research-workflow';
  const defaultTeamSource = options.defaultTeamSource || null;
  const defaultWorkflowSource = options.defaultWorkflowSource || null;

  return {
    async createProjectPlan(payload = {}) {
      const projectName = (payload.projectName || payload.name || '未命名科研项目').trim();
      const researchType = payload.researchType || payload.type || '通用科研';
      const objectives = normaliseObjectives(payload.objectives || payload.goals);
      const desiredOutcomes = normaliseObjectives(payload.desiredOutcomes || payload.expectedOutputs);
      const timeframe = payload.timeframe || payload.timeline || null;
      const requestedTeamSize = Number.isFinite(Number(payload.teamSize))
        ? Number(payload.teamSize)
        : Number.isFinite(Number(payload.expectedTeamSize))
        ? Number(payload.expectedTeamSize)
        : null;

      const profile = selectProfile(researchType);

      const expansions = await catalogService.listExpansions();
      const requestedPackId =
        normaliseId(payload.expansionPackId || payload.expansionPack || payload.packId) || null;
      let expansionPack = null;
      if (requestedPackId) {
        expansionPack = expansions.find((pack) => pack.id === requestedPackId) || null;
      }
      if (!expansionPack) {
        expansionPack =
          expansions.find((pack) => pack.id === defaultPackId) || expansions[0] || null;
      }

      const defaultSources = [];
      if (defaultTeamSource) defaultSources.push(defaultTeamSource);
      if (defaultWorkflowSource) defaultSources.push(defaultWorkflowSource);
      if (expansionPack) defaultSources.push(`expansion:${expansionPack.id}`);

      const requestedTeamId = normaliseId(payload.teamId || payload.team);
      const requestedTeamSource = normaliseId(payload.teamSource || payload.team?.source);
      const requestedWorkflowId = normaliseId(payload.workflowId || payload.workflow);
      const requestedWorkflowSource = normaliseId(
        payload.workflowSource || payload.workflow?.source,
      );

      const team = await resolveCatalogEntity(
        (id, source) => catalogService.getTeam(id, source),
        buildResolutionQueue({
          requestedId: requestedTeamId,
          requestedSource: requestedTeamSource,
          fallbackId: defaultTeamId,
          fallbackSources: defaultSources,
        }),
      );

      const workflow = await resolveCatalogEntity(
        (id, source) => catalogService.getWorkflow(id, source),
        buildResolutionQueue({
          requestedId: requestedWorkflowId,
          requestedSource: requestedWorkflowSource,
          fallbackId: defaultWorkflowId,
          fallbackSources: defaultSources,
        }),
      );

      if (!team) {
        const error = new Error('未找到科研团队配置文件，无法生成项目方案。');
        error.status = 500;
        throw error;
      }
      if (!workflow) {
        const error = new Error('未找到科研工作流定义，无法生成项目方案。');
        error.status = 500;
        throw error;
      }

      const phasePlan = buildPhasePlan(workflow, profile);
      const deliverables = gatherDeliverables(workflow);
      const interactionPoints = gatherInteractionPoints(workflow);
      const scalingRecommendation = chooseTeamScaling(team.teamScaling, requestedTeamSize, profile.recommendedTeamScaling);

      const agentIds = new Set();
      for (const member of team.members) {
        if (member.agent) agentIds.add(member.agent);
      }
      for (const step of workflow.steps) {
        if (step.agent && step.agent !== 'human-user') {
          agentIds.add(step.agent);
        }
        if (Array.isArray(step.subAgents)) {
          for (const ref of step.subAgents) {
            const parsed = parseAgentReference(ref);
            if (parsed) agentIds.add(parsed);
          }
        }
      }

      const agentDetails = [];
      const agentSourceHints = new Set();
      if (team.source) agentSourceHints.add(team.source);
      if (workflow.source) agentSourceHints.add(workflow.source);
      if (expansionPack) agentSourceHints.add(`expansion:${expansionPack.id}`);

      for (const agentId of agentIds) {
        let detail = null;
        for (const sourceHint of agentSourceHints) {
          // eslint-disable-next-line no-await-in-loop
          detail = await catalogService.getAgent(agentId, sourceHint);
          if (detail) break;
        }
        if (!detail) {
          // eslint-disable-next-line no-await-in-loop
          detail = await catalogService.getAgent(agentId);
        }
        if (detail) {
          agentDetails.push({
            id: detail.id,
            name: detail.name,
            title: detail.title,
            role: detail.role,
            focus: detail.focus,
            whenToUse: detail.whenToUse,
            source: detail.source,
            expansionPack: detail.expansionPack,
            corePrinciples: detail.corePrinciples,
            commandExamples: detail.commands.slice(0, 3),
            dependencySummary: detail.dependencySummary,
          });
        }
      }

      const initializationSteps = extractInitializationSteps(team.setupGuide);
      const runtimePractices = Array.isArray(team.setupGuide?.runtime_management)
        ? team.setupGuide.runtime_management
        : [];
      const successMetrics = Array.isArray(team.setupGuide?.success_metrics)
        ? team.setupGuide.success_metrics
        : profile.metrics;

      const knowledgePackId =
        workflow.expansionPack || team.expansionPack || expansionPack?.id || null;
      const knowledgePack =
        knowledgePackId && knowledgePackId !== 'core'
          ? expansions.find((pack) => pack.id === knowledgePackId) || null
          : null;

      const knowledgePackSummary = knowledgePack
        ? {
            id: knowledgePack.id,
            name: knowledgePack.name,
            description: knowledgePack.description,
          }
        : team.source === 'core' || workflow.source === 'core'
        ? { id: 'core', name: '核心目录', description: '基于 BMAD 核心知识库生成。' }
        : expansionPack
        ? {
            id: expansionPack.id,
            name: expansionPack.name,
            description: expansionPack.description,
          }
        : null;

      return {
        project: {
          name: projectName,
          researchType,
          profile: {
            id: profile.id,
            summary: profile.summary,
            metrics: profile.metrics,
            riskFocus: profile.riskFocus,
            knowledgeFocus: profile.knowledgeFocus,
          },
          objectives,
          desiredOutcomes,
          timeframe: timeframe || workflow.metadata?.estimated_duration || '根据项目规划动态调整',
        },
        recommendedTeam: {
          id: team.id,
          name: team.name,
          description: team.description,
          domain: team.domain,
          useCase: team.useCase,
          hierarchy: team.hierarchy,
          members: team.members,
          collaborationPatterns: team.collaborationPatterns,
          teamScaling: team.teamScaling,
          scalingRecommendation,
          qualityAssurance: team.qualityAssurance,
          setupGuide: team.setupGuide,
          initializationSteps,
          runtimePractices,
          successMetrics,
        },
        workflowPlan: {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          metadata: workflow.metadata,
          phases: phasePlan,
          steps: workflow.steps,
          deliverables,
          interactionPoints,
          qualityGates: workflow.qualityGates,
          riskManagement: workflow.riskManagement,
          successCriteria: workflow.successCriteria,
        },
        agentInsights: {
          totalAgents: agentDetails.length,
          agents: agentDetails,
        },
        knowledgeSupport: {
          expansionPack: knowledgePackSummary,
          recommendedTemplates: knowledgePack?.templates || [],
          recommendedWorkflows: knowledgePack?.workflows || [],
          recommendedAgents: knowledgePack?.agents || [],
          knowledgeFocus: profile.knowledgeFocus,
        },
        nextActions: [
          `启动 ${team.members[0]?.agent || 'research-strategy-planner'}，完成项目战略规划。`,
          initializationSteps[0] || '复盘自动配置结果并确认团队角色分工。',
          '同步知识管理团队，建立初始文献与知识库结构。',
        ],
      };
    },
  };
};
