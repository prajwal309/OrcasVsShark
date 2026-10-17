#!/usr/bin/env bash
# Run with Git for Windows (Git Bash), not PowerShell's script interpreter.
set -euo pipefail

REPO_URL="https://github.com/prajwal309/OrcasVsShark.git"
BRANCH="main"
COMMIT_MESSAGE="${1:-Update Orcas vs Sharks game}"

# Resolve paths with Bash so Windows paths containing spaces work correctly.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$SCRIPT_DIR"

command -v git >/dev/null 2>&1 || {
    echo "Git is required. Run this script using Git Bash from Git for Windows." >&2
    exit 1
}

echo "Orcas vs Sharks - commit and push to GitHub"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
    git init -b "$BRANCH"
fi

# Avoid renaming an existing feature branch or publishing it as main.
CURRENT_BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
    echo "Expected branch '$BRANCH'; current branch is '${CURRENT_BRANCH:-detached HEAD}'." >&2
    echo "Switch to main when ready, then run this script again." >&2
    exit 1
fi

if CURRENT_REMOTE="$(git remote get-url origin 2>/dev/null)"; then
    if [[ "$CURRENT_REMOTE" != "$REPO_URL" ]]; then
        echo "Origin differs from the expected repository: $CURRENT_REMOTE" >&2
        echo "Update origin yourself if appropriate, then run this script again." >&2
        exit 1
    fi
else
    git remote add origin "$REPO_URL"
fi

if [[ -n "$(git ls-files --unmerged)" ]]; then
    echo "Resolve existing merge conflicts before running this script." >&2
    exit 1
fi

echo "Staging all non-ignored changes..."
git add -A

if git diff --cached --quiet; then
    echo "No new changes to commit. Checking for commits to push..."
else
    git commit -m "$COMMIT_MESSAGE"
fi

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
    echo "No commits exist yet. Add project files and run this script again." >&2
    exit 1
fi

# Fetch errors stop the script; never force-push or hide authentication failures.
git fetch origin
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    git rebase "origin/$BRANCH"
fi

git push -u origin "$BRANCH"
echo "Done: https://github.com/prajwal309/OrcasVsShark"
