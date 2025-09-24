import { storage } from "./dbpool"

type msg = {
    id: string;
    uri: string;
    expire?: string;
    target?: string;
    priority?: number;
}

export const PRIORITY_NORMAL = 3
export const PRIORITY_IMPORTANT = 2
export const PRIORITY_SUPER = 1

export async function updateSystemBoard() {
    console.log(`update sysetm board from ${process.env.FEED_SYSTEM_BOARD_URL}`)
    const res = await fetch(process.env.FEED_SYSTEM_BOARD_URL as string)
    const data: msg[] = await res.json() as any
    storage.systemBoard = data.map(item => {
        return {
            id: item.id,
            uri: item.uri,
            expire: item.expire ? new Date(item.expire) : undefined,
            target: item.target ? item.target.split(',').map(t => t.trim()).filter(did => did.length > 0) : undefined,
            priority: item.priority ?? PRIORITY_NORMAL
        }
    })
}