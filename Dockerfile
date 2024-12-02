FROM node:20.11-alpine3.18

RUN apk add --update dumb-init

# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

WORKDIR /app
COPY package.json yarn.lock /app 
RUN yarn install
COPY . /app
EXPOSE 3001
ENV NODE_ENV=production
# potential perf issues w/ io_uring on this version of node
ENV UV_USE_IO_URING=0

CMD ["yarn", "start"]