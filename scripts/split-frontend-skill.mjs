#!/usr/bin/env node
/**
 * 一次性拆分脚本：将 tr-impl-frontend.ts 的单 instructions 字符串
 * 切分为主 SKILL（设计）+ 5 个 references 内容常量（实现）。
 *
 * 切分策略（按 ### 2.X 章节标题，保留原 TS 模板转义符 \` \${ 不变）：
 *   - 主 instructions = 概述 + Phase 1（1.1-1.9）+ 2.0 执行流程 + references 索引段 + 约束与检查清单 + 综合执行步骤
 *   - page-templates.md     = 2.1 + 2.2 + 2.15 + 2.16
 *   - component-templates.md = 2.3 + 2.4 + 2.5 + 2.6 + 2.7 + 2.8 + 2.10
 *   - popup-selectors.md    = 2.9 + 2.17 + 2.18 + 2.21
 *   - action-routing.md     = 2.11 + 2.20
 *   - style-and-security.md = 2.12 + 2.13 + 2.14 + 2.19
 *
 * 运行：node scripts/split-frontend-skill.mjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const file = path.join(process.cwd(), 'src/core/templates/workflows/tr-impl-frontend.ts');
const src = fs.readFileSync(file, 'utf8');

// 1. 提取 instructions 模板字符串内容（保留转义符）
const startMarker = 'instructions: `';
const startIdx = src.indexOf(startMarker);
if (startIdx < 0) throw new Error('未找到 instructions 模板起点');
const contentStart = startIdx + startMarker.length;
// instructions 模板结束标记：` ,\n        license  （反引号+逗号+换行+缩进+license）
const endMarker = '`,\n        license';
const endIdx = src.indexOf(endMarker, contentStart);
if (endIdx < 0) throw new Error('未找到 instructions 模板终点');
const instr = src.slice(contentStart, endIdx);

// 2. 按 ### 2.X 标题切分章节
// 匹配每个章节标题行，记录位置
const titleRe = /### (2\.\d+) [^\n]*\n/g;
const marks = [];
let m;
while ((m = titleRe.exec(instr)) !== null) {
    marks.push({ num: m[1], start: m.index, titleEnd: m.index + m[0].length });
}
if (marks.length === 0) throw new Error('未找到任何 ### 2.X 章节');

// 章节块：从标题行开始到下一个标题或 ## 一级标题前
// 找尾部起点：## 约束与检查清单
const tailMarker = '## 约束与检查清单';
const tailIdx = instr.indexOf(tailMarker);
if (tailIdx < 0) throw new Error('未找到 ## 约束与检查清单 尾部标记');

// 头部 = 开头到第一个 ### 2.1 之前
const headEnd = marks[0].start; // 第一个 ### 2.X 标题位置
// 但 2.0 执行流程属头部，需找到 ### 2.1 的位置
const mark21 = marks.find(x => x.num === '2.1');
if (!mark21) throw new Error('未找到 ### 2.1');
const headEndIdx = mark21.start;

const head = instr.slice(0, headEndIdx); // 含概述+Phase1+2.0执行流程

// 尾部 = 从 ## 约束与检查清单 前 --- 分隔到结尾
// 找 tailIdx 前最近的 --- 行
let tailStart = tailIdx;
const sepIdx = instr.lastIndexOf('---', tailIdx);
if (sepIdx >= 0 && sepIdx + 3 <= tailIdx) {
    // 确认 --- 后紧跟 ## 约束（中间只有空白）
    const between = instr.slice(sepIdx + 3, tailIdx).trim();
    if (between === '') tailStart = sepIdx;
}
const tail = instr.slice(tailStart);

// 3. 提取各章节块（标题行+内容，到下一个标题或尾部 --- 前）
function extractSection(num) {
    const mk = marks.find(x => x.num === num);
    if (!mk) throw new Error('章节不存在：' + num);
    // 找下一个章节标题
    const idx = marks.indexOf(mk);
    let nextStart;
    if (idx + 1 < marks.length) {
        nextStart = marks[idx + 1].start;
    } else {
        nextStart = tailStart; // 最后一个章节到尾部前
    }
    // 但章节块到下一个标题前，且可能含标题前的内容。从 mk.start 到 nextStart
    // 若 nextStart 前有 --- 分隔，截到 --- 前
    let block = instr.slice(mk.start, nextStart);
    // 去掉尾部空行和可能的 ---
    block = block.replace(/\n*---\s*$/, '');
    return block.trimEnd() + '\n';
}

// 4. 分组拼接
const groups = {
    pageTemplates: ['2.1', '2.2', '2.15', '2.16'],
    componentTemplates: ['2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.10'],
    popupSelectors: ['2.9', '2.17', '2.18', '2.21'],
    actionRouting: ['2.11', '2.20'],
    styleAndSecurity: ['2.12', '2.13', '2.14', '2.19'],
};

function joinSections(nums) {
    return nums.map(extractSection).join('\n');
}

const pageTemplates = joinSections(groups.pageTemplates);
const componentTemplates = joinSections(groups.componentTemplates);
const popupSelectors = joinSections(groups.popupSelectors);
const actionRouting = joinSections(groups.actionRouting);
const styleAndSecurity = joinSections(groups.styleAndSecurity);

// 5. 主 instructions = 头部 + references 索引段 + 尾部
const indexSection = `
### 实现模板索引（按需 Read 子文件）

> 本 SKILL 的完整页面/组件/弹窗/路由/样式实现模板拆分为 5 个参考文件，按页面类型与交互场景按需加载（allowed-tools 已含 Read 工具）。执行时按需 Read 对应子文件，不必全部加载，避免上下文膨胀。

| 子文件 | 包含内容 | 何时 Read |
|---|---|---|
| \\\`references/page-templates.md\\\` | 列表/添加/编辑/树形选择页面完整 JSP 模板 | 生成或修改上述页面类型时 |
| \\\`references/component-templates.md\\\` | zTree/select2/ymPrompt/calendar/ECharts/DWR/layui 组件模板 | 页面需要某组件时 |
| \\\`references/popup-selectors.md\\\` | 组织机构/主账号多选/资源选择弹窗 + 父子窗口回传7写法 | 实现选择器弹窗或数据回传时 |
| \\\`references/action-routing.md\\\` | 前端-后端数据传递规范 + Action 路由机制 | 涉及前后端交互、路由配置时 |
| \\\`references/style-and-security.md\\\` | XSS 安全 + 组件速查 + 先查已有实现 + 样式匹配换行规则 | 安全加固、选型前置、修改现有页面时 |

> 子文件路径相对技能目录（如 \\\`.claude/skills/venus_tr_impl_frontend/references/page-templates.md\\\`）。生成页面时先读本 SKILL 的 Phase 1 决策表选型，再按索引 Read 对应实现模板。

`;

const mainInstructions = head + indexSection + tail;

// 6. 提取原文件的其他部分（头注释、description、allowedTools、compatibility、command 模板）
// 文件头注释：开头到 import 行
const importLine = "import type { SkillTemplate, CommandTemplate } from '../types.js';";
const importIdx = src.indexOf(importLine);
const headerComment = src.slice(0, importIdx); // 含文件头注释

// 提取 description
const descMatch = src.match(/description: '([^']*)',/);
const desc = descMatch ? descMatch[1] : '';
// 提取 allowedTools
const toolsMatch = src.match(/allowedTools: '([^']*)',/);
const tools = toolsMatch ? toolsMatch[1] : '';
// 提取 compatibility
const compatMatch = src.match(/compatibility: '([^']*)',/);
const compat = compatMatch ? compatMatch[1] : '';

// 提取 command 模板函数（从 export function getTrImplFrontendCommandTemplate 到文件末尾）
const cmdFuncMarker = 'export function getTrImplFrontendCommandTemplate(): CommandTemplate {';
const cmdIdx = src.indexOf(cmdFuncMarker);
const commandPart = src.slice(cmdIdx).trimEnd() + '\n';

// 7. 组装新文件
const newHeader = `/**
 * tr_impl 类型技能模板：前端页面设计与生成（create-page + frontend-design 合并版）。
 *
 * 主 SKILL 承载"设计决策"（Phase 1 组件选型 + 执行流程 + 约束清单），
 * 完整页面/组件/弹窗/路由/样式"实现模板"拆分为 5 个 references 子文件，
 * 主 SKILL 通过索引段引用，AI 按需 Read 加载，避免单文件上下文膨胀。
 */
