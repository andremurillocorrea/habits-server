import Fastify from 'fastify'  
import cors from '@fastify/cors'
import { appRoutes } from './routes'

import dayjs from './lib/dayjs'

console.log(`Timezone: ${dayjs.tz.guess()}`)

const app = Fastify({
    logger: true
})

app.register(cors)
app.register(appRoutes)

const port = Number(process.env.PORT || '3333')

app.listen({
    port: port,
    host: '0.0.0.0'
}).then((url) => {
    console.log(`HTTP Server running on ${url}`)
})