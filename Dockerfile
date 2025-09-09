FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg dumb-init make gcc g++ python3 python3-dev python3-pip python3-venv

# 安装 Node.js 20（NodeSource 官方方式）
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# 安装 Yarn（官方仓库方式）
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
    && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
    && apt-get update && apt-get install -y yarn \
    && rm -rf /var/lib/apt/lists/*

ENV VENV=/opt/venv
RUN python3 -m venv $VENV
ENV PATH="$VENV/bin:$PATH"
# 3. 验证版本（可选）
RUN node -v && npm -v && yarn -v && python3 -V && pip3 -V
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

WORKDIR /app
COPY python/requirements.txt package.json yarn.lock /app
RUN pip3 install -r requirements.txt
RUN yarn install

COPY python /app/python
COPY lexicons /app/lexicons
COPY src /app/src
COPY public /app/public
COPY tsconfig.json /app/
RUN ls -al && yarn codegen && yarn build

EXPOSE 3001
ENV NODE_ENV=production
# potential perf issues w/ io_uring on this version of node
ENV UV_USE_IO_URING=0

CMD sh -c "uvicorn python.ocr:app > /tmp/ocr.log 2>&1 & yarn serve"
