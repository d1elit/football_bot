const BASE_URL = 'https://api.football-data.org/v4/';
const competitionCodes = new Map([
  ['premier-league', 'PL'],
  ['la-liga', 'PD'],
  ['bundesliga', 'BL1'],
  ['serie-a', 'SA'],
  ['ligue-1', 'FL1'],
]);

function createFootballApi({ apiKey, fetchImpl = fetch, logger = console }) {
  return {
    async getStandings(leagueId) {
      const code = competitionCodes.get(leagueId);
      if (!code) throw new Error('Unknown league.');
      if (!apiKey) throw new Error('Missing FOOTBALL_DATA_API_KEY.');
      const url = new URL('competitions/' + code + '/standings', BASE_URL);
      const response = await fetchImpl(url, {
        headers: { 'X-Auth-Token': apiKey },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        logger.error('Football API standings request failed:', response.status, await response.text().catch(() => '[Unable to read response body]'));
        throw new Error('Football API HTTP error: ' + response.status);
      }
      const data = await response.json();
      if (data.errorCode || data.message) {
        logger.error('Football API standings request failed:', response.status, JSON.stringify(data));
        throw new Error('Football API rejected the request.');
      }
      if (!Array.isArray(data.standings)) throw new Error('Invalid football API response.');
      const table = data.standings.find((standing) => standing.type === 'TOTAL')?.table;
      if (!table?.length) return null;
      const startDate = data.season?.startDate;
      if (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        throw new Error('Invalid football API response.');
      }
      return {
        season: Number(startDate.slice(0, 4)),
        table: table.map((row) => ({
          rank: row.position,
          team: { name: row.team.name },
          all: { played: row.playedGames },
          goalsDiff: row.goalDifference,
          points: row.points,
        })),
      };
    },
  };
}

module.exports = { createFootballApi };
