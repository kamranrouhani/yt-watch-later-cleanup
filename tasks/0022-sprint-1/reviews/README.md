# Reviews

Every review for this task goes here, one file each, named
`YYYY-MM-DD-HHMM-<kind>.md` where kind is `pre-merge`, `security`,
`sprint` or similar. Never edited, never deleted, including the ones that
turned out wrong. A later review that overturns an earlier one says so.

## Required header

Fill every git value by running the command. Never type a hash from memory.

```markdown
# Review: pre-merge

- **When:** YYYY-MM-DD HH:MM
- **Stage:** <which step of which plan>
- **Scope:** commits | uncommitted worktree | both
- **Branch:** <git rev-parse --abbrev-ref HEAD>
- **Base:** main @ <git merge-base HEAD main, short>
- **Head:** <git rev-parse --short HEAD>
- **Commits reviewed:**
  - <git log --oneline $(git merge-base HEAD main)..HEAD>
- **Reviewer:** self
```

For uncommitted work, also record `git status --porcelain`,
`git diff --stat`, and the hash from `git stash create` as
**Worktree snapshot**.

## What every review checks

- each acceptance box in the issue, met or not, with evidence
- `git log --format=%B main..HEAD` has no attribution trailer or tool name
- no em or en dashes in changed files
- no comments addressed to a person, no commented-out code
- no secrets or unscrubbed captures in the diff
- task files and code in separate commits
- anything a test cannot see: manifest wiring, permissions, network origins
