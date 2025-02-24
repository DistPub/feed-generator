### feed数据源过滤

1. 不是回复，不是转发
2. 中文内容，未知内容语言则检测：需要包含汉语字符，不包含日语和韩语字符（排除日文和韩文）
3. 当作者是机器人，post不包含external，过滤掉
4. 当作者是机器人，post包含external链接，链接是社区类网站或非中国网站，过滤掉
5. 当post不包含图片，入post库
6. 当post包含图片，且post自身没有标记，进入nsfw复核流程
7. 定时任务：每隔1h删除post库12h前的内容

#### 内容检测规则

1. regex `/^(?=.*\p{Script=Han})(?!.*[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])[\s\S]*$/us`

#### 机器人判定规则

0. 查黑白名单bot，不在名单中则往下执行
1. get `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=did%3Aplc%3Ammbknffnysobiitlszjovm3w&filter=posts_no_replies&includePins=false&limit=30`
2. 获取到最近30条post
3. a=最远创建时间
4. b=最近创建时间
5. 计算平均间隔时间（单位：小时）=(b-a)/post数量/1000/60/60
6. 如果平均间隔时间小于1，判断为机器人，否则为正常人
7. 将判断结果存到bw{today}.db

### 黑白名单

包含对作者的分类信息，schema如下

|did|bot|nsfw|
|---|---|----|
|did:plc:xx|1|0|

>1=black 0=white -1=unkonwn

0. 查bw{today}.db，有结果则返回
1. 继续查bw{today-1}.db/.../bw{today-6}.db共6个sqlite文件
2. 有结果，将结果存到bw{today}.db，返回结果
3. 定时任务，每天执行1次，删除bw{today-7}.db

### 社区类网站或非中国网站黑名单

此类网站无法判定数据来源或数据来源于外国人，硬编码在pastebin，启动时加载到内存

e.g.
```
youtube.com
x.com
threads.net
```

0. 定时任务，每隔1h执行get pastebin

### nsfw复核流程

0. 查黑白名单nsfw，
1. 在黑白名单中（老用户），查官方mod标签机，刷新标记结果，入post库结束
3. 不在名单中（复活用户或新用户）则往下执行
4. 查官方mod标签机，有标记则为黑，存到bw{today}.db，入post库结束
5. 没有标记入mod库，由gh actions审核
6. 审核结果存到bw{today}.db
8. 从mod库复制数据到post库，然后删除mod库中数据

### report流程

1. 允许用户报告机器人和nsfw群体
2. 报告机器人则走`机器人判定规则`，按照不在名单中执行
3. 报告nsfw群体则走`nsfw复核流程`，按照不在名单中执行
