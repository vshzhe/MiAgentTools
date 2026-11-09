# 项目文档索引

> 生成时间：2026-11-09 | 基于 `iagent_project_init` 全量语义扫描

## 文档清单

| 类型 | 文档 | 状态 |
|:---|:---|:---|
| 技术框架 | [架构/技术框架.md](architecture/技术框架.md) | ✅ 已生成 |
| 模块与功能点 | [模块/模块与功能点.md](modules/模块与功能点.md) | ✅ 已生成 |
| 数据库 | —— | ❌ 不适用 |
| API 规范 | —— | ❌ 不适用 |
| 安全规范 | [安全/安全规范.md](security/安全规范.md) | ✅ 已生成 |

## 不适用说明

### 数据库

**依据**：项目无应用级数据库 —— 无 DDL 迁移脚本、无 ORM 映射（Prisma / TypeORM / Sequelize 等）、无 SQLite 运行时依赖。`src/` 全量检索 `sqlite|sequelize|typeorm|prisma|knex|mongoose|CREATE TABLE` 仅命中技能模板中的示例散文（如 `src/core/templates/workflows/spec-archive.ts:390`），无代码依赖。`package.json:55-58` 的生产依赖仅 `@inquirer/prompts` 与 `commander`。持久化载体均为文本：`.iagent/config.yaml`、`.iagent/scan-baseline.json`、OpenSpec Markdown。跨变更 SQLite 索引能力已退役（仅 `src/core/legacy-migration.ts:90-99` 保留旧装机清理常量）。

### API 规范

**依据**：MiAgentTools 为 **CLI 命令行工具**，对外接口为 Commander.js 注册的 **13 个命令**（`iagent --help` 实测；注册见 `src/cli/index.ts:112-447`），无 REST/HTTP、WebSocket 或 RPC 端点。`src/` 全量检索 `node:http|node:https|node:net|fetch(|createServer|express|fastify|koa` 无命中。命令签名、选项与 `--json` 机器可读输出见 [README.md](../../README.md#cli-命令) 与各命令实现（`src/commands/`）。

---

## 扫描元信息

- 扫描基线：`.iagent/scan-baseline.json`（v2，`2026-11-09T14:34:53Z`；57 目录 / 251 文件）
- CodeGraph 索引：233 文件 / 3291 节点 / 10075 边（`2026-11-09T14:29:30Z`）
- 基线 failures：无（`failures: []`）
- 基线 limits（v2，无深度 / 文件数上限）：
  - `skipped.ignored = 12`、`skipped.timeout = 0`、`skipped.unreadable = 0`
  - `limits.softTimeout.exceeded = false`（30s 软超时未触发）
  - ⚠️ **跳过所致 ≠ 项目无该内容**：12 项按内置忽略清单与 `.gitignore` / 自定义 ignore 跳过，不代表这些位置不存在相关内容
- 降级路径：`iagent_feature_doc` 已委派用于模块 / 数据库 / API 信息基础；技术框架与安全规范由主 agent 源码扫描补足
