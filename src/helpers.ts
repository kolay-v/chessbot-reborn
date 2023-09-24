import { type InlineKeyboardButton } from 'grammy/out/types'
import { type AlgebraicGameStatus, type ChessBoard, type NotatedMove, type Square } from 'chess'
import { InlineKeyboard } from 'grammy'
import { type BoardMessage, type CompactUser } from './types'

const { BOARD_IMAGE_BASE_URL = '' } = process.env

const emoji = {
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
        callback_data: callbackOverride ?? `${col}${row}`
      }
    }

    /**
     * If it is an empty square.
     */
    // noinspection JSDeprecatedSymbols
    return {
      text: square?.move != null ? '·' : unescape('%u0020'),
      callback_data: callbackOverride ?? `${col}${row}`
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

const formatTopMessage = (isWhiteTurn: boolean, player: CompactUser, enemy?: CompactUser): string => {
  const playerString = `<a href="tg://user?id=${player.id}">${escapeHTML(player.first_name)}</a>`
  const enemyString = (enemy != null) ? `<a href="tg://user?id=${enemy.id}">${escapeHTML(enemy.first_name)}</a>` : '?'
  const getSide = (white: boolean): string => white ? 'White' : 'Black'
  return `${getSide(!isWhiteTurn)} (top) - ${enemyString}
${getSide(isWhiteTurn)} (bottom) - ${playerString}
${enemy != null ? `${getSide(isWhiteTurn)}'s turn` : 'Join Now!'} | <a href="https://t.me/chessbot_chat">Discussion</a>`
}

interface GetBoardMessageParams {
  status: AlgebraicGameStatus
  isWhiteTurn: boolean
  player: CompactUser
  enemy: CompactUser
  moves?: NotatedMove[]
  lastMoveArrow?: string
}

const getBoardMessage = ({ status, isWhiteTurn, player, enemy, moves = [], lastMoveArrow }: GetBoardMessageParams): BoardMessage => {
  const isLastTurn = lastMoveArrow != null
  return {
    imageUrl: makeBoardImageUrl(status.board, {
      rotate: isLastTurn ? isWhiteTurn : !isWhiteTurn,
      moves,
      arrows: lastMoveArrow != null ? [lastMoveArrow] : []
    }),
    text: formatTopMessage(isWhiteTurn, player, enemy),
    keyboard: renderBoardKeyboard({
      squares: status.board.squares.map((square) => {
        const move = moves
          .find(({ dest }) => dest.file === square.file &&
                  dest.rank === square.rank)

        return { ...square, move }
      }),
      isWhite: isLastTurn ? !isWhiteTurn : isWhiteTurn

    }).row().text('Last turn.', 'last_turn')
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
  sleep
}
