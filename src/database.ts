/* eslint-disable @typescript-eslint/naming-convention */
import knex from 'knex'
import knexFile from '../knexfile'
import { type User } from '@grammyjs/types'
import { type CompactUser, type GameEntry } from './types'

export class Database {
  private readonly knex = knex(knexFile)

  async createOrUpdateUser (user: User): Promise<void> {
    const {
      id,
      first_name,
      last_name,
      language_code,
      username
    } = user
    await this.knex.insert({
      id,
      first_name,
      last_name,
      language_code,
      username
    }).into('users')
      .onConflict('id')
      .merge()
  }

  async getUser (id: number): Promise<CompactUser | null> {
    return await this.knex.select('id', 'first_name').from('users').where({ id }).first()
  }

  async getGame (inlineMessageId?: string): Promise<GameEntry | null> {
    if (inlineMessageId == null) {
      return null
    }
    const game = await this.knex
      .select('id', 'whites_id', 'blacks_id')
      .from('games')
      .where({ inline_id: inlineMessageId })
      .first()
    if (game != null) {
      game.whites_id = Number(game.whites_id)
      game.blacks_id = Number(game.blacks_id)
    }
    return game
  }

  async createGame (whiteId: number, blackId: number, inlineMessageId: string): Promise<number | undefined> {
    const [game] = await this.knex.insert({
      whites_id: whiteId,
      blacks_id: blackId,
      inline_id: inlineMessageId
    }).into('games')
      .onConflict('inline_id')
      .ignore()
      .returning('id')
    return game?.id
  }

  async getGameMoves (gameId: number): Promise<string[]> {
    const gameMoves = await this.knex
      .select('entry')
      .from('moves')
      .where({ game_id: gameId })
      .orderBy('created_at', 'asc')

    return gameMoves.map(({ entry }) => entry)
  }

  async addMove (gameId: number, entry: string): Promise<void> {
    await this.knex.insert({
      game_id: gameId,
      entry
    }).into('moves')
  }
}
