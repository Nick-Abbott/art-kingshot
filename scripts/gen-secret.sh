#!/usr/bin/env bash
# Usage: ./scripts/gen-secret.sh [length]
length="${1:-32}"
LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length"
echo
