import { storage } from "./dbpool"
import { Database } from "./db"

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
export const USER_MSG_STATUS_SEND = 0
export const USER_MSG_STATUS_ACK = 1

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

export async function getUserMsg(did: string, db: Database) {
    const now = new Date()
    for (const msg of storage.systemBoard) {
        if (msg.expire && msg.expire < now) {
            continue
        }
        if (msg.target && !msg.target.includes(did)) {
            continue
        }
        const sended = await db.selectFrom('msg_board').where('did', '=', did).where('msgId', '=', msg.id).selectAll().executeTakeFirst()
        if (sended && sended.status === USER_MSG_STATUS_ACK) {
            continue
        }

        if (!sended) {
            await db.insertInto('msg_board').values({
                did,
                msgId: msg.id,
                status: USER_MSG_STATUS_SEND,
                updatedAt: (new Date()).toISOString()
            })
            .onConflict((oc) => oc.doNothing())
            .execute()
        }
        return msg
    }
}

function getMsgByUri(uri: string) {
    for (const msg of storage.systemBoard) {
        if (msg.uri === uri) {
            return msg
        }
    }
}

export async function ackUserMsg(did: string, uri: string, db: Database) {
    const msg = getMsgByUri(uri)
    if (!msg) {
        return
    }
    const sended = await db.selectFrom('msg_board').where('did', '=', did).where('msgId', '=', msg.id).selectAll().executeTakeFirst()
    if (sended && sended.status === USER_MSG_STATUS_SEND) {
        await db.updateTable('msg_board').set({
            status: USER_MSG_STATUS_ACK,
            updatedAt: (new Date()).toISOString()
        }).where('id', '=', sended.id)
        .execute()
    }
}