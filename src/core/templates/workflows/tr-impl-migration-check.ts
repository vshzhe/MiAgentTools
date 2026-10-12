/**
 * tr_impl 类型技能模板：迁移一致性检查。
 *
 * 源项目到目标项目的迁移后一致性检查：六层对比（Controller / Service /
 * DAO / 前端页面 / SQL / 数据库 schema）、框架档案驱动的方法映射（不含
 * 内置 per-framework 预设）、P0/P1/P2 问题分级，以及强制写回验证。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { CODEGRAPH_MCP } from '../tool-whitelist.js';

export function getTrImplMigrationCheckSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_tr_impl_migration_check',
        description: 'Check functional consistency after migrating a source project to a target project — identify lost functionality, inconsistent implementations, and framework-difference issues across backend layers (Controller/Service/DAO), frontend pages, SQL statements, and database schema. Use when the user wants a migration check, a function comparison between two projects, migration verification after code migration, or a framework-upgrade consistency check. Supports standalone interactive mode and non-interactive invocation from the auto-migration workflow.',
        allowedTools: `Read, Write, Edit, Glob, Grep, ${CODEGRAPH_MCP}`,
        type: 'tr_impl',
        instructions: `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

Check functional consistency after migrating a source project to a target project. Identify lost functionality, inconsistent implementations, and framework-difference issues across the backend (Controller / Service / DAO), frontend pages, SQL statements, and database schema. Every comparison result MUST be written into documents containing actual data — creating empty directories or template-only documents is forbidden.

**Input**: The user's request should include the source project path and the target project path, plus an optional check scope. If omitted, check if they can be inferred from conversation context (the current project is the usual target). If ambiguous, ask the user.

---

## Step 1: Determine execution mode

**Standalone mode (default when invoked directly)**:
- Collect parameters interactively using the **AskUserQuestion tool**:
  1. SOURCE_PROJECT — 源项目根目录 (source project root directory)
  2. TARGET_PROJECT — 目标项目根目录 (target project root directory; defaults to the current project)
  3. CHECK_SCOPE — 检查范围 (module names or a feature list; 「全部」 means the whole project)
- For CHECK_SCOPE, offer common choices: 「全部」, or module names detected from the source project's directory structure (multi-select when applicable).

**Non-interactive mode (when invoked from the auto-migration workflow)**:
- The calling flow injects the parameters (source/target paths, check scope, framework profiles, output directory).
- Do NOT ask questions; skip every parameter already provided.
- Record missing non-blocking parameters as gaps in the final summary — never block mid-run.

## Step 2: Validate paths and scope

For SOURCE_PROJECT and TARGET_PROJECT:

1. Verify each path exists and is readable (list its top-level entries).
2. If a path does not exist or is not readable: report a clear error naming the path and the reason, ask the user to re-enter it, and do NOT start any comparison.

Rules:

- **Identical source and target paths are valid input** (same-framework upgrade / version iteration scenario). Accept the input and compare by version or directory differences (for example two release directories or two versions of the same project) — never reject it just because the paths are equal.
- CHECK_SCOPE 「全部」 scans the whole project; otherwise restrict scanning to the named modules or features. If a scope entry cannot be located in either project, mark it **[待确认]** in the summary instead of guessing a match.

## Step 3: Collect framework profiles (method comparison is profile-driven)

This skill is framework-agnostic. Framework-specific knowledge comes ONLY from user-provided 框架档案 (framework profiles) — never from built-in presets.

A profile contains (all items optional except the framework name):

| 档案项 | 用途 |
|--------|------|
| 框架名 (framework name) | Identifies the source or target framework in the report |
| 框架标准方法清单 (framework standard method list) | Methods the framework auto-provides per layer (e.g., a configuration-driven framework that generates CRUD methods invisible in source code) |
| 框架特有机制说明 (framework-specific mechanisms) | Other framework behavior notes relevant to the comparison |

Collection:

- Non-interactive mode: use the profiles injected by the caller.
- Standalone mode: ask whether the source project uses a framework that auto-generates methods; if yes, ask the user to provide the standard method list (pasted text or a file path).
- Never guess or reconstruct a framework method list — if the user cannot provide one, treat the profile as absent and use the fallback below.
- A target-side profile is optional (useful when the two sides use different frameworks); without one, the target side is always compared by its actual source code.

**Method comparison rule**:

- **WHEN** the framework profile contains a framework standard method list **THEN** compare each method in that list against the target project implementation one by one (mapping by function: list page, add, update, delete, detail, import, export, etc.) — those methods may be invisible in the source code because the framework provides them.
- **WHEN** no method list is provided **THEN** extract the actual method signatures from the source code and compare them one by one against the target project.
- This skill MUST NOT contain built-in method-mapping presets for any specific framework. Any framework-specific method mapping exists only inside the user-provided profile content.

## Step 4: Determine the output root

Route by execution context:

| Context | Output root |
|---------|-------------|
| Invoked from the auto-migration workflow (change context) | \`openspec/changes/{change-name}/attachments/migration-check/\` |
| Standalone execution | User-specified directory, or the default \`openspec/migration/\` in the target project |

- Build every path with \`path.join()\` (cross-platform: Windows and POSIX).
- Create the output directory structure before writing documents (recursive mkdir semantics).

## Step 5: Six-layer comparison (write real data, then verify)

Core principle — for EVERY layer:

1. Read the actual code from both projects (Read / Glob / Grep).
2. Compare deeply — functionality, not line counts.
3. Write the analysis results into the layer's comparison document.
4. Read the document back and verify it contains actual data (Step 7).

Use the **TodoWrite tool** to track the six layers plus the issue list and summary, marking each layer completed only after its read-back verification passes.

### Tech stack detection (once, before Layer 1)

This skill is stack-agnostic. Detect each project's stack once and reuse the result for all layers:

1. Read \`openspec/config.yaml\` \`context\` for the target project's declared tech stack (if present).
2. Check build/dependency files in both projects (e.g., \`package.json\`, \`pom.xml\`, \`build.gradle\`, \`go.mod\`) — the two sides may use different stacks.
3. Derive stack-appropriate file patterns, method-signature extraction patterns, and SQL dialect from the detection result. Do not assume a specific stack.

Output structure under the output root (from Step 4):

\`\`\`
{OUTPUT_ROOT}/
├── 00_检查摘要.md
├── 01_后端对比/
│   ├── 01_Controller层对比.md
│   ├── 02_Service层对比.md
│   └── 03_DAO层对比.md
├── 02_前端对比/
│   ├── 01_页面文件对比.md
│   ├── 02_表单字段对比.md
│   └── 03_JavaScript函数对比.md
├── 03_SQL对比/
│   └── 01_SQL语句对比.md
├── 04_数据库对比/
│   └── 01_表结构对比.md
├── 05_问题清单/
│   ├── 01_严重问题.md
│   ├── 02_重要问题.md
│   └── 03_一般问题.md
└── 06_修复建议/
    └── 01_修复方案汇总.md
└── 07_对抗检查/
    ├── 01_C1_空实现检测.md
    ├── 02_C2_分支逻辑完整性.md
    ├── 03_C3_事务边界一致性.md
    ├── 04_C4_异常处理完整性.md
    ├── 05_C5_精度类型一致性.md
    └── 06_C6_SQL条件完整性.md
\`\`\`

**Adversarial check rules (C1-C6, cross-cutting):**

The adversarial checks are cross-cutting dimensions that run AFTER each layer's comparison completes. They inspect the code already read for that layer, looking for migration quality issues that the functional comparison alone would miss.

| 检查维度 | 关联层 | 执行时机 | 问题分级 |
|----------|--------|---------|---------|
| C1 空实现/硬编码检测 | 全局 (所有层) | 每层对比完成后 | P2 |
| C2 分支逻辑完整性 | Service 层 | Service 层对比完成后 | P0 |
| C3 事务边界一致性 | Service 层 | Service 层对比完成后 | P0 |
| C4 异常处理完整性 | 全局 (所有层) | 每层对比完成后 | P1 |
| C5 精度/类型一致性 | DAO 层 + Service 层 | DAO 层对比完成后 | P1 |
| C6 SQL 条件完整性 | SQL 层 | SQL 层对比完成后 | P0 |

**C1 — 空实现/硬编码检测**: scan the target code for \`return null;\`, \`return [];\`, \`// TODO\`, \`// FIXME\`, placeholder comments, and hardcoded stub values. Each finding is a P2 issue.

**C2 — 分支逻辑完整性**: compare the source and target code's conditional branches (if/else, switch, ternary). When the source has N branches but the target has fewer, report the missing branches as P0 issues. Quote the specific condition values from the source to show what was lost.

**C3 — 事务边界一致性**: check that the source project's transaction boundaries (Tx.begin/commit/rollback, @Transactional, transactionTemplate) have equivalent transaction management in the target. Missing transaction management on write operations (create/update/delete) is a P0 issue.

**C4 — 异常处理完整性**: compare try-catch blocks between source and target. An empty catch block (\`catch (e) {}\`) or a completely missing try-catch where the source has one is a P1 issue. Report the specific exception types being caught.

**C5 — 精度/类型一致性**: compare numeric precision and types between source and target (BigDecimal vs double/float, int vs long, number of decimal places). A precision mismatch that could cause data loss is a P1 issue.

**C6 — SQL 条件完整性**: compare the WHERE/JOIN conditions between source and target SQL statements. When the source has additional conditions (e.g., \`WHERE a=1 AND b=2\` vs \`WHERE a=1\`), report the missing conditions as P0 issues.

Each adversarial check report must follow the same format as the layer reports (header block, comparison table, findings list). Write the 6 reports under \`07_对抗检查/\`.

Every comparison document must contain: a header block (check time, SOURCE_PROJECT, TARGET_PROJECT, framework profiles used), the layer's inventory comparison table, per-item method/field comparison tables with concrete data, a difference analysis section, and the issues found (each tagged with its P0/P1/P2 level). Document skeleton — all \`{...}\` placeholders must be replaced with actual data before writing:

\`\`\`markdown
# {层名} 对比报告

**检查时间**: {timestamp}
**源项目**: {SOURCE_PROJECT}
**目标项目**: {TARGET_PROJECT}
**框架档案**: {profile summary or 未提供}

## 1. 文件清单对比

| 单元 | 源项目存在 | 目标项目存在 | 源项目路径 | 目标项目路径 | 状态 |
|------|-----------|-------------|-----------|-------------|------|
| {name} | ✅/❌ | ✅/❌ | {path} | {path} | 已迁移/缺失/新增 |

**统计**: 源项目 {N} 个，目标项目 {M} 个，覆盖率 {P}%

## 2. 逐单元方法/字段对比

| 源方法/字段 | 目标实现 | 功能 | 权限/校验 | 状态 |
|------------|---------|------|----------|------|
| {source} | {target} | {function} | {check} | ✅ 已实现 / ❌ 缺失 / ⚠️ 差异 |

## 3. 差异分析

{concrete differences, quoting the actual code fragments read from both sides}

## 4. 发现的问题

- **问题 #N** — 位置: {project}/{file}/{method} | 类型: {type} | 等级: P0/P1/P2 | 说明: {description} | 验证方法: {verification}
\`\`\`

A submitted document that still contains unfilled \`{...}\` placeholders fails the Step 7 read-back verification — rewrite it with actual data.

**Matching methodology**:

- Match by functionality, not by name alone: when a file or method was renamed during migration, correlate it via route paths, table names, or business semantics and report it as migrated (with the rename noted), not as missing.
- Logic moved between layers (for example from Controller to Service) must be traced into the destination layer and compared there before being reported as missing.
- Never conclude "missing" from line counts or file sizes — verify by reading the actual implementation.

### Layer 1: Controller 层对比 (01_后端对比/01_Controller层对比.md)

1. Glob both projects for controller files using stack-appropriate patterns (e.g., \`**/*Controller.java\`, \`**/*Controller.ts\`, \`**/controllers/**\`). Detect the stack from project files; do not assume a specific stack.
2. Build the file inventory comparison table: both-present / source-only (missing in target) / target-only (newly added), with full paths, plus coverage statistics (source N, target M, coverage P%).
3. For each controller in scope:
   - Read the source controller; enumerate its methods per the Step 3 rule: the profile's standard method list when provided, otherwise the actual method signatures extracted via Grep (adjust the pattern per language).
   - Read the target controller; extract method signatures and route/mapping annotations.
   - Build the method comparison table covering: method existence, signature (return type, parameters), route mapping, permission/authorization check, and view/JSON return type.
   - When core business logic differs (not just code placement), quote the actual code fragments read from BOTH sides and analyze the difference — logic moved to another layer must be verified in that layer before being reported as missing.
4. Write the document with the inventory table, per-controller method comparison tables, difference analysis, and issues found. Read back and verify.

### Layer 2: Service 层对比 (01_后端对比/02_Service层对比.md)

1. Glob both projects for service classes; build the inventory table as in Layer 1.
2. For each service in scope, compare method by method (existence, signature, return type, parameters), applying the Step 3 rule when the source framework auto-provides service methods.
3. Cross-cutting checks (apply the ones relevant to the detected stack; report the rest as not applicable):
   - Transaction management on create/update/delete methods
   - Logging / audit records on operations
   - Notification / messaging on data changes
   - Data isolation / tenant filtering on queries
4. When available, use CodeGraph tools (search / context / callers / callees) to verify call chains (Controller → Service → DAO); fall back to Grep when CodeGraph is unavailable.
5. Write the document with the inventory table, per-service method comparison tables, cross-cutting check results, and issues found. Read back and verify.

### Layer 3: DAO 层对比 (01_后端对比/03_DAO层对比.md)

1. Glob the target project for DAO / mapper / repository files. When the source project has no dedicated DAO layer (configuration-driven frameworks), compare against its configuration/bean definitions instead, guided by the framework profile's mechanism notes.
2. For each data-access unit, extract and compare: table names, selected fields, WHERE conditions, JOIN conditions, ORDER BY clauses, and parameter binding.
3. Write the document with the inventory table, per-unit data-access comparison tables, and issues found. Read back and verify.

### Layer 4: 前端对比 (02_前端对比/)

1. Glob both projects for page/template files using stack-appropriate patterns (e.g., \`**/*.jsp\`, \`**/*.html\`, \`**/*.vue\`, \`**/*.tsx\`).
2. For each page in scope, Read both versions and compare:
   - Page existence and inventory — 01_页面文件对比.md
   - Form fields: name, type, required, validation rules — 02_表单字段对比.md
   - JavaScript functions, AJAX request URLs, and static resource references — 03_JavaScript函数对比.md
3. Write each document with actual tables and field-level differences. Read back and verify each one.

### Layer 5: SQL 对比 (03_SQL对比/01_SQL语句对比.md)

1. Extract SQL statements from both projects: mapper/configuration files, embedded strings, and \`.sql\` scripts.
2. Compare statement by statement for the in-scope features: SELECT field completeness, WHERE conditions, JOIN conditions, ORDER BY clauses, LIKE usage, and field aliases.
3. Write the document with statement-level comparison tables and concrete differences. Read back and verify.

### Layer 6: 数据库对比 (04_数据库对比/01_表结构对比.md)

1. Extract table structures from \`.sql\` scripts or entity/model classes on both sides.
2. Compare: table existence, column lists, column types, nullability, defaults, indexes, and audit columns.
3. Write the document with table-level and column-level comparison tables and concrete differences. Read back and verify.

## Step 6: Classify issues into P0/P1/P2

Classification rules:

| Level | 含义 | Criteria |
|-------|------|----------|
| P0 🔴 严重问题 | Fix immediately | 功能完全缺失 (functionality completely missing); 核心业务逻辑错误 (core business logic errors); 数据完整性风险 (data integrity risk); 安全漏洞 (security vulnerabilities) |
| P1 🟡 重要问题 | Fix as soon as possible | 功能部分缺失 (partial functionality missing); 日志记录不完整 (incomplete logging); 权限配置问题 (permission configuration issues) |
| P2 🟢 一般问题 | Suggestions | 代码规范问题 (code standards); 注释缺失 (missing comments); 命名不规范 (naming suggestions) |

Every issue MUST contain: 位置 (location — project/file/method), 类型 (type), 等级 (level), 说明 (description), 验证方法 (verification method). Issue entry format (used in all three documents):

\`\`\`markdown
### 问题 #N: {标题}

- **位置**: {project}/{file}/{method}
- **类型**: {功能缺失 | 逻辑不一致 | 数据风险 | 安全 | 权限 | 日志 | 规范 | 空实现/硬编码 | 分支缺失 | 事务缺失 | 异常吞没 | 精度丢失 | SQL条件缺失}
- **等级**: P0 / P1 / P2
- **说明**: {what differs, with evidence from the comparison}
- **验证方法**: {how to verify the gap or the fix}
\`\`\`

Write three documents under \`05_问题清单/\`:

- \`01_严重问题.md\` (P0), \`02_重要问题.md\` (P1), \`03_一般问题.md\` (P2)
- **When a level has no issues, its document MUST still be written and state 「未发现该级别问题」 — never omit the document.**
- \`06_修复建议/01_修复方案汇总.md\`: consolidated fix suggestions grouped by issue and referencing the issue lists; when no issues were found at any level, state that instead.

Finally write \`00_检查摘要.md\`: check time, SOURCE_PROJECT, TARGET_PROJECT, CHECK_SCOPE, framework profiles used, per-layer statistics, and P0/P1/P2 issue counts. Skeleton:

\`\`\`markdown
# 迁移检查摘要

**检查时间**: {timestamp}
**源项目**: {SOURCE_PROJECT}
**目标项目**: {TARGET_PROJECT}
**检查范围**: {CHECK_SCOPE}
**框架档案**: {profiles used, or 未提供}
**对比结论**: {one-paragraph overall consistency conclusion}

| 对比层 | 文档 | 已对比单元数 | 发现问题数 |
|--------|------|-------------|-----------|
| Controller 层 | 01_后端对比/01_Controller层对比.md | {N} | {N} |
| Service 层 | 01_后端对比/02_Service层对比.md | {N} | {N} |
| DAO 层 | 01_后端对比/03_DAO层对比.md | {N} | {N} |
| 前端 | 02_前端对比/ | {N} | {N} |
| SQL | 03_SQL对比/01_SQL语句对比.md | {N} | {N} |
| 数据库 | 04_数据库对比/01_表结构对比.md | {N} | {N} |
| 对抗检查 | 07_对抗检查/ | {N} | {N} |

**问题统计**: P0 {N} 个 / P1 {N} 个 / P2 {N} 个
\`\`\`

## Step 7: Write-back verification (mandatory)

After EVERY document is written, use the Read tool to read it back and confirm:

1. The file exists and is non-empty.
2. It contains comparison tables with concrete rows (real file names, method names, field names — not placeholders).
3. It is not a template with unfilled headings only.

If verification fails, rewrite the document with the actual data before moving on. Never report a layer as checked based on a template-only or empty document.

## Final summary

After all documents are verified, report to the user:

- The output root path (from Step 4)
- Per-layer completion status (documents written and verified)
- P0/P1/P2 issue counts and the most critical issues (P0 first)
- Any **[待确认]** items and parameters that were missing in non-interactive mode

## Output verification

After the check completes, verify:

- [ ] All six layers compared and each document written with actual data
- [ ] Every document read back and verified non-template (Step 7)
- [ ] Issue lists written per level; each issue has 位置/类型/等级/说明/验证方法
- [ ] Empty levels state 「未发现该级别问题」 and are not omitted
- [ ] 00_检查摘要.md written with paths, scope, profiles, and statistics
- [ ] Output routed per Step 4, all paths built with \`path.join()\`
- [ ] Framework method comparison driven only by provided profiles — no invented method lists; gaps marked **[待确认]**
- [ ] Adversarial checks (C1-C6) executed for each applicable layer
- [ ] 07_对抗检查/ reports written with header, comparison table, and findings list

**Guardrails**
- Never invent methods, fields, tables, or differences — report only what the actual code shows; mark uncertain findings as **[待确认]**
- Never compare by line count or file size alone — compare functionality (methods, fields, SQL semantics)
- Non-interactive mode (auto-migration integration): never block on questions; record gaps in the summary instead
- Use \`path.join()\` for all file paths`,
        license: 'MIT',
        compatibility: '依赖 CodeGraph MCP（可选，调用链验证时使用）。',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

