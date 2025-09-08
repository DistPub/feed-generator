const tt = [
`Distributed ledger

Building the foundation of trust

Welcome to becoming a guardian of Vcity nodes

#XieZhang#Vcity#VcityMeta`,
`Distributed ledger

Building the foundation of trust

Welcome to becoming a guardian of Vcity nodes

#XieZhang#Vcity#VcityMeta`,
`Distributed ledger

Building the foundation of trust

Welcome to becoming a guardian of Vcity nodes

#XieZhang#Vcity#VcityMeta`,
`Immerse yourself in digital spaces

Ride the wave of technological innovation

Welcome to VcityMeta

Where every moment brims with wonder and surprise

#XieZhang#Vcity#VcityMeta`,
`沉浸数字空间

追逐科技浪潮

欢迎来到元宇宙

让每一刻都充满新奇与惊喜

#谢章#第五城VM#数藏#Vcity`,
`Distributed ledger

Building the foundation of trust

Welcome to becoming a guardian of Vcity nodes

#XieZhang#Vcity#VcityMeta`,
`分布式账本

共筑信任基石

欢迎成为Vcity节点守护者
#谢章#第五城VM#数藏#Vcity`,
`Immerse yourself in digital spaces

Ride the wave of technological innovation

Welcome to VcityMeta

Where every moment brims with wonder and surprise

#XieZhang#Vcity#VcityMeta`,
`Immerse yourself in digital spaces

Ride the wave of technological innovation

Welcome to VcityMeta

Where every moment brims with wonder and surprise

#ZhangXie #Vcity #VcityMeta #cityofpi`,
`沉浸数字空间

追逐科技浪潮

欢迎来到元宇宙

让每一刻都充满新奇与惊喜

#谢章 #第五城 #vcity #元宇宙 #派之城`,
`Unlock digital codes

Open the door to wealth

Vcity

Twelve diverse ecosystems, endless possibilities

#ZhangXie #Vcity #VcityMeta #cityofpi`,
`Immerse yourself in digital spaces

Ride the wave of technological innovation

Welcome to VcityMeta

Where every moment brims with wonder and surprise

#ZhangXie #Vcity #VcityMeta #cityofpi`,
`Distributed ledger

Building the foundation of trust

Welcome to becoming a guardian of Vcity nodes

#ZhangXie #Vcity #VcityMeta #cityofpi`,
`Immerse yourself in digital spaces

Ride the wave of technological innovation

Welcome to VcityMeta

Where every moment brims with wonder and surprise
#Zhang Xie#vcity#vcity.app`,
`沉浸数字空间
追逐科技浪潮
欢迎来到元宇宙
让每一刻都充满新奇与惊喜
#謝章#第五城#Vcity.app`,
`Distributed ledger

Building the foundation of trust

Welcome to becoming a guardian of Vcity nodes
#Zhang Xie#vcity#vcity.app`,
`分布式账本
共筑信任基石
欢迎成为Vcity节点守护者
#謝章#第五城#Vcity.app`,
`沉浸数字空间  追逐科技浪潮  欢迎来到元宇宙  让每一刻都充满新奇与惊喜 #谢章#第五城VM#数藏#`,
`分布式账本  共筑信任基石  欢迎成为Vcity节点守护者 #谢章#第五城VM#`,
`Immerse yourself in digital spaces
Ride the wave of technological innovation
Welcome to VcityMeta
Where every moment brims with wonder and surprise
#XieZhang#Vcity#VcityMeta`,
`沉浸数字空间
追逐科技浪潮
欢迎来到元宇宙
让每一刻都充满新奇与惊喜
#謝章#第五城#Vcity.app`,
`Distributed ledger
Building the foundation of trust
Welcome to becoming a guardian of Vcity nodes
#XieZhang#Vcity#VcityMeta`,
`Distributed ledger

Building the foundation of trust

Welcome to becoming a guardian of Vcity nodes
#Zhang Xie#Vcity#Vcity.app`,
`分布式账本

共筑信任基石

欢迎成为Vcity节点守护者
#謝章#第五城#Vcity.app`,
`Immerse in the digital space, chase the wave of technology, welcome to the metaverse, make every moment full of novelty and surprise #Xie Zhang #Fifth City VM #Digital Collectibles #VcityMeta`,
`Immerse yourself in digital spaces

Ride the wave of technological innovation

Welcome to VcityMeta

Where every moment brims with wonder and surprise
#XieZhang #Vcity #VcityMeta`,
`沉浸数字空间

追逐科技浪潮

欢迎来到元宇宙

让每一刻都充满新奇与惊喜
#谢章 #第五城VM #数藏 #Vcity.app`,
`Distributed ledger

Building the foundation of trust

Welcome to becoming a guardian of Vcity nodes
#XieZhang #Vcity #VcityMeta`,
`分布式账本

共筑信任基石

欢迎成为Vcity节点守护者
#谢章 #第五城VM #数藏 #Vcity.app`,
]
import dotenv from 'dotenv'
import { updateJieBaDict, tokenize, removeUrlsAndMentions, getTopics, zhTokenSeparator } from './topic'
dotenv.config()
async function main() {
    await updateJieBaDict()
    for(let i=0;i<tt.length;i++){
        const topics = getTopics(zhTokenSeparator(tokenize(removeUrlsAndMentions(tt[i]))))
        console.log(topics.join('\n'))
    }
}
main()