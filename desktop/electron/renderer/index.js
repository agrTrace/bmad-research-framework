const agentListEl = document.getElementById('agent-list');
const agentDetailEl = document.getElementById('agent-detail');
const agentCountEl = document.getElementById('agent-count');
const teamCountEl = document.getElementById('team-count');
const workflowCountEl = document.getElementById('workflow-count');
const expansionFilterEl = document.getElementById('expansion-filter');
const themeSelectEl = document.getElementById('theme-select');
const plannerForm = document.getElementById('planner-form');
const workflowSelect = document.getElementById('workflow-select');
const planOutputEl = document.getElementById('plan-output');
const projectTitleEl = document.getElementById('project-title');
const projectTypeEl = document.getElementById('project-type');
const projectObjectivesEl = document.getElementById('project-objectives');
const teamSizeEl = document.getElementById('team-size');

let catalogOverview = null;
let workflows = [];

async function initialise() {
  try {
    const preferences = await window.bmadDesktop.getPreferences();
    if (preferences?.theme && ['light', 'dark', 'system'].includes(preferences.theme)) {
      themeSelectEl.value = preferences.theme;
    }
    catalogOverview = await window.bmadDesktop.loadOverview();
    workflows = await window.bmadDesktop.listWorkflows();
    renderCatalog(catalogOverview);
    renderWorkflows(workflows);
    populateExpansions(catalogOverview.sources);
  } catch (error) {
    renderError(error);
  }
}

function renderCatalog(overview) {
  agentCountEl.textContent = overview.agentCount;
  teamCountEl.textContent = overview.teamCount;
  workflowCountEl.textContent = overview.workflowCount;
  renderAgentList(overview.agents);
}

function populateExpansions(sources = []) {
  expansionFilterEl.innerHTML = '<option value="all">全部</option>';
  const coreOption = document.createElement('option');
  coreOption.value = 'core';
  coreOption.textContent = '核心库';
  expansionFilterEl.appendChild(coreOption);
  sources
    .filter((source) => source.type === 'expansion')
    .forEach((source) => {
      const option = document.createElement('option');
      option.value = source.packId;
      option.textContent = `${source.name} v${source.version || 'N/A'}`;
      expansionFilterEl.appendChild(option);
    });
}

function renderAgentList(agents) {
  const selectedPack = expansionFilterEl.value;
  agentListEl.innerHTML = '';

  agents
    .filter((agent) => {
      if (selectedPack === 'all') return true;
      if (selectedPack === 'core') return agent.source === 'core';
      return agent.expansionPack === selectedPack;
    })
    .forEach((agent) => {
      const item = document.createElement('li');
      item.dataset.agentId = agent.id;
      item.innerHTML = `
        <div class="agent-title">${agent.name}</div>
        <div class="agent-role">${agent.role || '通用智能体'}</div>
        <div class="agent-meta">
          <span class="badge">${agent.source === 'core' ? '核心' : agent.expansionPack}</span>
          <span class="badge">指令 ${agent.commandCount}</span>
        </div>
      `;
      item.addEventListener('click', () => selectAgent(agent.id));
      agentListEl.appendChild(item);
    });
}

async function selectAgent(agentId) {
  agentListEl.querySelectorAll('li').forEach((li) => {
    li.classList.toggle('active', li.dataset.agentId === agentId);
  });

  try {
    const agent = await window.bmadDesktop.getAgentDetail(agentId);
    renderAgentDetail(agent);
  } catch (error) {
    agentDetailEl.innerHTML = `<p class="placeholder">加载智能体详情失败：${error.message}</p>`;
  }
}

function renderAgentDetail(agent) {
  if (!agent) {
    agentDetailEl.innerHTML = '<p class="placeholder">未找到该智能体。</p>';
    return;
  }

  const dependencies = Object.entries(agent.dependencySummary || {})
    .filter(([key]) => key !== 'totalCount')
    .map(([key, value]) => `<li>${key}：${value.items.join('、')}</li>`)
    .join('');

  const commands = agent.commands
    .map((command) => `<li><strong>${command.command}</strong> — ${command.description || '无描述'}</li>`)
    .join('');

  agentDetailEl.innerHTML = `
    <h3>${agent.name}</h3>
    <p class="agent-role">${agent.title || agent.role || '通用智能体'}</p>
    <section>
      <h4>简介</h4>
      <p>${agent.summary || '该智能体尚未提供简介。'}</p>
    </section>
    <section>
      <h4>职责</h4>
      <p>${agent.focus || '暂无专长描述。'}</p>
    </section>
    <section>
      <h4>推荐使用场景</h4>
      <p>${agent.whenToUse || '未提供使用建议。'}</p>
    </section>
    <section>
      <h4>命令与操作</h4>
      <ul>${commands || '<li>暂无指令</li>'}</ul>
    </section>
    <section>
      <h4>依赖总结</h4>
      <ul>${dependencies || '<li>无其他依赖</li>'}</ul>
    </section>
  `;
}

function renderWorkflows(workflowsList) {
  workflowSelect.innerHTML = '';
  workflowsList.forEach((workflow) => {
    const option = document.createElement('option');
    option.value = workflow.id;

    const phaseCount = Array.isArray(workflow.phases) ? workflow.phases.length : 0;
    option.textContent = `${workflow.name}（${phaseCount} 阶段）`;
    workflowSelect.appendChild(option);
  });
}

