import http from 'http'
import { app } from './app.js'
import { config } from './config/index.js'
import { initDb } from './database/index.js'

const server = http.createServer(app)

server.timeout = config.SERVER_TIMEOUT_MS
server.keepAliveTimeout = config.KEEP_ALIVE_TIMEOUT_MS
server.headersTimeout = config.HEADERS_TIMEOUT_MS

initDb()
  .catch(err => console.error('[ImgPress] DB init failed, domain checks disabled:', err))
  .finally(() => {
    server.listen(config.PORT, '0.0.0.0', () => {
      console.log(`imgpress running on :${config.PORT} (timeout: ${server.timeout / 1000}s)`)
    })
  })
