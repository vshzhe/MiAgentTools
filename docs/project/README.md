# 项目文档索引

> 生成时间：2026-10-10 | 基于 `iagent_project_init` 全量语义扫描

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

**依据**：项目**不依赖任何 SQLite 运行时**（跨变更索引能力与 SQLite WASM 依赖已退役，DEC-2）。唯一与"索引"相关的是 CodeGraph 代码知识图谱，其索引文件 `.codegraph/` 由外部 CodeGraph 工具自动生成、属本地产物（`.gitignore` 已排除）；项目内不存在 DDL 迁移脚本、ORM 映射、业务数据表或应用级数据库设计。

### API 规范

**依据**：MiAgentTools 为 **CLI 命令行工具**，对外接口为 Commander.js 注册的 11 个 shell 命令（`iagent init` / `iagent list` / `iagent validate` 等），无 REST/HTTP API、无 WebSocket 端点、无 RPC 接口。命令签名与参数说明见 `iagent --help` 及 [README.md](../../README.md#cli-命令)。

---

## 扫描元信息

- 扫描基线：`.iagent/scan-baseline.json`（2026-10-10，82 目录 / 205 文件）
- 索引：CodeGraph（99 文件 / 1003 符号节点 / 1494 边）
- 基线 failures：无
- 基线 limits：v2（无深度/文件数上限；跳过按 ignored / soft-timeout / unreadable 分类计数）
- 降级：`iagent_feature_doc` 不适用于 TypeScript CLI 项目，改用 CodeGraph + 源码扫描