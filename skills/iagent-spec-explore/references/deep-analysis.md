### 1.4 关键词检测与分析

在 grill-with-docs 追问之前或期间**扫描用户输入中的关键词**。

#### 关键词检测规则

**Layer 1: 类目关键词**（触发分析类目）

| 类目 | 关键词 |
|----------|----------|
| Security | security, authentication, auth, login, password, token, session, vulnerability, xss, sql injection, csrf, sanitization, validation, sanitize, escape |
| Architecture | architecture, refactor, restructure, migrate, move, rename, extract, merge, split, component, module, service, api, endpoint, route, call chain, dependency, integration |
| Business | business, workflow, process, flow, state, transition, rule, logic, validation, trigger, event, handler, step, procedure |
| Impact | impact, change, modify, update, delete, remove, add, replace, rename, signature, parameter, return type, breaking |

**Layer 2: 子类目关键词**（细化分析类型）

| 子类目 | 关键词 |
|--------------|----------|
| Security.InputValidation | input, validate, sanitize, escape, user input, form, request, parameter |
| Security.Authentication | login, signin, authenticate, password, token, jwt, oauth, session |
| Security.DataFlow | data flow, track, trace, source, sink, propagate, tainted |
| Architecture.CallChain | call chain, caller, callee, invocation, dependency, reference, import |
| Architecture.DataFlow | data flow, model, entity, dto, vo, database, query, dao, mapper |
| Architecture.API | api, endpoint, route, handler, controller, request, response |
| Business.StateTransition | state, transition, status, change, trigger, event, condition |
| Business.Validation | validate, rule, check, constraint, requirement, condition |

**Layer 3: 上下文修饰关键词**（调整分析范围）

| 修饰符 | 关键词 |
|----------|----------|
| Scope.Modify | modify, update, change, edit, refactor, enhance |
| Scope.Add | add, create, new, introduce, implement |
| Scope.Remove | remove, delete, drop, deprecate |
| Depth.Deep | deep, comprehensive, thorough, full, complete |
| Depth.Targeted | targeted, specific, particular, focused |

#### 检测逻辑

```
1. Exact match priority: Check exact keyword match first
2. Substring match: If no exact match, check substring presence
3. Case-insensitive: Match regardless of case
4. Multi-category: Allow multiple categories detected simultaneously
```

#### 分析自动执行

**检测到单个或多个类目**：
> "检测到 [Security/Architecture/Business] 关键词，自动运行相应分析。"

**检测到修饰词**：
> "检测到 [Modify] 范围与 [Deep] 深度，自动运行深度分析。"

关键词一经检测即直接执行分析 —— 不得向用户提供运行/跳过选项。推荐选项（"全部运行"）即默认行为。

#### 分析执行

**安全分析（Semgrep）**：
Semgrep MCP 为可选增强：不可用时该分析跳过并记录，不阻塞工作流。

```bash
# Use MCP tool for security scanning
mcp__plugin_semgrep_semgrep__semgrep_scan --code-files <paths>

# Or for findings from platform:
mcp__plugin_semgrep_semgrep__semgrep_findings --repos <repo> --issue-type ISSUE_TYPE_SAST
```

**架构分析（CodeGraph）**:
```bash
# Use symbols from 1.2.1 base scan results (already searched)
# Find callers/callees for deeper understanding
mcp__codegraph__codegraph_callers --symbol <symbol>
mcp__codegraph__codegraph_callees --symbol <symbol>

# Build context after questioning (task description now clearer)
mcp__codegraph__codegraph_context --task <description>
```

**业务分析（CodeGraph）**:
```bash
# Use symbols from 1.2.1 base scan results (already searched)
# Build context from task description (after questioning, now clearer)
mcp__codegraph__codegraph_context --task <business-flow>

# Deep exploration of business logic
mcp__codegraph__codegraph_explore --query <topic>
```

#### 分析结果写入探索文件

在 Background 之后加入 Analysis 段：

```markdown
## Analysis

### Security Findings
- <Vulnerability type>: <Affected area>
  Recommended fix: <Approach>

### Architecture Flow
<ASCII call chain diagram>

### Business Flow
<ASCII business process diagram>

### Identified Symbols
- <Symbol name> (<File location>)
  Reason: <Why identified>
  Priority: <Level>

## Questions
...
```

