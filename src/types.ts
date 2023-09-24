import { type Context, type InlineKeyboard, type SessionFlavor } from 'grammy'
import { type Database } from './database'
import { type Piece, type Square } from 'chess'

interface SessionData {
  wait: boolean
  selected: Square | null
}

interface CompactUser {
  id: number
  first_name: string
}

interface GameEntry {
  id: number
  whites_id: number
  blacks_id: number
}

interface BoardMessage {
  imageUrl: string
  text: string
  keyboard: InlineKeyboard
}

type MyContext = Context & { db: Database } & SessionFlavor<SessionData>

type Color = 'white' | 'black'

type MaterialDiffSide = Record<Piece['type'], number>

type MaterialDiff = Record<Color, MaterialDiffSide>

export type {
  SessionData,
  MyContext,
  CompactUser,
  GameEntry,
  BoardMessage,
  Color,
  MaterialDiff,
  MaterialDiffSide
}
