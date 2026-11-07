# Changelog

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## 1.0.1 — 2026-11-07

### 修复

- 版本号与仓库发布标签对齐，此前 `package.json` 停在 0.3.0。

## 1.0.0 — 2026-11-07

### 新增

- 人设模式与输出规范，落点为 `systemPrompt` 的一个 section。
- 全局设置与按会话覆盖，会话级切换在下一轮组装时生效。
- 桥接路由 `/api/dsh-output-rules`，支持读取、全局写入与会话级写入。
- 设置页「人设模式」一页，对话标题栏提供选择器。

### 修复

- 会话级覆盖此前静默失效：宿主侧用 `agent.ctx.get('systemPrompt')` 取到的是未追踪实例，`section()` 落进全局层并与同名段冲突，异常被空 `catch` 吞掉。改为 `agent.ctx.systemPrompt` 属性访问，并补了失败日志。
