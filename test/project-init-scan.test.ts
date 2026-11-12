/**
 * project-init 技能正文结构断言（扫描 → 落盘 → 回写 全链约束）。
 *
 * 断言源为模板源（getProjectInitSkillTemplate()），MUST NOT 读 skills/ 快照
 * —— 快照由产物重生成批次统一重建，本批次内处于计划性陈旧状态。
 */

import { describe, it, expect } from 'vitest';
import { getProjectInitSkillTemplate } from '../src/core/templates/workflows/project-init.js';

const template = getProjectInitSkillTemplate();
const body = template.instructions;

/** 抽取白名单条目（逗号分隔 + trim），供整条目精确断言 */
function parseEntries(allowedTools: string): string[] {
    return allowedTools
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

describe('project-init 技能正文：扫描基线', () => {
    it('写明基线路径、复用方式与降级 WARN', () => {
        expect(body).toContain('.iagent/scan-baseline.json');
        expect(body).toContain('复用其中的');
        expect(body).toContain('WARN');
        // 降级路径：自行机械探测，且不得终止
        expect(body).toContain('Glob / Grep / Read');
        expect(body).toContain('MUST NOT 因此终止');
        // 降级事实必须在报告中标注（不得静默降级）
        expect(body).toContain('基线缺失');
    });

    it('硬性要求呈现 limits.skipped 三类计数与 failures（跳过所致 ≠ 项目无该内容）', () => {
        expect(body).toContain('limits.skipped');
        expect(body).toContain('ignored');
        expect(body).toContain('timeout');
        expect(body).toContain('unreadable');
        expect(body).toContain('跳过所致 ≠ 项目无该内容');
        expect(body).toContain('MUST 逐条呈现');
        expect(body).toContain('limits.softTimeout.exceeded');
    });

    it('历史 v1 基线仍可读（版本分支而非报错）', () => {
        expect(body).toContain('历史基线（v1）仍可读');
        expect(body).toContain('MUST NOT 因缺少 `skipped` 而报错');
    });
});

describe('project-init 技能正文：技术框架语义扫描', () => {
    it('版本判定含四级回退链与「未知」兜底', () => {
        expect(body).toContain('四级回退链');
        expect(body).toContain('构建文件声明');
        expect(body).toContain('工具链配置');
        expect(body).toContain('构建脚本编译参数');
        expect(body).toContain('既有项目文档文本');
        expect(body).toContain('标「未知」');
        expect(body).toContain('MUST NOT 编造版本');
    });

    it('优先采信已结构化的技术栈声明', () => {
        expect(body).toContain('优先采信已结构化的技术栈声明');
        expect(body).toContain('.iagent/config.yaml');
        expect(body).toContain('openspec/config.yaml');
    });

    it('框架判定须结合源码实际使用，禁止仅凭 jar 断言', () => {
        expect(body).toContain('import 频次');
        expect(body).toContain('MUST NOT 仅凭 jar / 依赖存在就断言');
        expect(body).toContain('候选');
    });
});

describe('project-init 技能正文：委派 iagent_feature_doc', () => {
    it('提及被委派技能，并写明两条降级路径', () => {
        expect(body).toContain('iagent_feature_doc');
        expect(body).toContain('降级路径一（委派不可得）');
        expect(body).toContain('降级路径二（无 CodeGraph 索引）');
        // CodeGraph 不可用时改用通用工具完成扫描
        expect(body).toContain('未初始化 CodeGraph 索引时，改用 Glob / Grep / Read');
    });

    it('正文真实出现 codegraph_ 工具名（反向断言依据）', () => {
        expect(body).toMatch(/codegraph_[a-z]+/);
        expect(body).toContain('codegraph_status');
    });

    it('无阻断表述：非必须依赖、非必须有索引', () => {
        expect(body).toContain('MUST NOT 写成必须依赖');
        expect(body).toContain('MUST NOT 阻断流程');
    });
});

describe('project-init 技能正文：安全规范扫描', () => {
    it('含认证 / 鉴权 / 输入校验 / 配置约定四维', () => {
        expect(body).toContain('认证机制');
        expect(body).toContain('鉴权机制');
        expect(body).toContain('输入校验策略');
        expect(body).toContain('配置约定');
    });

    it('含两条显式禁令（凭据值 / 绕过细节）', () => {
        expect(body).toContain('MUST NOT 在文档中写入任何**凭据值**');
        expect(body).toContain('MUST NOT 写入任何**可利用的绕过细节**');
    });
});

describe('project-init 技能正文：已存在文档逐份确认', () => {
    it('逐份确认（非一次性总确认）', () => {
        expect(body).toContain('**逐份**呈现');
        expect(body).toContain('MUST NOT 合并为一次性总确认');
    });

    it('跳过即逐字保持；全部跳过仍正常结束', () => {
        expect(body).toContain('**逐字保持**');
        expect(body).toContain('**全部跳过**');
        expect(body).toContain('**正常结束**');
        expect(body).toContain('MUST NOT 视为失败');
    });
});

describe('project-init 技能正文：增量对齐与人工域标记', () => {
    it('含人工域标记字面量与增量对齐语义', () => {
        expect(body).toContain('<!-- 人工域:开始 -->');
        expect(body).toContain('<!-- 人工域:结束 -->');
        expect(body).toContain('**增量对齐**');
        expect(body).toContain('**逐字保留**');
        expect(body).toContain('MUST NOT 整体重写');
    });

    it('破损分支一律取保留侧（未闭合 / 嵌套 / 乱序）', () => {
        expect(body).toContain('未闭合（有开始标记、无结束标记）');
        expect(body).toContain('至文末整体保留');
        expect(body).toContain('MUST NOT 猜测闭合位置');
        expect(body).toContain('嵌套或乱序');
        expect(body).toContain('最外层最大连续区间');
    });

    it('无任何标记时退化为整体重派生且不报错', () => {
        expect(body).toContain('退化为整体重派生');
        expect(body).toContain('MUST NOT 报错');
    });
});

describe('project-init 技能正文：五类文档与索引落盘', () => {
    it('含五类文档路径映射表', () => {
        expect(body).toContain('docs/project/architecture/技术框架.md');
        expect(body).toContain('docs/project/modules/模块与功能点.md');
        expect(body).toContain('docs/project/database/数据库.md');
        expect(body).toContain('docs/project/api/API规范.md');
        expect(body).toContain('docs/project/security/安全规范.md');
        expect(body).toContain('docs/project/README.md');
    });

    it('不生成空壳文档', () => {
        expect(body).toContain('不生成该类文档');
        expect(body).toContain('MUST NOT 生成仅含「无内容」占位的空壳文档');
    });

    it('索引列出全部五类，未生成者标「不适用 + 探测依据」', () => {
        expect(body).toContain('MUST 列出**全部五类**');
        expect(body).toContain('「不适用」并附探测依据');
        expect(body).toContain('MUST NOT 静默省略');
    });
});

describe('project-init 技能正文：AGENTS.md 与 context 回写', () => {
    it('AGENTS.md 含四要素且复用第 5/6 步分支', () => {
        expect(body).toContain('AGENTS.md');
        expect(body).toContain('仓库地图');
        expect(body).toContain('常用命令');
        expect(body).toContain('修改守则');
        expect(body).toContain('同一分支');
        expect(body).toContain('MUST NOT 为其另立覆盖策略');
    });

    it('context 回写：逐行保留 + 段替换 + 失败 WARN', () => {
        expect(body).toContain('`context` 段');
        expect(body).toContain('逐行保留 + 段替换');
        expect(body).toContain('MUST NOT 重新序列化整个 YAML');
        expect(body).toContain('auto_package');
        expect(body).toContain('失败记 WARN 并继续');
    });
});

describe('project-init 参考文件与白名单', () => {
    it('references 非空且含五类文档骨架模板', () => {
        const references = template.references;
        expect(references, 'references 未声明').toBeDefined();
        expect(references?.length).toBeGreaterThanOrEqual(5);
        const paths = (references ?? []).map((ref) => ref.path);
        expect(paths).toEqual([
            'references/doc-architecture.md',
            'references/doc-modules.md',
            'references/doc-database.md',
            'references/doc-api.md',
            'references/doc-security.md',
        ]);
        for (const ref of references ?? []) {
            expect(ref.content.length).toBeGreaterThan(0);
        }
    });

    it('主正文不含五类骨架模板全文（仅文字引用）', () => {
        expect(body).toContain('references/doc-architecture.md');
        expect(body).not.toContain('### 表格形态');
    });

    it('allowedTools 含 CodeGraph MCP、Skill 委派与子代理派发条目，且无星号通配', () => {
        const entries = parseEntries(template.allowedTools);
        expect(entries).toContain('mcp__codegraph');
        expect(entries).toContain('mcp__codegraph__codegraph_status');
        // 委派条目为 canonical 宿主技能 ID（入参裸名由 skillDelegation 归一化）；
        // 裸名 / 下划线形态是永不放行的死条目
        expect(entries).toContain('Skill(iagent-feature-doc)');
        expect(entries).toContain('Skill(iagent-frontend-skill-gen)');
        expect(entries).toContain('Skill(iagent-backend-skill-gen)');
        expect(template.allowedTools).not.toContain('Skill(*)');
        // 第 11 步编排确有子代理派发动作 → Agent, Task 双写条目（新旧运行时兼容）
        expect(entries).toContain('Agent');
        expect(entries).toContain('Task');
        // 只读探查手段按正文实际使用保留
        expect(entries).toContain('Read');
        expect(entries).toContain('Glob');
        expect(entries).toContain('Grep');
        expect(entries).toContain('Bash(ls:*)');
        expect(entries).toContain('Bash(pwd:*)');
    });

    it('白名单条目格式规范：无空条目、无重复、分隔符统一', () => {
        const raw = template.allowedTools;
        expect(raw).toBe(raw.trim());
        const entries = parseEntries(raw);
        expect(new Set(entries).size).toBe(entries.length);
        expect(entries.join(', ')).toBe(raw);
    });
});

describe('project-init 技能正文：第 11 步技能蒸馏编排', () => {
    it('委派两侧生成侧技能 + Stage Envelope 最小输入（不内联制品正文）', () => {
        expect(body).toContain('iagent_frontend_skill_gen');
        expect(body).toContain('iagent_backend_skill_gen');
        expect(body).toContain('integration-mode: project-init');
        expect(body).toContain('Stage Envelope 最小输入');
        expect(body).toContain('MUST NOT 内联制品正文');
    });

    it('并发派发与重试一次后降级', () => {
        expect(body).toContain('并发派发');
        expect(body).toContain('自动重试一次');
        expect(body).toContain('降级路径（非并发）');
        expect(body).toContain('MUST NOT 被表述为已并发委派完成');
    });

    it('固定顺序保持：技能蒸馏在规则蒸馏之后', () => {
        expect(body).toContain('第 10 步**完成之后**执行');
        expect(body).toContain('规则蒸馏 → 技能蒸馏');
    });

    it('旧内联蒸馏正文无残留（C1-C6 引用走共享常量）', () => {
        // 共享真源文本仍被引用（插值），但旧版手写段落特征语句 MUST NOT 残留
        expect(body).toContain('写入前完整性自检 C1-C6');
        expect(body).not.toContain('### 11. 项目前后端技能蒸馏（技能蒸馏）');
        expect(body).not.toContain('**自动注册**：写入成功后把条目追加到');
    });

    it('config 注册单点串行：子代理不写 config、幂等、失败不回滚', () => {
        expect(body).toContain('MUST NOT 自行写 `.iagent/config.yaml`');
        expect(body).toContain('单点串行');
        expect(body).toContain('幂等追加');
        expect(body).toContain('MUST NOT 重新序列化整个 YAML');
        expect(body).toContain('不回滚已生成文件');
    });

    it('单侧失败隔离与汇总报告', () => {
        expect(body).toContain('单侧失败隔离');
        expect(body).toContain('另一侧继续完成');
        expect(body).toContain('config 注册只登记成功侧');
        expect(body).toContain('汇总报告');
        expect(body).toContain('设计模板清单（前端侧）');
        expect(body).toContain('未生成侧写明原因');
    });
});
