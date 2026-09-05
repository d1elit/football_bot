// Загружаем токены из .env до создания бота.
require('dotenv').config({ quiet: true });
const { Telegraf, Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const { getStandings } = require('./footballApi');

for (const name of ['TELEGRAM_BOT_TOKEN', 'FOOTBALL_API_KEY']) {
  if (!process.env[name]?.trim()) {
    console.error(`Missing ${name}. Set it in .env.`);
    process.exit(1);
  }
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN.trim());
// Постоянные идентификаторы лиг в API-Football.
const leagues = new Map([
  [39, 'Premier League'],
  [140, 'La Liga'],
  [78, 'Bundesliga'],
  [135, 'Serie A'],
  [61, 'Ligue 1'],
]);

bot.start((ctx) => ctx.reply('Welcome! Use /leagues to see football standings.'));
bot.help((ctx) => ctx.reply('Use /leagues, then select a league to see its current standings.'));

// Каждая кнопка передаёт идентификатор лиги в callback_data.
bot.command('leagues', (ctx) => ctx.reply('Choose a league:', Markup.inlineKeyboard(
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
    return ctx.reply('Could not load standings. The service may be unavailable, its quota exhausted, or your API plan may not include the current season. Please try again later.');
  }
  if (!standings) {
    return ctx.reply('Current standings are not available for this league yet.');
  }

  const heading = `${leagues.get(leagueId)} — ${standings.season}/${standings.season + 1}\nPos. Team — Played | GD | Points`;
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

// Запускаем получение событий от Telegram через long polling.
bot.launch().catch(() => {
  console.error('Failed to start the bot. Check TELEGRAM_BOT_TOKEN and your network connection.');
  process.exitCode = 1;
});

// Останавливаем бота при завершении процесса.
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
