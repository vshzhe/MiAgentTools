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

**依据**：项目使用 sql.js（SQLite WASM）仅作为 CodeGraph 代码知识图谱的内嵌索引后端（`src/core/spec/sqlite-index.ts`）与规格工作流的内存态存储（`src/core/spec/sqlite-memory-backend.ts`）。索引文件 `.codegraph/` 为自动生成的本地产物（`.gitignore` 已排除），不存在 DDL 迁移脚本、ORM 映射、业务数据表或应用级数据库设计。

### API 规范

**依据**：MiAgentTools 为 **CLI 命令行工具**，对外接口为 Commander.js 注册的 11 个 shell 命令（`iagent init` / `iagent list` / `iagent validate` 等），无 REST/HTTP API、无 WebSocket 端点、无 RPC 接口。命令签名与参数说明见 `iagent --help` 及 [README.md](../../README.md#cli-命令)。

---

## 扫描元信息

- 扫描基线：`.iagent/scan-baseline.json`（2026-10-10，82 目录 / 205 文件）
- 索引：CodeGraph（99 文件 / 1003 符号节点 / 1494 边）
- 基线 failures：无
- 基线 limits：命中（MAX_SCAN_DEPTH=8，更深层目录未遍历，已覆盖全部源码目录）
- 降级：`iagent_feature_doc` 不适用于 TypeScript CLI 项目，改用 CodeGraph + 源码扫描