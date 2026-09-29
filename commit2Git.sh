#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/prajwal309/OrcasVsShark.git"
BRANCH="main"
COMMIT_MESSAGE="${1:-Update Orcas vs Sharks game}"

echo "🦈🐋 Orcas vs Sharks — GitHub deploy"
echo "-----------------------------------"

# Make sure we're inside a Git repository
if [[ ! -d ".git" ]]; then
    echo "Initializing Git repository..."
    git init
fi

# Ensure we're using main
git branch -M "$BRANCH"

# Add or correct the GitHub remote
if git remote get-url origin >/dev/null 2>&1; then
    CURRENT_REMOTE="$(git remote get-url origin)"

    if [[ "$CURRENT_REMOTE" != "$REPO_URL" ]]; then
        echo "Updating origin:"
        echo "  $CURRENT_REMOTE"
        echo "  -> $REPO_URL"
        git remote set-url origin "$REPO_URL"
    fi
else
    echo "Adding GitHub remote..."
    git remote add origin "$REPO_URL"
fi

echo
echo "Repository:"
git remote -v

echo
echo "Adding files..."
git add -A

# Exit gracefully if there is nothing new to commit
if git diff --cached --quiet; then
    echo "No changes to commit."
else
    echo "Creating commit..."
    git commit -m "$COMMIT_MESSAGE"
fi

echo
echo "Pushing to GitHub..."

# If this is an empty/new remote repository, normal push works.
# If remote already has commits, fetch first and reconcile.
git fetch origin "$BRANCH" 2>/dev/null || true

if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    git pull --rebase origin "$BRANCH"
fi

git push -u origin "$BRANCH"

echo
echo "✅ Done!"
echo "https://github.com/prajwal309/OrcasVsShark"