/**
 * @TODO: prefix all cbq data with v2
 */
import chess from 'chess'
import { Composer } from 'grammy'
import {
  formatTopMessage,
  getBoardMessage,
  isWhiteTurn,
  makeBoardImageUrl,
  renderBoardKeyboard,
  sleep
} from '../helpers'
import { type BoardMessage, type MyContext } from '../types'

// TODO move this???
const updateBoard = async (ctx: MyContext, boardMsg: BoardMessage): Promise<void> => {
  await ctx.editMessageMedia({
    type: 'photo',
    media: boardMsg.imageUrl,
    caption: boardMsg.text,
    parse_mode: 'HTML'
  }, {
    reply_markup: boardMsg.keyboard
  }).catch(console.error)
}

const inlineGameComposer = new Composer<MyContext>()

inlineGameComposer.on('callback_query', async (ctx, next) => {
  if (ctx.session.wait) {
    await ctx.answerCallbackQuery('Please wait.')
    return
  }
  await next()
})

inlineGameComposer.on('inline_query', async ctx => {
  await ctx.db.createOrUpdateUser(ctx.from)
  const gameClient = chess.create({ PGN: true })
  const { board } = gameClient.getStatus()
  await ctx.answerInlineQuery([{
    id: 'white',
    type: 'photo',
    photo_url: makeBoardImageUrl(board),
    thumbnail_url: makeBoardImageUrl(board, { boardSize: 128 }),
    title: 'Play as white',
    caption: formatTopMessage(true, '', ctx.from),
    parse_mode: 'HTML',
    reply_markup: renderBoardKeyboard({
      squares: board.squares,
      isWhite: false,
      callbackOverride: `v2:join:b:${ctx.from.id}`
    }).row().text('Join the game.', `v2:join:b:${ctx.from.id}`)
  },
  {
    id: 'black',
    type: 'photo',
    photo_url: makeBoardImageUrl(board, { rotate: true }),
    thumbnail_url: makeBoardImageUrl(board, { rotate: true, boardSize: 128 }),
    title: 'Play as black',
    caption: formatTopMessage(false, '', ctx.from),
    parse_mode: 'HTML',
    reply_markup: renderBoardKeyboard({
      squares: board.squares,
      isWhite: false,
      callbackOverride: `v2:join:w:${ctx.from.id}`
    }).row().text('Join the game.', `v2:join:w:${ctx.from.id}`)
  }], {
    cache_time: 0,
    is_personal: true
  }) // TODO: handle errors
})

inlineGameComposer
  .filter((ctx): ctx is
    MyContext &
    { inlineMessageId: string } => ctx.inlineMessageId != null
  ).callbackQuery(/^v2:join:([wb]):(\d+)$/, async ctx => {
    const [, side, id] = ctx.match
    const enemyId = Number(id)
    const iAmWhite = side === 'w'
    const { id: myId } = ctx.from
    if (myId === enemyId) {
      await ctx.answerCallbackQuery('You cant play against yourself.')
      return
    }
    ctx.session.wait = true
    await ctx.db.createOrUpdateUser(ctx.from)
    const enemy = await ctx.db.getUser(enemyId)

    if (enemy === null) {
      ctx.session.wait = false
      await ctx.answerCallbackQuery('Game was removed, sorry. Start new one.')
      return
    }
    const gameId = await ctx.db.createGame(
      iAmWhite ? myId : enemyId,
      !iAmWhite ? myId : enemyId,
      ctx.inlineMessageId
    )

    if (gameId == null) {
      ctx.session.wait = false
      await ctx.answerCallbackQuery('Game was removed, sorry. Start new one.')
      return
    }

    const gameClient = chess.create({ PGN: true })
    const status = gameClient.getStatus()

    const boardMsg = getBoardMessage({
      status,
      isWhiteTurn: true,
      player: ctx.from,
      enemy
    })
    await ctx.editMessageMedia({
      type: 'photo',
      media: boardMsg.imageUrl,
      caption: boardMsg.text,
      parse_mode: 'HTML'
    }, { reply_markup: boardMsg.keyboard })
      .catch(console.error)
    ctx.session.wait = false
    ctx.log({
      type: 'join',
      creator: enemy,
      user: ctx.from
    })
  })

