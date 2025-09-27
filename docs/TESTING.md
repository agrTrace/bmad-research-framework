# 测试执行指南

为避免 "Tests not run" 的审查警告，请在提交任何改动（包括文档更新）前执行 `npm test`。该命令会依次运行构建与验证流程，确保核心元数据可被正确解析并产出结果。

## 步骤

1. 在仓库根目录安装依赖（如尚未安装）：
   ```bash
   npm install
   ```
2. 执行完整的测试命令：
   ```bash
   npm test
   ```
3. 观察终端输出，确认命令以状态码 0 结束，并出现 `Build completed successfully!` 与 `All configurations are valid!` 等提示。

## 结果解读

- 在沙箱或离线环境中，`npm install` 可能因外部网络限制而失败，此时需要配置企业私有源或预下载依赖。
- `npm test` 过程中若出现 `Resource not found` 的警告，表示某些可选任务或模板尚未提供。只要命令最终成功结束，这些警告不会影响测试结果，但应记录在案以便后续补充资源。
- 若命令以非零状态结束，请参考终端日志定位失败阶段，可分别执行 `npm run build` 或 `npm run validate` 进行排查。

## 记录示例

以下示例展示一次成功的执行片段，可作为对比参考：

```
$ npm test
...
Build completed successfully!
...
All configurations are valid!
```

如需在自动化流水线中调用，可直接运行同一命令或引用 `tools/cli.js` 提供的子命令。
