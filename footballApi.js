// Совместимый экспорт для прежних импортов из корня проекта.
const { createFootballApi } = require('./src/infrastructure/football/footballApi');
const { createGetStandings } = require('./src/application/getStandings');

async function getStandings(leagueId) {
  const footballApi = createFootballApi({ apiKey: process.env.FOOTBALL_DATA_API_KEY?.trim() });
  return createGetStandings({ footballApi })(leagueId);
}

module.exports = { getStandings };
