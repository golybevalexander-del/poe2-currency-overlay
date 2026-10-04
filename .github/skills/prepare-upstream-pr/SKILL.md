---
name: prepare-upstream-pr
description: Opt-in preparation of one upstream-ready contribution and an optional draft PR to POE2-VibeTools/poe2-currency-overlay. Use only when the user explicitly requests upstream contribution work, never after ordinary fork merges.
---

# Explicit opt-in gate

This skill is separate from `create-fork-pr`. A fork PR, fork merge, release,
maintenance run, or automatic skill match does not authorize upstream work.
If there is no explicit user request to prepare an upstream contribution,
stop without editing, branching, committing, pushing or creating a PR.

Distinguish three permissions:

1. **Assessment only**: compare and recommend; make no source or Git mutations.
2. **Preparation**: work on the user's approved contribution scope and dedicated
   local branch, preserving dirty work. No publication is implied.
3. **Publication**: explicitly authorized commit, fork-branch push and upstream
   draft PR creation/update. Ask once if these actions were not authorized.

Selecting/loading the skill is not publication permission. Never create a
recurring job, post-merge hook or automatic upstream draft. Do not publish an
installer, push upstream, auto-merge, reopen a closed PR, mark a draft ready
or change branch protection without separate authorization.

The supported frontmatter deliberately contains no invented opt-in flag or
pre-approved tools. The instruction gate applies even if the host loads it
automatically. For an additional host-level switch, the user can disable this
skill in the Copilot CLI `/skills` menu and enable it when needed. Do not alter
host settings on the user's behalf merely because this file was added.

# Verify the contribution context

Read repository instructions, `docs\DIRECT-BARTER.md`, the actual implementation,
and `.github\skills\adapt-direct-barter-ui\SKILL.md`. Determine the current
checkout root with `git rev-parse --show-toplevel`; inspect status, staged and
untracked work, branch, origin and every push URL first. Never publish its
absolute machine-specific path.

There are two distinct repositories:

- **Head/push repository**: `golybevalexander-del/poe2-currency-overlay`.
- **PR base repository**: `POE2-VibeTools/poe2-currency-overlay`.

Unlike the fork-publication skill, an authorized PR here intentionally targets
upstream. Git pushes still go only to the user's verified fork.

Read upstream contribution instructions and PR templates if present, README,
license, recent maintainer release notes, and relevant existing PRs/issues.
Verify actual current upstream default branch and release/tag commit; never
assume `master`, the fork's default branch, or a package version establishes
the upstream base. Use explicit repository arguments:

```powershell
# Run from the current repository root.
git status --short
git branch --show-current
git remote -v
git remote get-url --push --all origin
gh auth status --hostname github.com
gh repo view POE2-VibeTools/poe2-currency-overlay --json nameWithOwner,defaultBranchRef,url
gh repo view golybevalexander-del/poe2-currency-overlay --json nameWithOwner,isFork,parent,defaultBranchRef,url
```

Check exit codes and verify the fork parent/authenticated account. Never print
tokens, change accounts, or silently rewrite remotes. Fetch only the verified
refs needed for the comparison; do not merge them automatically. Inspect
`git merge-base`, committed divergence and the actual three-dot PR diff,
as well as unstaged/untracked work. If no safe shared base or clean preservation
strategy exists, stop and explain it. Never automatically stash/reset/rebase
or move the user's dirty feature checkout onto another branch.

# Prepare one coherent contribution

Propose a focused change against the verified upstream base, not a dump of the
fork's default branch. Obtain scope and branch approval before source/Git
mutations. When safe and authorized, create a dedicated branch in the fork,
for example `contribute/direct-barter`, from the agreed upstream commit.
Do not repurpose the ongoing fork PR branch or overwrite its history.

Separate changes the upstream app can reuse from fork-specific changes:

- Reconcile the tab/provider/scanner/service with the current upstream design,
  IPC, settings, localization, parser/icon facilities and tests. Follow the
  real integration map, not a wholesale copy of obsolete renderer files.
