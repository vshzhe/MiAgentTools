# Tasks

## 1. Canonical workflow identity and migration

- [x] 1.1 Introduce canonical `workflowId` resolution from existing commandId values while preserving legacy `iagent_<name>` aliases, and verify registry, profiles, config workflows, command references, and legacy mappings resolve the same IDs.
- [x] 1.2 Update host-facing skill directory/name derivation to `iagent-<workflowId>` without changing the canonical config workflow list, and verify Claude, Pi, OpenCode V2, and Codex path-generation tests cover kebab-case outputs.
- [x] 1.3 Implement safe migration of managed `iagent_<name>` skill artifacts to `iagent-<name>` during init/update, including fingerprint-aware conflict handling and non-iagent preservation; verify migration, conflict, idempotency, and rollback-preservation tests.
- [x] 1.4 Update list/show/validate/reconcile/uninstall and documentation lookup paths to accept legacy aliases while displaying canonical IDs; verify old-name queries and non-iagent deletion-boundary tests.

## 2. Shared workflow protocol and capability model

- [x] 2.1 Define the host-neutral workflow protocol for phase input, required capabilities, handoff, receipt, gate, retry, strict, and degraded states; verify schema/model tests reject missing required receipt fields and invalid transitions.
- [x] 2.2 Add host capability negotiation and diagnostic metadata for strict/degraded execution, including explicit blocking when strict capabilities are missing; verify capability matrix tests for Claude Code, OpenCode V2, Pi strict, and Pi degraded.
- [x] 2.3 Refactor workflow templates to express protocol actions rather than hard-coded `Skill(...)`, `Agent`, `Task`, MCP names, or Claude-only tool vocabulary; verify template scans find no unadapted host-specific delegation in shared content and preserve existing phase semantics.
- [x] 2.4 Add host-native gate and receipt transition handling, ensuring unconfirmed gates and invalid receipts cannot advance phases; verify gate-blocking and receipt-failure tests.

## 3. Claude Code adapter compatibility

- [x] 3.1 Map shared protocol delegation, skill loading, user confirmation, MCP access, and subagent lifecycle to Claude Code native Skill/Agent/AskUserQuestion/hooks semantics; verify Claude adapter contract tests for each required action.
- [x] 3.2 Preserve Claude-specific allowed-tools and session permission behavior while deriving it from the host adapter instead of shared workflow text; verify existing whitelist, permissions, and generated-artifact parity tests.
- [x] 3.3 Update Claude-facing generated names and command references to canonical kebab-case while retaining legacy lookup/migration support; verify generated snapshots and old-install migration tests.

## 4. OpenCode V2 project adapter

- [x] 4.1 Extend OpenCode command generation with V2 `agent`, `model`, and `subagent` metadata while retaining `$ARGUMENTS` injection, minimal frontmatter, and fingerprint protection; verify command parsing fixtures for orchestrator and worker commands.
- [x] 4.2 Generate project-local `.opencode/agents/` definitions for the iagent orchestrator and phase workers, including bounded permissions and phase ownership; verify generated agent files and worker receipt contract tests.
- [x] 4.3 Generate or merge project-local `.opencode/opencode.jsonc` V2 `permissions` without modifying root user configuration or unrelated project fields; verify JSONC merge, idempotency, conflict, and non-destructive preservation tests.
- [x] 4.4 Adapt OpenCode workflow references to native `skill` and `subagent` IDs and reject missing V2 skill/subagent permissions in strict mode; verify a V2 fixture covering skill loading, child-agent dispatch, and blocked permission behavior.
- [x] 4.5 Update OpenCode documentation and examples to V2 terminology (`permissions`, `shell`, `subagent`, `skill`) and verify no new V1-only configuration is emitted.

## 5. Pi npm runtime and host adapter

- [x] 5.1 Add a replaceable Pi runtime provider with default package `@tintinweb/pi-subagents`, latest-version resolution, Pi-version compatibility checks, conflict detection, and resolved-version diagnostics; verify provider unit tests with installed, missing, incompatible, and conflicting runtime fixtures.
- [x] 5.2 Implement project-local installation through the Pi package mechanism and make init continue after installation failure; verify mocked install failures still produce a successful init result with degraded status and actionable warnings.
- [x] 5.3 Generate Pi strict artifacts and runtime metadata when the provider is available, including native workflow/agent references and argument placeholders; verify Pi 1.2.0-compatible generated paths, command arguments, and strict capability checks.
- [x] 5.4 Generate explicitly marked Pi degraded artifacts when strict runtime is unavailable, documenting unsupported delegation, receipts, gates, and automatic phase progression; verify degraded output never reports delegated completion.
- [x] 5.5 Add provider replacement configuration for a future iagent-owned npm package without changing shared protocol contracts; verify switching providers changes only installation/detection behavior.
- [x] 5.6 Document package security review, project trust, `/reload`, project-local installation, strict/degraded diagnostics, and manual retry commands; verify every documented command matches the generated behavior.

## 6. Init/update and generated artifact integration

- [x] 6.1 Integrate capability detection, runtime installation, host metadata generation, and strict/degraded status into `iagent init` while preserving migration-before-generation ordering; verify end-to-end init results for all tool selections.
- [x] 6.2 Integrate host-aware refresh and migration into `iagent update`, preserving fingerprint hand-modification protection and legacy artifact reporting; verify idempotent update, manual-edit protection, and failed-migration recovery.
- [x] 6.3 Extend command-artifact ownership, reconcile, uninstall, project scan, and `.gitignore` handling for new OpenCode V2 and kebab-case artifacts; verify user-file preservation and cross-host cleanup boundaries.
- [x] 6.4 Regenerate `skills/` snapshots after template changes and update parity, size, language, allowed-tools, command-reference, and host-adapter regression locks; verify `pnpm build && pnpm generate:skills` followed by the relevant test suite.
- [x] 6.5 Update README, AGENTS.md, skills manual, and runtime troubleshooting documentation for the shared protocol, OpenCode V2 project files, Pi npm runtime, degraded semantics, and migration behavior; verify documented layouts and commands against generated fixtures.

## 7. Integration and release verification

- [x] 7.1 Add cross-host smoke fixtures covering argument propagation, skill loading, native delegation, gate blocking, receipt validation, and ordinary phase completion for Claude Code, OpenCode V2, Pi strict, and Pi degraded; verify each fixture records expected status and failure diagnostics.
- [x] 7.2 Run build, lint, full tests, generated-skill parity, and OpenSpec validation; verify all pass and no generated artifact contains stale underscore-only or Claude-only delegation references for non-Claude hosts.
- [x] 7.3 Apply the required version increment and CHANGELOG entry for the breaking external artifact naming and new host orchestration capability; verify package version, changelog links, and README version examples are synchronized.
