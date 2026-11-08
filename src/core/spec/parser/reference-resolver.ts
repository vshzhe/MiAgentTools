/**
 * Scenario Ref 引用上下文补全（D2）。
 *
 * 纯函数、无 I/O、无新依赖：把 `Scenario Ref` 的场景叶子名用**同一任务**的
 * `Spec Ref` 补全为 `capability / Requirement / Scenario` 全路径，供校验层做覆盖匹配。
 * 无法消歧时只返回事实（缺少上下文 / 歧义），本模块 MUST NOT 猜测归属 ——
 * 诊断文案与落盘由校验层负责。
 */

/** 场景叶子名判定：非空、不含路径分隔符 `/` 且不含链式分隔符 `→` */
export function isLeafScenarioRef(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.length > 0 && !trimmed.includes('/') && !trimmed.includes('→');
}

export type ScenarioRefResolution =
    /** 值本身含分隔符，视为历史全路径 / 链式形态，不做补全 */
    | { kind: 'full-path'; ref: string; resolved: string }
    /** 叶子名由同任务唯一 Spec Ref 补全成功 */
    | { kind: 'leaf-resolved'; ref: string; resolved: string }
    /** 叶子名但任务无 Spec Ref —— 缺少上下文 */
    | { kind: 'missing-context'; ref: string }
    /** 叶子名但任务有 ≥2 条（去重后）Spec Ref —— 歧义 */
    | { kind: 'ambiguous'; ref: string; specRefCount: number };

/**
 * 解析单条 Scenario Ref：叶子名用同任务 Spec Ref 补全，其余原样视为全路径。
 *
 * @param specRefs 同一任务的 Spec Ref 列表（MUST NOT 混入其它任务或跨 capability 推断）
 * @param ref 单条 Scenario Ref 原始值
 */
export function resolveScenarioRef(specRefs: readonly string[], ref: string): ScenarioRefResolution {
    if (!isLeafScenarioRef(ref)) {
        return { kind: 'full-path', ref, resolved: ref.trim() };
    }
    const candidates = uniqueSpecRefs(specRefs);
    if (candidates.length === 0) {
        return { kind: 'missing-context', ref };
    }
    if (candidates.length > 1) {
        return { kind: 'ambiguous', ref, specRefCount: candidates.length };
    }
    return { kind: 'leaf-resolved', ref, resolved: `${candidates[0]} / ${ref.trim()}` };
}

/** 解析任务的全部 Scenario Ref（保持原始顺序与条目，不合并、不丢弃） */
export function resolveScenarioRefs(
    specRefs: readonly string[],
    scenarioRefs: readonly string[],
): ScenarioRefResolution[] {
    return scenarioRefs.map((ref) => resolveScenarioRef(specRefs, ref));
}

/**
 * 引用归一化：剥离包裹反引号、统一分隔符两侧空白与大小写。
 * 追溯匹配的唯一归一化实现（校验层复用，避免两份口径漂移）。
 */
export function normalizeRef(value: string): string {
    return value.replaceAll('`', '').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** 去重后的非空 Spec Ref（同一值重复书写不构成歧义） */
function uniqueSpecRefs(specRefs: readonly string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of specRefs) {
        const value = raw.trim();
        if (value.length === 0) continue;
        const key = normalizeRef(value);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(value);
    }
    return result;
}
