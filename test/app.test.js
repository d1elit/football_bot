const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGetStandings } = require('../src/application/getStandings');
const { createFootballApi } = require('../src/infrastructure/football/footballApi');
const { createServer } = require('../src/presentation/http/createServer');
const { createBot } = require('../src/presentation/telegram/createBot');
const { loadConfig } = require('../src/config');

test('standings use 2024, sort without mutating the repository result, and reject unknown leagues', async () => {
  const table = [{ rank: 2 }, { rank: 1 }];
  const getStandings = createGetStandings({ footballApi: {
    async getStandings(id, season) {
      assert.equal(id, 39);
      assert.equal(season, 2024);
      return table;
    },
  } });
  const result = await getStandings(39);
  assert.equal(result.season, 2024);
  assert.deepEqual(result.table.map((row) => row.rank), [1, 2]);
  assert.equal(table[0].rank, 2);
  await assert.rejects(getStandings(999), /Unknown league/);
});

test('API adapter sends authentication and season and maps standings', async () => {
  const api = createFootballApi({ apiKey: 'test', fetchImpl: async (url, options) => {
    assert.equal(url.origin, 'https://v3.football.api-sports.io');
    assert.equal(url.pathname, '/standings');
    assert.equal(url.searchParams.get('league'), '39');
    assert.equal(url.searchParams.get('season'), '2024');
    assert.equal(options.headers['x-apisports-key'], 'test');
    assert(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ errors: [], response: [{ league: { standings: [[{
      rank: 1, team: { name: 'Test FC' }, all: { played: 3 }, goalsDiff: 5, points: 9,
    }]] } }] }));
  } });
  assert.equal((await api.getStandings(39, 2024))[0].team.name, 'Test FC');
});

test('API failures log HTTP status and body and still reject', async () => {
  for (const [status, body] of [[429, 'Rate limited'], [200, JSON.stringify({ errors: { plan: 'Restricted' }, response: [] })]]) {
    const logs = [];
    const api = createFootballApi({ apiKey: 'test', logger: { error: (...args) => logs.push(args) },
      fetchImpl: async () => new Response(body, { status }),
    });
    await assert.rejects(api.getStandings(39, 2024));
    assert.equal(logs[0][1], status);
    assert.equal(logs[0][2], body);
  }
});

test('empty standings remain unavailable', async () => {
  const api = createFootballApi({ apiKey: 'test', fetchImpl: async () => new Response('{"errors":[],"response":[]}') });
  assert.equal(await createGetStandings({ footballApi: api })(39), null);
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
  let expectedId = 39;
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
    assert.deepEqual(keyboard.map((row) => row[0].callback_data), ['league:39', 'league:140', 'league:78', 'league:135', 'league:61']);
    const callback = { update_id: 2, callback_query: { id: 'query', from, chat_instance: 'chat', message, data: 'league:39' } };
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
      ['La Liga', 140], ['ла лига', 140], ['EPL', 39], ['АПЛ', 39],
      ['Premier League', 39], ['Bundesliga', 78], ['бундеслига', 78],
      ['Serie A', 135], ['серия а', 135], ['Ligue 1', 61], ['лига 1', 61],
      ['  pReMiEr   LEAGUE  ', 39], ['  ЛА   ЛИГА  ', 140],
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
    expectedId = 39;
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
  assert.throws(() => loadConfig({ TELEGRAM_BOT_TOKEN: 'test' }), /FOOTBALL_API_KEY/);
  assert.throws(() => loadConfig({ TELEGRAM_BOT_TOKEN: 'test', FOOTBALL_API_KEY: 'test', PORT: 'bad' }), /PORT/);
});
