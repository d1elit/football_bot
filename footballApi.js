const BASE_URL = 'https://v3.football.api-sports.io/';

// Все HTTP-запросы к API-Football находятся в этом модуле.
async function request(endpoint, params) {
  const apiKey = process.env.FOOTBALL_API_KEY?.trim();
  if (!apiKey) throw new Error('Missing FOOTBALL_API_KEY.');
  const url = new URL(endpoint, BASE_URL);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    if (endpoint === 'standings') {
      console.error('Football API standings request failed:', response.status, await response.text().catch(() => '[Unable to read response body]'));
    }
    throw new Error(`Football API HTTP error: ${response.status}`);
  }
  const data = await response.json();
  // API может вернуть HTTP 200, но сообщить об ошибке в поле errors.
  if (data.errors && Object.keys(data.errors).length > 0) {
    if (endpoint === 'standings') {
      console.error('Football API standings request failed:', response.status, JSON.stringify(data));
    }
    throw new Error('Football API rejected the request.');
  }
  if (!Array.isArray(data.response)) throw new Error('Invalid football API response.');
  return data.response;
}

async function getStandings(leagueId) {
  // Узнаём текущий сезон у API, а не вычисляем его по календарному году.
  const leagues = await request('leagues', { id: leagueId, current: 'true' });
  const season = leagues.find((item) => item.league.id === leagueId)
    ?.seasons.find((item) => item.current);
  if (!season || season.coverage?.standings === false) return null;
  const results = await request('standings', { league: leagueId, season: season.year });
  const table = results[0]?.league?.standings?.flat();
  if (!table?.length) return null;
  return { season: season.year, table: table.sort((a, b) => a.rank - b.rank) };
}

module.exports = { getStandings };
