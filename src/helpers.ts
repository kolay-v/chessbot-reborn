import { type InlineKeyboardButton } from 'grammy/out/types'
import { type AlgebraicGameStatus, type ChessBoard, type GameStatus, type NotatedMove, type Piece, type Square } from 'chess'
import { InlineKeyboard } from 'grammy'
import { type BoardMessage, type Color, type CompactUser, type MaterialDiff, type MaterialDiffSide } from './types'

const { BOARD_IMAGE_BASE_URL = '' } = process.env

const emoji: Record<Color, Record<Piece['type'], string>> = {
  white: {
    rook: '♖',
    knight: '♘',
    bishop: '♗',
    queen: '♕',
    king: '♔',
    pawn: '♙'
  },
  black: {
    rook: '♜',
    knight: '♞',
    bishop: '♝',
    queen: '♛',
    king: '♚',
    pawn: '♟'
  }
}

const getCurrentSide = (isWhiteTurn: boolean): Color => isWhiteTurn ? 'white' : 'black'

const escapeHTML = (text: string): string => {
  const escapeChar = (c: string): string => {
    switch (c) {
      case '&': return '&amp;'
      case '"': return '&quot;'
      case '<': return '&lt;'
      default: return c
    }
  }
  return text.split('').map(escapeChar).join('')
}

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white'

// const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

interface renderBoardKeyboardParams {
  squares: Array<Square & { move?: NotatedMove }>
  isWhite: boolean
  callbackOverride?: string
}

const renderBoardKeyboard = ({ squares = [], isWhite, /* actions, */ callbackOverride }: renderBoardKeyboardParams): InlineKeyboard => {
  const horizontal = 'abcdefgh'.split('')
  const vertical = Array.from({ length: 8 }, (item, idx) => idx + 1).reverse()

  /**
   * Nested loops board generation.
   *
   * @type {Array}
   */
  let boardMarkup: InlineKeyboardButton[][] = vertical.map((row) => horizontal.map((col) => {
    /**
     * Find a pressed square.
     *
     * @type {Object}
     */
    const square = squares
      .find(({ file, rank }) => file === col && rank === row)

    /**
     * If it is a piece.
     */
    if (square?.piece != null) {
      const piece = emoji[square.piece.side.name][square.piece.type]

      return {
        text: `${square.move != null ? 'X' : ''}${piece}`,
        callback_data: callbackOverride ?? `v2:${col}${row}`
      }
    }

    /**
     * If it is an empty square.
     */
    // noinspection JSDeprecatedSymbols
    return {
      text: square?.move != null ? '·' : unescape('%u0020'),
      callback_data: callbackOverride ?? `v2:${col}${row}`
    }
  }))

  /**
   * Manage the rotation of a board.
   */
  if (!isWhite) {
    boardMarkup = boardMarkup.map((row) => row.reverse()).reverse()
  }

  /**
   * Attach additional buttons.
   */
  // if (actions) {
  //   boardMarkup.push(actions)
  // }

  /**
   * Returns an Extra object.
   */
  return new InlineKeyboard(boardMarkup)
}

interface BoardImageOptions {
  rotate?: boolean
  boardSize?: number
  moves?: NotatedMove[]
  arrows?: string[]
}

const formatStatus = ({ isCheck, isRepetition, isCheckMate, isStalemate }: GameStatus): string => {
  const result: string[] = []
  if (isCheck) {
    result.push('CHECK')
  }
  if (isCheckMate) {
    result.push('CHECK MATE')
  }
  if (isStalemate) {
    result.push('STALE MATE')
  }
  if (isRepetition) {
    result.push('REPETITION')
  }
  return result.join(' | ')
}

const makeBoardImageUrl = (board: ChessBoard, { rotate, boardSize, moves, arrows }: BoardImageOptions = {}): string => {
  const boardWithFen = board as ChessBoard & { getFen: () => string }
  const fen = encodeURIComponent(boardWithFen.getFen())

  const params = new URLSearchParams()
  if (rotate != null) {
    params.append('rotate', String(Number(rotate)))
  }
  if (boardSize != null) {
    params.append('board_size', String(boardSize))
  }
  if (arrows != null) {
    arrows.forEach(arrow => {
      params.append('arrows', arrow)
    })
  }
  if (moves != null && moves.length !== 0) {
    params.append('marks', moves.map(({ dest }) => `${dest.file}${dest.rank}`).join(','))
  }

  return `${BOARD_IMAGE_BASE_URL}${fen}.jpg?${params.toString()}`
}

