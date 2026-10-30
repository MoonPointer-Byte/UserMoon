#!/bin/sh
set -e
cd ~/UserMoon

# ensure mysql published on all interfaces
docker compose up -d mysql
sleep 2
docker port usermoon-mysql-1 || true

# clear stuck board / slot
curl -s -X POST http://127.0.0.1/api/stop -H 'Content-Type: application/json' -d '{"visitor":"ops"}' || true
sleep 2
docker rm -f usermoon-slot 2>/dev/null || true

# relaunch
curl -s -X POST http://127.0.0.1/api/launch \
  -H 'Content-Type: application/json' \
  -d '{"id":"ideaface","visitor":"ops"}'
echo
sleep 6

# probe mysql from new slot
if docker inspect usermoon-slot >/dev/null 2>&1; then
  echo "probe:"
  docker exec usermoon-slot getent hosts host.docker.internal || true
  docker exec usermoon-slot python3 -c 'import socket; s=socket.create_connection(("host.docker.internal",3306),3); s.close(); print("mysql_ok")' || echo "mysql_fail"
fi

curl -s http://127.0.0.1/api/board
echo
