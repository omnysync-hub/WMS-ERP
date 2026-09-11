---
description: Always use codebase-memory-mcp tools for symbol discovery, navigation, impact analysis, and updates in Workman Services
globs: "**/*"
always_on: true
---

# Codebase Memory Protocol

- Project: `D-WORKMAN-SERVICES`
- Root: `d:/WORKMAN SERVICES`

## Rules
1. **Search and Discovery**:
   - Always call `search_graph`, `query_graph`, `trace_path`, or `get_code_snippet` from `codebase-memory-mcp` first when locating functions, components, API routes, or types.
2. **Impact & Blast Radius**:
   - Before and after modifying code, check the blast radius using `detect_changes(project='D-WORKMAN-SERVICES')`.
3. **Index Freshness**:
   - Use `index_status` to verify index health.
   - Run `index_repository(repo_path='d:/WORKMAN SERVICES', persistence=true)` when new files or substantial structural changes are introduced.
4. **Architecture Context**:
   - Consult `manage_adr` and `get_architecture` when making structural or architectural decisions.
