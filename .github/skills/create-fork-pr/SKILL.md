---
name: create-fork-pr
description: Prepare and, only with explicit publishing authorization, commit reviewed paths and open or update a pull request in golybevalexander-del/poe2-currency-overlay, never its upstream.
---

# Authorization and destination

The only publication destination is
`https://github.com/golybevalexander-del/poe2-currency-overlay`.
`POE2-VibeTools/poe2-currency-overlay` is read-only upstream.
Authoring this skill, asking for a plan/draft, or invoking maintenance is NOT
authorization to commit, push or open/update a PR.

Before mutation, establish explicit current-task authorization covering the
reviewed scope and commit/push/PR actions. If missing, do read-only preflight,
explain the proposed destination/scope, ask once for permission, then stop at
that boundary. Separate authorization is needed to edit an existing PR if
that action was not requested. Never auto-merge, publish installers/releases,
change branch protection, create hooks/automations, or reset profiles. Do not
force-push except for an explicitly authorized, scoped privacy repair under the
public-content gate below.

# Read-only preflight

Use PowerShell from the current repository root, determined with
`git rev-parse --show-toplevel`. Do not hardcode a machine-specific checkout.
Read repository
instructions, `docs\DIRECT-BARTER.md`, `README.md`, `PRIVACY.md`, `LICENSE`,
`renderer\vendor\ee2\LICENSE` and manifests, and inspect ALL intended changes.

```powershell
# Run from the current repository root.
git status --short
git branch --show-current
git remote -v
git remote get-url --all origin
git remote get-url --push --all origin
git --no-pager diff --stat
git --no-pager diff
git --no-pager diff --cached
git ls-files --others --exclude-standard
gh auth status --hostname github.com
gh repo view golybevalexander-del/poe2-currency-overlay --json nameWithOwner,isFork,parent,defaultBranchRef,url
```

Verify `nameWithOwner`, URL and parent match the expected fork relationship.
Check the authenticated account can publish to this fork without exposing tokens
or changing accounts. No `gh auth token`, credentials in URLs, or secret output.
Missing auth/repository access is a blocker, not permission to switch accounts.
Confirm every fetch/push URL and branch tracking ref; remote names alone prove
nothing. Reject upstream/unknown/multiple unintended push destinations. If
`origin` is not the fork, stop and ask rather than silently rewriting remotes.

Resolve the target from the fork's **live `defaultBranchRef.name`**, unless the
user explicitly specifies a different fork base. It is currently `master`,
but must never be hardcoded as the default. Verify the head is the reviewed
non-default feature/reconciliation branch, not detached HEAD or another
session's branch. Do not create or switch branches under dirty user work.

Example after validating the repository result:

```powershell
$fork = 'golybevalexander-del/poe2-currency-overlay'
$base = gh repo view $fork --json defaultBranchRef --jq '.defaultBranchRef.name'
$head = git branch --show-current
```

Check exit codes and nonempty branch names before using these variables.
Confirm the workspace-selected/app-tracked target and `$base` agree; if they
do not, ask rather than guessing a recovery target.

# Ancestry and scope gate

Fetch the necessary fork base ref only after the remote is verified:
`git fetch origin $base`. Fetch only explicitly identified upstream refs if
release provenance needs verification; this is not authorization for a merge.
Inspect:

```powershell
$baseRef = "refs/remotes/origin/$base"
git merge-base $baseRef HEAD
git rev-list --left-right --count "${baseRef}...HEAD"
git --no-pager log --oneline "${baseRef}..HEAD"
git --no-pager diff --stat "${baseRef}...HEAD"
git --no-pager diff "${baseRef}...HEAD"
```

These describe committed divergence; separately review staged, unstaged and
untracked files. Determine actual upstream release/tag SHA and previously
imported base for a reconciliation PR. A version bump is not proof of import.
If the eventual PR would include unrelated history, a broad upstream merge,
unexpected binary/generated churn, or edits the user did not authorize, explain
it and stop. Do not silently rebase/reset/cherry-pick to hide the problem.

Build an explicit reviewed path/hunk allowlist. Do not `git add .` or `git add -A`.
Preserve other staged edits: if the index contains unrelated work, stop and
ask how to isolate it instead of unstaging it without permission. Inspect
untracked directory contents before staging a directory. Exclude credentials,
cookies, tokens, player clipboard/account data, provider cache files, downloaded
runtime archives, app profiles, logs, screenshots and session scratch artifacts.
Check `.gitignore`, manifests, licensing/attribution and privacy guards.

# Public-content privacy gate

Treat the repository and its PRs as publicly readable unless live visibility
verification proves otherwise. Even private repositories must not embed
machine-specific personal details merely for convenient local instructions.

Before staging, inspect all proposed source, docs, skills, tests, commit messages
and PR text for hardcoded local information, not just credentials:

- Absolute checkout/home/runtime paths and local usernames.
- Assistant session identifiers, scratch directories, downloaded tool locations
  and local attachment/screenshot paths.
- App profile/cache contents, private logs, clipboard/account data and tokens.

Use repository-relative commands, public repository URLs and generic environment
variables such as `$env:APPDATA` where needed. Keep actual private runtime
locations in local settings or excluded scratch files. Do not copy a terminal
transcript or session launch instructions wholesale into public documentation.
Inspect Markdown links and screenshots too; generic placeholders must not
silently retain private path targets.

