/**
 * 提交技能模板契约测试（optimize-commit-skills）。
 *
 * 覆盖 svn-commit / commit 两个模板正文的行为契约：
 *   1. 知识库推送移除与三环节确认
 *   2. 归档未提交提案检测、候选标注与状态边界
 *   3. 三类提交说明统一「对象 + 改动」，文档类禁止泛化
 *   4. 归档提案溯源尾行去日期前缀
 *   5. Git 侧归档路径、暂存安全与 docs 明确化
 */

import { describe, it, expect } from 'vitest';
import {
    getSvnCommitSkillTemplate,
    getSvnCommitCommandTemplate,
} from '../src/core/templates/workflows/svn-commit.js';
import {
    getCommitSkillTemplate,
    getCommitCommandTemplate,
} from '../src/core/templates/workflows/commit.js';

const svnSkill = getSvnCommitSkillTemplate();
const svnBody = svnSkill.instructions;
const svnCommand = getSvnCommitCommandTemplate();
const gitSkill = getCommitSkillTemplate();
const gitBody = gitSkill.instructions;
const gitCommand = getCommitCommandTemplate();

describe('SVN 提交技能：知识库移除与三环节确认', () => {
    it('技能正文与描述不再包含知识库推送字样', () => {
        // Given: 已移除知识库环节的技能模板
        // When + Then: 正文与描述均不得出现知识库 / llm-wiki / submission_id
        expect(svnBody).not.toMatch(/知识库/);
        expect(svnBody).not.toMatch(/llm[-_]wiki/);
        expect(svnBody).not.toMatch(/submission_id/);
        expect(svnSkill.description).not.toMatch(/知识库/);
        expect(svnSkill.description).not.toMatch(/四环节/);
    });

    it('确认环节收敛为三环节且原环节 4 已上移', () => {
        expect(svnBody).toContain('三环节确认提交');
        expect(svnBody).toContain('### 环节 3：最终确认与提交');
        expect(svnBody).not.toContain('### 环节 4');
        expect(svnBody).not.toContain('知识库推送询问');
    });

    it('环节 2 确认门与最终确认门仍然保留', () => {
        expect(svnBody).toContain('提交内容清单和功能描述是否需要修改');
        expect(svnBody).toContain('询问最终确认');
    });

    it('普通文本提交请求不触发技能', () => {
        expect(svnBody).toContain('仅由显式调用');
        expect(svnBody).toContain('普通文本提交请求不触发');
    });

    it('汇报段不再包含知识库结果且编号为第 6 步', () => {
        expect(svnBody).toContain('### 6. 汇报');
        expect(svnBody).not.toContain('### 7. 汇报');
        expect(svnBody).not.toContain('submission_id');
        expect(svnBody).not.toContain('审核状态');
    });

    it('斜杠指令描述同步为三环节', () => {
        expect(svnCommand.description).toContain('三环节确认提交');
        expect(svnCommand.description).not.toContain('四环节');
        expect(svnCommand.content).not.toMatch(/知识库/);
    });
});

describe('SVN 提交技能：归档未提交提案检测与状态边界', () => {
    it('同时检测活跃变更与归档未提交提案并标注已归档', () => {
        expect(svnBody).toContain('openspec/changes/archive/');
        expect(svnBody).toContain('存在未提交制品的归档提案');
        expect(svnBody).toContain('已归档');
    });

    it('活跃与归档同名并存时分别列出不合并', () => {
        expect(svnBody).toContain('活跃与归档同名并存时分别列出');
        expect(svnBody).toContain('MUST NOT 合并');
    });

    it('归档提案部分提交时只纳入未提交部分', () => {
        expect(svnBody).toContain('归档提案仅部分制品未提交时只纳入未提交部分');
    });

    it('归档提案无 VCS 变更时提示无需提交并终止', () => {
        expect(svnBody).toContain('该归档提案无需提交');
    });

    it('多个归档候选时全部列出由用户选择', () => {
        expect(svnBody).toContain('多个候选时全部列出供用户选择');
    });

    it('归档提案未纳管制品经确认后纳入且禁止静默 add', () => {
        expect(svnBody).toContain('经环节 2 清单确认后纳入并归文档类');
        expect(svnBody).toContain('MUST NOT 静默 svn add');
        expect(svnBody).toContain('其他未点名未纳管制品仍默认排除');
    });

    it('点名已归档提案正常读取推进而非报错拒绝', () => {
        expect(svnBody).toContain('提案已归档，按提案内容检查未提交变更');
        expect(svnBody).not.toContain('已归档提案报错');
    });

    it('未点名且无任何候选时退化为提交全部', () => {
        expect(svnBody).toContain('无任何候选时退化为场景 2');
    });
});

describe('SVN 提交技能：三类提交说明统一规范', () => {
    it('三类说明必须同时包含改动对象与改动内容', () => {
        expect(svnBody).toContain('提交说明统一规范（对象 + 改动）');
        expect(svnBody).toContain('改动对象');
        expect(svnBody).toContain('改动内容');
    });

    it('文档类禁止泛化表述', () => {
        expect(svnBody).toContain('MUST NOT 单独使用「更新文档 / 修改文档 / 更新提案 / 补充说明」');
    });

    it('三类示例均体现对象与改动', () => {
        expect(svnBody).toContain('feat: 审计管理-告警展示: 新增告警批量处理逻辑');
        expect(svnBody).toContain('test: 审计管理-告警展示: 补充告警批量处理用例');
        expect(svnBody).toContain('docs: 审计告警批量处理: 更新接口文档与规格');
    });

    it('文档对象无法定位时使用文件路径或能力名兜底', () => {
        expect(svnBody).toContain('文件路径或能力名兜底');
        expect(svnBody).toContain('仍无法确定时询问用户');
    });
});

