#!/usr/bin/env bash
# Script to launch local development server for Pogranichny 2118 Reader Interface
PORT=8002
echo "=========================================================="
echo " Starting Pogranichny 2118 (LOGOS-3) Web Reader Interface"
echo " Open in your browser: http://localhost:$PORT/"
echo "=========================================================="
python3 scripts/dev_server.py "$PORT"