inlineGameComposer.callbackQuery(/^v2:([a-h])([1-8])$/, async ctx => {
  ctx.session.wait = true
  const game = await ctx.db.getGame(ctx.inlineMessageId)
  if (game == null) {
    ctx.session.wait = false
    await ctx.answerCallbackQuery('Game was removed, sorry. Start new one.').catch(console.error)
    return
  }

  if (game.whites_id !== ctx.from.id && game.blacks_id !== ctx.from.id) {
    ctx.session.wait = false
    await ctx.answerCallbackQuery('Sorry, this game is busy. Try to make a new one.').catch(console.error)
    return
  }

  const moves = await ctx.db.getGameMoves(game.id)

  if ((isWhiteTurn(moves) && ctx.from.id === game.blacks_id) ||
    (!isWhiteTurn(moves) && ctx.from.id === game.whites_id)) {
    ctx.session.wait = false
    await ctx.answerCallbackQuery('Wait, please. Now is not your turn.').catch(console.error)
    return
  }

  const gameClient = chess.create({ PGN: true })

  moves.forEach((move) => {
    try {
      gameClient.move(move)
    } catch (error) {
      console.error(error) // TODO better debug function
    }
  })
  const enemy = await ctx.db.getUser(ctx.from.id === game.whites_id
    ? game.blacks_id
    : game.whites_id)
  if (enemy == null) {
    ctx.session.wait = false
    await ctx.answerCallbackQuery('Game was removed, sorry. Start new one.')
      .catch(console.error)
    return
  }
  let status = gameClient.getStatus()
  const pressed = status.board.squares
    .find(({ file, rank }) => file === ctx.match[1] && rank === Number(ctx.match[2]))

  if ((ctx.session.selected == null) &&
    (pressed?.piece == null ||
      (pressed.piece.side.name === 'black' && isWhiteTurn(moves)) ||
      (pressed.piece.side.name === 'white' && !isWhiteTurn(moves)))
  ) { // if not selected and (clicked on empty or enemy piece)
    ctx.session.wait = false
    await ctx.answerCallbackQuery()
      .catch(console.error)
    return
  }

  /**
   * Selection of a piece
   */
  if (
    pressed?.piece != null &&
    ((pressed.piece.side.name === 'white' && isWhiteTurn(moves)) ||
      (pressed.piece.side.name === 'black' && !isWhiteTurn(moves))) &&
    !(ctx.session.selected != null &&
      pressed.file === ctx.session.selected.file &&
      pressed.rank === ctx.session.selected.rank)
  ) { // if clicked on own piece and not on selected piece
    const allowedMoves = Object.keys(status.notatedMoves)
      .filter((key) => status.notatedMoves[key].src === pressed)
      .map((key) => ({ ...status.notatedMoves[key], key }))

    // TODO
    if (allowedMoves.length === 0) {
      ctx.session.selected = null
      ctx.session.wait = false
      await ctx.answerCallbackQuery(`${pressed.piece.type} ${pressed.file}${pressed.rank}`)
        .catch(console.error)
      return
    }

    const boardMsg = getBoardMessage({
      status,
      isWhiteTurn: isWhiteTurn(moves),
      moves: allowedMoves,
      player: ctx.from,
      enemy
    })
    await updateBoard(ctx, boardMsg)

    ctx.session.selected = pressed

    ctx.session.wait = false
    await ctx.answerCallbackQuery(`${pressed.piece.type} ${pressed.file}${pressed.rank}`)
      .catch(console.error)
    return
  }

  const { selected } = ctx.session
  /**
   * Selection of a destination to move
   */
  if (selected != null) {
    // if (
    //   ctx.session.selected.piece.type === 'pawn' &&
    //   (
    //     (isWhiteTurn(gameMoves) && ctx.game.selected.rank === 7 && pressed.rank === 8) ||
    //     (!isWhiteTurn(gameMoves) && ctx.game.selected.rank === 2 && pressed.rank === 1)
    //   ) &&
    //   !ctx.game.promotion
    // ) {
    //   ctx.game.promotion = pressed
    //
    //   const makeMoves = ctx.game.allowedMoves.filter(
    //     ({ dest: { file, rank } }) => file === pressed.file && rank === pressed.rank
    //   )
    //   const keyboardRow = promotion({ makeMoves, pressed })
    //   const board = ctx.game.lastBoard.reply_markup
    //
    //   board.inline_keyboard.unshift(keyboardRow)
    //
    //   await ctx.editMessageReplyMarkup(board)
    //     .catch(debug)
    //
    //   ctx.game.busy = false
    //   return ctx.answerCbQuery()
    // }

    // let makeMove?: string
    // let topMessageText = topMessage(
    //   !isWhiteTurn(gameMoves),
    //   enemy,
    //   ctx.from,
    // )

    // if (ctx.game.promotion) {
    //   makeMove = ctx.game.allowedMoves.find(({ key, dest: { file, rank } }) => (
    //     file === pressed.file && rank === pressed.rank && key.endsWith(ctx.match[3])
    //   ))
    //   ctx.game.promotion = null
    // } else {

    const makeMove = Object.keys(status.notatedMoves).reverse()
      .find((key) => {
        const { dest, src } = status.notatedMoves[key]
        return src.file === selected.file && src.rank === selected.rank &&
          dest.file === pressed?.file && dest.rank === pressed.rank
      })
    // }

    if (makeMove != null) {
      try {
        gameClient.move(makeMove)
      } catch (error) {
        console.error(error)
      }

      await ctx.db.addMove(game.id, makeMove)
      ctx.log({
        type: 'move',
        from: ctx.from
      })

      // log(
      //   preLog('MOVE', `${gameEntry.id} ${makeMove.key} ${gameMoves.length + 1} ${makeUserLog(ctx.from)}`),
      //   ctx
      // )
    }

    status = gameClient.getStatus()

    if (makeMove != null) {
      const boardMsg = getBoardMessage({
        status,
        isWhiteTurn: !isWhiteTurn(moves),
        moves: [],
        player: enemy,
        enemy: ctx.from
      })
      await updateBoard(ctx, boardMsg)

      ctx.session.selected = null

      ctx.session.wait = false
      await ctx.answerCallbackQuery(makeMove)
        .catch(console.error)
      return
    }
  }

  // if (ctx.game.allowedMoves.length > 0) {
  //   await ctx.editMessageReplyMarkup(ctx.game.lastBoard.reply_markup)
  //     .catch(debug)
  // }\

  ctx.session.selected = null

  const boardMsg = getBoardMessage({
    status,
    isWhiteTurn: isWhiteTurn(moves),
    moves: [],
    player: ctx.from,
    enemy
  })
  await updateBoard(ctx, boardMsg)

  // console.log({ game })
  ctx.session.wait = false
})

