# 配置、安装与测试指南

本文档提供从零开始部署 BMAD Research Framework 的完整流程，涵盖本地开发环境准备、依赖安装、配置 SaaS 服务以及运行内置校验测试的步骤。

## 1. 环境准备

在开始之前，请确保满足以下要求：

- **操作系统**：macOS、Linux 或 Windows（需具备 Node.js 运行环境）
- **Node.js**：>= 20.10.0（与 `package.json` 中的 `engines` 字段保持一致）
- **npm**：建议使用 npm v10 及以上版本
- **Git**：用于克隆仓库

检查版本：
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
