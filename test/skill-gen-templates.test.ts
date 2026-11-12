/**
 * 生成侧技能模板（frontend-skill-gen / backend-skill-gen）正文结构断言。
 *
 * 断言源为模板源（get<Side>SkillGenSkillTemplate()），MUST NOT 读 skills/ 快照
 * —— 快照由 `pnpm generate:skills` 派生。
 *
 * 覆盖：扫描维度清单（D2/D8）、前端设计模板协议（D8）、双态注册（D9）、
 * C1-C6 自检（共享真源）、已存在处理、allowedTools 授权面。
 */

import { describe, it, expect } from 'vitest';
import {
    getFrontendSkillGenSkillTemplate,
} from '../src/core/templates/workflows/frontend-skill-gen.js';
import {
    getBackendSkillGenSkillTemplate,
} from '../src/core/templates/workflows/backend-skill-gen.js';
import { getProjectInitSkillTemplate } from '../src/core/templates/workflows/project-init.js';

const frontend = getFrontendSkillGenSkillTemplate();
const backend = getBackendSkillGenSkillTemplate();
const projectInit = getProjectInitSkillTemplate();
const frontendBody = frontend.instructions;
const backendBody = backend.instructions;
const initBody = projectInit.instructions;

/** 抽取白名单条目（逗号分隔 + trim），供整条目精确断言 */
function parseEntries(allowedTools: string): string[] {
    return allowedTools
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

describe('frontend-skill-gen：扫描维度清单与设计模板协议', () => {
    it('清单逐项存在（D2/D8 八维度）', () => {
        for (const dim of [
            '前端框架',
            '常用组件设计：选择框、下拉框、复选框、tree、单选框',
            '分页',
            'table',
            '前后端交互逻辑',
            '新能力 vs 历史能力注意事项',
            '页面设计',
            '弹窗设计',
        ]) {
            expect(frontendBody).toContain(dim);
        }
    });

    it('设计模板落点与三类产物（页面骨架 / 弹窗骨架 / 数据交换约定）', () => {
        expect(frontendBody).toContain('.iagent/templates/frontend/');
        expect(frontendBody).toContain('页面骨架');
        expect(frontendBody).toContain('弹窗骨架');
        expect(frontendBody).toContain('数据交换约定');
        expect(frontendBody).toContain('主页面 ↔ 弹窗页面数据传递');
    });

    it('无 UI 证据不生成模板（D8 证据约束）', () => {
        expect(frontendBody).toContain('MUST NOT 生成设计模板目录');
        expect(frontendBody).toContain('无 UI 证据，设计模板未生成');
        expect(frontendBody).toContain('同样受 C1-C6 证据约束');
    });

    it('无证据维度标不适用（清单 ≠ 内容模板）', () => {
        expect(frontendBody).toContain('不适用 + 探测依据');
        expect(frontendBody).toContain('清单是扫描维度而非内容模板');
        expect(frontendBody).toContain('MUST NOT 编造');
    });
});

describe('backend-skill-gen：扫描维度清单与无设计模板', () => {
    it('清单逐项存在（D2 六维度）', () => {
        for (const dim of [
            '技术框架',
            '数据库设计',
            'MVC 架构设计',
            '接口设计',
            '前后端接口交互',
            '网络安全',
        ]) {
            expect(backendBody).toContain(dim);
        }
    });

    it('无设计模板产出声明', () => {
        expect(backendBody).toContain('无设计模板产出');
        expect(backendBody).not.toContain('.iagent/templates/frontend/');
    });
});

describe('双态注册（独立调用自身注册 / 被委派跳过）', () => {
    it('前端模板含双态注册语义（D9）', () => {
        expect(frontendBody).toContain('注册双态');
        expect(frontendBody).toContain('integration-mode: project-init');
        expect(frontendBody).toContain('MUST NOT 写 `.iagent/config.yaml`');
        expect(frontendBody).toContain('skills:` frontend 角色组');
        expect(frontendBody).toContain('MUST NOT 重新序列化整个 YAML');
    });

    it('后端模板含双态注册语义（D9）', () => {
        expect(backendBody).toContain('注册双态');
        expect(backendBody).toContain('integration-mode: project-init');
        expect(backendBody).toContain('MUST NOT 写 `.iagent/config.yaml`');
        expect(backendBody).toContain('skills:` backend 角色组');
    });

    it('委派回执（四列最小回执）', () => {
        for (const body of [frontendBody, backendBody]) {
            expect(body).toContain('委派回执');
            expect(body).toContain('<任务 id> | <状态> | <产出文件> | <公开签名>');
        }
    });
});

describe('蒸馏协议共享真源（C1-C6 / 证据判定 / 产物形态）', () => {
    it('C1-C6 六项自检与必需章节清单被两模板引用', () => {
        for (const body of [frontendBody, backendBody, initBody]) {
            expect(body).toContain('写入前完整性自检 C1-C6');
            expect(body).toContain('全部通过才可写入');
            for (const section of [
                '## 框架与版本',
                '## 目录与分层',
                '## 设计规范',
                '## 实现规范',
                '## 约定与禁止项',
                '## 证据索引',
                '## 不适用项',
            ]) {
                expect(body).toContain(section);
            }
            expect(body).toContain('MUST NOT 写入该侧');
        }
    });

    it('产物形态（默认 phases: both + 拆分判据）被两模板引用', () => {
        for (const body of [frontendBody, backendBody]) {
            expect(body).toContain('默认本侧一份');
            expect(body).toContain('phases: design');
            expect(body).toContain('phases: implement');
            expect(body).toContain('frameworks');
        }
    });

    it('证据判定骨架（候选 ≠ 使用 / 证据不足不生成）被两模板引用', () => {
        for (const body of [frontendBody, backendBody]) {
            expect(body).toContain('MUST NOT 据此断言使用');
            expect(body).toContain('该侧**不生成**');
            expect(body).toContain('MUST NOT 造占位空壳');
        }
    });
});

describe('已存在处理与安全边界', () => {
    it('已存在逐份确认与人工域标记（破损取保留侧）', () => {
        for (const body of [frontendBody, backendBody]) {
            expect(body).toContain('逐份确认（确认重新生成 / 修改 / 跳过）');
            expect(body).toContain('人工域标记');
            expect(body).toContain('逐字保留');
            expect(body).toContain('破损取保留侧');
            expect(body).toContain('全部跳过时正常结束');
        }
    });

    it('安全边界（不写凭据值 / 不写绕过细节）', () => {
        for (const body of [frontendBody, backendBody]) {
            expect(body).toContain('MUST NOT 写入凭据值');
            expect(body).toContain('MUST NOT 写入可利用的绕过细节');
        }
    });

    it('单侧报告（未生成侧写明原因 / 非阻断）', () => {
        for (const body of [frontendBody, backendBody]) {
            expect(body).toContain('未生成侧写明原因');
            expect(body).toContain('非阻断');
        }
    });
});

describe('allowedTools 授权面', () => {
    it('两侧白名单含 CodeGraph MCP + Write/Glob/Grep，且不含派发条目', () => {
        for (const template of [frontend, backend]) {
            const entries = parseEntries(template.allowedTools);
            expect(entries).toContain('mcp__codegraph');
            expect(entries).toContain('mcp__codegraph__codegraph_explore');
            expect(entries).toContain('Read');
            expect(entries).toContain('Glob');
            expect(entries).toContain('Grep');
            expect(entries).toContain('Write');
            // 生成侧技能无子代理派发动作 → MUST NOT 持派发条目
            expect(entries).not.toContain('Agent');
            expect(entries).not.toContain('Task');
            expect(template.allowedTools).not.toContain('Skill(');
            expect(template.allowedTools).not.toContain('Skill(*)');
        }
    });

    it('白名单条目格式规范：无空条目、无重复、分隔符统一', () => {
        for (const template of [frontend, backend]) {
            const raw = template.allowedTools;
            expect(raw).toBe(raw.trim());
            const entries = parseEntries(raw);
            expect(new Set(entries).size).toBe(entries.length);
            expect(entries.join(', ')).toBe(raw);
        }
    });

    it('project-init 白名单含两生成侧委派条目与子代理派发条目', () => {
        const entries = parseEntries(projectInit.allowedTools);
        expect(entries).toContain('Skill(iagent-frontend-skill-gen)');
        expect(entries).toContain('Skill(iagent-backend-skill-gen)');
        expect(entries).toContain('Agent');
        expect(entries).toContain('Task');
    });
});

describe('frontmatter 契约', () => {
    it('name / type / 双态描述结构', () => {
        expect(frontend.name).toBe('iagent_frontend_skill_gen');
        expect(backend.name).toBe('iagent_backend_skill_gen');
        expect(frontend.type).toBe('init');
        expect(backend.type).toBe('init');
        // description 含触发词标记与 NOT for 排歧
        for (const template of [frontend, backend]) {
            expect(template.description).toContain('触发词');
            expect(template.description).toContain('NOT for');
        }
    });
});
