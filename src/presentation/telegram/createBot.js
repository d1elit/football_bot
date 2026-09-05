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
  const leagueHints = [
    'Напиши название лиги в поле сообщения — и я покажу турнирную таблицу за сезон 2024/2025.',
    '',
    'Можно отправить любой из вариантов:',
    '• апл, EPL или Premier League',
    '• ла лига или La Liga',
    '• бундеслига или Bundesliga',
    '• серия а или Serie A',
    '• лига 1 или Ligue 1',
    '',
    'Например, отправь: апл',
    'Или используй /leagues, чтобы выбрать лигу кнопкой.',
  ].join('\n');
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
