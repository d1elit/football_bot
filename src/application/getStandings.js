const { leagues } = require('../domain/leagues');

// Сценарий не зависит от Telegraf, Fastify или способа выполнения HTTP-запросов.
function createGetStandings({ footballApi }) {
  return async function getStandings(leagueId) {
    if (!leagues.has(leagueId)) throw new Error('Unknown league.');
    const standings = await footballApi.getStandings(leagueId);
    if (!standings?.table?.length) return null;
    const { season, table } = standings;
    return { season, table: [...table].sort((a, b) => a.rank - b.rank) };
  };
}

module.exports = { createGetStandings };
