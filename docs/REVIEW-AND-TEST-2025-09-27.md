# BMAD Research Framework — Code Review & Test Report (2025-09-27)

## Executive Summary
- Completed a focused code and content audit of the SaaS services, Electron desktop shell, and bundled knowledge assets.
- Identified critical gaps in packaged resources (missing task/template files and desktop build exclusions) that will break core agent flows and offline usage.
- Executed six regression and tooling commands to verify current build/validation health and to surface runtime warnings for remediation.

## Code Review Findings
### Critical
1. **Core agents reference missing dependency files.** The `analyst` persona (and other core agents) still lists `create-doc.md` and multiple templates that are no longer shipped in `bmad-core/tasks` or `bmad-core/templates`. Runtime command execution will fail because these files cannot be resolved, and the build pipeline already warns about them. 【F:bmad-core/agents/analyst.md†L58-L84】【174ab9†L9-L111】【8e8575†L1-L2】
2. **Expansion-pack specialists depend on absent assets.** The research expansion agents (for example, `grant-application-writer`) require a full suite of NSFC tasks, templates, checklists, and data files that are missing from the repository, so their commands cannot execute. Build outputs surface each missing reference. 【F:expansion-packs/bmad-research-framework/agents/grant-application-writer.md†L60-L95】【174ab9†L35-L111】【7b96f6†L1-L2】【253856†L1-L2】
3. **Electron packaging omits mandatory service and data directories.** The desktop build configuration only bundles `main.js`, `preload.js`, and the renderer assets, but `main.js` dynamically loads the SaaS catalog/project services and expects the `bmad-core` and `expansion-packs` folders at runtime. A packaged app produced with this manifest will ship without the required modules and knowledge base, causing IPC handlers to throw `MODULE_NOT_FOUND` errors. 【F:desktop/electron/package.json†L18-L25】【F:desktop/electron/main.js†L1-L12】

### Major
4. **Desktop/SaaS coupling hard-codes repository layout.** The Electron main process resolves the project root with `path.resolve(__dirname, '..', '..')`, which assumes the packaged structure mirrors the source repository. If the builder ever relocates app files (e.g., ASAR packaging), these relative traversals will no longer reach the services or data directories even after they are bundled. Consider using `app.getAppPath()` and embedding knowledge assets explicitly. 【F:desktop/electron/main.js†L9-L12】

### Minor
5. **Build logs mask severity of missing assets.** `npm run build` and `npm run validate` succeed despite dozens of missing resource warnings, so CI/CD may report green builds while functionality is broken. Treat the missing dependency warnings as errors or add validation steps that fail when dependencies are absent. 【174ab9†L9-L111】【17b1c9†L1-L41】

## Test Execution Summary
| # | Command | Result |
|---|---------|--------|
| 1 | `npm run build` | ✅ Completed with missing-resource warnings (see Findings 1–2). 【e4e141†L1-L89】 |
| 2 | `npm run validate` | ✅ Completed with identical missing-resource warnings. 【17b1c9†L1-L41】 |
| 3 | `npm test` | ✅ Delegated to build + validate; reproduces warnings above. 【c9e9d0†L1-L83】 |
| 4 | `node tools/cli.js list:agents` | ✅ Lists available agents from the catalog service. 【e4e681†L1-L10】 |
| 5 | `node tools/cli.js list:expansions` | ✅ Confirms only one expansion pack is available. 【da1941†L1-L3】 |
| 6 | `node tools/cli.js upgrade --dry-run --project .` | ✅ Reports no migration needed for the current layout. 【6973e0†L1-L3】 |

## Recommendations
- Restore or replace all referenced task/template/checklist/data files, or adjust agent manifests to match the assets that actually ship.
- Update the Electron build manifest to include `services/saas`, `bmad-core`, `expansion-packs`, and any other runtime dependencies, and resolve modules via `app.getAppPath()` to remain packaging-agnostic.
- Tighten CI validation so that missing-resource warnings fail the build, preventing regressions from slipping into releases.
