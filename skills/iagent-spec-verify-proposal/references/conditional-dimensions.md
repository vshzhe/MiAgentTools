### Dimension 6: 交互细节完整性 [由前端关键词自动触发]

**Trigger**：在 design.md 或 specs/**/*.md 中检测到前端关键词。

**Check**：design.md 包含标准化的交互细节矩阵分节：
- **字段-UI组件映射矩阵**：把每个数据字段映射到 UI 组件、校验规则与交互行为
- **API 交互契约**：每个端点 —— Method、URL、Request/Response、错误码
- **数据库表-字段映射**：每张表 —— 列名、类型、约束、默认值、业务含义
- **UI 状态覆盖**：每个数据展示组件 —— Loading/Empty/Error/Data 状态

**PASS 条件**：
- 四个矩阵分节齐备且已填充（不是空表模板）
- 每个分节至少有一行具体数据
- 覆盖率 ≥ 70%

**覆盖率计算**：
```
D6 Score = (populated sections / 4) * 100%
Each section counts fully populated if it has ≥ 1 non-placeholder row
```

**存量处理**（向后兼容）：
- 若 design.md 不含交互细节矩阵分节（检查分节标题）：
  - 报告 WARNING（而非 FAIL）："交互细节矩阵缺失。建议补充以提升实现质量。"
  - WARNING 不阻断 apply 工作流
- 若 design.md 含这些分节但内容不完整（新变更）：
  - 报告 FAIL（阻断 apply）："交互细节矩阵不完整。请补充缺失内容。"

**FAIL 示例**：
- "D6 FAIL: 字段-UI组件映射矩阵为空 —— 需要列出字段与组件的对应关系"
- "D6 WARNING: 交互细节矩阵缺失。建议补充以提升实现质量。"

**FAIL 处理**：
> 交互细节矩阵缺失或不完整。
> [1] 在 design.md 补充交互细节 [2] 确认有意跳过 [3] 返回设计阶段

### Dimension 7: API 契约完整性 [由 API 关键词自动触发]

**Trigger**：在 design.md 或 specs/**/*.md 中检测到 API 关键词。

**Check**：design.md 中列出的每个 API 端点都有完整契约定义：
- Method（GET/POST/PUT/DELETE）
- URL 路径
- 带类型的 Request body/params
- 带类型的 Response body 结构
- 错误码（至少：200、400、404、500）

**PASS 条件**：
- ≥ 80% 的已检测端点有完整契约
- 每个端点包含：Method、URL、Request、Response，至少 2 个错误码

**覆盖率计算**：
```
D7 Score = (endpoints with complete contracts / total endpoints) * 100%
```

**存量处理**：
- 若 design.md 未找到 API 契约分节：WARNING，而非 FAIL
- WARNING 提示："API 交互契约缺失。建议补充端点定义。"

**FAIL 示例**：
- "D7 FAIL: POST /api/v1/orders 缺少 Response body 定义"
- "D7 WARNING: API 交互契约缺失。建议补充端点定义。"

### Dimension 8: 数据库映射完整性 [由 DB 关键词自动触发]

**Trigger**：在 design.md 或 specs/**/*.md 中检测到数据库关键词。

**Check**：每个被引用的数据库表都有完整字段映射：
- 字段名
- 类型（VARCHAR、INT 等）
- 约束（NOT NULL、UNIQUE 等）
- 默认值
- 业务含义

**PASS 条件**：
- ≥ 80% 的已检测表有完整字段映射
- 每个字段至少包含：名称、类型、约束

**覆盖率计算**：
```
D8 Score = (tables with complete mappings / total tables) * 100%
```

**存量处理**：
- 若未找到 DB 映射分节：WARNING，而非 FAIL
- WARNING 提示："数据库表-字段映射缺失。建议补充字段定义以避免实现时猜测。"

**FAIL 示例**：
- "D8 FAIL: orders 表字段定义不完整 —— amount 字段缺少类型和约束"
- "D8 WARNING: 数据库表-字段映射缺失。建议补充字段定义以避免实现时猜测。"

### Dimension 9: 业务步骤完整性 [由业务关键词自动触发]

**Trigger**：在 design.md 或 specs/**/*.md 中检测到业务流程关键词。

