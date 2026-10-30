#!/bin/sh
set -e
echo "extra_hosts:"
docker inspect usermoon-slot --format '{{json .HostConfig.ExtraHosts}}' 2>/dev/null || true
echo "host.docker.internal:"
docker exec usermoon-slot getent hosts host.docker.internal 2>/dev/null || echo missing
echo "mysql probe:"
docker exec usermoon-slot python3 -c 'import socket; s=socket.create_connection(("host.docker.internal",3306),3); s.close(); print("mysql_ok")' 2>&1 || true
