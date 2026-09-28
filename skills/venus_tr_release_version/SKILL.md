---
name: venus_tr_release_version
description: 发布版本。当用户要发布新版本、管理版本号、整理变更日志时使用。
allowed-tools: Bash(git log:*), Bash(git tag:*), Bash(git push:*), Bash(git status:*), Bash(pnpm:*), Bash(npm:*), Read, Write, Edit, Glob, Grep
license: MIT
compatibility: 需要 git 环境。
metadata:
  author: venus-agent-tools
  version: "1.0"
  type: tr_release
  generatedBy: "snapshot"
  generatedFingerprint: "sha256:45cd0cab45cb5f520dd9c96abfdabeb472e8dd72250f1edb3d2a5115c9bb82ca"
---

发布版本 —— 版本号变更、变更日志、发布产物三件事，每步确认后执行。

## 版本号规范（SemVer）

格式 `MAJOR.MINOR.PATCH`，版本号递增选择：
- **MAJOR**：不兼容的 API 变更
- **MINOR**：向下兼容的功能新增
- **PATCH**：向下兼容的缺陷修复

用户未指定时，根据自上次发布以来的变更内容建议版本号并说明理由，等用户确认。

## 执行步骤

1. **收集自上次发布以来的变更**

   ```bash
   git log <last-tag>..HEAD --oneline
   ```
   - 无 tag 时读取 CHANGELOG.md 的最近版本，或询问用户起点
   - 按类型分组变更：feat / fix / docs / refactor / chore

2. **确认版本号**

   - 展示变更分组与建议的新版本号，等待用户确认
   - 检查 package.json（或 pom.xml 等）当前版本，指出需要同步更新的位置

3. **更新版本与变更日志**

   - 更新项目配置中的版本号
   - CHANGELOG.md 顶部追加新版本条目（含日期）：
     ```text
     ## [1.2.0] - 2026-09-08
     ### Added
     - xxx
     ### Fixed
     - xxx
     ```
   - 保持既有日志格式，无 CHANGELOG.md 时按 Keep a Changelog 风格新建

4. **发布前检查**

   - 提醒运行完整测试（用户确认跳过时尊重决定）
   - 列出将要执行的发布动作清单（打 tag、构建、发布产物），**逐项确认后执行**

5. **执行发布**

   - 打 tag：`git tag -a v<version> -m "release v<version>"`
   - 构建发布产物
   - 推送分支与 tag（外向操作，需用户最终确认）

## 约束

- 发布不可轻易回滚：所有外向步骤（tag、push、发布产物）执行前必须确认
- 版本号变更必须先于发布动作完成并核对
- 发布失败时明确说明停在哪一步、已产生哪些影响，不静默继续