describe('SVN 提交技能：归档溯源尾行命名', () => {
    it('归档提案尾行使用去掉日期前缀的变更名', () => {
        expect(svnBody).toContain('去掉日期前缀的目录名');
        expect(svnBody).toContain('2026-11-08-add-audit-alert');
        expect(svnBody).toContain('add-audit-alert');
    });

    it('非日期前缀目录原样使用', () => {
        expect(svnBody).toContain('目录名不符合 `YYYY-MM-DD-` 前缀时原样使用');
    });

    it('每笔分类提交独立标注来源提案', () => {
        expect(svnBody).toContain('提案: <变更名>');
        expect(svnBody).toContain('非提案场景（场景 1/2/3 及场景 4 退化）不带溯源标注');
    });
});

describe('SVN 提交技能：排除规则与三类分类回归', () => {
    it('编译产物排除优先于被引用则 add', () => {
        expect(svnBody).toContain('本规则优先级高于「被引用则 add」');
        expect(svnBody).toContain('*.class');
    });

    it('A / M / ? 三种状态分别处理', () => {
        expect(svnBody).toContain('?（未纳管）直接忽略');
        expect(svnBody).toContain('A（已被 svn add）为危险项');
        expect(svnBody).toContain('M（已版本化）属历史误提交');
    });

    it('全部变更被排除时不生成注释、不提交', () => {
        expect(svnBody).toContain('过滤后无剩余变更时不生成注释、不执行提交');
    });

    it('三类路径优先且空类跳过', () => {
        expect(svnBody).toContain('路径优先：目录语义覆盖扩展名');
        expect(svnBody).toContain('某类为空时跳过该笔提交');
    });

    it('归档提案制品归入文档类', () => {
        expect(svnBody).toContain('经环节 2 确认纳入的归档提案未提交制品');
        expect(svnBody).toContain('固定 `docs`');
    });
});

describe('Git 提交技能：归档检测与暂存安全', () => {
    it('提案检测同时覆盖活跃与归档未提交制品', () => {
        expect(gitBody).toContain('openspec/changes/archive/');
        expect(gitBody).toContain('存在未提交制品的归档变更');
        expect(gitBody).toContain('已归档');
    });

    it('活跃与归档同名并存时分别列出', () => {
        expect(gitBody).toContain('活跃与归档同名并存时 MUST 分别列出');
        expect(gitBody).toContain('MUST NOT 合并');
    });

    it('归档提案固定清单使用归档路径前缀', () => {
        expect(gitBody).toContain('`<change-path>` 为 `archive/YYYY-MM-DD-<name>`');
        expect(gitBody).toContain('openspec/changes/<change-path>/proposal.md');
    });

    it('归档溯源尾行去日期前缀', () => {
        expect(gitBody).toContain('归档提案使用去掉日期前缀的变更名');
        expect(gitBody).toContain('2026-11-08-add-x');
    });

    it('无候选退化为普通提交且不追加提案尾行', () => {
        expect(gitBody).toContain('退化为普通提交');
        expect(gitBody).toContain('MUST NOT 附加 `提案:` 尾行');
    });

    it('禁止全量暂存并保留人工确认闸门', () => {
        expect(gitBody).toContain('MUST NOT 使用 `git add -A`');
        expect(gitBody).toContain('MUST NOT 自动 commit');
        expect(gitBody).toContain('确认后再执行');
    });

    it('暂存失败降级为 WARN 且不阻断提交', () => {
        expect(gitBody).toContain('只记 WARN 并提示手动处理');
        expect(gitBody).toContain('MUST NOT 阻断代码提交');
    });
});

describe('Git 提交技能：docs 类说明明确化', () => {
    it('docs 类必须写明文档对象与内容变化', () => {
        expect(gitBody).toContain('**docs 类**');
        expect(gitBody).toContain('写明文档对象与内容变化');
        expect(gitBody).toContain('MUST NOT 只写「更新文档 / 修改文档 / 更新提案」');
    });

    it('docs 示例包含对象与改动', () => {
        expect(gitBody).toContain('docs(openspec): 更新告警接口规格与测试说明');
    });

    it('斜杠指令内容同步 docs 规范', () => {
        expect(gitCommand.content).toContain('**docs 类**');
        expect(gitCommand.content).toContain('写明文档对象与内容变化');
    });
});

describe('提交技能：渲染完整性', () => {
    it('两技能正文均非空且无 CMD:SKIP 标记泄漏', () => {
        expect(svnBody.length).toBeGreaterThan(0);
        expect(gitBody.length).toBeGreaterThan(0);
        expect(svnBody).not.toContain('CMD:SKIP');
        expect(gitBody).not.toContain('CMD:SKIP');
    });

    it('技能正文不残留 llm-wiki 工具名', () => {
        expect(svnBody).not.toMatch(/llm[-_]wiki/);
        expect(gitBody).not.toMatch(/llm[-_]wiki/);
    });
});
