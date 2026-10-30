#!/bin/sh
set -e
IFACE=$(ip route | awk '/default/ {print $5; exit}')
echo "iface=${IFACE}"
if [ -z "$IFACE" ]; then
  echo "no default iface"
  exit 0
fi

# Remove overly-broad DROP 3306 rules (would also block docker -> host MySQL)
while sudo iptables -C DOCKER-USER -p tcp --dport 3306 -j DROP 2>/dev/null; do
  sudo iptables -D DOCKER-USER -p tcp --dport 3306 -j DROP || break
done
while sudo iptables -C DOCKER-USER -p tcp --dport 3306 -i "$IFACE" -j DROP 2>/dev/null; do
  sudo iptables -D DOCKER-USER -p tcp --dport 3306 -i "$IFACE" -j DROP || break
done

# Only drop MySQL traffic arriving from the public NIC
sudo iptables -I DOCKER-USER -p tcp --dport 3306 -i "$IFACE" -j DROP
sudo iptables -L DOCKER-USER -n -v --line-numbers | head -20
echo MYSQL_HARDENED_OK
