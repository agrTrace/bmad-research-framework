# BMAD Research Framework · Electron 桌面版

该目录提供与 SaaS 服务完全独立的 Electron 桌面应用，支持在本地环境离线浏览智能体目录、查看扩展包、并生成研究项目计划。

## 功能特性

- 离线浏览核心与扩展包智能体、团队与工作流概览
- 查看单个智能体的命令、依赖、推荐使用场景与角色描述
- 基于工作流生成项目计划，包含阶段安排、交付物与沟通节点
- 轻量级偏好存储：窗口尺寸、主题选择（浅色 / 深色 / 跟随系统）

## 安装依赖

```bash
cd desktop/electron
npm install
```

> ⚠️ 在封闭网络环境下安装 Electron 可能失败，可参考 `INSTALL.md` 中的离线安装指引或使用本地镜像源。

## 开发与调试

```bash
npm start          # 启动正式模式
npm run start:dev  # 启用日志的调试模式
```

应用会自动读取仓库根目录下的 `bmad-core/` 与 `expansion-packs/` 数据，无需启动 SaaS 服务。

## 打包

```bash
npm run package
```

默认使用 `electron-builder` 生成平台安装包，可在 `package.json` 中调整配置。

## 目录结构

```
desktop/electron/
├─ main.js          # Electron 主进程，注册 IPC 与服务实例
├─ preload.js       # 预加载脚本，将后台能力暴露给渲染层
├─ renderer/        # 渲染进程静态页面与脚本
└─ package.json     # 桌面应用独立依赖与脚本
```
