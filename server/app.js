import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { cors } from './middleware/cors.js'
import { adminRouter } from './routes/admin.js'
import { compressionRouter } from './routes/compression.js'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientDirectory = path.join(serverDirectory, '../client')

export const app = express()

app.use(cors)
app.get('/', (req, res) => res.sendFile(path.join(clientDirectory, 'index.html')))
app.use(express.static(clientDirectory))
app.use(express.json())
app.get('/admin', (req, res) => res.sendFile(path.join(clientDirectory, 'admin.html')))
app.use('/api/admin', adminRouter)
app.use(compressionRouter)
