# AGENTS.md

> **头部约定（对所有 Agent 生效，最高优先级）**
>
> - **输出语言：中文优先**。所有回复、说明、提交信息、注释建议均优先使用简体中文；代码、命令、标识符保持原样。
> - **提示与交互：中文优先**。向用户提问、汇报进度、错误说明均用中文；引用报错原文时保留原文并附中文解释。
> - 用户使用其他语言提问时，跟随用户语言，但文档与注释产出仍默认中文。

---

## 项目概述

基于 [atproto](https://atproto.com) 的 **Bluesky Feed Generator**（源自 bluesky-social/feed-generator starter kit），并扩展了中文内容流过滤、机器人识别、NSFW 复核与 Labeler 服务。

- **技术栈**: TypeScript + Express + `@atproto/xrpc-server`，SQLite（`better-sqlite3` + Kysely）
- **包管理**: Yarn 1（`yarn@1.22.22`），Node >= 18

## 常用命令

```bash
yarn build          # tsc 编译到 dist/
yarn start          # ts-node src/index.ts 开发运行
yarn serve          # node dist/index.js 生产运行
yarn codegen        # lexicons/*.json 生成 src/lexicon（lex gen-server）
yarn publishFeed    # 发布 feed generator
yarn anounceLabeler # 公告 labeler
yarn configLabeler / yarn unconfigLabeler   # 配置/取消配置 labeler
yarn unpublishFeed  # 下线 feed generator
```

验证方式：`yarn build` 零错误即视为编译通过；运行 `yarn start` 后 XRPC 端点可响应。

## 目录结构

| 路径 | 说明 |
|---|---|
| `src/index.ts` | 入口，组装 firehose 订阅、服务与定时任务 |
| `src/server.ts` | XRPC/Express 服务 |
| `src/algos/` | feed 输出算法（如 whats-alf） |
| `src/methods/` | XRPC 方法：feed-generation、feed-interaction、labeler、mod-image-post、topic、outbox |
| `src/db/` | SQLite schema 与 migrations（Kysely） |
| `src/bw.ts` | 黑白名单（bot/nsfw 判定与缓存） |
| `src/subscription.ts` | Bluesky firehose 订阅入库 |
| `src/lexicon/` | 由 `yarn codegen` 生成，勿手改 |
| `lexicons/` | Lexicon JSON 定义（codegen 输入） |
| `scripts/` | labeler 发布/配置脚本 |
| `dbhome/` | 运行时数据库：`main.db`、`not.db`（gh actions 生成）、按日滚动 `bw{YYYYMMDD}.db` |

## 领域规则（重要，改动前必读）

详见 `README.md`，要点：

1. **内容过滤**：仅收中文内容（含汉字且不含日/韩字符，用 `\p{Script=Han}` 正则判断）；纯转引/回复转发过滤；机器人帖过滤。
2. **机器人判定**：最近 30 帖平均发帖间隔 < 1 小时，或外链占比 > 80% 判为 bot；结果写入 `bw{today}.db`。
3. **黑白名单**：值 `1=黑 / 0=白 / -1=未知`，缓存 7 天；查询顺序 bw{today} → 前 6 天的滚动库。
4. **NSFW 复核**：带图帖进复核流程，结合官方 mod 标签与 gh actions 人工审核，结果回写黑白名单。
5. **定时任务**：每小时清理 post/mod 库 12h 前数据、同步 not.db；每天删除 7 天前的 bw{date}.db。
6. **Labeler 服务**：基于 not.db 与 bw{date}.db 对外发布噪声用户/机器人/NSFW 标记，默认纯净版 feed。

## 编码约定

- 新增 XRPC 端点：先在 `lexicons/` 定义 JSON，再 `yarn codegen`，勿手改 `src/lexicon/`。
- 数据库结构变更走 `src/db/migrations.ts`，不要直接改线上 db 文件。
- 日志统一用 `src/logger.ts`（pino）。
- 中文判定正则保持与 README 中规则一致（含 Han 且不含 Hiragana/Katakana/Hangul）。
