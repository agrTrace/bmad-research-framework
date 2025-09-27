# 配置、安装与测试指南

本文档提供从零开始部署 BMAD Research Framework 的完整流程，涵盖本地开发环境准备、依赖安装、配置 SaaS 服务以及运行内置校验测试的步骤。

## 1. 环境准备

在开始之前，请确保满足以下要求：

- **操作系统**：macOS、Linux 或 Windows（需具备 Node.js 运行环境）
- **Node.js**：>= 20.10.0（与 `package.json` 中的 `engines` 字段保持一致）
- **npm**：建议使用 npm v10 及以上版本
- **Git**：用于克隆仓库

检查版本：

```bash
node -v
npm -v
git --version
```

## 2. 获取项目代码

通过 Git 克隆仓库后进入项目目录：

```bash
git clone https://github.com/YOUR_ORG/bmad-research-framework.git
cd bmad-research-framework
```

如果已经拥有仓库，可通过 `git pull` 更新到最新代码。

## 3. 安装依赖

项目包含 CLI 工具与 SaaS 在线服务，两者共享同一套依赖。执行以下命令安装：

```bash
npm install
```

安装成功后将生成 `node_modules/` 目录，并为 CLI 与 SaaS 服务准备好运行环境。

> **提示**：在受限网络环境中，可配置企业私有 npm 镜像或提前下载依赖包，确保安装顺利完成。

## 4. 核心配置

大部分功能可在默认配置下运行，但以下环境变量可以根据需要覆盖：

| 变量名 | 作用 | 默认值 |
| ------ | ---- | ------ |
| `BMAD_ROOT` | 指定框架根目录，供 SaaS 服务读取核心数据 | 仓库根目录 |
| `HOST` | SaaS 服务监听地址 | `0.0.0.0` |
| `PORT` | SaaS 服务端口 | `3000` |

配置方式示例：

```bash
export BMAD_ROOT="/path/to/bmad-research-framework"
export HOST="127.0.0.1"
export PORT="4000"
```

## 5. 构建与校验

框架提供两项关键的质量校验命令：

```bash
npm test           # 依次执行构建与验证流程
# 或单独运行：
npm run build      # 执行框架构建流程
npm run validate   # 运行内置验证，确保配置与元数据一致
```

建议在每次提交代码前运行 `npm test`，确认升级工具、元数据与服务接口均处于健康状态；如需单独排查，可分别执行 `build` 或 `validate`。

## 6. 运行 SaaS 在线服务

安装与构建完成后，可启动 Express SaaS 服务，将框架能力以 HTTP API 的形式对外提供：

```bash
npm run start:saas
```

服务默认监听 `http://0.0.0.0:3000`，启动后可在终端看到 `BMAD Research SaaS listening...` 的日志输出。

### 6.1 常用接口

- `GET /health`：健康检查
- `GET /api/catalog/agents`：获取智能体列表
- `GET /api/catalog/workflows`：查询工作流配置
- `POST /api/projects`：根据输入生成项目规划

示例请求：

```bash
curl http://localhost:3000/health

curl http://localhost:3000/api/catalog/agents

curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
        "projectName": "AI 辅助药物设计",
        "researchType": "应用研究",
        "objectives": ["药物筛选", "模型评估"]
      }'
```

## 7. 运行桌面版 Electron 应用

桌面版本提供与 SaaS 完全独立的本地体验。首次使用前需安装桌面端依赖：

```bash
cd desktop/electron
npm install
```

随后可通过根目录提供的脚本直接启动应用：

```bash
npm run start:desktop
```

若需启用更详细的日志，可执行 `npm run start:desktop:dev`。桌面程序默认读取当前仓库的核心与扩展包数据，无需启动 SaaS 服务即可离线生成项目计划。

## 8. 运行 CLI 功能（可选）

框架仍可作为命令行工具使用，以下示例展示如何在本地项目中初始化：

```bash
npx research-framework install ./my-research-project
```

CLI 会引导完成扩展包安装、研究流程初始化等步骤，可与 SaaS 服务并行使用。

## 9. 测试完成后的期望结果

完成上述步骤后，应能获得以下结果：

1. `npm install` 无报错，依赖安装完毕。
2. `npm run build`、`npm run validate` 均以退出码 0 结束。
3. 执行 `npm run start:saas` 后浏览器或 `curl` 请求能获得有效响应。
4. 可选：`npx research-framework install` 能在新目录中生成框架模板。

## 10. 常见问题排查

- **依赖安装失败**：检查网络环境或使用企业私有镜像；必要时可手动下载 tarball 后使用 `npm install <path-to-tarball>`。
- **SaaS 服务无法读取数据**：确认 `BMAD_ROOT` 指向仓库根目录，且该目录下的 `bmad-core/` 与 `expansion-packs/` 完整存在。
- **端口被占用**：修改 `PORT` 环境变量或停止占用端口的进程。

按照本指南完成配置后，BMAD Research Framework 即可在本地或服务器环境稳定运行，并通过 SaaS 或 CLI 形态提供科研智能体能力。
