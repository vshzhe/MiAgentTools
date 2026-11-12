/**
 * 项目技能蒸馏共享协议（单一真源）。
 *
 * project-init 第 11 步（委派编排 + 降级内联）与两个生成侧技能模板
 * （frontend-skill-gen / backend-skill-gen）引用同一套蒸馏文本，
 * 防止「project-init / 前端侧 / 后端侧」三处各自维护而漂移。
 *
 * 本模块只承载文本常量，无 IO、无依赖（同 codegraph-protocol.ts 模式）：
 * 模板经模板字符串插值消费，正文断言对**解析后**的 instructions 生效。
 */

/** 单侧证据判定骨架（候选 ≠ 使用；零猜测补扫；证据不足不生成） */
export const SKILL_DISTILL_EVIDENCE_RULE = `- **证据判定**：依据扫描基线 \`signals\` / \`candidates\`、五类 \`docs/project/\` 文档与源码实际使用证据判定本侧框架；依赖或 jar 的存在只作候选，MUST NOT 据此断言使用；证据不足按零猜测补扫，仍不足则该侧**不生成**（MUST NOT 造占位空壳）。`;

/** 产物形态契约（默认 phases: both 单文件 + 拆分判据 + 多框架分节） */
export const SKILL_DISTILL_PRODUCT_SHAPE = `- **产物形态**：默认本侧一份 \`.iagent/skills/<side>-design.md\`（含设计要点与实现规范，frontmatter \`phases: both\`、\`scope\`、\`source: distilled\`）。满足任一条件时按阶段拆分：同侧 ≥2 框架 / 后端 ≥3 个分层或模块族 / 设计或实现任一段超约 150 行 → \`<side>-design.md\`（\`phases: design\`）+ \`<side>-implement.md\`（\`phases: implement\`）。多框架未拆分时在同侧文档内按框架分节，\`frameworks\` 逐项列出。拆分判据与结论写入报告。`;

/** C1-C6 写入前完整性自检（全部通过才可写入） */
export const SKILL_DISTILL_CHECKLIST_C1_C6 = `- **写入前完整性自检 C1-C6**（全部通过才可写入）：
  - C1 frontmatter 必填：\`name\` / \`description\` / \`phases\` / \`scope\` / \`frameworks\` / \`source\`；\`name\` 必须等于文件名主干；\`frameworks\` 为检测到的框架逐项列出（能进入生成本侧即已有框架证据，MUST NOT 留空）；
  - C2 必需章节齐全：\`## 框架与版本\` / \`## 目录与分层\` / \`## 设计规范\` / \`## 实现规范\` / \`## 约定与禁止项\` / \`## 证据索引\` / \`## 不适用项\`；无内容须写「不适用 + 探测依据」，不得删章节或留空；拆分文件按 \`phases\` 计算（design 可把实现规范标不适用，implement 可把设计规范标不适用）；
  - C3 每条规则行必须带证据锚点（\`文件:行\` / 类.方法 / \`docs/project/\` 章节），无证据不写入；
  - C4 禁止占位符：\`[待补充]\` / \`TODO\` / \`TBD\` / \`<...>\`；
  - C5 与 \`.iagent/rules/*.md\` 冲突时以代码事实为准并记 WARN，冲突项在 \`## 证据索引\` 标注；
  - C6 单文件超约 300 行时拆分或下沉，禁止超长无结构文件；
  - 自检不通过先补齐；无法补齐时 MUST NOT 写入该侧，报告列出缺失章节 / 证据 / 不适用依据。`;

/** 已存在处理（逐份确认 + 人工域标记，破损取保留侧） */
export const SKILL_DISTILL_EXISTING_HANDLING = `- **已存在处理**：复用逐份确认（确认重新生成 / 修改 / 跳过）与人工域标记（\`<!-- 人工域:开始 -->\` 与 \`<!-- 人工域:结束 -->\` 区间**逐字保留**，破损取保留侧——未闭合由开始标记至文末整体保留，嵌套或乱序取最外层最大连续区间）；全部跳过时正常结束。`;

/** 安全边界（两条显式禁令） */
export const SKILL_DISTILL_SECURITY_BAN = `- **安全边界**：MUST NOT 写入凭据值（口令、密钥、令牌、连接串中的口令段，只写键名与位置），MUST NOT 写入可利用的绕过细节。`;

/** 蒸馏报告（逐侧结论） */
export const SKILL_DISTILL_REPORT_RULE = `- **报告**：逐侧给出生成文件、C1-C6 结论、不适用项依据、冲突项；未生成侧写明原因（证据不足）。`;

/** 委派回执（四列最小回执） */
export const SKILL_DISTILL_RECEIPT_RULE = `- **委派回执**：完成或终止时输出四列最小回执：\`<任务 id> | <状态> | <产出文件> | <公开签名>\`；不粘贴文件正文，MUST NOT 把本地降级执行表述为已并发委派完成。`;
