# Cursor Cloud Agent base image for ExpiryMate.
# Paths in environment.json are relative to `.cursor/`.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:/usr/local/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    iptables \
    jq \
    openssh-client \
    python3 \
    sudo \
    fuse-overlayfs \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 (matches apps/api Dockerfile)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@9.15.0 --activate

# Docker (for local Postgres via compose)
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl --retry 3 --retry-delay 5 -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
      docker-ce=5:28.5.2-1~ubuntu.24.04~noble \
      docker-ce-cli=5:28.5.2-1~ubuntu.24.04~noble \
      containerd.io \
      docker-buildx-plugin \
      docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/docker \
    && printf '%s\n' '{' '  "storage-driver": "fuse-overlayfs"' '}' > /etc/docker/daemon.json \
    && update-alternatives --set iptables /usr/sbin/iptables-legacy \
    && update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy \
    || true

RUN id -u ubuntu >/dev/null 2>&1 || useradd -m -s /bin/bash ubuntu \
    && groupadd -f docker \
    && usermod -aG docker ubuntu \
    && usermod -aG sudo ubuntu \
    && echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu \
    && echo "PasswordAuthentication no\nChallengeResponseAuthentication no\nUsePAM no" \
      > /etc/ssh/sshd_config.d/disable_password_auth.conf

USER ubuntu
WORKDIR /home/ubuntu
