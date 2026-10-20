#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "已生成 .env，请先改 MYSQL_PASSWORD 再重新执行。"
  exit 1
fi

docker compose pull || true
docker compose up -d --build
docker compose ps
echo "站点: http://$(curl -s ifconfig.me || echo '<服务器公网IP>')/UserMoon/"