Check the staged snapshot, untracked files selected for publication and every
commit in the outgoing base-to-head range. Searching only the latest diff or
`.gitignore` is insufficient: earlier commits may retain removed information.
Search for absolute Windows drive/home paths, Unix home directories and known
local session/user markers, then inspect matches without posting them publicly.
Repeat against the exact PR title/body before creating or updating it, and
verify the resulting live text.

If private paths/data have already been pushed, report the affected publication
surfaces without repeating those details. Removing them in a follow-up commit
does not remove them from history. Obtain explicit authorization before
amending/rebasing and force-pushing; never rewrite the default branch silently.
For an authorized feature-branch repair, confirm the exact expected remote head
and use a narrowly scoped `--force-with-lease`, not unrestricted `--force`.
Do not claim that rewritten history erases existing clones, PR events or cached
GitHub objects; sensitive-data exposure may require GitHub Support and credential
rotation where relevant.

Run actual relevant commands from `package.json` and the current
`adapt-direct-barter-ui` skill/checklist, including feature tests, item build,
localization and `git diff --check` where applicable. Record the actual results,
not previous-session assumptions; instruction-only changes need format/reference
validation, not a claimed application regression run.

# Authorized staging, commit and fork-only push

Only after scope and publication approval:

1. Stage precise reviewed paths or approved hunks:
   `git add -- <reviewed-path-1> <reviewed-path-2>`.
   Inspect `git diff --cached --name-status`, `git diff --cached`,
   `git diff --cached --check`. Confirm no unrelated staged changes remain.
2. Commit with a focused message and this final trailer unless the user opts out:

   ```text
   Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
   ```

   Use a reviewed commit-message file outside the repo when needed:
   `git commit -F <message-file>`. No amend unless separately requested.
3. Recheck the final fork-base-to-HEAD diff/log, current branch and all push
   URLs immediately before pushing. Stop if scope/destination changed.
   Push only the reviewed feature head:
   `git push --set-upstream origin "HEAD:refs/heads/$head"`.
   Never push a default branch, use `--all/--mirror/--force`, or push upstream.
   A privacy repair uses only its separately approved, exact-head lease.

# PR creation or authorized update

Query existing open PRs in the **fork**, explicitly:

```powershell
gh pr list --repo $fork --state open --head $head --json number,url,title,baseRefName,headRefName
gh pr list --repo $fork --state all --head $head --json number,url,state,title,baseRefName,headRefName
```

Confirm the actual head owner/repository with live PR details
(`headRepositoryOwner` and `headRepository`) if results are ambiguous. If a matching
PR exists, inspect its live base/head/state/title/body, and update only authorized
fields; do not create a duplicate. If a matching head has only closed/merged PRs,
report that history and confirm whether a new PR is intended. Never reopen or
retarget automatically. Respect concurrent edits and runtime guarded-update
tools when available.

Write the body to a reviewed file outside the repository, then create a PR with
an explicit fork, verified base and reviewed head in a standalone CLI environment:

```powershell
gh pr create --repo golybevalexander-del/poe2-currency-overlay --base $base --head $head --title '<reviewed title>' --body-file '<reviewed body file>'
```

Never omit `--repo` and let `gh` select the upstream parent.
If the Copilot host requires its native `create_pull_request` tool for the
current workspace, use that tool instead of the CLI. Verify that the current
session repository/head is this fork and that its selected base is correct
first; the tool cannot target another repository/head. Include a base override
only when established by the user's intended target. If unavailable or scope
mismatched, stop; do not bypass host restrictions. In this host, edits to a PR
title/body use `update_pull_request` rather than `gh pr edit`.

# Writing style: match the main repository

Use the upstream maintainer's own release notes, README and commit prose as the
style reference, not third-party automated dependency/security PRs. Read recent
examples when preparing a new PR. Write like a short, practical changelog:

- Title: subsystem followed by the meaningful change, for example
  `Direct Barter: recorded exchanges, Buy/Sell and item capture`.
- Lead with what the user can do, not the implementation process or approval
  history: `Direct Barter: pick an item and see what it was directly exchanged
  with in your league.`
- Use short feature bullets, plain words and real item names. Explain behavior
  and relevant edge cases rather than enumerating every module or requirement.
- Group supporting details under compact bold labels such as `Historical, not
  live`, `Fork isolation`, `Maintenance` and `Checked`, only where useful.
  Avoid lengthy audit-style sections, repeated scope statements and marketing.
- Keep actual checks, limitations and manual-review links. Distinguish prior
  checks from fresh runs and DOM/IPC checks from visual/in-game verification.
  A concise body must not hide failures or advertise executable live offers.
- Include release/base provenance when relevant, but keep raw diagnostics,
  exhaustive check output and path inventories out of the body.

Preserve this writing style when updating an existing PR; do not expand it back
into a verbose implementation report. An example is a shape to follow, not
permission to copy test results or claim behavior without checking it.

The reviewed body must still cover:

- Scope and meaningful changes, preserving historical-only direct membership
  and independent per-ONE-row-item valuation; no claimed live order book.
- Actual validation commands/results, failed/blocked checks and real limitations.
- Windows launch/restart and a link to `docs/DIRECT-BARTER.md` manual review.
- Verified upstream release tag/commit and imported base when applicable.
- Fork-profile/update/report isolation and attribution/licensing when relevant.

No secrets, download/auth tokens, raw private logs or unsupported claims in the
body. Inspect the result with `gh pr view --repo $fork <number> --json url,state,baseRefName,headRefName`.
Verify the returned URL belongs to the fork, not upstream, and report it as a
clickable link plus branch/base, commit, checks and remaining review work.
Do not merge or publish anything further.
