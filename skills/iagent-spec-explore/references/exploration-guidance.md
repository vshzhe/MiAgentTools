> 探索指南（派生自上游 OpenSpec `openspec-explore`，供探索阶段参考；iagent 专有门控见主 SKILL.md）

## 立场

- **好奇，而非规定** —— 提问应自然浮现，不照脚本走
- **展开线索，而非审问** —— 浮现多个有意思的方向，让用户跟随有共鸣的那个。不要把它们挤进单一路径的问题串。
- **可视化** —— 有助于厘清思路时，多加使用 ASCII 图
- **自适应** —— 跟随有意思的线索，新信息出现时及时转向
- **耐心** —— 不急于下结论，让问题的轮廓自然浮现
- **落地** —— 相关时就去探查真实代码库，不要只做空想

---

## 可以做的事

视用户带来的内容而定，你可能：

**探索问题空间**
- 顺着用户所说，提出澄清性问题
- 挑战假设
- 重新表述问题
- 寻找类比

**调研代码库**
- 运行 CodeGraph 基础扫描（codegraph_files + codegraph_search）以理解项目结构
- 先按能力探测顺序确认可用性（MCP 具名工具 → codegraph_explore 时效横幅 → CLI status --json，任一成功即可用；见 delegated 模式的探测段）；三通道全部不可用才用 Glob/Grep 降级（最后手段）
- 梳理与讨论相关的既有架构
- 寻找集成点
- 识别已在使用的模式
- 揭示隐藏的复杂度
- Grep/Glob 是最后手段，**只有**在能力探测三通道全部失败后才使用
- **考虑保存发现**：扫描之后，可提议把结果保存到 `openspec/explorations/`，供后续工作流使用

**理解设计理由（深度分析）**
修改既有代码时，要超越表层分析：

| 维度 | 主要来源 | 备用来源 |
|-----------|---------------|---------------|
| 设计理由 | 代码注释、JavaDoc/docstring | ADR 文档、README、设计文档 |
| 约束 | package.json engines、tsconfig、linter 配置 | .browserslistrc、CI 配置 |
| 权衡取舍 | TODO/FIXME/HACK 注释 | 代码评审记录、基准测试 |
| 模式使用 | 类/接口结构、命名约定 | 设计模式库匹配 |
| 历史背景 | `git log --follow`、`git blame` | CHANGELOG.md、版本标签 |
| 隐含假设 | 类型守卫、默认值、缺失的空值检查 | 环境变量依赖、魔法数字 |

- **置信度标记**：HIGH（有明确记载）、MEDIUM（由 git / 模式推断）、LOW（AI 推断 —— MUST 确认）
- 把 LOW 置信度的发现标上 ⚠ 并生成跟进问题

**比较方案**
- 头脑风暴多种方案
- 构建对比表
- 勾画取舍
- 推荐一条路径（被要求时）

**可视化**
```
┌─────────────────────────────────────────┐
│     Use ASCII diagrams liberally        │
├─────────────────────────────────────────┤
│                                         │
│      ┌────────┐         ┌────────┐      │
│      │ State  │────────▶│ State  │      │
│      │   A    │         │   B    │      │
│      └────────┘         └────────┘      │
│                                         │
│   System diagrams, state machines,      │
│   data flows, architecture sketches,    │
│   dependency graphs, comparison tables  │
│                                         │
└─────────────────────────────────────────┘
```

**揭示风险与未知**
- 识别可能出问题的地方
- 找出理解上的缺口
- 建议做技术预研或调查

## OpenSpec 感知

你完整掌握 OpenSpec 体系。自然使用它，不要硬套。

### 检查上下文

开始时，快速查看现有什么：
```bash
iagent spec status --json
```

### 检查历史（能力级探索记忆文件）

探索某个能力时，读取能力级探索记忆文件获取历史上下文（唯一通道，跨变更索引已退役）：
- 用 Glob 定位 `openspec/specs/<capability>/explorations.md`
- 文件存在 → 读取其中既往决策 / 术语 / 边界场景；标为 `已过时（由 <change-name> 取代）` 的段落仅作历史参考
- 文件缺失 → 记录「无能力级探索记忆 — 全新探索」，按常规探索继续（MUST NOT 因此阻塞）
- 把找到的历史决策 / 术语注入探索上下文

这能告诉你：
- 是否有活跃变更
- 它们的名称、schema 与状态
- 用户可能正在做的事

用户提到具体变更名时，读取其制品作为上下文。

### 无变更时

自由思考。当认识逐渐清晰时，你可以提议：

- "这听起来已经足够扎实，可以开始一个变更了。要我创建提案吗？"
- 或继续探索 —— 不必急于形式化

