import type { WSData }    from './types'
import { PORT, ADMIN_KEY } from './config'
import { fetchHandler }    from './http'
import { websocket }       from './ws'

const server = Bun.serve<WSData>({
  port: PORT,
  fetch: fetchHandler,
  websocket,
})

console.log(`✅ Chat running at http://localhost:${server.port}`)
console.log(`🔑 Admin key: ${ADMIN_KEY}`)
