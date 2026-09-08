---
name: "Venus: 发布版本"
description: 发布版本 —— 版本号管理、变更日志整理、发布流程执行
allowed-tools: Bash(venus:*)
category: Venus / 版本
tags: [venus, tr_release, release, version, changelog]
---

发布版本 —— 版本号变更、变更日志、发布产物三件事，每步确认后执行。

**输入**：`/venus:release-version` 后可跟目标版本号（如 1.2.0）或版本类型（major/minor/patch；可省略，省略时根据变更内容建议）。

## 执行步骤

1. **收集变更**：`git log <last-tag>..HEAD --oneline`，按 feat / fix / docs / refactor / chore 分组。
2. **确认版本号**：按 SemVer 建议（MAJOR 破坏性 / MINOR 新功能 / PATCH 修复），展示分组与理由，等用户确认。
3. **更新版本与日志**：同步项目配置版本号；CHANGELOG.md 顶部追加新版本条目（含日期，Keep a Changelog 风格）。
4. **发布前检查**：提醒运行完整测试；列出发布动作清单（tag、构建、推送），逐项确认后执行。
5. **执行发布**：`git tag -a v<version>` → 构建 → 推送分支与 tag（需用户最终确认）。

## 约束

- 所有外向步骤（tag、push、发布产物）执行前必须确认
- 发布失败时明确停在哪一步、影响范围，不静默继续
