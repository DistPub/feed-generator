### feed数据源过滤

1. 回复，转发，引用没有发表text和media就是纯引用相当于转发，过滤掉
2. 中文内容（语言不包含日语和韩语，因为这两种语言有些字符会被识别为中文），未知内容语言则检测：需要包含汉语字符，不包含日语和韩语字符（排除日文和韩文）
3. 当作者是机器人，post不包含external，过滤掉
4. 当作者是机器人，post包含external链接，判断链接标题描述是否中文内容，不是过滤掉，是再判断hostname，非中国国别域名过滤掉，是再判断社区类网站或非中国网站，过滤掉
5. 当post不包含图片，入post库
6. 当post包含图片（可能来自于引用），且post自身没有标记，进入nsfw复核流程

### 定时任务

1. 每隔1h删除post库，mod库12h前的内容
2. 每个1h同步not.db，新增的和删掉的都emit一下
3. 每天执行1次，删除bw{today-7}.db

#### 内容检测规则

1. regex `/^(?=.*\p{Script=Han})(?!.*[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])[\s\S]*$/us`

#### 机器人判定规则

0. 查黑白名单bot，不在名单中则往下执行
1. get `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=did%3Aplc%3Ammbknffnysobiitlszjovm3w&filter=posts_no_replies&includePins=false&limit=30`
2. 获取到最近30条post
3. a=最远创建时间
4. b=最近创建时间
5. 计算平均间隔时间（单位：小时）=(b-a)/30/1000/60/60
6. 如果平均间隔时间小于1，判断为机器人，否则继续
7. 如果每条post都携带外部链接（facet或external），判断为机器人
8. 不满足上面两条则为正常人
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

>标签结果缓存7天，刷新post则重新计算缓存时间，确保至少7天内只计算一次

### 社区类网站或非中国网站判断

此类网站无法判定数据来源或数据来源于外国人

3. 检查not.db中非中国网站名单，有结果过滤
4. 其他情况则不是

> not.db由gh actions生成, 非中国网站名单在pastbin维护

### nsfw复核流程

0. 查黑白名单nsfw缓存
1. 在黑白名单中（老用户），是nsfw直接入post库结束
2. 在黑白名单中（老用户），是not-nsfw，查官方mod标签机，存在色情修改为nsfw，否则使用缓存的not-nsfw，入post库结束
3. 不在名单中（复活用户或新用户）则往下执行
4. 查官方mod标签机，有标记则为黑，存到bw{today}.db，入post库结束
5. 没有标记入mod库，由gh actions审核
6. 审核结果黑存到bw{today}.db，白查看最近30条post，不到这个量存-1未知，到了才存白0到bw{today}.db
8. 从mod库复制数据到post库，然后删除mod库中数据

### labeler服务

基于 not.db bw{time}.db 对外发布标记

1. 噪声用户 (由@smitechow.com提供列表【不科学，不合法，不主流】，gh actions更新到not.db)
2. 机器人 (由feed流实时生成【发言频率间隔<1h】，存储在bw{time}.db)
3. 不是机器人 (由feed流实时生成【发言频率间隔>=1h】，存储在bw{time}.db)
3. NSFW群体 (由feed流实时生成【发表过nsfw图片】，存储在bw{time}.db)
3. 不是NSFW群体 (由feed流实时生成【发表过normal图片】，存储在bw{time}.db)

默认提供纯净版，即噪声用户，NSFW群体隐藏，机器人警告，不是机器人，不是NSFW群体忽略

#### report流程

1. 允许用户报告机器人和nsfw群体
2. 报告机器人则走`机器人判定规则`，按照不在名单中执行
3. 报告nsfw群体则走`nsfw复核流程`，按照不在名单中执行
4. 报告噪声用户，同步not.db，再检测

>报告nsfw群体必须指定具体post，符合有图片的情况，存在另外一张表中
