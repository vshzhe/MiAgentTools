/**
 * tr_release 类型技能模板：版本。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

export function getTrReleaseVersionSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_tr_release_version',
        description: '发布版本。当用户要发布新版本、管理版本号、整理变更日志时使用。',
        allowedTools: 'Bash(git log:*), Bash(git tag:*), Bash(git push:*), Bash(git status:*), Bash(pnpm:*), Bash(npm:*), Read, Write, Edit, Glob, Grep',
        type: 'tr_release',
        instructions: `发布版本 —— 版本号变更、变更日志、发布产物三件事，每步确认后执行。

## 版本号规范（SemVer）

格式 \`MAJOR.MINOR.PATCH\`，版本号递增选择：
- **MAJOR**：不兼容的 API 变更
- **MINOR**：向下兼容的功能新增
- **PATCH**：向下兼容的缺陷修复

用户未指定时，根据自上次发布以来的变更内容建议版本号并说明理由，等用户确认。

## 执行步骤

1. **收集自上次发布以来的变更**

   \`\`\`bash
   git log <last-tag>..HEAD --oneline
   \`\`\`
   - 无 tag 时读取 CHANGELOG.md 的最近版本，或询问用户起点
   - 按类型分组变更：feat / fix / docs / refactor / chore

2. **确认版本号**

   - 展示变更分组与建议的新版本号，等待用户确认
   - 检查 package.json（或 pom.xml 等）当前版本，指出需要同步更新的位置

3. **更新版本与变更日志**

   - 更新项目配置中的版本号
   - CHANGELOG.md 顶部追加新版本条目（含日期）：
     \`\`\`text
     ## [1.2.0] - 2026-09-08
     ### Added
     - xxx
     ### Fixed
     - xxx
     \`\`\`
   - 保持既有日志格式，无 CHANGELOG.md 时按 Keep a Changelog 风格新建

4. **发布前检查**

   - 提醒运行完整测试（用户确认跳过时尊重决定）
   - 列出将要执行的发布动作清单（打 tag、构建、发布产物），**逐项确认后执行**

5. **执行发布**

   - 打 tag：\`git tag -a v<version> -m "release v<version>"\`
   - 构建发布产物
   - 推送分支与 tag（外向操作，需用户最终确认）

## 约束

- 发布不可轻易回滚：所有外向步骤（tag、push、发布产物）执行前必须确认
- 版本号变更必须先于发布动作完成并核对
- 发布失败时明确说明停在哪一步、已产生哪些影响，不静默继续`,
        license: 'MIT',
        compatibility: '需要 git 环境。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getTrReleaseVersionCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 发布版本',
        description: '发布版本 —— 版本号管理、变更日志整理、发布流程执行',
        category: 'Venus / 版本',
        tags: ['venus', 'tr_release', 'release', 'version', 'changelog'],
        content: `发布版本 —— 版本号变更、变更日志、发布产物三件事，每步确认后执行。

**输入**：\`/venus:release-version\` 后可跟目标版本号（如 1.2.0）或版本类型（major/minor/patch；可省略，省略时根据变更内容建议）。

## 执行步骤

1. **收集变更**：\`git log <last-tag>..HEAD --oneline\`，按 feat / fix / docs / refactor / chore 分组。
2. **确认版本号**：按 SemVer 建议（MAJOR 破坏性 / MINOR 新功能 / PATCH 修复），展示分组与理由，等用户确认。
3. **更新版本与日志**：同步项目配置版本号；CHANGELOG.md 顶部追加新版本条目（含日期，Keep a Changelog 风格）。
4. **发布前检查**：提醒运行完整测试；列出发布动作清单（tag、构建、推送），逐项确认后执行。
5. **执行发布**：\`git tag -a v<version>\` → 构建 → 推送分支与 tag（需用户最终确认）。

## 约束

- 所有外向步骤（tag、push、发布产物）执行前必须确认
- 发布失败时明确停在哪一步、影响范围，不静默继续`,
    };
}