type FormatTopMessageUser = CompactUser & { materialDiffString?: string | null }

const formatTopMessage = (isWhiteTurn: boolean, status: string, player: FormatTopMessageUser, enemy?: FormatTopMessageUser): string => {
  const playerString = `<a href="tg://user?id=${player.id}">${escapeHTML(player.first_name)}</a>${player.materialDiffString ?? ''}`
  const enemyString = (enemy != null) ? `<a href="tg://user?id=${enemy.id}">${escapeHTML(enemy.first_name)}</a>${enemy.materialDiffString ?? ''}` : '?'
  const getSide = (white: boolean): string => white ? 'White' : 'Black'
  return `${getSide(!isWhiteTurn)} (top) - ${enemyString}
${getSide(isWhiteTurn)} (bottom) - ${playerString}
${enemy != null ? `${getSide(isWhiteTurn)}'s turn` : 'Join Now!'} | <a href="https://t.me/chessbot_chat">Discussion</a> new
${status}`
}

interface GetBoardMessageParams {
  status: AlgebraicGameStatus
  isWhiteTurn: boolean
  player: CompactUser
  enemy: CompactUser
  moves?: NotatedMove[]
  lastMoveArrow?: string
}

const getMaterialDiff = (board: ChessBoard): MaterialDiff => {
  const diff = {
    white: { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 },
    black: { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 }
  }
  for (const square of board.squares) {
    const { piece } = square
    if (piece == null) {
      continue
    }
    const color = piece.side.name
    const { type: role } = piece
    const them = diff[opposite(color)]
    if (them[role] > 0) {
      them[role]--
    } else {
      diff[color][role]++
    }
  }
  return diff
}

const getScore = (diff: MaterialDiff): number => (
  (diff.white.queen - diff.black.queen) * 9 +
    (diff.white.rook - diff.black.rook) * 5 +
    (diff.white.bishop - diff.black.bishop) * 3 +
    (diff.white.knight - diff.black.knight) * 3 +
    (diff.white.pawn - diff.black.pawn)
)

const formatMaterialString = (diff: MaterialDiffSide, score: number): string | null => {
  const emojis: string[] = []
  for (const [role, count] of Object.entries(diff)) {
    if (count > 0) {
      emojis.push(emoji.white[role as Piece['type']].repeat(count))
    }
  }
  if (emojis.length > 0) {
    return `  ${emojis.join(' ')}${score > 0 ? ` +${score}` : ''}`
  } else {
    return null
  }
}

const getBoardMessage = ({ status, isWhiteTurn, player, enemy, moves = [], lastMoveArrow }: GetBoardMessageParams): BoardMessage => {
  const { board } = status
  const materialDiff = getMaterialDiff(board)
  const materialScore = getScore(materialDiff)
  return {
    imageUrl: makeBoardImageUrl(board, {
      rotate: !isWhiteTurn,
      moves,
      arrows: lastMoveArrow != null ? [lastMoveArrow] : []
    }),
    text: formatTopMessage(isWhiteTurn, formatStatus(status), {
      ...player,
      materialDiffString: formatMaterialString(materialDiff[getCurrentSide(isWhiteTurn)], isWhiteTurn ? materialScore : -materialScore)
    }, {
      ...enemy,
      materialDiffString: formatMaterialString(materialDiff[getCurrentSide(!isWhiteTurn)], !isWhiteTurn ? materialScore : -materialScore)
    }),
    keyboard: renderBoardKeyboard({
      squares: board.squares.map((square) => {
        const move = moves
          .find(({ dest }) => dest.file === square.file &&
                  dest.rank === square.rank)

        return { ...square, move }
      }),
      isWhite: isWhiteTurn

    }).row().text('Last turn.', 'v2:last_turn')
  }
}

const isWhiteTurn = (moves: string[]): boolean => (moves.length % 2) === 0

const sleep = async (timeMs: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, timeMs)
  })
}

export {
  isWhiteTurn,
  formatTopMessage,
  renderBoardKeyboard,
  makeBoardImageUrl,
  getBoardMessage,
  escapeHTML,
  sleep
}
