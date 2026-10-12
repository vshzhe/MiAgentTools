/**
 * 指令适配器注册表。
 *
 * MVP 仅注册 Claude Code；新增工具时实现 ToolCommandAdapter 并在此注册即可。
 */

import type { ToolCommandAdapter } from '../types.js';
import { claudeAdapter } from './claude.js';
import { piAdapter } from './pi.js';

export class CommandAdapterRegistry {
    private static adapters: Map<string, ToolCommandAdapter> = new Map();

    static {
        CommandAdapterRegistry.register(claudeAdapter);
        CommandAdapterRegistry.register(piAdapter);
    }

    /** 注册适配器 */
    static register(adapter: ToolCommandAdapter): void {
        CommandAdapterRegistry.adapters.set(adapter.toolId, adapter);
    }

    /** 按工具 id 查找适配器 */
    static get(toolId: string): ToolCommandAdapter | undefined {
        return CommandAdapterRegistry.adapters.get(toolId);
    }

    /** 获取全部适配器 */
    static getAll(): ToolCommandAdapter[] {
        return Array.from(CommandAdapterRegistry.adapters.values());
    }

    /** 是否已注册 */
    static has(toolId: string): boolean {
        return CommandAdapterRegistry.adapters.has(toolId);
    }
}