${importLine}

const PAGE_TEMPLATES = \`${pageTemplates}\`;

const COMPONENT_TEMPLATES = \`${componentTemplates}\`;

const POPUP_SELECTORS = \`${popupSelectors}\`;

const ACTION_ROUTING = \`${actionRouting}\`;

const STYLE_AND_SECURITY = \`${styleAndSecurity}\`;

export function getTrImplFrontendSkillTemplate(): SkillTemplate {
    return {
        name: 'venus_tr_impl_frontend',
        description: '${desc}',
        allowedTools: '${tools}',
        type: 'tr_impl',
        instructions: \`${mainInstructions}\`,
        references: [
            { path: 'references/page-templates.md', content: PAGE_TEMPLATES },
            { path: 'references/component-templates.md', content: COMPONENT_TEMPLATES },
            { path: 'references/popup-selectors.md', content: POPUP_SELECTORS },
            { path: 'references/action-routing.md', content: ACTION_ROUTING },
            { path: 'references/style-and-security.md', content: STYLE_AND_SECURITY },
        ],
        license: 'MIT',
        compatibility: '${compat}',
        metadata: { author: 'venus-agent-tools', version: '1.0' },
    };
}

${commandPart}`;

fs.writeFileSync(file, newHeader, 'utf8');

// 统计
const lines = newHeader.split('\n').length;
console.log(`已重写 ${file}`);
console.log(`总行数: ${lines}`);
console.log(`主 instructions: ~${mainInstructions.split('\n').length} 行`);
console.log(`page-templates: ${pageTemplates.split('\n').length} 行`);
console.log(`component-templates: ${componentTemplates.split('\n').length} 行`);
console.log(`popup-selectors: ${popupSelectors.split('\n').length} 行`);
console.log(`action-routing: ${actionRouting.split('\n').length} 行`);
console.log(`style-and-security: ${styleAndSecurity.split('\n').length} 行`);
