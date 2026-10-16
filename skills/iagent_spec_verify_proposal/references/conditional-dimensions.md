### Dimension 6: Interaction Detail Completeness [Auto-triggered by frontend keywords]

**Trigger**: Frontend keywords detected in design.md or specs/**/*.md.

**Check**: design.md contains the standardized interaction detail matrix sections:
- **字段-UI组件映射矩阵**: Map each data field to UI component, validation rules, and interaction behavior
- **API 交互契约**: Each endpoint — Method, URL, Request/Response, error codes
- **数据库表-字段映射**: Each table — column name, type, constraints, defaults, business meaning
- **UI 状态覆盖**: Each data-display component — Loading/Empty/Error/Data states

**PASS condition**:
- All four matrix sections present and populated (not empty table templates)
- Each section has at least one row with concrete data
- Coverage rate ≥ 70%

**Coverage calculation**:
```
D6 Score = (populated sections / 4) * 100%
Each section counts fully populated if it has ≥ 1 non-placeholder row
```

**Legacy Handling** (Backward Compatible):
- If design.md does NOT contain the interaction detail matrix sections (check for section headers):
  - Report WARNING (NOT FAIL): "交互细节矩阵缺失。建议补充以提升实现质量。"
  - WARNING does NOT block apply workflow
- If design.md contains the sections but content is incomplete (new change):
  - Report FAIL (blocks apply): "交互细节矩阵不完整。请补充缺失内容。"

**FAIL examples**:
- "D6 FAIL: 字段-UI组件映射矩阵为空 —— 需要列出字段与组件的对应关系"
- "D6 WARNING: 交互细节矩阵缺失。建议补充以提升实现质量。"

**FAIL handling**:
> Missing or incomplete interaction detail matrix.
> [1] Add interaction detail to design.md [2] Confirm intentional skip [3] Return to design phase

### Dimension 7: API Contract Completeness [Auto-triggered by API keywords]

**Trigger**: API keywords detected in design.md or specs/**/*.md.

**Check**: Each API endpoint listed in design.md has complete contract definition:
- Method (GET/POST/PUT/DELETE)
- URL path
- Request body/params with types
- Response body shape with types
- Error codes (at minimum: 200, 400, 404, 500)

**PASS condition**:
- ≥ 80% of detected endpoints have complete contracts
- Each endpoint has: Method, URL, Request, Response, at least 2 error codes

**Coverage calculation**:
```
D7 Score = (endpoints with complete contracts / total endpoints) * 100%
```

**Legacy Handling**:
- If no API contracts section found in design.md: WARNING, not FAIL
- WARNING message: "API 交互契约缺失。建议补充端点定义。"

**FAIL examples**:
- "D7 FAIL: POST /api/v1/orders 缺少 Response body 定义"
- "D7 WARNING: API 交互契约缺失。建议补充端点定义。"

### Dimension 8: Database Mapping Completeness [Auto-triggered by DB keywords]

**Trigger**: Database keywords detected in design.md or specs/**/*.md.

**Check**: Each database table referenced has complete field mapping:
- Field name
- Type (VARCHAR, INT, etc.)
- Constraints (NOT NULL, UNIQUE, etc.)
- Default value
- Business meaning

**PASS condition**:
- ≥ 80% of detected tables have complete field mappings
- Each field has at least: name, type, constraints

**Coverage calculation**:
```
D8 Score = (tables with complete mappings / total tables) * 100%
```

**Legacy Handling**:
- If no DB mapping section found: WARNING, not FAIL
- WARNING message: "数据库表-字段映射缺失。建议补充字段定义以避免实现时猜测。"

**FAIL examples**:
- "D8 FAIL: orders 表字段定义不完整 —— amount 字段缺少类型和约束"
- "D8 WARNING: 数据库表-字段映射缺失。建议补充字段定义以避免实现时猜测。"

### Dimension 9: Business Step Completeness [Auto-triggered by business keywords]

**Trigger**: Business process keywords detected in design.md or specs/**/*.md.

**Check**: Complex business operations (3+ steps or conditional branches) in tasks.md have explicit step decomposition:
- Steps numbered sequentially
- Each step labeled with execution layer [前端]/[后端]/[API]/[DB]
- Error paths documented per step
- Transaction boundaries marked

