---
name: "Venus: 提案验证门"
description: Verify artifacts with quantified scoring - 9-dimension check with tech stack detection
allowed-tools: Bash(venus:*)
category: Venus / 规格
tags: [venus, spec, verify, proposal]
---

**Before verifying, read openspec/rules/ai-coding.md for verification criteria.**

Verify artifacts against exploration results with quantified scoring.

Checks 9 dimensions (D1-D5 core + D6-D9 conditional) with coverage rates. ALL must PASS to proceed.

**Read-only verification steps execute without confirmation**: artifact reading, file scanning, CodeGraph queries, and D1-D9 scoring analysis run directly without mid-flow confirmation prompts. Only the verification report (and genuinely user-owned choices, e.g., choosing a fix path after a FAIL verdict) is surfaced to the user.

---

**Input**: Optionally specify change name. If omitted, infer from context.

---

## Tech Stack Detection

Parse `openspec/config.yaml` context for keywords:
- TypeScript, Java/JSP, Python, Go, Rust

Prompt user: "Detected [TypeScript]. Run tech-specific validation?"

---

## Change Type Auto-Detection

Scan design.md and specs for keywords before executing D6-D9:
- Frontend (page, component, UI, Vue, React, JSP) → trigger D6
- API (endpoint, route, handler, POST, GET) → trigger D7
- DB (table, column, schema, DDL) → trigger D8
- Business (流程, 状态机, 多步骤, 事务) → trigger D9

Non-triggered dimensions marked "不适用" and skipped.

---

## 9 Dimensions with Scoring

| Dimension | Check | Score Formula | Trigger |
|-----------|-------|----------------|---------|
| D1: Requirements | Decisions → specs | matched/total * 100% | Always |
| D2: Technical | Choices → design | matched/total * 100% | Always |
| D3: Tasks | Requirements → tasks | covered/total * 100% | Always |
| D4: Boundaries | Questions → scenarios | addressed/total * 100% | Always |
| D5: Pending | Items → resolved | resolved/total * 100% | Always |
| D6: Interaction Detail | design.md matrix completeness | populated/4 * 100% | Auto (frontend keywords) |
| D7: API Contract | Endpoint contract completeness | complete/total * 100% | Auto (API keywords) |
| D8: Database Mapping | Table field completeness | complete/total * 100% | Auto (DB keywords) |
| D9: Business Steps | Complex op decomposition | decomposed/total * 100% | Auto (business keywords) |

**Overall**: Average of triggered dimensions

**Legacy WARNING**: If design.md lacks interaction detail sections → WARNING (not FAIL, not blocking)

---

## Score Thresholds

| Score | Interpretation |
|-------|----------------|
| ≥90% | High quality ✓ (PASS) |
| <90% | Needs revision ✗ (FAIL) |

---

## Result Handling

**PASS**: Auto-run inline read-only deep review (no dedicated skill)

**FAIL**: Auto-fix and re-run; if still FAIL, options (no skip-to-apply):
[1] 手动编辑 - Fix artifacts yourself
[2] 返回探索 - Return to exploration
[3] 查看差异 - View diff

**WARNING (legacy)**: Legacy changes missing interaction-detail matrices (D6-D8) get WARNING (not FAIL) and do not block apply — this is backward-compat for old changes, distinct from the removed "skip verification" option.

---

## Output

```
## Verification Report

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 85% | PASS |
| D2: Technical | 90% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 70% | FAIL |
| D5: Pending | 100% | PASS |
| D6: Interaction Detail | 75% | PASS |
| D7: API Contract | 80% | PASS |
| D8: Database Mapping | N/A | SKIP |
| D9: Business Steps | 100% | PASS |

Overall: 87% (Good quality)

[Inline deep review on pass / Auto-fix + options on fail]
```

---

## Guardrails

- Quantified scoring for each dimension
- Change type auto-detection triggers D6-D9
- Legacy changes: WARNING for missing interaction detail, new changes: FAIL
- Tech stack detection from config
- Inline deep review after pass (no dedicated skill)
- Auto-fix loop on fail
- Use `path.join()` for paths
