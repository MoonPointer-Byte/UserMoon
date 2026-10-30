#!/bin/sh
set -e
mkdir -p /src/.runtime/moonreader/novels /src/.runtime/moonreader/avatar /src/.runtime/m2
if ! command -v redis-server >/dev/null 2>&1; then
  echo "安装 Redis…"
  apt-get update
  apt-get install -y --no-install-recommends redis-server
fi
if ! redis-cli ping >/dev/null 2>&1; then
  redis-server --daemonize yes --bind 127.0.0.1 --protected-mode yes
fi
if [ ! -x /src/.runtime/jdk/bin/java ]; then
  echo "准备 JDK 21…"
  if [ ! -s /src/.runtime/jdk.tgz ]; then
    curl -fL --retry 3 -A "Mozilla/5.0" -o /src/.runtime/jdk.tgz https://repo.huaweicloud.com/openjdk/21.0.2/openjdk-21.0.2_linux-x64_bin.tar.gz
  fi
  rm -rf /tmp/jdk-extract
  mkdir -p /tmp/jdk-extract
  tar -xzf /src/.runtime/jdk.tgz -C /tmp/jdk-extract
  rm -rf /src/.runtime/jdk
  mv /tmp/jdk-extract/jdk-* /src/.runtime/jdk
fi
export JAVA_HOME=/src/.runtime/jdk
export PATH=$JAVA_HOME/bin:$PATH
export MAVEN_USER_HOME=/src/.runtime/m2
export MVNW_REPOURL=https://maven.aliyun.com/repository/public
if [ ! -f /src/.runtime/m2/settings.xml ]; then
  cat > /src/.runtime/m2/settings.xml << 'EOF'
<settings>
  <mirrors>
    <mirror>
      <id>aliyun</id>
      <mirrorOf>*</mirrorOf>
      <url>https://maven.aliyun.com/repository/public</url>
    </mirror>
  </mirrors>
</settings>
EOF
fi
export SERVER_PORT=8081
export SPRING_DATASOURCE_URL='jdbc:mysql://host.docker.internal:3306/xs?createDatabaseIfNotExist=true&serverTimezone=Asia/Shanghai&useUnicode=true&characterEncoding=utf-8'
export SPRING_DATASOURCE_USERNAME=root
export SPRING_DATASOURCE_PASSWORD="${MYSQL_PASSWORD:-usermoon}"
export SPRING_DATA_REDIS_HOST=127.0.0.1
export SPRING_DATA_REDIS_PORT=6379
export APP_NOVEL_PATH=/src/.runtime/moonreader/novels/
export APP_UPLOAD_PATH=/src/.runtime/moonreader/avatar/
cd /src/MoonReader/XS_backend
sed -i 's/\r$//' mvnw
if [ ! -f target/XS-0.0.1-SNAPSHOT.jar ]; then
  echo "第一次编译 MoonReader 后端…"
  sh ./mvnw -DskipTests package
fi
echo "启动 MoonReader 后端…"
java -jar target/XS-0.0.1-SNAPSHOT.jar > /tmp/moonreader-api.log 2>&1 &
ok=0
i=0
while [ "$i" -lt 400 ]; do
  if python3 -c 'import socket,sys; s=socket.create_connection((sys.argv[1], int(sys.argv[2])), 2); s.close()' 127.0.0.1 8081; then
    ok=1
    break
  fi
  i=$((i+1))
  sleep 0.4
done
if [ "$ok" -ne 1 ]; then
  echo "MoonReader 后端没有在 8081 端口起来"
  tail -n 120 /tmp/moonreader-api.log
  exit 1
fi
cd /src/MoonReader/XS_frontend/frontend
export MOONREADER_API=http://127.0.0.1:8081
if [ ! -x node_modules/.bin/vite ]; then npm install; fi
exec npx vite --host 0.0.0.0 --port 8080
