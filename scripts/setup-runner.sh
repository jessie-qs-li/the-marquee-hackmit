#!/usr/bin/env bash
# Install a self-hosted GitHub Actions runner for this repository.
#
# Cinema Village refuses GitHub's shared runner addresses, so the refresh job
# loses ~80 showtimes on every scheduled run. A runner on your own machine
# presents an ordinary residential address and the venue answers it.
#
# Usage:
#   1. Open https://github.com/jessie-qs-li/the-marquee-hackmit/settings/actions/runners/new
#      and copy the registration token it shows (starts with A..., valid one hour).
#   2. bash scripts/setup-runner.sh <TOKEN>
#
# The token is only passed to GitHub's own config script; nothing is written to
# the repository. Re-running is safe: it removes any existing registration first.
set -euo pipefail

REPO_URL="https://github.com/jessie-qs-li/the-marquee-hackmit"
LABEL="marquee-local"
DIR="$HOME/.github-runner-marquee"

TOKEN="${1:-}"
if [ -z "$TOKEN" ]; then
  echo "Usage: bash scripts/setup-runner.sh <REGISTRATION_TOKEN>"
  echo "Get one from: $REPO_URL/settings/actions/runners/new"
  exit 1
fi

case "$(uname -m)" in
  arm64|aarch64) ARCH="osx-arm64" ;;
  x86_64)        ARCH="osx-x64"   ;;
  *) echo "Unsupported architecture: $(uname -m)"; exit 1 ;;
esac

VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
  | sed -n 's/.*"tag_name": *"v\([^"]*\)".*/\1/p' | head -1)"
[ -n "$VERSION" ] || { echo "Could not determine the latest runner version."; exit 1; }
echo "Runner v$VERSION for $ARCH"

mkdir -p "$DIR" && cd "$DIR"
if [ ! -x ./config.sh ]; then
  curl -fsSL -o runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${VERSION}/actions-runner-${ARCH}-${VERSION}.tar.gz"
  tar xzf runner.tar.gz && rm runner.tar.gz
fi

# a re-run should replace the old registration rather than stack a second one
./config.sh remove --token "$TOKEN" >/dev/null 2>&1 || true
./config.sh --unattended --replace \
  --url "$REPO_URL" --token "$TOKEN" \
  --name "$(scutil --get ComputerName 2>/dev/null || hostname)-marquee" \
  --labels "$LABEL" --work _work

# run as a login service so it survives reboots and picks up missed schedules
./svc.sh install >/dev/null
./svc.sh start

echo
echo "Runner installed at $DIR and started."
echo "Last step, in the repository settings:"
echo "  Settings -> Secrets and variables -> Actions -> Variables -> New repository variable"
echo "  Name: RUNNER_LABEL      Value: $LABEL"
echo
echo "Until that variable exists the job keeps using GitHub's runners, so"
echo "nothing breaks in the meantime."
echo "Stop it any time with:  cd $DIR && ./svc.sh stop"