function renderPlan(plan) {
  planOutputEl.classList.remove('hidden');
  const project = plan.project || {};
  const profile = project.profile || {};
  const team = plan.recommendedTeam || {};
  const scaling = team.scalingRecommendation || {};
  const workflow = plan.workflowPlan || {};
  const knowledge = plan.knowledgeSupport || {};
  const phases = Array.isArray(workflow.phases) ? workflow.phases : [];
  const deliverables = Array.isArray(workflow.deliverables) ? workflow.deliverables : [];
  const interactionPoints = Array.isArray(workflow.interactionPoints)
    ? workflow.interactionPoints
    : [];
  const nextActions = Array.isArray(plan.nextActions) ? plan.nextActions : [];
  const focusAreas = [
    ...(Array.isArray(profile.metrics) ? profile.metrics : []),
    ...(Array.isArray(profile.riskFocus) ? profile.riskFocus : []),
    ...(profile.knowledgeFocus ? [profile.knowledgeFocus] : []),
  ];

  planOutputEl.innerHTML = `
    <h3>${project.name || '科研项目规划'}</h3>
    <p class="plan-summary">${profile.summary || '该研究类型暂无补充摘要。'}</p>

    <div class="plan-section">
      <h4>研究重点</h4>
      <ul class="plan-list">
        ${focusAreas.length ? focusAreas.map((focus) => `<li>${focus}</li>`).join('') : '<li>该研究类型未提供额外侧重点。</li>'}
      </ul>
    </div>

    <div class="plan-section">
      <h4>推荐团队</h4>
      <p><strong>${team.name || '未指定团队'}</strong></p>
      <p>${team.description || '暂无团队描述。'}</p>
      <p>${scaling.rationale || '采用默认团队配置。'}</p>
    </div>

    <div class="plan-section">
      <h4>阶段安排</h4>
      ${
        phases.length
          ? phases
              .map(
                (phase) => `
              <article class="phase-card">
                <h5>${phase.name}</h5>
                <p>${phase.description || '无描述'}</p>
                <ul class="plan-list">
                  ${
                    Array.isArray(phase.steps) && phase.steps.length
                      ? phase.steps
                          .map((step) => `<li>${step.name} — <em>${step.agent || '未指派'}</em></li>`)
                          .join('')
                      : '<li>该阶段暂无具体步骤。</li>'
                  }
                </ul>
              </article>
            `,
              )
              .join('')
          : '<p class="placeholder">未找到工作流阶段定义。</p>'
      }
    </div>

    <div class="plan-section">
      <h4>交付物与沟通节点</h4>
      <h5>交付物</h5>
      <ul class="plan-list">
        ${
          deliverables.length
            ? deliverables
                .map((deliverable) => `<li>${deliverable.output}（阶段：${deliverable.phase}）</li>`)
                .join('')
            : '<li>该工作流未定义交付物。</li>'
        }
      </ul>
      <h5>沟通节点</h5>
      <ul class="plan-list">
        ${
          interactionPoints.length
            ? interactionPoints
                .map((point) => `<li>${point.stepName} — ${point.description}</li>`)
                .join('')
            : '<li>该工作流未包含关键沟通节点。</li>'
        }
      </ul>
    </div>

    <div class="plan-section">
      <h4>知识支持</h4>
      <p>扩展包：${knowledge.expansionPack?.name || '未指定'}</p>
      <p>推荐模板：${
        Array.isArray(knowledge.recommendedTemplates) && knowledge.recommendedTemplates.length
          ? knowledge.recommendedTemplates.join('、')
          : '无'
      }</p>
      <p>知识侧重点：${knowledge.knowledgeFocus || profile.knowledgeFocus || '未提供'}</p>
    </div>

    <div class="plan-section">
      <h4>下一步行动</h4>
      <ul class="plan-list">
        ${nextActions.length ? nextActions.map((action) => `<li>${action}</li>`).join('') : '<li>暂无建议的后续行动。</li>'}
      </ul>
    </div>
  `;
}

function renderError(error) {
  agentDetailEl.innerHTML = `<p class="placeholder">加载目录失败：${error.message}</p>`;
}

expansionFilterEl.addEventListener('change', () => {
  if (!catalogOverview) return;
  renderAgentList(catalogOverview.agents);
});

plannerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = {
      projectName: projectTitleEl.value,
      researchType: projectTypeEl.value,
      objectives: projectObjectivesEl.value,
      expectedTeamSize: teamSizeEl.value ? Number(teamSizeEl.value) : undefined,
      workflowId: workflowSelect.value,
    };

    const plan = await window.bmadDesktop.generatePlan(payload);
    renderPlan(plan);
  } catch (error) {
    planOutputEl.classList.remove('hidden');
    planOutputEl.innerHTML = `<p class="placeholder">生成项目计划失败：${error.message}</p>`;
  }
});

themeSelectEl.addEventListener('change', () => {
  const theme = themeSelectEl.value;
  window.bmadDesktop.setTheme(theme);
});

initialise();
