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
  const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  const phases = Array.isArray(workflow.phases) ? workflow.phases : [];
  const stepsByPhase = steps.reduce((acc, step) => {
    const key = step.phase;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(step);
    return acc;
  }, new Map());

  return phases.map((phase) => {
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
  const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  for (const step of steps) {
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
  const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  return steps
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


module.exports = function createProjectService(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '../../../..');
  const dependencySearchPaths = Array.isArray(options.dependencySearchPaths)
    ? options.dependencySearchPaths
    : [];
  const catalogService =
    options.catalogService || createCatalogService({ rootDir, dependencySearchPaths });
  const defaultPackId = options.defaultPackId || 'bmad-research-framework';
  const defaultTeamId = options.defaultTeamId || 'research-full-team';
  const defaultWorkflowId = options.defaultWorkflowId || 'universal-research-workflow';

  const normalisePackId = (value) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'core') return null;
    if (trimmed.startsWith('expansion:')) {
      const [, packId] = trimmed.split(':');
      return packId || null;
    }
    return trimmed;
  };

  const resolvePack = (expansions, requestedId) => {
    if (!Array.isArray(expansions) || !expansions.length) return null;
    if (requestedId) {
      const found = expansions.find((pack) => pack.id === requestedId);
      if (found) return found;
    }
    const fallback = expansions.find((pack) => pack.id === defaultPackId);
    if (fallback) return fallback;
    return expansions[0] || null;
  };

  const resolveTeam = async ({ requestedId, fallbackId, preferredSource }) => {
    const idsToTry = [requestedId, fallbackId].filter(Boolean);
    const sourcesToTry = [];
    if (preferredSource) sourcesToTry.push(preferredSource);
    sourcesToTry.push(undefined);

    const seen = new Set();

    const tryLoad = async (id, source, summaryMeta = null) => {
      if (!id) return null;
      const key = `${source || 'any'}|${id}`;
      if (seen.has(key)) return null;
      seen.add(key);
      try {
        const detail = await catalogService.getTeam(id, source);
        if (detail) {
          return { detail, summary: summaryMeta };
        }
      } catch (error) {
        console.warn('Failed to load team definition', id, source, error);
      }
      return null;
    };

    for (const id of idsToTry) {
      for (const source of sourcesToTry) {
        const result = await tryLoad(id, source);
        if (result) return result;
      }
    }

    const summaryLists = [];
    if (preferredSource) {
      try {
        summaryLists.push(await catalogService.listTeams({ source: preferredSource }));
      } catch (error) {
        console.warn('Failed to list teams for preferred source', preferredSource, error);
      }
    }
    try {
      summaryLists.push(await catalogService.listTeams());
    } catch (error) {
      console.warn('Failed to list available teams', error);
    }

    for (const summaries of summaryLists) {
      if (!Array.isArray(summaries)) continue;
      for (const summary of summaries) {
        const result = await tryLoad(summary.id, summary.source, summary);
        if (result) return result;
      }
    }

    return { detail: null, summary: null };
  };

  const resolveWorkflow = async ({ requestedId, fallbackId, preferredSource }) => {
    const idsToTry = [requestedId, fallbackId].filter(Boolean);
    const sourcesToTry = [];
    if (preferredSource) sourcesToTry.push(preferredSource);
    sourcesToTry.push(undefined);

    const seen = new Set();

    const tryLoad = async (id, source, summaryMeta = null) => {
      if (!id) return null;
      const key = `${source || 'any'}|${id}`;
      if (seen.has(key)) return null;
      seen.add(key);
      try {
        const detail = await catalogService.getWorkflow(id, source);
        if (detail) {
          return { detail, summary: summaryMeta };
        }
      } catch (error) {
        console.warn('Failed to load workflow definition', id, source, error);
      }
      return null;
    };

    for (const id of idsToTry) {
      for (const source of sourcesToTry) {
        const result = await tryLoad(id, source);
        if (result) return result;
      }
    }

    const summaryLists = [];
    if (preferredSource) {
      try {
        summaryLists.push(await catalogService.listWorkflows({ source: preferredSource }));
      } catch (error) {
        console.warn('Failed to list workflows for preferred source', preferredSource, error);
      }
    }
    try {
      summaryLists.push(await catalogService.listWorkflows());
    } catch (error) {
      console.warn('Failed to list available workflows', error);
    }

    for (const summaries of summaryLists) {
      if (!Array.isArray(summaries)) continue;
      for (const summary of summaries) {
        const result = await tryLoad(summary.id, summary.source, summary);
        if (result) return result;
      }
    }

    return { detail: null, summary: null };
  };

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

      let expansions = [];
      try {
        expansions = await catalogService.listExpansions();
      } catch (error) {
        console.warn('Failed to list expansion packs, continuing with defaults', error);
      }

      const requestedPackId = normalisePackId(
        payload.expansionPackId ||
          payload.packId ||
          payload.pack ||
          payload.expansionPack ||
          (typeof payload.source === 'string' ? payload.source : null) ||
          (payload.source && typeof payload.source === 'object' ? payload.source.packId : null),
      );
      const selectedPack = resolvePack(expansions, requestedPackId);
      const preferredSource =
        payload.source === 'core'
          ? 'core'
          : selectedPack
          ? `expansion:${selectedPack.id}`
          : null;

      const teamSource = payload.teamSource || preferredSource;
      const workflowSource = payload.workflowSource || preferredSource;

      const { detail: team, summary: teamSummary } = await resolveTeam({
        requestedId: payload.teamId || payload.team || payload.preferredTeamId || defaultTeamId,
        fallbackId: defaultTeamId,
        preferredSource: teamSource,
      });

      if (!team) {
        const error = new Error('未找到科研团队配置文件，无法生成项目方案。');
        error.status = 500;
        throw error;
      }

      const { detail: workflow, summary: workflowSummary } = await resolveWorkflow({
        requestedId: payload.workflowId || payload.workflow || payload.preferredWorkflowId || defaultWorkflowId,
        fallbackId: defaultWorkflowId,
        preferredSource: workflowSource,
      });

      if (!workflow) {
        const error = new Error('未找到科研工作流定义，无法生成项目方案。');
        error.status = 500;
        throw error;
      }

      const phasePlan = buildPhasePlan(workflow, profile);
      const deliverables = gatherDeliverables(workflow);
      const interactionPoints = gatherInteractionPoints(workflow);
      const scalingRecommendation = chooseTeamScaling(
        team.teamScaling || {},
        requestedTeamSize,
        profile.recommendedTeamScaling,
      );

      const agentIds = new Set();
      const teamMembers = Array.isArray(team.members) ? team.members : [];
      for (const member of teamMembers) {
        if (member.agent) agentIds.add(member.agent);
      }

      const workflowSteps = Array.isArray(workflow.steps) ? workflow.steps : [];
      for (const step of workflowSteps) {
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
      const agentLookups = await Promise.all(
        Array.from(agentIds).map(async (agentId) => {
          try {
            return await catalogService.getAgent(agentId);
          } catch (error) {
            console.warn('Failed to load agent detail', agentId, error);
            return null;
          }
        }),
      );

      for (const detail of agentLookups) {
        if (!detail) continue;
        const commandExamples = Array.isArray(detail.commands) ? detail.commands.slice(0, 3) : [];
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
          commandExamples,
          dependencySummary: detail.dependencySummary,
        });
      }

      const initializationSteps = extractInitializationSteps(team.setupGuide || {});
      const runtimePractices = Array.isArray(team.setupGuide?.runtime_management)
        ? team.setupGuide.runtime_management
        : [];
      const successMetrics = Array.isArray(team.setupGuide?.success_metrics)
        ? team.setupGuide.success_metrics
        : profile.metrics;

      const teamSourceInfo = teamSummary?.source || teamSource || null;
      const workflowSourceInfo = workflowSummary?.source || workflowSource || null;

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
          members: teamMembers,
          collaborationPatterns: team.collaborationPatterns,
          teamScaling: team.teamScaling,
          scalingRecommendation,
          qualityAssurance: team.qualityAssurance,
          setupGuide: team.setupGuide,
          initializationSteps,
          runtimePractices,
          successMetrics,
          source: teamSourceInfo,
          expansionPack: team.expansionPack || teamSummary?.expansionPack || selectedPack?.id || null,
        },
        workflowPlan: {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          metadata: workflow.metadata,
          phases: phasePlan,
          steps: workflowSteps,
          deliverables,
          interactionPoints,
          qualityGates: workflow.qualityGates,
          riskManagement: workflow.riskManagement,
          successCriteria: workflow.successCriteria,
          source: workflowSourceInfo,
          expansionPack: workflow.expansionPack || workflowSummary?.expansionPack || selectedPack?.id || null,
        },
        agentInsights: {
          totalAgents: agentDetails.length,
          agents: agentDetails,
        },
        knowledgeSupport: {
          knowledgeFocus: profile.knowledgeFocus,
          expansionPack: selectedPack
            ? { id: selectedPack.id, name: selectedPack.name, version: selectedPack.version }
            : null,
        },
        nextActions: [
          `启动 ${teamMembers[0]?.agent || 'research-strategy-planner'}，完成项目战略规划。`,
          initializationSteps[0] || '复盘自动配置结果并确认团队角色分工。',
          '同步知识管理团队，建立初始文献与知识库结构。',
        ],
      };
    },
  };
};
