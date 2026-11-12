/**
 * init 类型技能模板：前端生成侧技能蒸馏（frontend-skill-gen）。
 *
 * 可独立调用（自身幂等注册），也可被 project-init 委派（跳过自身注册，
 * 注册由父级单点承担）。蒸馏协议文本（C1-C6 / 证据判定 / 产物形态 /
 * 已存在处理 / 安全边界 / 回执）取自 skill-distill.ts 共享真源，
 * MUST NOT 在本模板重复手写。
 *
 * 模板单一源：command 版正文由 deriveCommandContent() 从 skill 版 instructions
 * 派生（与 project-init.ts 同构；本模板刻意不标记 CMD:SKIP 段落 —— 全部防护
 * 语句在指令版同样必需，漏标只会让 command 更长不会缺失防护）。
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { CODEGRAPH_MCP } from '../tool-whitelist.js';
import { deriveCommandContent } from '../derive-command.js';
import {
    SKILL_DISTILL_EVIDENCE_RULE,
    SKILL_DISTILL_PRODUCT_SHAPE,
    SKILL_DISTILL_CHECKLIST_C1_C6,
    SKILL_DISTILL_EXISTING_HANDLING,
    SKILL_DISTILL_SECURITY_BAN,
    SKILL_DISTILL_REPORT_RULE,
    SKILL_DISTILL_RECEIPT_RULE,
} from '../skill-distill.js';

/** 前端扫描维度清单（用户确认的生成范围；清单 ≠ 内容模板） */
const FRONTEND_DIMENSIONS = [
    '前端框架（证据来源：构建文件 / 依赖清单 / 源码 import / \`.iagent/config.yaml\` context）',
    '常用组件设计：选择框、下拉框、复选框、tree、单选框（证据来源：页面源码组件用法 / 组件库引入 / 模板片段）',
    '分页（证据来源：分页组件 / 列表页源码 / 接口分页参数）',
    'table（证据来源：表格组件 / 列定义 / 数据绑定方式）',
    '前后端交互逻辑（证据来源：请求封装 / 数据获取与提交链路 / 错误处理）',
    '新能力 vs 历史能力注意事项（证据来源：新增模块 vs 既有模块的扫描证据区分标注；无法区分时标「未知」）',
    '页面设计（证据来源：页面骨架 / 布局结构 / 路由与导航方式）',
    '弹窗设计（证据来源：弹窗组件用法 / 打开-关闭方式 / 主页面与弹窗间数据传递）',
].join('\n');

