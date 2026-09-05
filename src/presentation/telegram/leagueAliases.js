const { leagues } = require('../../domain/leagues');

const leagueNames = new Map([
  ...[...leagues].map(([id, name]) => [name.toLowerCase(), id]),
  ['ла лига', 'la-liga'],
  ['epl', 'premier-league'],
  ['апл', 'premier-league'],
  ['бундеслига', 'bundesliga'],
  ['серия а', 'serie-a'],
  ['лига 1', 'ligue-1'],
]);

function resolveLeagueId(text) {
  const name = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return leagueNames.get(name);
}

module.exports = { resolveLeagueId };
