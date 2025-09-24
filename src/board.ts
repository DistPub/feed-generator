import { storage } from "./dbpool"

export async function updateSystemBoard() {
    console.log(`update sysetm board from ${process.env.FEED_SYSTEM_BOARD_URL}`)
    const res = await fetch(process.env.FEED_SYSTEM_BOARD_URL as string)
    const data = await res.json()
    storage.systemBoard = data
}