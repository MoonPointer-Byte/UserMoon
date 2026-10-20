FROM docker.1ms.run/library/python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xz-utils procps psmisc \
  && curl -fsSL https://cdn.npmmirror.com/binaries/node/v20.19.5/node-v20.19.5-linux-x64.tar.xz -o /tmp/node.tar.xz \
  && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
  && rm /tmp/node.tar.xz \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src
CMD ["sleep", "infinity"]