**PASS condition**:
- ≥ 80% of detected complex operations have step decomposition
- Each decomposition has: numbered steps, layer labels, error paths

**Coverage calculation**:
```
D9 Score = (complex ops with decomposition / total complex ops) * 100%
```

**Legacy Handling**:
- If no complex operations detected: mark as "不适用", skip
- If complex operations detected but not decomposed: FAIL (no WARNING — this is new behavior)
- FAIL message: "复杂业务操作 X 需要步骤拆解。请添加前端→API→后端→DB 步骤标注。"

**FAIL examples**:
- "D9 FAIL: 用户下单流程 (4步骤, 含事务) 未拆解 —— 需要标注执行层和异常路径"

### Dimension 10: Flowchart Node Coverage (流程图节点覆盖度) [Auto-triggered by 功能流程图 段]

**Trigger**: 探索产物 `exploration.md` 含 `## 功能流程图` 段时触发（该段由探索阶段产出并经流程最终确认门确认）。

**Check**: `## 功能流程图` 段的**关键操作节点清单**中的每个节点，是否被 `design` 段（节点清单引用 / 关键操作节点描述）或 `tasks.md`（任务标注的节点 id）覆盖
—— 检查提案与**外部流程基准**的偏差，而非提案自身的完整性（JSON 缺失降级 MD 解析时按对应 MD 制品读取，WARN）。

**Coverage calculation**:
```
D10 Score = (被 design/tasks 覆盖的节点数 / 流程图总节点数) * 100%
```

**覆盖判定（两级，优先显式标注）**:
1. **显式标注匹配（优先，可复现）**：`tasks.md` 任务标注了对应节点 id（`[N4]` 形）即视为该节点被覆盖；`design` 段显式引用该节点 id 或节点操作名亦计入
2. **语义等价判定（补充）**：节点未被显式标注时，MAY 以 AI **语义等价判定**补充 —— 同一操作的**不同措辞**算命中（如节点"扣减库存"与任务"库存预占"视为同一操作）；
   语义判定 MUST 能指出具体对应之处，MUST NOT 笼统放行

**PASS condition**: 覆盖度 ≥ 90%（与统一阈值一致）。

**纳入既有总分（triggered 集合）**: 本维度纳入既有总分公式的 `triggered` 集合，与 D1-D5 核心维度、D6-D10 条件维度**同权重**参与平均分：
`Overall Score = (D1 + … + D5 + sum(triggered)) / (5 + triggered_count)`。既有核心+条件维度累加的算法核心与公式本身 MUST NOT 被本维度改动。

**与 D9 的职责分离（自证 vs 他证）**: D9（Business Steps）检查提案**自身**是否拆解复杂操作（**自证**，SHALL 保留不动，MUST NOT 被本维度替换或缩窄）；
本维度检查提案与**外部流程基准**（经用户确认的功能流程图）的偏差（**他证**）。两者互补：D9 查"是否拆了"，本维度查"是否拆对 / 拆全"。

**缺失处理（SKIP，向后兼容）**: 无 `## 功能流程图` 段（含该段存在但**未获用户确认**）时，本维度 SHALL 标 **SKIP** 并从总分**分母中排除**（不计入 `triggered_count`），
MUST NOT 按 0 分拉低总分、MUST NOT 据此判 FAIL —— 保证归档期既有变更、纯文档 / 纯配置变更不被误伤。

**FAIL 输出（偏差可定位）**: 本维度低于阈值时，报告 MUST **逐条列出未被 design/tasks 覆盖的节点标识与操作名**（如 `N5 分批查询 — 无对应任务`），
使偏差定位到具体节点，MUST NOT 仅给出覆盖度百分比。

**只读约束**: 本维度为**只读评分** —— 本技能 `allowedTools` 为 `Read, Glob, Grep, Bash(iagent:*)`（无 Write/Edit），MUST NOT 要求本技能自行编辑 design.md / specs/**/*.md / tasks.md 修复；
修复建议仅呈现给调用方，由 propose 阶段或用户处置。

**FAIL examples**:
- "D10 FAIL: 节点 N5 分批查询 未被 design/tasks 覆盖（覆盖度 83% = 5/6）"

---

