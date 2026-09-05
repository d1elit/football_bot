const { leagues } = require('../domain/leagues');

// Сценарий не зависит от Telegraf, Fastify или способа выполнения HTTP-запросов.
function createGetStandings({ footballApi, season = 2024 }) {
  return async function getStandings(leagueId) {
    if (!leagues.has(leagueId)) throw new Error('Unknown league.');
    const table = await footballApi.getStandings(leagueId, season);
    if (!table?.length) return null;
    return { season, table: [...table].sort((a, b) => a.rank - b.rank) };
  };
}

module.exports = { createGetStandings };
