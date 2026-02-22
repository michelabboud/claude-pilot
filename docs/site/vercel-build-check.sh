#!/bin/bash
# Vercel Ignored Build Step — only build when docs/site/ actually changes.
# Cuts ~60% of infrastructure cost by skipping redundant builds.
#
# Exit codes (Vercel convention):
#   0 = skip build (no relevant changes)
#   1 = proceed with build (changes detected)

# 1. Skip all non-production deployments (PR previews, dev branches)
if [ "$VERCEL_ENV" != "production" ]; then
  echo "Skip: non-production environment ($VERCEL_ENV)"
  exit 0
fi

# 2. Always build on first deployment (no previous SHA to compare)
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  echo "Build: first deployment"
  exit 1
fi

# 3. Fetch enough git history to compare against previous deployment
git fetch --deepen=100 2>/dev/null || true
git fetch origin "$VERCEL_GIT_PREVIOUS_SHA" --depth=1 2>/dev/null || true

# 4. If previous SHA is unreachable, build as a safety fallback
if ! git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA" 2>/dev/null; then
  echo "Build: previous SHA unreachable, building as fallback"
  exit 1
fi

# 5. Check if docs/site/ changed since the last successful deployment
if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- docs/site/; then
  echo "Skip: no changes in docs/site/"
  exit 0
else
  echo "Build: docs/site/ changed"
  exit 1
fi