- Preserve historical-only raw-pair membership, unknown/zero-volume endpoints,
  completed 3/24-hour coverage, separate per-row Exalted valuation/provenance,
  Buy/Sell ratios, search numeric exactness, contextual capture, clear races
  and truthful errors. Do not imply current offer availability.
- Do not transplant fork branding, package/repository identity, fork profile
  selection, upstream-config migration exclusions, disabled upstream updater/
  reporting controls or local publication settings blindly. Keep upstream's
  intended app identity and existing user profiles intact in the proposed
  upstream version. Resolve integration conflicts with the user rather than
  weakening fork isolation on the fork branch.
- Treat tutorial dismissal and shared icon repairs as coupled fixes only when
  appropriate to the approved contribution. Split unrelated fixes if upstream
  review would be clearer. Include maintenance agents/skills only if requested
  and suitable for upstream; fork-only publication instructions normally stay
  in the fork.
- Retain upstream attribution, GPL-3.0-or-later and vendored MIT notices.

Update focused tests/docs and run the actual available test/build/localization
commands from the current manifests and adaptation skill. Keep the manual
checklist, actual results and limitations. Never kill the user's app or reset
profiles to make a smoke test pass. DOM/IPC verification is not an in-game test.

# One draft per contribution, not per fork update

Before authorized publication, search upstream's existing PRs by verified head
owner/branch and inspect base/head/state/draft:

```powershell
gh pr list --repo POE2-VibeTools/poe2-currency-overlay --state all --head '<approved-head>' --json number,url,state,isDraft,baseRefName,headRefName,headRepositoryOwner,headRepository
```

`gh pr list --head` does not accept owner:branch syntax. Verify head
repository/owner in the returned live details; a branch-name match alone is not
enough. Look for an existing PR for the same contribution even if its branch
differs.

- No matching contribution: create one draft only with explicit publication
  authorization.
- Existing open draft: update the same approved branch/PR; do not duplicate it.
  Updating title/body and adding commits need appropriate authorization.
- Existing ready PR: do not convert its state or expand its scope automatically.
- Closed/merged contribution: report the history. A genuinely new follow-up
  needs a new approved scope/branch, not an automatic replacement draft.

Review exact paths/hunks and final base-to-head diff before committing. Preserve
unrelated staged changes; never `git add .`, force-push, or include profiles,
logs, caches, credentials, runtime downloads or private screenshots. Follow
the scope, public-content privacy, staging, author/trailer and safe push gates in
`.github\skills\create-fork-pr\SKILL.md`, but **not its fork-only PR destination**.
Push the approved head branch only to verified fork `origin`.

In a standalone CLI environment that permits this operation, the explicit
authorized creation command is:

```powershell
gh pr create --repo POE2-VibeTools/poe2-currency-overlay --base '<verified-upstream-base>' --head 'golybevalexander-del:<approved-head>' --draft --title '<reviewed title>' --body-file '<reviewed body file>'
```

Respect the host's native PR creation/update requirements. In the Copilot app,
`create_pull_request` is restricted to its current session repository/head:
the existing fork session cannot target upstream through that tool. Do not
probe it or bypass the restriction with CLI publication. Explain the limitation
and stop until the user has an appropriate supported publication context.
Never create a fork PR and present it as an upstream draft.

# Body and verification

Use the main-repository writing style defined in `create-fork-pr`: short
subsystem title, practical feature bullets, actual checks and clear limitations.
Follow upstream's PR template when present. Explain that this is a focused
proposal extracted from the fork, mention the verified upstream base and any
remaining review decisions, and avoid requesting adoption of fork-only branding
or policies. No copied test claims or private diagnostics.

After an authorized operation, verify live URL, OPEN state, draft state, base
repository/ref and fork head repository/ref/SHA. Report the link, precise scope,
actual checks and remaining blockers. Keep the draft until the user explicitly
asks to mark it ready. Do not merge or open further PRs automatically.