export function getTrImplMigrationCheckCommandTemplate(): CommandTemplate {
    return {
        name: 'Venus: 迁移一致性检查',
        description: '检查源项目到目标项目的迁移一致性（后端/前端/SQL/数据库全栈）',
        category: 'Venus / 实现',
        tags: ['venus', 'tr_impl', 'migration-check', 'verification', 'comparison'],
        content: `**适用 openspec/rules/ai-coding.md 全域护栏。** 未定义项标 **[待确认]**，禁止猜测。

Check functional consistency after migrating a source project to a target project. Identify lost functionality, inconsistent implementations, and framework-difference issues across the backend (Controller / Service / DAO), frontend pages, SQL statements, and database schema. Every comparison result MUST be written into documents containing actual data — creating empty directories or template-only documents is forbidden.

**Input**: Optionally specify the source and target project paths after \`/venus:tr-impl-migration-check\` (e.g., \`/venus:tr-impl-migration-check /path/to/source-project /path/to/target-project\`). If omitted, they are collected interactively; the target defaults to the current project when only the source path is given.

---

## Step 1: Determine execution mode

**Standalone mode (default when invoked directly)**:
- Collect parameters interactively using the **AskUserQuestion tool**:
  1. SOURCE_PROJECT — 源项目根目录 (source project root directory)
  2. TARGET_PROJECT — 目标项目根目录 (target project root directory; defaults to the current project)
  3. CHECK_SCOPE — 检查范围 (module names or a feature list; 「全部」 means the whole project)
- For CHECK_SCOPE, offer common choices: 「全部」, or module names detected from the source project's directory structure (multi-select when applicable).

**Non-interactive mode (when invoked from the auto-migration workflow)**:
- The calling flow injects the parameters (source/target paths, check scope, framework profiles, output directory).
- Do NOT ask questions; skip every parameter already provided.
- Record missing non-blocking parameters as gaps in the final summary — never block mid-run.

## Step 2: Validate paths and scope

For SOURCE_PROJECT and TARGET_PROJECT:

1. Verify each path exists and is readable (list its top-level entries).
2. If a path does not exist or is not readable: report a clear error naming the path and the reason, ask the user to re-enter it, and do NOT start any comparison.

Rules:

- **Identical source and target paths are valid input** (same-framework upgrade / version iteration scenario). Accept the input and compare by version or directory differences (for example two release directories or two versions of the same project) — never reject it just because the paths are equal.
- CHECK_SCOPE 「全部」 scans the whole project; otherwise restrict scanning to the named modules or features. If a scope entry cannot be located in either project, mark it **[待确认]** in the summary instead of guessing a match.

## Step 3: Collect framework profiles (method comparison is profile-driven)

This skill is framework-agnostic. Framework-specific knowledge comes ONLY from user-provided 框架档案 (framework profiles) — never from built-in presets.

A profile contains (all items optional except the framework name):

| 档案项 | 用途 |
|--------|------|
| 框架名 (framework name) | Identifies the source or target framework in the report |
| 框架标准方法清单 (framework standard method list) | Methods the framework auto-provides per layer (e.g., a configuration-driven framework that generates CRUD methods invisible in source code) |
| 框架特有机制说明 (framework-specific mechanisms) | Other framework behavior notes relevant to the comparison |

Collection:

- Non-interactive mode: use the profiles injected by the caller.
- Standalone mode: ask whether the source project uses a framework that auto-generates methods; if yes, ask the user to provide the standard method list (pasted text or a file path).
- Never guess or reconstruct a framework method list — if the user cannot provide one, treat the profile as absent and use the fallback below.
- A target-side profile is optional (useful when the two sides use different frameworks); without one, the target side is always compared by its actual source code.

**Method comparison rule**:

- **WHEN** the framework profile contains a framework standard method list **THEN** compare each method in that list against the target project implementation one by one (mapping by function: list page, add, update, delete, detail, import, export, etc.) — those methods may be invisible in the source code because the framework provides them.
- **WHEN** no method list is provided **THEN** extract the actual method signatures from the source code and compare them one by one against the target project.
- This skill MUST NOT contain built-in method-mapping presets for any specific framework. Any framework-specific method mapping exists only inside the user-provided profile content.

## Step 4: Determine the output root

Route by execution context:

| Context | Output root |
|---------|-------------|
| Invoked from the auto-migration workflow (change context) | \`openspec/changes/{change-name}/attachments/migration-check/\` |
| Standalone execution | User-specified directory, or the default \`openspec/migration/\` in the target project |

- Build every path with \`path.join()\` (cross-platform: Windows and POSIX).
- Create the output directory structure before writing documents (recursive mkdir semantics).

## Step 5: Six-layer comparison (write real data, then verify)

Core principle — for EVERY layer:

1. Read the actual code from both projects (Read / Glob / Grep).
2. Compare deeply — functionality, not line counts.
3. Write the analysis results into the layer's comparison document.
4. Read the document back and verify it contains actual data (Step 7).

Use the **TodoWrite tool** to track the six layers plus the issue list and summary, marking each layer completed only after its read-back verification passes.

### Tech stack detection (once, before Layer 1)

This skill is stack-agnostic. Detect each project's stack once and reuse the result for all layers:

1. Read \`openspec/config.yaml\` \`context\` for the target project's declared tech stack (if present).
2. Check build/dependency files in both projects (e.g., \`package.json\`, \`pom.xml\`, \`build.gradle\`, \`go.mod\`) — the two sides may use different stacks.
3. Derive stack-appropriate file patterns, method-signature extraction patterns, and SQL dialect from the detection result. Do not assume a specific stack.

Output structure under the output root (from Step 4):

\`\`\`
{OUTPUT_ROOT}/
├── 00_检查摘要.md
├── 01_后端对比/
│   ├── 01_Controller层对比.md
│   ├── 02_Service层对比.md
│   └── 03_DAO层对比.md
├── 02_前端对比/
│   ├── 01_页面文件对比.md
│   ├── 02_表单字段对比.md
│   └── 03_JavaScript函数对比.md
├── 03_SQL对比/
│   └── 01_SQL语句对比.md
├── 04_数据库对比/
│   └── 01_表结构对比.md
├── 05_问题清单/
│   ├── 01_严重问题.md
│   ├── 02_重要问题.md
│   └── 03_一般问题.md
└── 06_修复建议/
    └── 01_修复方案汇总.md
└── 07_对抗检查/
    ├── 01_C1_空实现检测.md
    ├── 02_C2_分支逻辑完整性.md
    ├── 03_C3_事务边界一致性.md
    ├── 04_C4_异常处理完整性.md
    ├── 05_C5_精度类型一致性.md
    └── 06_C6_SQL条件完整性.md
\`\`\`

**Adversarial check rules (C1-C6, cross-cutting):**

The adversarial checks are cross-cutting dimensions that run AFTER each layer's comparison completes. They inspect the code already read for that layer, looking for migration quality issues that the functional comparison alone would miss.

| 检查维度 | 关联层 | 执行时机 | 问题分级 |
|----------|--------|---------|---------|
| C1 空实现/硬编码检测 | 全局 (所有层) | 每层对比完成后 | P2 |
| C2 分支逻辑完整性 | Service 层 | Service 层对比完成后 | P0 |
| C3 事务边界一致性 | Service 层 | Service 层对比完成后 | P0 |
| C4 异常处理完整性 | 全局 (所有层) | 每层对比完成后 | P1 |
| C5 精度/类型一致性 | DAO 层 + Service 层 | DAO 层对比完成后 | P1 |
| C6 SQL 条件完整性 | SQL 层 | SQL 层对比完成后 | P0 |

**C1 — 空实现/硬编码检测**: scan the target code for \`return null;\`, \`return [];\`, \`// TODO\`, \`// FIXME\`, placeholder comments, and hardcoded stub values. Each finding is a P2 issue.

**C2 — 分支逻辑完整性**: compare the source and target code's conditional branches (if/else, switch, ternary). When the source has N branches but the target has fewer, report the missing branches as P0 issues. Quote the specific condition values from the source to show what was lost.

**C3 — 事务边界一致性**: check that the source project's transaction boundaries (Tx.begin/commit/rollback, @Transactional, transactionTemplate) have equivalent transaction management in the target. Missing transaction management on write operations (create/update/delete) is a P0 issue.

**C4 — 异常处理完整性**: compare try-catch blocks between source and target. An empty catch block (\`catch (e) {}\`) or a completely missing try-catch where the source has one is a P1 issue. Report the specific exception types being caught.

**C5 — 精度/类型一致性**: compare numeric precision and types between source and target (BigDecimal vs double/float, int vs long, number of decimal places). A precision mismatch that could cause data loss is a P1 issue.

**C6 — SQL 条件完整性**: compare the WHERE/JOIN conditions between source and target SQL statements. When the source has additional conditions (e.g., \`WHERE a=1 AND b=2\` vs \`WHERE a=1\`), report the missing conditions as P0 issues.

Each adversarial check report must follow the same format as the layer reports (header block, comparison table, findings list). Write the 6 reports under \`07_对抗检查/\`.

Every comparison document must contain: a header block (check time, SOURCE_PROJECT, TARGET_PROJECT, framework profiles used), the layer's inventory comparison table, per-item method/field comparison tables with concrete data, a difference analysis section, and the issues found (each tagged with its P0/P1/P2 level). Document skeleton — all \`{...}\` placeholders must be replaced with actual data before writing:

\`\`\`markdown
# {层名} 对比报告

**检查时间**: {timestamp}
**源项目**: {SOURCE_PROJECT}
**目标项目**: {TARGET_PROJECT}
**框架档案**: {profile summary or 未提供}

## 1. 文件清单对比

| 单元 | 源项目存在 | 目标项目存在 | 源项目路径 | 目标项目路径 | 状态 |
|------|-----------|-------------|-----------|-------------|------|
| {name} | ✅/❌ | ✅/❌ | {path} | {path} | 已迁移/缺失/新增 |

**统计**: 源项目 {N} 个，目标项目 {M} 个，覆盖率 {P}%

## 2. 逐单元方法/字段对比

| 源方法/字段 | 目标实现 | 功能 | 权限/校验 | 状态 |
|------------|---------|------|----------|------|
| {source} | {target} | {function} | {check} | ✅ 已实现 / ❌ 缺失 / ⚠️ 差异 |

## 3. 差异分析

{concrete differences, quoting the actual code fragments read from both sides}

## 4. 发现的问题

- **问题 #N** — 位置: {project}/{file}/{method} | 类型: {type} | 等级: P0/P1/P2 | 说明: {description} | 验证方法: {verification}
\`\`\`

A submitted document that still contains unfilled \`{...}\` placeholders fails the Step 7 read-back verification — rewrite it with actual data.

**Matching methodology**:

- Match by functionality, not by name alone: when a file or method was renamed during migration, correlate it via route paths, table names, or business semantics and report it as migrated (with the rename noted), not as missing.
- Logic moved between layers (for example from Controller to Service) must be traced into the destination layer and compared there before being reported as missing.
- Never conclude "missing" from line counts or file sizes — verify by reading the actual implementation.

### Layer 1: Controller 层对比 (01_后端对比/01_Controller层对比.md)

1. Glob both projects for controller files using stack-appropriate patterns (e.g., \`**/*Controller.java\`, \`**/*Controller.ts\`, \`**/controllers/**\`). Detect the stack from project files; do not assume a specific stack.
2. Build the file inventory comparison table: both-present / source-only (missing in target) / target-only (newly added), with full paths, plus coverage statistics (source N, target M, coverage P%).
3. For each controller in scope:
   - Read the source controller; enumerate its methods per the Step 3 rule: the profile's standard method list when provided, otherwise the actual method signatures extracted via Grep (adjust the pattern per language).
   - Read the target controller; extract method signatures and route/mapping annotations.
   - Build the method comparison table covering: method existence, signature (return type, parameters), route mapping, permission/authorization check, and view/JSON return type.
   - When core business logic differs (not just code placement), quote the actual code fragments read from BOTH sides and analyze the difference — logic moved to another layer must be verified in that layer before being reported as missing.
4. Write the document with the inventory table, per-controller method comparison tables, difference analysis, and issues found. Read back and verify.

### Layer 2: Service 层对比 (01_后端对比/02_Service层对比.md)

1. Glob both projects for service classes; build the inventory table as in Layer 1.
2. For each service in scope, compare method by method (existence, signature, return type, parameters), applying the Step 3 rule when the source framework auto-provides service methods.
3. Cross-cutting checks (apply the ones relevant to the detected stack; report the rest as not applicable):
   - Transaction management on create/update/delete methods
   - Logging / audit records on operations
   - Notification / messaging on data changes
   - Data isolation / tenant filtering on queries
4. When available, use CodeGraph tools (search / context / callers / callees) to verify call chains (Controller → Service → DAO); fall back to Grep when CodeGraph is unavailable.
5. Write the document with the inventory table, per-service method comparison tables, cross-cutting check results, and issues found. Read back and verify.

### Layer 3: DAO 层对比 (01_后端对比/03_DAO层对比.md)

1. Glob the target project for DAO / mapper / repository files. When the source project has no dedicated DAO layer (configuration-driven frameworks), compare against its configuration/bean definitions instead, guided by the framework profile's mechanism notes.
2. For each data-access unit, extract and compare: table names, selected fields, WHERE conditions, JOIN conditions, ORDER BY clauses, and parameter binding.
3. Write the document with the inventory table, per-unit data-access comparison tables, and issues found. Read back and verify.

### Layer 4: 前端对比 (02_前端对比/)

1. Glob both projects for page/template files using stack-appropriate patterns (e.g., \`**/*.jsp\`, \`**/*.html\`, \`**/*.vue\`, \`**/*.tsx\`).
2. For each page in scope, Read both versions and compare:
   - Page existence and inventory — 01_页面文件对比.md
   - Form fields: name, type, required, validation rules — 02_表单字段对比.md
   - JavaScript functions, AJAX request URLs, and static resource references — 03_JavaScript函数对比.md
3. Write each document with actual tables and field-level differences. Read back and verify each one.

### Layer 5: SQL 对比 (03_SQL对比/01_SQL语句对比.md)

1. Extract SQL statements from both projects: mapper/configuration files, embedded strings, and \`.sql\` scripts.
2. Compare statement by statement for the in-scope features: SELECT field completeness, WHERE conditions, JOIN conditions, ORDER BY clauses, LIKE usage, and field aliases.
3. Write the document with statement-level comparison tables and concrete differences. Read back and verify.

### Layer 6: 数据库对比 (04_数据库对比/01_表结构对比.md)

1. Extract table structures from \`.sql\` scripts or entity/model classes on both sides.
2. Compare: table existence, column lists, column types, nullability, defaults, indexes, and audit columns.
3. Write the document with table-level and column-level comparison tables and concrete differences. Read back and verify.

## Step 6: Classify issues into P0/P1/P2

Classification rules:

| Level | 含义 | Criteria |
|-------|------|----------|
| P0 🔴 严重问题 | Fix immediately | 功能完全缺失 (functionality completely missing); 核心业务逻辑错误 (core business logic errors); 数据完整性风险 (data integrity risk); 安全漏洞 (security vulnerabilities) |
| P1 🟡 重要问题 | Fix as soon as possible | 功能部分缺失 (partial functionality missing); 日志记录不完整 (incomplete logging); 权限配置问题 (permission configuration issues) |
| P2 🟢 一般问题 | Suggestions | 代码规范问题 (code standards); 注释缺失 (missing comments); 命名不规范 (naming suggestions) |

Every issue MUST contain: 位置 (location — project/file/method), 类型 (type), 等级 (level), 说明 (description), 验证方法 (verification method). Issue entry format (used in all three documents):

\`\`\`markdown
### 问题 #N: {标题}

- **位置**: {project}/{file}/{method}
- **类型**: {功能缺失 | 逻辑不一致 | 数据风险 | 安全 | 权限 | 日志 | 规范 | 空实现/硬编码 | 分支缺失 | 事务缺失 | 异常吞没 | 精度丢失 | SQL条件缺失}
- **等级**: P0 / P1 / P2
- **说明**: {what differs, with evidence from the comparison}
- **验证方法**: {how to verify the gap or the fix}
\`\`\`

Write three documents under \`05_问题清单/\`:

- \`01_严重问题.md\` (P0), \`02_重要问题.md\` (P1), \`03_一般问题.md\` (P2)
- **When a level has no issues, its document MUST still be written and state 「未发现该级别问题」 — never omit the document.**
- \`06_修复建议/01_修复方案汇总.md\`: consolidated fix suggestions grouped by issue and referencing the issue lists; when no issues were found at any level, state that instead.

Finally write \`00_检查摘要.md\`: check time, SOURCE_PROJECT, TARGET_PROJECT, CHECK_SCOPE, framework profiles used, per-layer statistics, and P0/P1/P2 issue counts. Skeleton:

\`\`\`markdown
# 迁移检查摘要

**检查时间**: {timestamp}
**源项目**: {SOURCE_PROJECT}
**目标项目**: {TARGET_PROJECT}
**检查范围**: {CHECK_SCOPE}
**框架档案**: {profiles used, or 未提供}
**对比结论**: {one-paragraph overall consistency conclusion}

| 对比层 | 文档 | 已对比单元数 | 发现问题数 |
|--------|------|-------------|-----------|
| Controller 层 | 01_后端对比/01_Controller层对比.md | {N} | {N} |
| Service 层 | 01_后端对比/02_Service层对比.md | {N} | {N} |
| DAO 层 | 01_后端对比/03_DAO层对比.md | {N} | {N} |
| 前端 | 02_前端对比/ | {N} | {N} |
| SQL | 03_SQL对比/01_SQL语句对比.md | {N} | {N} |
| 数据库 | 04_数据库对比/01_表结构对比.md | {N} | {N} |
| 对抗检查 | 07_对抗检查/ | {N} | {N} |

**问题统计**: P0 {N} 个 / P1 {N} 个 / P2 {N} 个
\`\`\`

## Step 7: Write-back verification (mandatory)

After EVERY document is written, use the Read tool to read it back and confirm:

1. The file exists and is non-empty.
2. It contains comparison tables with concrete rows (real file names, method names, field names — not placeholders).
3. It is not a template with unfilled headings only.

If verification fails, rewrite the document with the actual data before moving on. Never report a layer as checked based on a template-only or empty document.

## Final summary

After all documents are verified, report to the user:

- The output root path (from Step 4)
- Per-layer completion status (documents written and verified)
- P0/P1/P2 issue counts and the most critical issues (P0 first)
- Any **[待确认]** items and parameters that were missing in non-interactive mode

## Output verification

After the check completes, verify:

- [ ] All six layers compared and each document written with actual data
- [ ] Every document read back and verified non-template (Step 7)
- [ ] Issue lists written per level; each issue has 位置/类型/等级/说明/验证方法
- [ ] Empty levels state 「未发现该级别问题」 and are not omitted
- [ ] 00_检查摘要.md written with paths, scope, profiles, and statistics
- [ ] Output routed per Step 4, all paths built with \`path.join()\`
- [ ] Framework method comparison driven only by provided profiles — no invented method lists; gaps marked **[待确认]**
- [ ] Adversarial checks (C1-C6) executed for each applicable layer
- [ ] 07_对抗检查/ reports written with header, comparison table, and findings list

**Guardrails**
- Never invent methods, fields, tables, or differences — report only what the actual code shows; mark uncertain findings as **[待确认]**
- Never compare by line count or file size alone — compare functionality (methods, fields, SQL semantics)
- Non-interactive mode (auto-migration integration): never block on questions; record gaps in the summary instead
- Use \`path.join()\` for all file paths`,
    };
}
