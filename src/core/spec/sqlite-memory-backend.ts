/**
 * SQLite 内存后端（供测试使用）。
 *
 * 实现与 sqlite-index.ts 相同的接口，但数据存储在内存 Map 中，
 * 不依赖 sqlite3 CLI 或 better-sqlite3。
 */

/** 变更索引条目 */
export interface ChangeIndexEntry {
    name: string;
    archiveDate?: string;
    module?: string;
    summary?: string;
    status?: string;
}

/** 能力索引条目 */
export interface CapabilityIndexEntry {
    name: string;
    changeName: string;
    operation: string;
}

/** 决策索引条目 */
export interface DecisionIndexEntry {
    title: string;
    choice: string;
    rationale: string;
    changeName: string;
}

/** 需求索引条目 */
export interface RequirementIndexEntry {
    requirementName: string;
    scenarioText: string;
    changeName: string;
    capabilityName: string;
}

/** 探索记忆条目 */
export interface ExplorationMemoryEntry {
    capability: string;
    changeName: string;
    memoryType: string;
    content: string;
    archivedAt: string;
    supersededBy?: string;
}

export class MemoryBackend {
    private changes = new Map<string, ChangeIndexEntry>();
    private capabilities: Array<CapabilityIndexEntry & { changeId: number }> = [];
    private decisions: DecisionIndexEntry[] = [];
    private requirements: RequirementIndexEntry[] = [];
    private explorationMemory: ExplorationMemoryEntry[] = [];
    private nextId = 1;

    insertChange(entry: ChangeIndexEntry): void {
        this.changes.set(entry.name, entry);
    }

    insertCapability(cap: CapabilityIndexEntry): void {
        const exists = this.capabilities.some(
            (c) => c.name === cap.name && c.changeName === cap.changeName,
        );
        if (!exists) {
            this.capabilities.push({ ...cap, changeId: this.nextId++ });
        }
    }

    insertDecision(entry: DecisionIndexEntry): void {
        this.decisions.push(entry);
    }

    insertRequirement(entry: RequirementIndexEntry): void {
        this.requirements.push(entry);
    }

    insertExplorationMemory(entry: ExplorationMemoryEntry): void {
        this.explorationMemory.push(entry);
    }

    queryExplorationByCapability(capability: string): ExplorationMemoryEntry[] {
        return this.explorationMemory
            .filter((e) => e.capability === capability)
            .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
    }

    queryCapabilityConflicts(capabilityNames: string[]): string[] {
        const conflicts = new Set<string>();
        for (const cap of this.capabilities) {
            if (capabilityNames.includes(cap.name)) {
                const change = this.changes.get(cap.changeName);
                if (change && change.status === 'active') {
                    conflicts.add(cap.changeName);
                }
            }
        }
        return [...conflicts];
    }

    searchDecisions(keyword: string): DecisionIndexEntry[] {
        return this.decisions.filter(
            (d) =>
                d.title.includes(keyword) ||
                d.choice.includes(keyword) ||
                d.rationale.includes(keyword),
        );
    }

    searchRequirements(keyword: string): RequirementIndexEntry[] {
        return this.requirements.filter(
            (r) =>
                r.requirementName.includes(keyword) ||
                r.scenarioText.includes(keyword),
        );
    }

    isIndexed(changeName: string): boolean {
        return this.changes.has(changeName);
    }

    get indexedCount(): number {
        return this.changes.size;
    }

    get capabilityCount(): number {
        return this.capabilities.length;
    }

    get decisionCount(): number {
        return this.decisions.length;
    }

    clear(): void {
        this.changes.clear();
        this.capabilities = [];
        this.decisions = [];
        this.requirements = [];
        this.explorationMemory = [];
        this.nextId = 1;
    }
}