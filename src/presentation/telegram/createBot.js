const { Telegraf, Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const { leagues } = require('../../domain/leagues');
const { resolveLeagueId } = require('./leagueAliases');
const { leagueHints } = require('./helpText');
const { createShowStandings } = require('./showStandings');

// Telegram получает сценарий через аргумент, не создавая API-клиент.
function createBot({ token, getStandings }) {
  const bot = new Telegraf(token);
  const showStandings = createShowStandings({ getStandings });
  bot.start((ctx) => ctx.reply(`Привет! ⚽\n\n${leagueHints}`));
  bot.help((ctx) => ctx.reply(leagueHints));

  // Каждая кнопка передаёт идентификатор лиги в callback_data.
  const showLeagues = (ctx) => ctx.reply('Выбери чемпионат:', Markup.inlineKeyboard(
    [...leagues].map(([id, name]) => [Markup.button.callback(name, `league:${id}`)])
  ));
  bot.command('leagues', showLeagues);

  bot.action(/^league:(\d+)$/, async (ctx) => {
    const leagueId = Number(ctx.match[1]);
    if (!leagues.has(leagueId)) return ctx.answerCbQuery('Unknown league.');

    // Сразу убираем индикатор загрузки на кнопке, затем обращаемся к API.
    await ctx.answerCbQuery();
    return showStandings(ctx, leagueId);
  });

  bot.on(message('text'), (ctx) => {
    const leagueId = resolveLeagueId(ctx.message.text);
    return leagueId === undefined ? showLeagues(ctx) : showStandings(ctx, leagueId);
  });
  bot.catch(() => console.error('Failed to handle a Telegram update.'));

  return bot;
}

module.exports = { createBot };
