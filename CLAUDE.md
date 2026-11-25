## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- flow:begin orchestration -->
### Orchestration

Build a spec with `/flow:build`: Matt's `/implement-spec` run on Orca workers, with models routed by `route.py` from the table in `docs/agents/orchestration.md`. A build milestone is a GitHub Milestone; the founder merges the integration PR. See `docs/agents/orchestration.md`.
<!-- flow:end orchestration -->
