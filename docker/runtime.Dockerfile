FROM docker.m.daocloud.io/library/node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Tencent CVM: Debian official apt is too slow from CN; use Tsinghua mirror.
RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g; s|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g; s|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl procps psmisc python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src
CMD ["sleep", "infinity"]
