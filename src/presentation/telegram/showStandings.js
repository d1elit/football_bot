const { leagues } = require('../../domain/leagues');
const { formatStandings } = require('./formatStandings');

function createShowStandings({ getStandings }) {
  return async function showStandings(ctx, leagueId) {
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
  };
}

module.exports = { createShowStandings };