#### Pending 段增强

加入按类型归类的子段，供 Phase 2 关注：

```markdown
## Pending

### For Phase 2 Impact Analysis
- <Symbol name> (<File location>) - Priority: HIGH

### Security Concerns
- <Vulnerability type>: <Affected area> - Fix: <Approach>

### Business Validation
- <Validation question>: <Context>
```

#### 分析驱动的跟进问题（NEW）

**分析完成后**，自动生成跟进问题：

```
Algorithm: generateFollowUpQuestions(analysisResults)

1. Security Findings → Generate questions:
   - HIGH/CRITICAL: "Fix XSS in <file>:<line>?" (auto-ask)
   - MEDIUM: "Address SQL injection in <file>?" (on request)
   - Include: vulnerability type, file path, fix recommendation

2. Architecture Symbols → Generate questions:
   - HIGH callers: "Update N callers of <symbol>?" (auto-ask)
   - MEDIUM callers: "Check callers of <symbol>?" (on request)
   - Include: call chain, impact scope, migration plan

3. Business Steps → Generate questions:
   - Decision triggers: "Is <trigger> correct?" (auto-ask)
   - State transitions: "Validate transition rules?" (on request)
   - Include: state change, validation rule, edge cases
```

**问题优先级逻辑**：
- **HIGH 优先级**：自动提问（安全 CRITICAL、架构破坏性变更、业务决策）
- **MEDIUM/LOW 优先级**：仅在用户要求时提问："展示全部跟进问题"

**深度优先追问**：
- 从发现的漏洞 → 追问相关安全领域
- 从破坏性变更 → 追问迁移策略与弃用时间线
- 从决策点 → 追问边界场景与错误处理

**示例**：
```
After Security analysis finds XSS vulnerability:

AI: "Security analysis found XSS vulnerability in sanitizeInput() at user-utils.ts:45.
    How should we fix it?
    My recommendation: Use DOMPurify for HTML sanitization in this area.

    [Depth-first]
    Should we also check other sanitization points in the authentication flow?
    My recommendation: Yes - review all input validation in auth module."
```

### 1.4.5 实现深潜分析（NEW）

**触发**：分层触发机制检测到 Scope.Modify、Scope.Add + 触及既有代码，或 Depth.Deep 关键词时。

**目的**：超越表层分析（"谁调用谁"），在动手改动前理解代码**为什么**这样设计。

**分析维度**：

| 维度 | 主要来源 | 备用来源 |
|-----------|---------------|---------------|
| 设计理由 | 代码注释、JavaDoc/docstring | ADR 文档、README、设计文档 |
| 约束 | package.json engines、tsconfig、linter 配置 | .browserslistrc、CI 配置 |
| 权衡取舍 | TODO/FIXME/HACK 注释 | 代码评审记录、基准测试 |
| 模式使用 | 类/接口结构、命名约定 | 设计模式库匹配 |
| 历史背景 | `git log --follow`、`git blame` | CHANGELOG.md、版本标签 |
| 隐含假设 | 类型守卫、默认值、缺失的空值检查 | 环境变量依赖、魔法数字 |

**范围控制**（按触发级别）：

| 触发级别 | 维度 | 符号上限 |
|--------------|------------|-------------|
| 🔴 自动（Scope.Modify） | 全部 6 个维度 | 10 个核心符号 |
| 🟡 提示（Scope.Add） | 理由 + 约束 + 假设 | 10 个核心符号 |
| 🟢 手动（Depth.Deep） | 用户选定 | 10 个核心符号 |

**置信度标记**：
- `HIGH`：见于代码注释、ADR 或设计文档 —— 有明确记载
- `MEDIUM`：由 git 历史、命名模式或结构分析推断
- `LOW`：AI 从代码模式推断 —— MUST 生成跟进问题请用户确认

**与 Grill-With-Docs 的集成**：
- LOW 置信度的发现 → 自动生成跟进问题
- 隐含假设 → 一律生成确认问题
- 权衡取舍 → 询问在当前需求下是否仍成立

**产出**：把发现写入 exploration.md 的 `## Implementation Deep-Dive` 段。
无发现的子段标记 `<!-- No findings -->`。
整段为条件显示 —— 仅在触发深度分析时显示。