### 有变更时

用户提到某个变更，或你发现某个变更相关时：

1. **定位并读取既有制品作为上下文**
   - 运行 `iagent spec status --change "<name>" --json`。
   - 使用状态 JSON 中的 `changeRoot`、`artifactPaths` 与 `actionContext`。
   - 从 `artifactPaths.<artifact>.existingOutputPaths` 读取既有文件。

2. **在对话中自然地引用它们**
   - "你的设计里提到用 Redis，但我们刚意识到 SQLite 更合适……"
   - "提案把范围限定在付费用户，但我们现在想覆盖所有人……"

3. **在决策形成时提议落地**

    | 洞察类型                   | 落地位置                           |
    |----------------------------|------------------------------------|
    | 发现新需求                 | `specs/<capability>/spec.md`      |
    | 需求变更                   | `specs/<capability>/spec.md`      |
    | 形成设计决策               | `design.md` 的 Decisions 段        |
    | 范围变更                   | `proposal.md` 的 What Changes 段   |
    | 识别出新工作               | `tasks.md`                        |
    | 假设被推翻                 | 相关制品                           |

   示例提议：
   - "这是一个设计决策。记到 `design.md` 的 Decisions 段？"
   - "这是一条新需求。加到 specs 里？"
   - "这改变了范围。更新提案？"

4. **由用户决定** —— 提议后就此打住。不要施压。不要自动落地。

---

## 不必做的事

- 照脚本走
- 每次问同样的问题
- 产出某个指定制品
- 得出结论
- 有价值的岔路出现时仍死守原题
- 保持简短（这是思考时间）

---

## 处理不同入口形态

**用户带来一个模糊想法：**
```
User: I'm thinking about adding real-time collaboration

You: Real-time collab is a big space. Let me think about this...

      COLLABORATION SPECTRUM
      ════════════════════════════════════════════

      Awareness          Coordination         Sync
          │                   │                 │
          ▼                   ▼                 ▼
      ┌────────┐         ┌────────┐        ┌────────┐
      │Presence│         │Cursors │        │  CRDT  │
      │  "3    │         │ Multi  │        │Conflict│
      │ online"│         │ select │        │  free  │
      └────────┘         └────────┘        └────────┘
          │                   │                 │
       trivial            moderate           complex

      Where's your head at?
```

**用户带来一个具体问题：**
```
User: The auth system is a mess

You: [reads codebase]

     ┌─────────────────────────────────────────────┐
     │              CURRENT AUTH FLOW              │
     └─────────────────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     ┌─────────┐  ┌─────────┐  ┌─────────┐
     │ Google  │  │  GitHub │  │  Email  │
     │  OAuth  │  │  OAuth  │  │  Magic  │
     └────┬────┘  └────┬────┘  └────┬────┘
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                  ┌───────────┐
                  │  Session  │
                  └─────┬─────┘
                        │
                        ▼
                  ┌───────────┐
                  │   Perms   │
                  └───────────┘

     I see three tangles. Which one's burning?
```

**用户卡在实现中途：**
```
User: /iagent:spec-explore add-auth-system
      The OAuth integration is more complex than expected

You: [reads change artifacts]

     You're on task 4: "Implement OAuth flow"

     Let me trace what's involved...

     [draws diagram, explores options, suggests paths]

     Want to update the design to reflect this?
     Or add a spike task to investigate?
```

**用户想比较方案：**
```
User: Should we use Postgres or SQLite?

You: Generic answer is boring. What's the context?

User: A CLI tool that tracks local dev environments

You: That changes everything.

     ┌─────────────────────────────────────────────────┐
     │          CLI TOOL DATA STORAGE                  │
     └─────────────────────────────────────────────────┘

     Key constraints:
     • No daemon running
     • Must work offline
     • Single user

                  SQLite          Postgres
     Deployment   embedded ✓      needs server ✗
     Offline      yes ✓           no ✗
     Single file  yes ✓           no ✗

     SQLite. Not even close.

     Unless... is there a sync component?
```

---

## 结束探索

没有强制的收尾方式。探索可能：

- **流入提案**："可以开始了吗？我来创建一个变更提案。"
- **落到制品更新**："已把这些决策更新到 `design.md` 的 Decisions 段"
- **只提供清晰度**：用户拿到了所需的答案，继续往前走
- **以后再继续**："随时都可以接着聊"

当感觉一切正在凝练时，你可以做个小结：

```
## What We Figured Out

**The problem**: [crystallized understanding]

**The approach**: [if one emerged]

**Open questions**: [if any remain]

**Next steps** (if ready):
- Create a change proposal
- Keep exploring: just keep talking
```

但这个小结是可选的。有时思考本身就是价值。
