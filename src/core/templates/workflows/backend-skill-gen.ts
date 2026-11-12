/**
 * init 类型技能模板：后端生成侧技能蒸馏（backend-skill-gen）。
 *
 * 可独立调用（自身幂等注册），也可被 project-init 委派（跳过自身注册）。
 * 与 frontend-skill-gen 同构，但无设计模板产出；蒸馏协议文本取自
 * skill-distill.ts 共享真源，MUST NOT 在本模板重复手写。
 *
 * 模板单一源：command 版正文由 deriveCommandContent() 从 skill 版
 * instructions 派生（刻意不标记 CMD:SKIP 段落 —— 全部防护语句在指令版
 * 同样必需）。
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

/** 后端扫描维度清单（用户确认的生成范围；清单 ≠ 内容模板） */
const BACKEND_DIMENSIONS = [
    '技术框架（证据来源：构建文件 / 依赖清单 / 源码 import / \`.iagent/config.yaml\` context）',
    '数据库设计（证据来源：DDL / 建表脚本 / ORM 映射 / \`docs/project/database/\` 文档；数据源配置只记录键名）',
    'MVC 架构设计（证据来源：分层目录结构 / 控制器-服务-数据访问层调用链）',
    '接口设计（证据来源：路由 / 控制器 / \`docs/project/api/\` 文档；请求与响应字段与实现一致，无法确证标「未知」）',
    '前后端接口交互（证据来源：前端调用点与后端处理器对应关系 / 统一返回结构 / 错误码约定）',
    '网络安全（证据来源：认证 / 鉴权 / 输入校验落点与 \`docs/project/security/\` 文档）',
].join('\n');

export function getBackendSkillGenSkillTemplate(): SkillTemplate {
    return {
        name: 'iagent_backend_skill_gen',
        description:
            '生成后端设计技能。当用户要在目标项目单独生成后端设计/实现技能（项目技能）或由 project-init 委派执行后端侧技能蒸馏时使用；触发词"后端技能蒸馏 / backend skill gen / 生成后端技能"；NOT for 前端侧（改用 iagent_frontend_skill_gen）、整库初始化（改用 iagent_project_init）。',
        allowedTools: 'Read, Write, Glob, Grep, ' + CODEGRAPH_MCP,
        type: 'init',
        instructions: `生成后端设计技能 —— 后端侧证据判定 → 扫描维度清单 → 生成项目技能 → C1-C6 自检 → 双态注册。

**调用形态双态**：本技能可被**独立调用**（用户直接发起），也可被 \`iagent_project_init\` **委派**（并发子代理）。两种形态共用同一蒸馏协议；差异仅在注册归属（见第 6 步）。

**输入**：\`/iagent:backend-skill-gen\`（独立调用，目标项目为当前项目根）；被委派时委派输入含 \`integration-mode: project-init\` 标记与 Stage Envelope 式最小输入（扫描基线路径 / 五类文档路径 / config 路径 / 输出路径），MUST NOT 依赖内联制品正文。

> 全程**非阻断**：任一步失败记 WARN 并继续，MUST NOT 使流程以失败收场。

## 执行步骤

### 1. 读取证据

- 优先读 \`.iagent/scan-baseline.json\` 的 \`signals\` / \`candidates\`（\`skipped\` / \`failures\` 计数 MUST 呈现，跳过所致 ≠ 项目无该内容）；缺失或无法解析时记 WARN 降级为机械探测（Glob / Grep / Read），MUST NOT 终止
- 复用五类 \`docs/project/\` 文档、\`AGENTS.md\` 与 \`.iagent/config.yaml\` 的 \`context\` 段；CodeGraph 索引可用时用 \`codegraph_explore\` 获取分层与调用链结构，不可用时改用 Glob / Grep / Read，MUST NOT 阻断

### 2. 证据判定

${SKILL_DISTILL_EVIDENCE_RULE}

### 3. 后端扫描维度清单（生成范围约束）

逐维度扫描并判定，**清单是扫描维度而非内容模板**：生成内容 MUST 受 C1-C6 证据约束，无证据维度标「不适用 + 探测依据」，MUST NOT 编造：

${BACKEND_DIMENSIONS}

### 4. 生成项目技能

${SKILL_DISTILL_PRODUCT_SHAPE}

本侧**无设计模板产出**（设计模板仅前端生成侧技能承担）。

### 5. 写入前完整性自检 C1-C6

${SKILL_DISTILL_CHECKLIST_C1_C6}

### 6. 注册双态

- **独立调用**：写入成功后把条目幂等追加到 \`.iagent/config.yaml\` 的 \`skills:\` backend 角色组（逐行段替换、保留注释与未知段，MUST NOT 重新序列化整个 YAML）；注册失败记 WARN，不回滚已生成文件
- **被 project-init 委派**（委派输入含 \`integration-mode: project-init\`）：MUST NOT 写 \`.iagent/config.yaml\` —— 注册由父级在两侧完成后单点串行承担，只产出技能文件并返回回执

### 7. 委派回执

${SKILL_DISTILL_RECEIPT_RULE}

### 8. 已存在处理

${SKILL_DISTILL_EXISTING_HANDLING}

### 9. 安全边界

${SKILL_DISTILL_SECURITY_BAN}

### 10. 单侧报告

${SKILL_DISTILL_REPORT_RULE}

## 约束

- 只生成后端侧：MUST NOT 越界生成前端侧技能或注册到 frontend 组（前端侧由 iagent_frontend_skill_gen 承担）
- 不引入用户未要求的功能与依赖（最小可用原则）
- 清单 ≠ 内容模板：清单约束扫描范围，证据约束写入内容，二者正交`,
        license: 'MIT',
        compatibility: '无特殊依赖，通用环境可用。CodeGraph 索引为可选增强，缺失时自动降级为 Glob / Grep / Read。',
        metadata: { author: 'mi-agent-tools' },
    };
}

export function getBackendSkillGenCommandTemplate(): CommandTemplate {
    return {
        name: 'iAgent: 生成后端设计技能',
        description: '后端侧技能蒸馏 —— 生成后端设计技能（可独立调用或由 project-init 委派）',
        category: 'iAgent / 初始化',
        tags: ['iagent', 'init', 'backend', 'skill-gen'],
        content: deriveCommandContent(getBackendSkillGenSkillTemplate().instructions),
    };
}
