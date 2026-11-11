import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    receiptStorePath,
    readReceipt,
    writeReceipt,
    RECEIPTS_DIR_NAME,
} from '../src/core/host-orchestration/receipt-store.js';
import { resolveNextPhase } from '../src/core/host-orchestration/transition.js';
import { WORKFLOW_PROTOCOLS } from '../src/core/host-orchestration/workflows.js';

const tempRoots: string[] = [];

function makeTempRoot(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iagent-receipt-'));
    tempRoots.push(dir);
    return dir;
}

afterAll(() => {
    for (const dir of tempRoots) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('receipt store path', () => {
    it('derives .openspec-tmp/pipeline-<change>/receipts/<phase>.json', () => {
        const p = receiptStorePath('demo-change', 'propose').replaceAll('\\', '/');
        expect(p).toBe('.openspec-tmp/pipeline-demo-change/receipts/propose.json');
    });

    it('keeps the receipts directory name as a single source constant', () => {
        expect(receiptStorePath('x', 'y').replaceAll('\\', '/')).toContain(`/${RECEIPTS_DIR_NAME}/`);
    });
});

describe('receipt store read / write', () => {
    it('round-trips a receipt', () => {
        const cwd = makeTempRoot();
        const result = writeReceipt(
            'demo',
            'verify',
            { phase: 'verify', status: 'ok', artifact: 'x', nextAllowed: 'apply' },
            cwd
        );
        expect(result.ok).toBe(true);
        const read = readReceipt('demo', 'verify', cwd);
        expect(read?.phase).toBe('verify');
        expect(read?.nextAllowed).toBe('apply');
    });

    it('reports failure without throwing when the workspace cannot be created', () => {
        const cwd = makeTempRoot();
        const fileAsDir = path.join(cwd, 'occupied');
        fs.writeFileSync(fileAsDir, 'x', 'utf8');
        const result = writeReceipt('demo', 'apply', { phase: 'apply', status: 'ok' }, fileAsDir);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason.length).toBeGreaterThan(0);
        }
    });

    it('returns undefined for a missing receipt', () => {
        const cwd = makeTempRoot();
        expect(readReceipt('nope', 'explore', cwd)).toBeUndefined();
    });
});

describe('resolveNextPhase', () => {
    const protocol = WORKFLOW_PROTOCOLS['auto-workflow'];

    it('resolves a later phase', () => {
        const result = resolveNextPhase(protocol, 'explore', 'propose');
        expect(result.resolved).toBe(true);
        expect(result.phase?.id).toBe('propose');
    });

    it('resolves the same phase for blocked resume', () => {
        const result = resolveNextPhase(protocol, 'apply', 'apply');
        expect(result.resolved).toBe(true);
        expect(result.phase?.id).toBe('apply');
    });

    it('rejects backward, unknown and empty nextAllowed', () => {
        expect(resolveNextPhase(protocol, 'apply', 'explore').resolved).toBe(false);
        expect(resolveNextPhase(protocol, 'apply', 'nope').resolved).toBe(false);
        expect(resolveNextPhase(protocol, 'apply', '').resolved).toBe(false);
        expect(resolveNextPhase(protocol, 'apply', undefined).resolved).toBe(false);
    });

    it('rejects an unknown current phase', () => {
        expect(resolveNextPhase(protocol, 'nope', 'propose').resolved).toBe(false);
    });

    it('does not mutate the protocol', () => {
        const before = protocol.phases.map((phase) => phase.id);
        resolveNextPhase(protocol, 'explore', 'propose');
        expect(protocol.phases.map((phase) => phase.id)).toEqual(before);
        expect(protocol.phases[0]).toBe(protocol.phases[0]);
    });
});
