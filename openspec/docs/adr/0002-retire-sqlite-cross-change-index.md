# ADR-0002: 退役跨变更 SQLite 索引

- **状态**：已接受（2026-10-26，变更 `upgrade-workflow-efficiency`，裁决 DEC-2）
- **背景**：`openspec/changes/archive/.iagent/index.db` 曾被设计为跨变更检索缓存（changes / capabilities / decisions_fts / requirements_fts / exploration_memory 五表），由 `iagent spec reindex` 从归档 Markdown 重建，并在 `iagent init` 时直接建库、每次归档后 `--force` 全量重建。实测与核对结论：写侧每条 SQL 一次 `sqlite3` 子进程（单变更 5–6 次），全量重建 42 变更约 9.8s（其中 40 个走 legacy sidecar 降级、1 个抛 `Cannot read properties of undefined`）；读侧三个查询函数零调用点、技能模板指向的库路径与真值不一致、`spec-explore` 白名单又无 `Bash(sqlite3:*)` —— 索引事实上「只写不读」。
- **决策**：**移除**该能力：删除 `sqlite-index.ts` / `markdown-index.ts` / `index-cache.ts` / `sqlite-memory-backend.ts`、`iagent spec reindex` 命令与全部辅助、`init` 的建库段、`spec-archive` / `spec-bulk-archive` 的 reindex 调用、`sql.js` 依赖、索引相关测试；`sqlite-cross-change-index` 的 6 条 Requirement 全部 REMOVED。检索改由 Glob/Grep 与 `openspec/specs/<capability>/explorations.md`（`spec-archive` 归档时同步的能力级记忆）承担。
- **理由**：索引的边际收益 = f(归档变更数 × 检索频次) − 构建/失效/迁移成本。当前规模下 4MB / 401 个 Markdown 全文检索实测 253ms（ripgrep 更快），而索引每次归档固定付出约 10s 并带一个已复现的崩溃面；索引在规格中即被定义为「可重建缓存」而非真源，移除不触及任何真源。
- **影响**：
  - **BREAKING**：CLI 行为（`spec reindex` 消失）、依赖面（`sql.js` 移除）、能力删除、规格 6 条 REMOVED；版本 1.0.2 → 2.0.0。
  - 用户目录中的历史 `index.db` **不被删除**；升级文档给出「可外部打开 / 何时可清理」指引。
  - 探索记忆的读路径收敛为唯一 Glob 分支；提案阶段的「能力冲突检测」不再查索引（该查询在模板中从未实现）。
- **备选方案**（否决）：① 懒建 + 进程内 `sql.js`（WASM）+ 新增 `iagent spec memory` 查询入口 —— 为当前不存在的检索需求引入 WASM 持久化与旧库迁移；② 仅修路径/白名单/legacy 崩溃 —— 成本与「只写不读」的根因仍在；③ 保留现状 —— 净成本 + 崩溃 + 规格漂移三重。
- **恢复方式**：若未来变更规模使全文检索成为真实需求，从归档的规格（`openspec/changes/archive/**/specs/sqlite-cross-change-index/`）重新提案，优先考虑「按需构建 + 单一查询入口」而非固定全量重建。
