const BASE_URL = 'https://v3.football.api-sports.io/';

// Адаптер внешнего API: HTTP, авторизация, ошибки и преобразование ответа.
function createFootballApi({ apiKey, fetchImpl = fetch, logger = console }) {
  async function request(endpoint, params) {
    if (!apiKey) throw new Error('Missing FOOTBALL_API_KEY.');
    const url = new URL(endpoint, BASE_URL);
    url.search = new URLSearchParams(params).toString();
    const response = await fetchImpl(url, {
      headers: { 'x-apisports-key': apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (endpoint === 'standings') {
        logger.error('Football API standings request failed:', response.status, await response.text().catch(() => '[Unable to read response body]'));
      }
      throw new Error(`Football API HTTP error: ${response.status}`);
    }
    const data = await response.json();
    // API может вернуть HTTP 200, но сообщить об ошибке в поле errors.
    if (data.errors && Object.keys(data.errors).length > 0) {
      if (endpoint === 'standings') {
        logger.error('Football API standings request failed:', response.status, JSON.stringify(data));
      }
      throw new Error('Football API rejected the request.');
    }
    if (!Array.isArray(data.response)) throw new Error('Invalid football API response.');
    return data.response;
  }

  return {
    async getStandings(leagueId, season) {
      const results = await request('standings', { league: leagueId, season });
      const table = results[0]?.league?.standings?.flat();
      if (!table?.length) return null;
      return table.map((row) => ({
        rank: row.rank,
        team: { name: row.team.name },
        all: { played: row.all.played },
        goalsDiff: row.goalsDiff,
        points: row.points,
      }));
    },
  };
}

module.exports = { createFootballApi };
