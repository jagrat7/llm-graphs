#!/usr/bin/env bash
# Worktree setup: symlink the main checkout's gitignored env files into this
# worktree, then install dependencies. Env files stay real files in the main
# checkout, so editing one there updates every worktree.
set -euo pipefail

worktree=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
# The first entry of `git worktree list` is always the main checkout.
root=${T3CODE_PROJECT_ROOT:-$(git -C "$worktree" worktree list --porcelain | sed -n '1s/^worktree //p')}

# Running in the main checkout itself would link files onto themselves.
if [ "$root" != "$worktree" ]; then
  while IFS= read -r -d '' file; do
    case "${file##*/}" in
      *.example | *.sample | *.template | *.dist) continue ;;
      .env | .env.* | .dev.vars) ;;
      *) continue ;;
    esac
    source="$root/$file"
    target="$worktree/$file"
    # Only a symlink is ever replaced, so a real file in the worktree is kept.
    if [ -e "$target" ] && [ ! -L "$target" ]; then continue; fi
    mkdir -p "$(dirname "$target")"
    ln -sfn "$source" "$target"
    echo "Linked $file"
  done < <(git -C "$root" ls-files --others --ignored --exclude-standard --directory -z)
fi

cd "$worktree"
bun install
