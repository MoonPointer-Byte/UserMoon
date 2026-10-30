#!/bin/sh
echo "=== board ==="
curl -s http://127.0.0.1/api/board
echo
echo "=== http ==="
curl -s -o /dev/null -w "site:%{http_code}\n" http://127.0.0.1/UserMoon/
curl -s -o /dev/null -w "live:%{http_code}\n" http://127.0.0.1/live/
curl -s -o /dev/null -w "p18762:%{http_code}\n" http://127.0.0.1:18762/
echo "=== body head ==="
curl -s http://127.0.0.1:18762/ | head -c 400
echo
echo "=== containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo "=== slot procs ==="
docker exec usermoon-slot sh -c 'ps aux; echo ---; ss -lntp 2>/dev/null || netstat -lntp 2>/dev/null; echo ---app---; tail -n 50 /tmp/app.log; echo ---api---; tail -n 40 /tmp/ideaface-api.log' 2>&1
echo "=== mem ==="
free -h | head -2
