/**
 * 宿主技能引用归一化的单一实现。
 *
 * 技能模板正文 / 参考文件 / frontmatter 描述中可能残留内部下划线技能名
 * （legacy `iagent_<id>`），而所有宿主产物与 `skills/` 快照一律使用 canonical
 * kebab-case 宿主技能 ID（`iagent-<workflowId>`）。归一化在生成期单点完成，
 * 避免每个宿主适配器各写一份正则（必然漂移）。
 */

/**
 * 把文本中的 legacy 内部技能名 `iagent_<id>` 归一化为 canonical `iagent-<id>`。
 *
 * @param text - 待归一化文本（正文 / description / compatibility / 参考文件）
 */
export function normalizeHostSkillRefs(text: string): string {
    return text.replace(/\biagent_([a-z0-9_]+)\b/g, (_match, suffix: string) =>
        `iagent-${suffix.replaceAll('_', '-')}`
    );
}
