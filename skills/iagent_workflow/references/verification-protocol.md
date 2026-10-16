### 3.1 Auto-Execute Verification (No User Prompt)

**⚠️ Verification is now AUTOMATIC — no user choice prompt**

After all artifacts are generated and validated in Phase 2.5, system MUST automatically enter Phase 3 verification without asking the user:

1. **Skip method-specific prompt** — Do NOT show "Propose 方式一步生成，建议运行验证" or "已通过逐步迭代创建，验证可选"
2. **Skip user choice** — Do NOT ask [立即验证] / [跳过验证]
3. **Execute directly** — Proceed to 3.2 Verification Execution

### 3.2 Verification Execution

Execute D1-D5 core verification by **invoking the `iagent_spec_verify_proposal` skill** (NOT a CLI instruction):

```bash
# Resolve change status first
iagent spec status --change "<name>" --json
# Then invoke the verification skill (iagent_spec_verify_proposal is a SKILL name, not a valid
# `iagent spec instructions` artifact ID — valid artifact IDs are proposal/specs/design/tasks only.
# Running `iagent spec instructions iagent_spec_verify_proposal` errors with "Artifact not found".)
```

Invoke the skill: use the Skill tool to call `iagent_spec_verify_proposal` for change `<name>`. The skill performs inline D1-D5 scoring by reading the artifacts and exploration.md; it does not depend on any CLI verify command (none exists — the iagent CLI only has `validate` for schema-level checks).

**Fallback (skill unavailable)**: If the `iagent_spec_verify_proposal` skill is not installed or its invocation fails, fall back to AI inline reading of proposal/specs/design/tasks + D1-D5 manual scoring, and emit WARN log: "iagent_spec_verify_proposal skill unavailable, degraded to inline scoring". Do NOT silently skip verification.

Execute 5-dimension verification:
1. **D1: Requirement Coverage** — Decisions → spec requirements
2. **D2: Technical Consistency** — Technical choices → `design.md`
3. **D3: Task Completeness** — Spec requirements → tasks
4. **D4: Boundary Coverage** — Questions/edge cases → spec scenarios
5. **D5: Pending Resolution** — Pending items → resolved
6. **D6: Deep Analysis Coverage** — Deep analysis completeness → Implementation Deep-Dive section

### 3.3 Quantified Score Report

Display verification results with scores:

```
## Verification Report

| Dimension | Coverage | Status |
|-----------|----------|--------|
| D1: Requirements | 85% | PASS |
| D2: Technical | 90% | PASS |
| D3: Tasks | 100% | PASS |
| D4: Boundaries | 70% | FAIL |
| D5: Pending | 100% | PASS |
| D6: Deep Analysis | N/A | PASS |

**Overall Score**: 89%
```

Score interpretation (unified 90% threshold — the previous 70%/90% dual-band is removed):
- ≥90%: High quality, ready for implementation (PASS — auto-trigger deep review per 3.5)
- <90%: Needs revision before implementation (FAIL — auto-fix per 3.6)

### 3.4 Tech Stack Detection

Detect tech stack from `openspec/config.yaml` context field:

```bash
# Read config.yaml and parse context field
# Match keywords: TypeScript, Java/JSP, Python, Go, Rust
```

If tech stack detected:
> "Detected tech stack: [TypeScript]. Run tech-specific validation?"
> [Yes] [No - basic only]

### 3.5 Verification Pass → Auto-Trigger Deep Review → Auto-Generate Requirement Doc

When ALL dimensions PASS (≥90%):

1. **Auto-execute deep review** — Invoke the `iagent_proposal_review` **skill** (via Skill tool) — Do NOT ask user, auto-execute (user can interrupt to skip)
2. Deep review scope: codebase deep exploration + multi-dimensional completeness
3. Display results alongside verification report
4. **Fallback (skill unavailable or call fails)**: degrade to main-workflow inline read-only deep review + WARN log — never silently skip

> "Verification passed! All D1-D5 ≥90%. Auto-running iagent_proposal_review..."
> [deep review results displayed]

If user wants to skip the deep review, they can interrupt. Otherwise it runs automatically.

5. **Converge — generate the requirement document** — after the deep review converges, invoke `iagent_requirement_doc` in non-interactive mode (via Skill tool) to generate the requirement document at `openspec/changes/<change-name>/需求文档.md`. The document is generated from the CURRENT artifacts (proposal/specs/design/tasks) before implementation begins — the user can review it during the apply phase. Generation failure is non-blocking (WARN log + continue). MUST NOT ask the user for document basic information. After generation, proceed to the Phase 3.7 implementation bridge (do not stop at apply-ready).
   - Rationale: generating the document at verification time gives the user a review-ready document before implementation starts; the archive phase performs in-place incremental alignment on the existing document

> "Deep review complete."
> "Requirement document: generated at openspec/changes/<name>/需求文档.md."

### 3.6 Verification Fail → Auto-Fix and Re-run

**On FAIL, do NOT generate the requirement document.** Generation happens only after fixes pass re-verification (then 3.5 step 5 runs).

When ANY dimension FAILS (<90%), system MUST auto-fix:

1. **Auto-generate fix suggestions**:
   - For each FAIL dimension, generate specific fixes (missing scenarios, incomplete sections)
   - Example: D4 missing boundary scenario → add scenario to spec

2. **Apply fixes** to artifact files using Edit tool

3. **Auto re-run verification** after fixes applied

4. **Display fix summary**:
   ```
   ## Auto-Fix Applied
   - D4: Added 2 boundary scenarios to specs/auth/spec.md
   - D1: Added 1 requirement scenario to specs

   Re-running verification...
   ```

5. **If re-run passes**: Proceed to 3.5 (auto-trigger deep review)
6. **If re-run still fails**: Show remaining issues and offer options (no skip-to-apply path):
   > [1] Manual edit — Fix artifacts yourself
   > [2] Return to exploration — Add missing decisions
   > [3] View detailed diff report

---
