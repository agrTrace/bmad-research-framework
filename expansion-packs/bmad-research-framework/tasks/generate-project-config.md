# <!-- Powered by BMAD™ Core -->

# generate-project-config

## Task Description

自动生成科研项目的专业智能体配置方案，基于项目内容分析结果为项目匹配最优的专业团队。

## Prerequisites

- 用户已提供项目基本描述和研究想法
- 已完成项目域分析和复杂度评估
- 可访问专业领域知识库映射表

## Task Flow

### Step 1: 项目内容分析

分析用户提供的项目信息：

```
请提供以下项目信息以便进行配置分析：

1. 项目基本描述：
   - 研究主题和目标
   - 主要研究内容
   - 预期解决的问题

2. 技术要求：
   - 涉及的技术方法
   - 数据处理需求
   - 实验或仿真需求

3. 项目规模：
   - 预计研究周期
   - 团队规模偏好
   - 资源投入情况
```

### Step 2: 领域识别和映射

基于项目内容识别所需专业领域：

1. **关键词提取**：从项目描述中提取技术关键词
2. **领域映射**：将关键词映射到专业学科领域
3. **依赖分析**：分析专业领域间的协作关系
4. **优先级评估**：根据项目核心需求确定领域优先级

### Step 3: 专业智能体配置生成

为每个识别的领域生成专业智能体配置：

```yaml
# 自动生成配置示例
project_specialists:
  - template: research-specialist-template
    domain: "{{identified_domain_1}}"
    knowledge_base: "{{corresponding_kb_1}}"
    role: "{{specific_role_description}}"
    priority: "{{calculated_priority}}"
    team_assignment: {{team_number}}
    
  - template: research-specialist-template
    domain: "{{identified_domain_2}}"
    knowledge_base: "{{corresponding_kb_2}}"
    role: "{{specific_role_description}}"
    priority: "{{calculated_priority}}"
    team_assignment: {{team_number}}
```

### Step 4: 同行评议专家配置

基于项目特点配置评议专家：

```yaml
peer_reviewers:
  - template: peer-reviewer-template
    domain: "{{primary_domain}}"
    expertise_level: "senior"
    focus_area: "整体技术路线评议"
    review_phase: "proposal"
    
  - template: peer-reviewer-template
    domain: "{{secondary_domain}}"
    expertise_level: "expert"
    focus_area: "专业技术方案评议"
    review_phase: "proposal"
```

### Step 5: 团队结构设计

设计合理的团队组织架构：

1. **团队数量**：基于项目复杂度确定团队数
2. **团队规模**：每团队的专家数量配置
3. **协调机制**：团队间协作方式设计
4. **沟通频率**：定期汇报和协调机制

### Step 6: 配置验证和优化

验证生成配置的合理性：

- **完整性检查**：确保所有技术需求都有对应专家
- **平衡性检查**：避免某些专业过度集中或缺失
- **协作性检查**：确保专业间有良好的协作接口
- **资源合理性**：评估配置的资源需求合理性

## Output Format

使用 `project-config-template.yaml` 模板生成配置文件：

```yaml
project_analysis:
  project_type: "{{derived_project_type}}"
  complexity_level: "{{assessed_complexity}}"
  estimated_duration: "{{estimated_timeline}}"
  identified_domains: [{{domain_list}}]
  primary_challenges: [{{challenge_list}}]

specialist_configuration:
  # 自动生成的专业智能体列表

peer_reviewer_configuration:
  # 自动生成的评议专家列表

team_structure:
  recommended_teams: {{team_count}}
  specialists_per_team: "{{team_size_range}}"
  coordination_method: "{{coordination_approach}}"
  communication_frequency: "{{communication_schedule}}"

resource_requirements:
  # 资源需求评估结果

quality_assurance:
  # 质量保证机制设计
```

## User Interaction Points

1. **项目信息确认**：用户确认项目分析结果的准确性
2. **专业配置审查**：用户可修改自动生成的专业智能体配置
3. **团队结构调整**：用户可调整团队组织方式
4. **最终配置确认**：用户确认最终配置方案

## Quality Checks

- [ ] 配置覆盖了所有识别的技术需求
- [ ] 专业领域分布合理，避免冗余和遗漏
- [ ] 团队规模符合项目复杂度要求
- [ ] 协调机制设计合理可执行
- [ ] 评议专家配置能够提供全面的专业评估

## Success Criteria

- 生成的配置能够完整支撑项目技术需求
- 专业智能体的职责分工明确且无重叠
- 团队组织结构清晰高效
- 用户对配置方案满意并确认采用

## Error Handling

- 如果项目描述不够详细，引导用户补充关键信息
- 如果无法映射到已知专业领域，提供自定义配置选项
- 如果配置验证失败，提供修改建议和重新配置选项