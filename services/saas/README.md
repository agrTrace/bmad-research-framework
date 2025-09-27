# BMAD Research Framework SaaS 服务

该目录提供将 BMAD Research Framework 封装为在线服务（SaaS）的参考实现，包含可直接运行的 Node.js/Express 服务：

- `/api/catalog`：查询智能体、团队、工作流以及扩展包元数据
- `/api/projects`：根据研究项目信息自动生成推荐的科研团队与工作流计划
- `/health`：基础健康检查

## 快速启动

```bash
npm install
npm test           # 可选：确保核心构建与配置校验通过
npm run start:saas
```

默认监听 `0.0.0.0:3000`，可通过环境变量进行配置：

- `PORT`：服务端口，默认为 `3000`
- `HOST`：监听地址，默认为 `0.0.0.0`
- `BMAD_ROOT`：框架根目录，默认推断为仓库根目录

启动后可通过例如以下请求获取数据：

```bash
curl http://localhost:3000/api/catalog/agents
curl -X POST http://localhost:3000/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"projectName":"AI 辅助药物设计", "researchType":"应用研究"}'
```

## 结构说明

- `src/app.js`：Express 应用创建，挂载路由与中间件
- `src/server.js`：服务启动入口
- `src/routes`：API 路由定义
- `src/controllers`：请求处理逻辑
- `src/services`：业务能力（目录/项目规划）
- `src/utils`：通用工具函数

该服务默认读取仓库中的 `bmad-core` 与 `expansion-packs/bmad-research-framework` 内容，未来可扩展支持更多扩展包或鉴权能力。