**Check**：tasks.md 中的复杂业务操作（3 步以上或含条件分支）有显式步骤拆解：
- 步骤按顺序编号
- 每个步骤标注执行层 [前端]/[后端]/[API]/[DB]
- 每个步骤记录异常路径
- 标注事务边界

**PASS 条件**：
- ≥ 80% 的已检测复杂操作有步骤拆解
- 每份拆解包含：编号步骤、层级标注、异常路径

**覆盖率计算**：
```
D9 Score = (complex ops with decomposition / total complex ops) * 100%
```

**存量处理**：
- 若未检测到复杂操作：标记为 "不适用"，跳过
- 若检测到复杂操作但未拆解：FAIL（无 WARNING —— 这是新行为）
- FAIL 提示："复杂业务操作 X 需要步骤拆解。请添加前端→API→后端→DB 步骤标注。"

**FAIL 示例**：
- "D9 FAIL: 用户下单流程 (4步骤, 含事务) 未拆解 —— 需要标注执行层和异常路径"

### Dimension 10: 功能流程图节点覆盖度 [由 功能流程图 段自动触发]

**Trigger**：探索产物 `exploration.md` 含 `## 功能流程图` 段时触发（该段由探索阶段产出并经流程最终确认门确认）。

**Check**：`## 功能流程图` 段的**关键操作节点清单**中的每个节点，是否被 `design` 段（节点清单引用 / 关键操作节点描述）或 `tasks.md`（任务标注的节点 id）覆盖
—— 检查提案与**外部流程基准**的偏差，而非提案自身的完整性（JSON 缺失降级 MD 解析时按对应 MD 制品读取，WARN）。

**覆盖率计算**：
```
D10 Score = (被 design/tasks 覆盖的节点数 / 流程图总节点数) * 100%
```

**覆盖判定（两级，优先显式标注）**:
1. **显式标注匹配（优先，可复现）**：`tasks.md` 任务标注了对应节点 id（`[N4]` 形）即视为该节点被覆盖；`design` 段显式引用该节点 id 或节点操作名亦计入
2. **语义等价判定（补充）**：节点未被显式标注时，MAY 以 AI **语义等价判定**补充 —— 同一操作的**不同措辞**算命中（如节点"扣减库存"与任务"库存预占"视为同一操作）；
   语义判定 MUST 能指出具体对应之处，MUST NOT 笼统放行

**PASS 条件**：覆盖度 ≥ 90%（与统一阈值一致）。

**纳入既有总分（triggered 集合）**：本维度纳入既有总分公式的 `triggered` 集合，与 D1-D5 核心维度、D6-D10 条件维度**同权重**参与平均分：
`Overall Score = (D1 + … + D5 + sum(triggered)) / (5 + triggered_count)`。既有核心+条件维度累加的算法核心与公式本身 MUST NOT 被本维度改动。

**与 D9 的职责分离（自证与他证）**：D9（Business Steps）检查提案**自身**是否拆解复杂操作（**自证**，SHALL 保留不动，MUST NOT 被本维度替换或缩窄）；
本维度检查提案与**外部流程基准**（经用户确认的功能流程图）的偏差（**他证**）。两者互补：D9 查"是否拆了"，本维度查"是否拆对 / 拆全"。

**缺失处理（SKIP，向后兼容）**：无 `## 功能流程图` 段（含该段存在但**未获用户确认**）时，本维度 SHALL 标 **SKIP** 并从总分**分母中排除**（不计入 `triggered_count`），
MUST NOT 按 0 分拉低总分、MUST NOT 据此判 FAIL —— 保证归档期既有变更、纯文档 / 纯配置变更不被误伤。

**FAIL 输出（偏差可定位）**：本维度低于阈值时，报告 MUST **逐条列出未被 design/tasks 覆盖的节点标识与操作名**（如 `N5 分批查询 — 无对应任务`），
使偏差定位到具体节点，MUST NOT 仅给出覆盖度百分比。

**只读约束**：本维度为**只读评分** —— 本技能 `allowedTools` 为 `Read, Glob, Grep, Bash(iagent:*)`（无 Write/Edit），MUST NOT 要求本技能自行编辑 design.md / specs/**/*.md / tasks.md 修复；
修复建议仅呈现给调用方，由 propose 阶段或用户处置。

**FAIL 示例**：
- "D10 FAIL: 节点 N5 分批查询 未被 design/tasks 覆盖（覆盖度 83% = 5/6）"

---

