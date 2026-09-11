# Workman Services — Agent Guidelines & Memory Protocol

## 1. Codebase Memory MCP Integration

This project is indexed into **`codebase-memory-mcp`** under the project identifier:
```text
Project Name: D-WORKMAN-SERVICES
Root Path: d:/WORKMAN SERVICES
```

### Discovery & Search Protocol (MCP First)
Always prioritize using `codebase-memory-mcp` tools before falling back to manual file scans:
1. **Symbol & Entity Discovery**: Use `search_graph` (query by symbol, class, function, or route name) instead of blind text searches.
2. **Reading Source Elements**: Use `get_code_snippet` to retrieve exact line spans and function definitions efficiently.
3. **Dependency & Caller Analysis**: Use `trace_path` (inbound for callers, outbound for dependencies) to understand the call hierarchy.
4. **Complex Relationships**: Use `query_graph` to inspect edges (`CALLS`, `DEFINES`, `IMPORTS`, `IMPLEMENTS`).
5. **Architectural Overview**: Use `get_architecture(aspects=['all'])` for understanding structural boundaries.
6. **Architectural Decisions**: Check `manage_adr(mode='get')` for persisted design principles and constraints.

### Automatic Sync & Blast-Radius Protocol
With every prompt, plan, or code change:
1. **Impact Analysis (Pre/Post Change)**:
   - Run `detect_changes` (`project: "D-WORKMAN-SERVICES"`) to inspect the blast radius and transitive callers of altered symbols.
2. **Keep Index Fresh**:
   - Check `index_status` for project health and parse coverage.
   - Run `index_repository(repo_path="d:/WORKMAN SERVICES", persistence=true)` after major additions or modifications to keep the graph and `.codebase-memory/graph.db.zst` synchronized.
3. **Fallback & Flagged Ranges**:
   - When files contain tree-sitter parse partials (as reported by `index_status`), supplement graph queries with targeted `grep_search`.
