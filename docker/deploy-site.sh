#!/bin/sh
set -e
cd ~/UserMoon
docker compose build app
docker compose up -d app
# free RAM: stop heavy showcase if idle/running overnight
docker rm -f usermoon-slot 2>/dev/null || true

# Harden MySQL published port against WAN (docker bridge / localhost still OK)
if [ -x "$(dirname "$0")/harden-mysql.sh" ]; then
  sh "$(dirname "$0")/harden-mysql.sh" || true
fi

sleep 4
echo "=== redirect ==="
curl -sI http://127.0.0.1/UserMoon | head -n 8
curl -sI http://127.0.0.1/ | head -n 5
echo "=== home ==="
curl -s -o /dev/null -w "home:%{http_code}\n" http://127.0.0.1/UserMoon/
curl -s http://127.0.0.1/api/board | head -c 200
echo
curl -s -o /dev/null -w "launch_no_auth:%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"id":"ideaface"}' http://127.0.0.1/api/launch
free -h | head -2
echo DEPLOY_OK
