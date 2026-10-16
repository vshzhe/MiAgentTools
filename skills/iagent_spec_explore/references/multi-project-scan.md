### 1.2.1.5 Multi-Project CodeGraph Agent Scan (条件触发 — 检测到其他项目路径时执行)

**⚠️ CONDITIONAL: Only executes when exploration context contains other project paths**

After the 1.2.1 base scan (current project), system MUST check if the exploration context contains paths to other projects (e.g., user-specified `--project-path`, auto-migration SOURCE_PROJECT/TARGET_PROJECT, or paths confirmed during conversation).

**When other project paths are detected**:

1. **Check CodeGraph initialization** for each other project path:
   - Run Bash `ls <path>/.codegraph/` to check whether the target project has a `.codegraph/` directory (directory contents listed — including codegraph.db — means CodeGraph is initialized). Do NOT use Glob to check dot-prefixed directories (Glob returns false negatives for them)
   - If initialized (ls succeeds): proceed with Agent scan
   - If not initialized (ls fails — directory does not exist): log WARN "Other project <path> does not have CodeGraph initialized — falling back to Glob/Grep" and fall back to Glob/Grep

2. **Single sub-agent serial scan across all detected projects**:
   - Spawn **ONE** sub-agent that scans ALL detected projects **serially** inside itself; the system MUST NOT spawn a separate sub-agent for each project path (this removes the N repeated cold starts)
   - The sub-agent SHALL call the CodeGraph MCP tools once for each project, switching the `projectPath` parameter to that project's path on every call
   - For each project, execute `codegraph_files` for file structure, `codegraph_search` for symbol search, `codegraph_context` for context understanding
   - Limit scan depth: `maxDepth: 3`, `maxNodes: 20` to prevent excessive results
   - The sub-agent MUST NOT modify any files

   - **⛔ EXIT GUARD**: the sub-agent MUST stop and return findings immediately after scanning all projects — MUST NOT enter plan mode / design mode / propose next steps / suggest implementation; the sub-agent is a scanner only, its sole output is the structured findings per project; the orchestrator alone owns flow advancement
   - **MUST only query incrementally**: the sub-agent MUST limit scanning to what was NOT already covered by the 1.2.1 base scan; it MUST NOT re-derive information already available in the current project's exploration file   - Apply a 120s budget for each project (budget exceeded → per-project WARN fallback to Glob/Grep)

3. **Per-project degradation (project granularity)**:
   - If one project's CodeGraph is not initialized, its scan fails, or it exceeds the 120s budget: **only that project** falls back to Glob/Grep with a WARN log — the other projects continue their scan normally
   - One project's failure MUST NOT affect other projects
   - If an other-project path is identical to the current project path, the sub-agent SHALL skip that project
   - If the runtime provides no sub-agent capability at all: ALL projects fall back to Glob/Grep with a WARN log

4. **Merge results** into exploration.md:
   - Write to `## Codebase Findings > ### Other Project Findings` subsection
   - Prefix results with project path for clear attribution
   - Results include: discovered files, identified symbols, and call chains

5. **When no other project paths detected**:
   - Do NOT trigger the multi-project Agent scan
   - Proceed with the existing 1.2.2 flow unchanged

**Fallback**: If Agent spawn fails, sub-agent times out, or CodeGraph is not initialized in the target project:
- WARN log with specific failure reason
- Fall back to Glob/Grep for that project
- Do NOT retry the failed Agent scan
- This fallback does NOT affect the current project's scan results

**Checkpoint Enforcement**:
- System MUST execute this check after 1.2.1 base scan completes
- If other project paths exist, system MUST attempt Agent scan (with fallback)
- Results MUST be written to exploration.md before proceeding to 1.2.2
- This check MUST NOT block the main workflow — failures degrade gracefully