inlineGameComposer.callbackQuery('v2:last_turn', async ctx => {
  ctx.session.wait = true
  const game = await ctx.db.getGame(ctx.inlineMessageId)
  if (game == null) {
    ctx.session.wait = false
    await ctx.answerCallbackQuery('Game was removed, sorry. Start new one.').catch(console.error)
    return
  }

  if (game.whites_id !== ctx.from.id && game.blacks_id !== ctx.from.id) {
    ctx.session.wait = false
    await ctx.answerCallbackQuery('Sorry, this game is busy. Try to make a new one.').catch(console.error)
    return
  }

  const moves = await ctx.db.getGameMoves(game.id)

  if ((isWhiteTurn(moves) && ctx.from.id === game.blacks_id) ||
    (!isWhiteTurn(moves) && ctx.from.id === game.whites_id)) {
    ctx.session.wait = false
    await ctx.answerCallbackQuery('Wait, please. Now is not your turn.').catch(console.error)
    return
  }

  const enemy = await ctx.db.getUser(ctx.from.id === game.whites_id
    ? game.blacks_id
    : game.whites_id)
  if (enemy == null) {
    ctx.session.wait = false
    await ctx.answerCallbackQuery('Game was removed, sorry. Start new one.')
      .catch(console.error)
    return
  }

  ctx.session.selected = null

  const gameClient = chess.create({ PGN: true })
  const isWhite = isWhiteTurn(moves)

  const lastMove = moves.pop()
  if (lastMove == null) {
    ctx.session.wait = false
    await ctx.answerCallbackQuery('There is no last turn.')
      .catch(console.error)
    return
  }

  moves.forEach(entry => {
    try {
      gameClient.move(entry)
    } catch (error) {
      console.error(error)
    }
  })

  const prevStatus = gameClient.getStatus()

  const move = prevStatus.notatedMoves[lastMove]
  const arrow = `${move.src.file}${move.src.rank}${move.dest.file}${move.dest.rank}`
  const prevBoardMsg = getBoardMessage({
    status: prevStatus,
    isWhiteTurn: isWhite,
    player: enemy,
    enemy: ctx.from,
    lastMoveArrow: arrow
  })

  try {
    gameClient.move(lastMove)
  } catch (error) {
    console.error(error)
  }
  const status = gameClient.getStatus()
  const boardMsg = getBoardMessage({
    status,
    isWhiteTurn: isWhite,
    enemy,
    player: ctx.from
  })

  await ctx.answerCallbackQuery().catch(console.error)
  await updateBoard(ctx, prevBoardMsg)
  ctx.log({
    type: 'last_turn',
    from: ctx.from
  })
  await sleep(3000)
  await updateBoard(ctx, boardMsg)
  ctx.session.wait = false
})

inlineGameComposer.chosenInlineResult(/^white|black$/, ctx => {
  ctx.log({
    type: 'board',
    from: ctx.from,
    side: ctx.chosenInlineResult.result_id
  })
})

export { inlineGameComposer }
