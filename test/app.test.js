const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGetStandings } = require('../src/application/getStandings');
const { createFootballApi } = require('../src/infrastructure/football/footballApi');
const { createServer } = require('../src/presentation/http/createServer');
const { createBot } = require('../src/presentation/telegram/createBot');
const { loadConfig } = require('../src/config');

test('standings use the returned season, sort without mutating the repository result, and reject unknown leagues', async () => {
  const table = [{ rank: 2 }, { rank: 1 }];
  const getStandings = createGetStandings({ footballApi: {
    async getStandings(id) {
      assert.equal(id, 'premier-league');
      return { season: 2026, table };
    },
  } });
  const result = await getStandings('premier-league');
  assert.equal(result.season, 2026);
  assert.deepEqual(result.table.map((row) => row.rank), [1, 2]);
  assert.equal(table[0].rank, 2);
  await assert.rejects(getStandings(999), /Unknown league/);
});

test('API adapter maps all competitions, authenticates, and returns current TOTAL standings', async () => {
  for (const [id, code] of [['premier-league', 'PL'], ['la-liga', 'PD'], ['bundesliga', 'BL1'], ['serie-a', 'SA'], ['ligue-1', 'FL1']]) {
    const api = createFootballApi({ apiKey: 'test', fetchImpl: async (url, options) => {
      assert.equal(url.origin, 'https://api.football-data.org');
      assert.equal(url.pathname, '/v4/competitions/' + code + '/standings');
      assert.equal(url.search, '');
      assert.equal(options.headers['X-Auth-Token'], 'test');
      assert(options.signal instanceof AbortSignal);
      return new Response(JSON.stringify({ season: { startDate: '2026-08-14' }, standings: [
        { type: 'HOME', table: [{ position: 9 }] },
        { type: 'TOTAL', table: [{ position: 1, team: { name: 'Test FC' }, playedGames: 3, goalDifference: 5, points: 9 }] },
        { type: 'AWAY', table: [{ position: 8 }] },
      ] }));
    } });
    assert.deepEqual(await api.getStandings(id), { season: 2026, table: [
      { rank: 1, team: { name: 'Test FC' }, all: { played: 3 }, goalsDiff: 5, points: 9 },
    ] });
  }
});

test('API failures log HTTP status and body and still reject', async () => {
  for (const [status, body] of [[401, 'Unauthorized'], [403, 'Restricted'], [429, 'Rate limited'], [500, 'Unavailable'], [200, JSON.stringify({ errorCode: 403, message: 'Restricted' })]]) {
    const logs = [];
    const api = createFootballApi({ apiKey: 'test', logger: { error: (...args) => logs.push(args) },
      fetchImpl: async () => new Response(body, { status }),
    });
    await assert.rejects(api.getStandings('premier-league'));
    assert.equal(logs[0][1], status);
    assert.equal(logs[0][2], body);
  }
});

test('empty standings remain unavailable', async () => {
  for (const standings of [[], [{ type: 'TOTAL', table: [] }], [{ type: 'HOME', table: [{ position: 1 }] }]]) {
    const api = createFootballApi({ apiKey: 'test', fetchImpl: async () => new Response(JSON.stringify({ standings })) });
    assert.equal(await createGetStandings({ footballApi: api })('premier-league'), null);
  }
});

test('adapter rejects invalid responses, missing credentials, unknown leagues, and transport failures', async () => {
  const noFetch = async () => { assert.fail('Unexpected HTTP request'); };
  await assert.rejects(createFootballApi({ fetchImpl: noFetch }).getStandings('premier-league'), /FOOTBALL_DATA_API_KEY/);
  await assert.rejects(createFootballApi({ apiKey: 'test', fetchImpl: noFetch }).getStandings('unknown'), /Unknown league/);
  for (const body of ['not JSON', '{}', JSON.stringify({ standings: [{ type: 'TOTAL', table: [{ position: 1 }] }] })]) {
    const api = createFootballApi({ apiKey: 'test', fetchImpl: async () => new Response(body) });
    await assert.rejects(api.getStandings('premier-league'));
  }
  for (const error of [new Error('Offline'), new DOMException('Timed out', 'TimeoutError')]) {
    const api = createFootballApi({ apiKey: 'test', fetchImpl: async () => { throw error; } });
    await assert.rejects(api.getStandings('premier-league'), (actual) => actual === error);
  }
});

test('Fastify health endpoint responds without Telegram or external requests', async (t) => {
  const server = createServer({ logger: false });
  t.after(() => server.close());
  const response = await server.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
});