export function getFrontendSkillGenSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_frontend_skill_gen',
        description:
            '生成前端设计技能。当用户要在目标项目单独生成前端设计/实现技能（项目技能）或由 project-init 委派执行前端侧技能蒸馏时使用；触发词"前端技能蒸馏 / frontend skill gen / 生成前端技能"；NOT for 后端侧（改用 iagent_backend_skill_gen）、整库初始化（改用 iagent_project_init）。',
        allowedTools: 'Read, Write, Glob, Grep, ' + CODEGRAPH_MCP,
        type: 'init',
        instructions: `生成前端设计技能 —— 前端侧证据判定 → 扫描维度清单 → 生成项目技能与设计模板 → C1-C6 自检 → 双态注册。

**调用形态双态**：本技能可被**独立调用**（用户直接发起），也可被 \`iagent_project_init\` **委派**（并发子代理）。两种形态共用同一蒸馏协议；差异仅在注册归属（见第 7 步）。

**输入**：\`/iagent:frontend-skill-gen\`（独立调用，目标项目为当前项目根）；被委派时委派输入含 \`integration-mode: project-init\` 标记与 Stage Envelope 式最小输入（扫描基线路径 / 五类文档路径 / config 路径 / 输出路径），MUST NOT 依赖内联制品正文。

> 全程**非阻断**：任一步失败记 WARN 并继续，MUST NOT 使流程以失败收场。

## 执行步骤

### 1. 读取证据

- 优先读 \`.iagent/scan-baseline.json\` 的 \`signals\` / \`candidates\`（\`skipped\` / \`failures\` 计数 MUST 呈现，跳过所致 ≠ 项目无该内容）；缺失或无法解析时记 WARN 降级为机械探测（Glob / Grep / Read），MUST NOT 终止
- 复用五类 \`docs/project/\` 文档、\`AGENTS.md\` 与 \`.iagent/config.yaml\` 的 \`context\` 段；CodeGraph 索引可用时用 \`codegraph_explore\` 获取组件与调用链结构，不可用时改用 Glob / Grep / Read，MUST NOT 阻断

### 2. 证据判定

${SKILL_DISTILL_EVIDENCE_RULE}

### 3. 前端扫描维度清单（生成范围约束）

逐维度扫描并判定，**清单是扫描维度而非内容模板**：生成内容 MUST 受 C1-C6 证据约束，无证据维度标「不适用 + 探测依据」，MUST NOT 编造：

${FRONTEND_DIMENSIONS}

### 4. 生成项目技能

${SKILL_DISTILL_PRODUCT_SHAPE}

### 5. 前端设计模板生成

- 依据页面与弹窗相关 **UI 证据**（页面骨架、常用组件用法、弹窗组件用法、主页面与弹窗间数据传递方式）蒸馏设计模板，供后续页面生成 / 弹窗生成 / 主页面与弹窗页面数据交换等技能读取复用
- 落点 \`.iagent/templates/frontend/\`，三类产物：
  | 模板 | 内容 |
  |---|---|
  | 页面骨架 | 页面布局结构骨架（分区 / 导航 / 列表-表单区约定），逐条带证据锚点 |
  | 弹窗骨架 | 弹窗结构骨架（标题 / 内容区 / 操作区 / 关闭方式），逐条带证据锚点 |
  | 数据交换约定 | 主页面 ↔ 弹窗页面数据传递约定（传参方式 / 回写方式 / 刷新语义），逐条带证据锚点 |
- 模板内容同样受 C1-C6 证据约束（无证据不编造，标注置信度）；**无 UI 证据时 MUST NOT 生成设计模板目录**，报告写明「无 UI 证据，设计模板未生成」+ 探测依据

### 6. 写入前完整性自检 C1-C6

${SKILL_DISTILL_CHECKLIST_C1_C6}

### 7. 注册双态

- **独立调用**：写入成功后把条目幂等追加到 \`.iagent/config.yaml\` 的 \`skills:\` frontend 角色组（逐行段替换、保留注释与未知段，MUST NOT 重新序列化整个 YAML）；注册失败记 WARN，不回滚已生成文件
- **被 project-init 委派**（委派输入含 \`integration-mode: project-init\`）：MUST NOT 写 \`.iagent/config.yaml\` —— 注册由父级在两侧完成后单点串行承担，只产出技能文件与设计模板并返回回执

### 8. 委派回执

${SKILL_DISTILL_RECEIPT_RULE}

### 9. 已存在处理

${SKILL_DISTILL_EXISTING_HANDLING}

### 10. 安全边界

${SKILL_DISTILL_SECURITY_BAN}

### 11. 单侧报告

${SKILL_DISTILL_REPORT_RULE}

## 约束

- 只生成前端侧：MUST NOT 越界生成后端侧技能或注册到 backend 组（后端侧由 iagent_backend_skill_gen 承担）
- 不引入用户未要求的功能与依赖（最小可用原则）
- 清单 ≠ 内容模板：清单约束扫描范围，证据约束写入内容，二者正交`,
        license: 'MIT',
        compatibility: '无特殊依赖，通用环境可用。CodeGraph 索引为可选增强，缺失时自动降级为 Glob / Grep / Read。',
        metadata: { author: 'mi-agent-tools' },
    };
}

export function getFrontendSkillGenCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 生成前端设计技能',
        description: '前端侧技能蒸馏 —— 生成前端设计技能与设计模板（可独立调用或由 project-init 委派）',
        category: 'iAgent / 初始化',
        tags: ['iagent', 'init', 'frontend', 'skill-gen'],
        content: deriveCommandContent(getFrontendSkillGenSkillTemplate().instructions),
    };
}
