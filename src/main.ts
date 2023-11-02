import 'dotenv/config'
import { Bot, session } from 'grammy'
import { Database } from './database'
import { mainComposer } from './composers'
import { type MyContext, type SessionData } from './types'
import { autoRetry } from '@grammyjs/auto-retry'

const { BOT_TOKEN } = process.env

const db = new Database()
const bot = new Bot<MyContext>(BOT_TOKEN ?? '')

bot.use(async (ctx, next) => {
  ctx.db = db
  await next()
})

bot.api.config.use(autoRetry())
bot.use(
  session({
    initial: (): SessionData => ({
      wait: false,
      selected: null
    }),
    getSessionKey: (ctx) => ctx.inlineMessageId ??
      (ctx.chat != null && ctx.from?.id != null
        ? `${ctx.chat.id}${ctx.from.id}`
        : undefined)
  })
)

bot.use(mainComposer)

bot.use(async ctx => {
  await fetch('http://localhost:6572/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ctx.update)
  }).catch(console.error)
})

bot.start({ drop_pending_updates: true })
  .catch(console.error)
