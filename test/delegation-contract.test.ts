/**
 * 委托模式双轴词汇单一源回归锁（变更 fix-mode-delegation-host-parity，任务 1.2）。
 *
 * 锁定三件事：
 *   1. 两轴正交：`mode`（执行归属）与 `gate-skip`（门承载）互不推导；
 *   2. `auto-mode=true` **仅**映射门承载轴，不产生 `delegated` 的停点抑制标志；
 *   3. 未知 gate id / 未知参数键不被静默接受（忽略并记 WARN）。
 */

import { describe, it, expect } from 'vitest';
import {
    DELEGATION_MODES,
    DELEGATION_MODE_PARAM,
    GATE_SKIP_IDS,
    GATE_SKIP_PARAM,
    LEGACY_AUTO_MODE_PARAM,
    renderDelegationModeContract,
    renderGateSkipOption,
    resolveDelegationContract,
} from '../src/core/host-orchestration/delegation-contract.js';

describe('委托契约词汇常量', () => {
    it('模式与门承载取值来自唯一常量源', () => {
        // Given / When / Then：取值表只在本模块定义，模板与宿主渲染均插值引用
        expect(DELEGATION_MODES).toEqual(['interactive', 'delegated']);
        expect(GATE_SKIP_IDS).toEqual(['design-confirmation']);
        expect(LEGACY_AUTO_MODE_PARAM).toBe('auto-mode');
        expect(DELEGATION_MODE_PARAM).toBe('mode');
        expect(GATE_SKIP_PARAM).toBe('gate-skip');
    });
});

describe('resolveDelegationContract —— 两轴正交', () => {
    it('缺省为 interactive 且无门跳过', () => {
        // Given：无参数
        const contract = resolveDelegationContract();
        // When / Then
        expect(contract.mode).toBe('interactive');
        expect(contract.gateSkips).toEqual([]);
        expect(contract.legacyAutoMode).toBe(false);
        expect(contract.warnings).toEqual([]);
    });

    it('仅传 mode=delegated 时不产生 gateSkips（业务门照常触发）', () => {
        // Given：只声明执行归属
        const contract = resolveDelegationContract({ mode: 'delegated' });
        // When / Then：门承载轴保持为空
        expect(contract.mode).toBe('delegated');
        expect(contract.gateSkips).toEqual([]);
        expect(contract.legacyAutoMode).toBe(false);
    });

    it('仅传 gate-skip 时 mode 保持 interactive（停点与自验证照常生效）', () => {
        const contract = resolveDelegationContract({ 'gate-skip': 'design-confirmation' });
        expect(contract.mode).toBe('interactive');
        expect(contract.gateSkips).toEqual(['design-confirmation']);
    });

    it('两轴可同时声明且互不覆盖', () => {
        const contract = resolveDelegationContract({
            mode: 'delegated',
            'gate-skip': 'design-confirmation',
        });
        expect(contract.mode).toBe('delegated');
        expect(contract.gateSkips).toEqual(['design-confirmation']);
    });
});

describe('resolveDelegationContract —— auto-mode 仅映射门承载轴', () => {
    it('auto-mode=true 产出 design-confirmation 而 mode 保持原值', () => {
        // Given：旧写法 auto-mode=true
        const contract = resolveDelegationContract({ 'auto-mode': 'true' });
        // Then：mode 未被改写为 delegated，仅门承载轴生效
        expect(contract.mode).toBe('interactive');
        expect(contract.gateSkips).toEqual(['design-confirmation']);
        expect(contract.legacyAutoMode).toBe(true);
    });

    it('auto-mode=true 与 gate-skip=design-confirmation 的门承载结果一致', () => {
        const legacy = resolveDelegationContract({ 'auto-mode': 'true' });
        const canonical = resolveDelegationContract({ 'gate-skip': 'design-confirmation' });
        expect(legacy.gateSkips).toEqual(canonical.gateSkips);
        expect(legacy.mode).toBe(canonical.mode);
        expect(legacy.legacyAutoMode).toBe(true);
        expect(canonical.legacyAutoMode).toBe(false);
    });

    it('auto-mode=false 不产生门跳过', () => {
        const contract = resolveDelegationContract({ 'auto-mode': 'false' });
        expect(contract.gateSkips).toEqual([]);
        expect(contract.legacyAutoMode).toBe(false);
    });
});

describe('resolveDelegationContract —— 未知输入不被静默接受', () => {
    it('未知 gate id 被忽略并记 WARN，不产生任何门跳过', () => {
        // Given：未知门 id（拼写错误 / 未来门）
        const contract = resolveDelegationContract({ 'gate-skip': 'unknown' });
        // Then：不得按「已跳过」处理
        expect(contract.gateSkips).toEqual([]);
        expect(contract.warnings.length).toBeGreaterThan(0);
        expect(contract.warnings.join('\n')).toContain('unknown');
    });

    it('gate-policy= 不是可解析参数键，忽略并记 WARN', () => {
        // Given：概念轴名被误当参数键
        const contract = resolveDelegationContract({ 'gate-policy': 'design-confirmation' });
        // Then：MUST NOT 映射为门已跳过
        expect(contract.gateSkips).toEqual([]);
        expect(contract.warnings.some((warning) => warning.includes('gate-policy'))).toBe(true);
    });

    it('未知委托模式回落 interactive 并记 WARN', () => {
        const contract = resolveDelegationContract({ mode: 'auto' });
        expect(contract.mode).toBe('interactive');
        expect(contract.warnings.some((warning) => warning.includes('mode'))).toBe(true);
    });

    it('逗号列表去重且忽略空片段', () => {
        const contract = resolveDelegationContract({
            'gate-skip': ' design-confirmation , ,design-confirmation',
        });
        expect(contract.gateSkips).toEqual(['design-confirmation']);
        expect(contract.warnings).toEqual([]);
    });
});

describe('词汇渲染函数', () => {
    it('renderGateSkipOption 输出 canonical 参数串', () => {
        expect(renderGateSkipOption(GATE_SKIP_IDS)).toBe('gate-skip=design-confirmation');
    });

    it('renderDelegationModeContract 含两轴说明与不可互换声明', () => {
        const text = renderDelegationModeContract();
        // 轴一与轴二词汇来自常量
        expect(text).toContain('mode');
        expect(text).toContain('interactive');
        expect(text).toContain('delegated');
        expect(text).toContain('gate-skip');
        expect(text).toContain('design-confirmation');
        // 不可互换与门不豁免
        expect(text).toContain('MUST NOT 视为');
        expect(text).toContain('不豁免任何业务确认门');
        // 与宿主原生 mode 字段区分
        expect(text).toContain('MUST NOT 与宿主原生');
    });
});
