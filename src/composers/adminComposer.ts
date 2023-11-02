import { Composer } from 'grammy'
import { type MyContext } from '../types'

const { ADMIN_ID } = process.env

const adminComposer = new Composer<MyContext>().filter(ctx => ctx.from?.id === ADMIN_ID)

adminComposer.command('stats', async ctx => {
  const { movesMade, uniqueUsers, boardsCreated } = await ctx.db.getDatabaseStats()
  await ctx.reply(`Boards created - ${boardsCreated.toLocaleString('ru')}
 Moves made - ${movesMade.toLocaleString('ru')}
Unique users - ${uniqueUsers.toLocaleString('ru')}`)
})

export { adminComposer }
