import { Jieba } from '@node-rs/jieba';
import { dict } from '@node-rs/jieba/dict'
import { removeStopwords, eng, zho } from 'stopword'

const jieba = Jieba.withDict(dict)

export async function updateJieBaDict() {
    console.log(`update jieba dict from ${process.env.JIEBA_DICT_PATH}`)
    const res = await fetch(process.env.JIEBA_DICT_PATH as string)
    const text = await res.text()
    const dictBuffer = Buffer.from(text, 'utf-8')
    jieba.loadDict(dictBuffer)
}

export function tokenize(text: string): string[] {
    const segments: string[] = jieba.cut(text, false);

    const tokens: string[] = [];
    for (const seg of segments) {
        if (/^[\u4e00-\u9fff]+$/.test(seg)) {
            tokens.push(seg);
        } else {
            // 其他片段用正则分词
            const re = /([a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?|[^\s\w])/gu;
            let m: RegExpExecArray | null;
            while ((m = re.exec(seg)) !== null) {
                tokens.push(m[0]);
            }
        }
    }

    // 过滤停用词和标点符号
    return removeStopwords(removeStopwords(tokens, zho), eng).filter(token => token.length > 1)
}

/**
 * 移除字符串中的网址和@提及（@后面是域名）
 * @param text 输入文本
 * @returns 移除后的文本
 */
export function removeUrlsAndMentions(text: string): string {
    // 匹配网址（http/https/ftp/file/裸域名等）
    const urlPattern = /\b((https?:\/\/|ftp:\/\/|file:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?)/gi;
    // 匹配@提及（@后面是域名）
    const mentionPattern = /@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/g;
    const ret = text
        .replace(urlPattern, '')
        .replace(mentionPattern, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .toLowerCase();
    return ret
}

/**
 * 统计字符串数组中每个item出现的次数，按次数降序排序，优先长词，取前3个item合并为字符串返回
 * @param items 字符串数组
 * @returns 前3个高频item（优先长词）合并后的字符串
 */
export function top3Concat(items: string[]): string {
    const freqMap = new Map<string, number>();
    for (const item of items) {
        freqMap.set(item, (freqMap.get(item) || 0) + 1);
    }
    const sorted = Array.from(freqMap.entries())
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1]; // 次数降序
            if (b[0].length !== a[0].length) return b[0].length - a[0].length; // 长词优先
            return a[0].localeCompare(b[0]); // 字典序
        })
        .slice(0, 3)
        .sort((a, b) => {
            return a[0].localeCompare(b[0]); // 字典序
        })
    if (sorted.length < 3) return ''
    return sorted.map(([item]) => `#${item}`).join('');
}

export function getTopics(tokens_array: string[][]) {
    const topics: string[] = []
    for(let i=0;i<tokens_array.length;i++){
        if (tokens_array[i].length < 3) continue
        const ret = top3Concat(tokens_array[i])
        if (ret)
            topics.push(ret)
    }
    return topics
}

export function zhTokenSeparator(items: string[]) {
    const zhTokens: string[] = []
    const otherTokens: string[] = []
    for(let i=0;i<items.length;i++){
        if (/^[\u4e00-\u9fff]+$/.test(items[i])) {
            zhTokens.push(items[i])
        } else {
            otherTokens.push(items[i])
        }
    }
    return [zhTokens, otherTokens]
}