test('Telegram keyboard and callbacks use the injected standings scenario', async () => {
  let fail = false;
  let unavailable = false;
  let expectedId = 'premier-league';
  const bot = createBot({ token: 'test', getStandings: async (id) => {
    assert.equal(id, expectedId);
    if (fail) throw new Error('Offline');
    if (unavailable) return null;
    return { season: 2024, table: [{ rank: 1, team: { name: 'Test FC' }, all: { played: 3 }, goalsDiff: 5, points: 9 }] };
  } });
  bot.botInfo = { id: 1, is_bot: true, username: 'test_bot', first_name: 'Test' };
  const sent = [];
  // Подменяем транспорт Telegraf, сохраняя настоящую обработку команд и callback.
  const Telegram = require('telegraf').Telegram;
  const original = Telegram.prototype.callApi;
  Telegram.prototype.callApi = async function (method, payload) { sent.push({ method, payload }); return true; };
  try {
    const from = { id: 2, is_bot: false, first_name: 'User' };
    const message = { message_id: 1, date: 1, chat: { id: 2, type: 'private' }, from, text: '/leagues', entities: [{ type: 'bot_command', offset: 0, length: 8 }] };
    await bot.handleUpdate({ update_id: 1, message });
    const keyboard = sent[0].payload.reply_markup.inline_keyboard;
    assert.deepEqual(keyboard.map((row) => row[0].callback_data), ['league:premier-league', 'league:la-liga', 'league:bundesliga', 'league:serie-a', 'league:ligue-1']);
    const callback = { update_id: 2, callback_query: { id: 'query', from, chat_instance: 'chat', message, data: 'league:premier-league' } };
    await bot.handleUpdate(callback);
    assert.equal(sent[1].method, 'answerCallbackQuery');
    assert.match(sent[2].payload.text, /2024\/2025/);
    assert.match(sent[2].payload.text, /Test FC/);
    fail = true;
    await bot.handleUpdate(callback);
    assert.equal(sent[4].method, 'sendMessage');
    assert.doesNotMatch(sent[4].payload.text, /Test FC/);

    const sendText = (text) => bot.handleUpdate({ update_id: 3, message: { ...message, text, entities: [] } });
    await sendText('EPL');
    assert.deepEqual(sent.at(-1), sent[4]);
    fail = false;

    for (const [name, id] of [
      ['La Liga', 'la-liga'], ['ла лига', 'la-liga'], ['EPL', 'premier-league'], ['АПЛ', 'premier-league'],
      ['Premier League', 'premier-league'], ['Bundesliga', 'bundesliga'], ['бундеслига', 'bundesliga'],
      ['Serie A', 'serie-a'], ['серия а', 'serie-a'], ['Ligue 1', 'ligue-1'], ['лига 1', 'ligue-1'],
      ['  pReMiEr   LEAGUE  ', 'premier-league'], ['  ЛА   ЛИГА  ', 'la-liga'],
    ]) {
      expectedId = id;
      await bot.handleUpdate({ ...callback, callback_query: { ...callback.callback_query, data: `league:${id}` } });
      const buttonReply = sent.at(-1);
      const count = sent.length;
      await sendText(name);
      assert.equal(sent.length, count + 1);
      assert.deepEqual(sent.at(-1), buttonReply);
    }

    unavailable = true;
    expectedId = 'premier-league';
    await bot.handleUpdate(callback);
    const unavailableReply = sent.at(-1);
    await sendText('АПЛ');
    assert.deepEqual(sent.at(-1), unavailableReply);

    for (const text of ['hello', 'Premier League news', '   ']) {
      await sendText(text);
      assert.deepEqual(sent.at(-1), sent[0]);
    }
  } finally {
    Telegram.prototype.callApi = original;
  }
});

test('configuration validates required tokens and port', () => {
  assert.throws(() => loadConfig({}), /TELEGRAM_BOT_TOKEN/);
  assert.throws(() => loadConfig({ TELEGRAM_BOT_TOKEN: 'test' }), /FOOTBALL_DATA_API_KEY/);
  assert.throws(() => loadConfig({ TELEGRAM_BOT_TOKEN: 'test', FOOTBALL_DATA_API_KEY: 'test', PORT: 'bad' }), /PORT/);
  assert.equal(loadConfig({ TELEGRAM_BOT_TOKEN: 'test', FOOTBALL_DATA_API_KEY: ' key ' }).footballApiKey, 'key');
});
