import { Composer, InlineKeyboard } from 'grammy'
import { inlineGameComposer } from './inlineGameComposer'
import { type MyContext } from '../types'
import { adminComposer } from './adminComposer'

const mainComposer = new Composer<MyContext>()

mainComposer.command('start', async ctx => {
  const me = await ctx.api.getMe()
  await ctx.reply(
    `To play chess with a friend, type @${me.username} to your message input field.`,
    {
      reply_markup: new InlineKeyboard()
        .switchInline('Play with friend', '')
        .row()
        .url('Source code', 'https://github.com/kolay-v/chessbot-reborn')
        .row()
        .url('Chat', 'https://t.me/chessbot_chat')
    })
})

mainComposer.use(adminComposer)
mainComposer.use(inlineGameComposer)

export { mainComposer }
