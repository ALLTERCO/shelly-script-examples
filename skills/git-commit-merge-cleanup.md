# Skill: Git Commit, Merge, Push, and Feature Cleanup

## Description
Use this skill when finalizing repository changes with the team workflow used in this project.

This skill enforces:
- branch from `dev`
- explicit user approval before commit/merge/push
- `--no-ff` merges
- delete all `feature/*` branches locally and remotely after merge flow is complete

---

## Workflow

### 1) Start from `dev` and create a feature branch
```bash
git checkout dev
git checkout -b feature/<short-description>
```

### 2) Ask before commit
Before asking, run a documentation check for touched areas and update docs if needed.

Minimum review set:
- `CHANGELOG.md` (add current month entry at top if change is not recorded)
- nearest folder `README.md` for changed scripts
- root/category `README.md` indexes when files are added/renamed/removed
- script header metadata (`@title`, `@description`, `@status`, `@link`) when behavior or path changed

Rule:
- If any of the above is outdated, update documentation first, then proceed to commit.

Use prompt:
- `Changes are ready. May I commit them?`

Then commit with the project message format:
```bash
git add <files>
git commit -m "$(cat <<'EOF'
Short summary (imperative mood, max 50 chars)

- Bullet point 1
- Bullet point 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### 3) Ask before merge feature -> dev
Use prompt:
- `Feature is ready and tested. May I merge to dev?`

Then merge:
```bash
git checkout dev
git merge feature/<short-description> --no-ff -m "Merge feature/<short-description> into dev"
```

### 4) Ask before push
Use prompt:
- `May I push dev to origin?`

Then push:
```bash
git push origin dev
```

### 5) Cleanup feature branches (required)
After successful push, remove feature branches both local and remote.

Delete local `feature/*` branches:
```bash
for b in $(git branch --format='%(refname:short)' | rg '^feature/'); do git branch -D "$b"; done
```

Delete remote `origin/feature/*` branches:
```bash
for rb in $(git ls-remote --heads origin 'refs/heads/feature/*' | awk '{print $2}' | sed 's#refs/heads/##'); do git push origin --delete "$rb"; done
```

Verify cleanup:
```bash
git branch --format='%(refname:short)' | rg '^feature/' || true
git ls-remote --heads origin 'refs/heads/feature/*'
```

---

## Guardrails
- Never commit, merge, or push without explicit user approval.
- Always use `--no-ff` when merging.
- Do not use destructive history rewrite commands (`reset --hard`, force-push) unless explicitly requested.
- If remote operations fail due to environment/network restrictions, rerun with required escalation/approval.
