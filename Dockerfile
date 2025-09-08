FROM node:20.11-alpine3.18

RUN apk add --update dumb-init make gcc g++ python3
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

WORKDIR /app
COPY package.json yarn.lock /app
RUN yarn install
COPY lexicons /app/lexicons
COPY src /app/src
COPY public /app/public
COPY tsconfig.json /app/
RUN ls -al && yarn codegen && yarn build
EXPOSE 3001
ENV NODE_ENV=production
# potential perf issues w/ io_uring on this version of node
ENV UV_USE_IO_URING=0

CMD ["yarn", "serve"]
