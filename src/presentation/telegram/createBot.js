const { Telegraf, Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const { leagues } = require('../../domain/leagues');
const { formatStandings } = require('./formatStandings');

const leagueNames = new Map([
  ...[...leagues].map(([id, name]) => [name.toLowerCase(), id]),
  ['ла лига', 140],
  ['epl', 39],
  ['апл', 39],
  ['бундеслига', 78],
  ['серия а', 135],
  ['лига 1', 61],
]);

// Telegram получает сценарий через аргумент, не создавая API-клиент.
function createBot({ token, getStandings }) {
  const bot = new Telegraf(token);
  bot.start((ctx) => ctx.reply('Привет! используй команду /leagues чтобы увидеть список европейских топ лиг.'));
  bot.help((ctx) => ctx.reply('Используй /leagues, после чего выбери лигу и увидишь состояние турнирной таблицы за 2024 год.'));

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

  async function showStandings(ctx, leagueId) {
    let standings;
    try {
      standings = await getStandings(leagueId);
    } catch {
      return ctx.reply('Не удалось загрузить турнирную таблицу. Сервис может быть недоступен, лимит запросов исчерпан или ваш тариф API не поддерживает текущий сезон. Пожалуйста, попробуйте позже.');
    }
    if (!standings) {
      return ctx.reply('Текущая турнирная таблица для этой лиги пока недоступна.');
    }

    for (const text of formatStandings(leagues.get(leagueId), standings)) {
      await ctx.reply(text, { parse_mode: 'HTML' });
    }
  }

  bot.on(message('text'), (ctx) => {
    const name = ctx.message.text.trim().toLowerCase().replace(/\s+/g, ' ');
    const leagueId = leagueNames.get(name);
    return leagueId === undefined ? showLeagues(ctx) : showStandings(ctx, leagueId);
  });
  bot.catch(() => console.error('Failed to handle a Telegram update.'));

  return bot;
}

module.exports = { createBot };
