const { leagues } = require('../../domain/leagues');

const leagueNames = new Map([
  ...[...leagues].map(([id, name]) => [name.toLowerCase(), id]),
  ['ла лига', 140],
  ['epl', 39],
  ['апл', 39],
  ['бундеслига', 78],
  ['серия а', 135],
  ['лига 1', 61],
]);

function resolveLeagueId(text) {
  const name = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return leagueNames.get(name);
}

module.exports = { resolveLeagueId };
