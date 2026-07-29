#!/bin/bash
echo '{"method": "graph", "id": 1}' | /Users/ghchinoy/projects/watcher/daemon/watcher-daemon /Users/ghchinoy/projects/best-practices > /tmp/daemon_out.txt 2> /tmp/daemon_err.txt
echo "Exit Code: $?"
cat /tmp/daemon_err.txt
