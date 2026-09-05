const { createFootballApi } = require('./infrastructure/football/footballApi');
const { createGetStandings } = require('./application/getStandings');
const { createBot } = require('./presentation/telegram/createBot');
const { createServer } = require('./presentation/http/createServer');

// Здесь связываем конкретные адаптеры со сценарием приложения.
function createApp(config) {
  const footballApi = createFootballApi({ apiKey: config.footballApiKey });
  const getStandings = createGetStandings({ footballApi });
  const bot = createBot({ token: config.telegramToken, getStandings });
  const server = createServer();

  server.addHook('onClose', async () => {
    try {
      bot.stop('Server closing');
    } catch (error) {
      // stop() может быть вызван до окончания запуска Telegram.
      if (error.message !== 'Bot is not running!') throw error;
    }
  });

  return { server, bot };
}

module.exports = { createApp };
