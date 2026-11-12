#!/usr/bin/env bash
set -euo pipefail
mkdir -p dist
ares-package app -o dist/
ls dist/com.apos.launcher_*.ipk
