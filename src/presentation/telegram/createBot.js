const { Telegraf, Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const { leagues } = require('../../domain/leagues');

// Telegram получает сценарий через аргумент, не создавая API-клиент.
function createBot({ token, getStandings }) {
  const bot = new Telegraf(token);
  bot.start((ctx) => ctx.reply('Привет! используй команду /leagues чтобы увидеть список европейских топ лиг.'));
  bot.help((ctx) => ctx.reply('Используй /leagues, после чего выбери лигу и увидишь состояние турнирной таблицы за 2024 год.'));

  // Каждая кнопка передаёт идентификатор лиги в callback_data.
  bot.command('leagues', (ctx) => ctx.reply('Выбери чемпионат:', Markup.inlineKeyboard(
    [...leagues].map(([id, name]) => [Markup.button.callback(name, `league:${id}`)])
  )));

  bot.action(/^league:(\d+)$/, async (ctx) => {
    const leagueId = Number(ctx.match[1]);
    if (!leagues.has(leagueId)) return ctx.answerCbQuery('Unknown league.');

    // Сразу убираем индикатор загрузки на кнопке, затем обращаемся к API.
    await ctx.answerCbQuery();
    let standings;
    try {
      standings = await getStandings(leagueId);
    } catch {
      return ctx.reply('Не удалось загрузить турнирную таблицу. Сервис может быть недоступен, лимит запросов исчерпан или ваш тариф API не поддерживает текущий сезон. Пожалуйста, попробуйте позже.');
    }
    if (!standings) {
      return ctx.reply('Текущая турнирная таблица для этой лиги пока недоступна.');
    }

    const heading = `${leagues.get(leagueId)} — ${standings.season}/${standings.season + 1}\nПоз. Команда — И | РМ | Очки`;
    const rows = standings.table.map((row) =>
      `${row.rank}. ${row.team.name} — ${row.all.played} | ${row.goalsDiff} | ${row.points}`
    );
    // Делим длинный ответ на сообщения с учётом лимита Telegram.
    let text = heading;
    for (const row of rows) {
      if (text.length + row.length + 1 > 4000) {
        await ctx.reply(text);
        text = heading;
      }
      text += `\n${row}`;
    }
    await ctx.reply(text);
  });

  // Сохраняем эхо для обычных текстовых сообщений.
  bot.on(message('text'), (ctx) => ctx.reply(ctx.message.text));
  bot.catch(() => console.error('Failed to handle a Telegram update.'));

  return bot;
}

module.exports = { createBot };
