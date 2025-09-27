# BMAD Research Framework — 系统测试报告

本报告记录了针对当前代码基线执行的六项核心测试，覆盖构建、验证、集成与命令行功能。所有测试均在容器环境（Node.js 20.19.4）中执行。

> **环境说明：** 尝试通过 `npm install` 安装依赖仍然受到外部 npm 注册表的 403 限制，仓库内已提交的依赖缓存可支撑以下测试。

## 1. 构建流程（Build Pipeline）
- **命令：** `npm run build`
- **目标：** 验证核心与扩展包的静态资源是否可以成功打包。
- **结果：** 成功。构建过程中提示的缺失依赖均为扩展包可选资源提示，不影响产物生成。

## 2. 配置校验（Configuration Validation）
- **命令：** `npm run validate`
- **目标：** 校验智能体与团队定义的依赖完整性以及工作流引用。
- **结果：** 成功。与构建阶段一致，仅报告可选资料缺失的警示信息。

## 3. 回归测试套件（Regression Suite）
- **命令：** `npm test`
- **目标：** 串行执行构建与验证，确保在一次运行中通过完整回归流程。
- **结果：** 成功。自动重复了测试 1 与测试 2，整体流程无异常终止。

## 4. 目录服务集成测试（Catalog Service Integration）
- **命令：** `node - <<'NODE' ...`（调用 `catalog-service` 的 `getOverview` 与 `getAgent`）
- **目标：** 直接加载目录服务，确认在本地文件系统上能够聚合核心与扩展元数据。
- **结果：** 成功。共计发现 15 个智能体、1 个团队与 1 个工作流，能够返回 `analyst` 智能体详情。

## 5. 项目规划服务集成测试（Project Planning Integration）
- **命令：** `node - <<'NODE' ...`（调用 `project-service` 的 `createProjectPlan`）
- **目标：** 针对应用研究场景生成完整的科研项目计划，验证团队/工作流聚合逻辑。
- **结果：** 成功。生成的方案包含 13 个团队成员与 4 个阶段的工作流规划。

## 6. CLI 工具验证（CLI Tooling Validation）
- **命令：**
  - `node tools/cli.js list:agents`
  - `node tools/cli.js list:expansions`
  - `node tools/cli.js upgrade --dry-run --project ./`
- **目标：** 检查命令行工具的智能体列举、扩展包列举以及 V3→V4 升级提示是否工作正常。
- **结果：** 成功。CLI 正确输出核心智能体清单、扩展包列表，并确认当前工程已处于最新结构无需迁移。

## 结论
除受外部仓库访问限制的 `npm install` 外，其余六项核心测试均顺利通过，验证了 SaaS 与 CLI 关键功能的可用性。建议在具备 npm 官方镜像访问权限的环境中重试依赖安装，以确保后续开发与部署流程的稳定性。
