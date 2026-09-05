// Чтение окружения сосредоточено на границе приложения.
function loadConfig(env = process.env) {
  for (const name of ['TELEGRAM_BOT_TOKEN', 'FOOTBALL_DATA_API_KEY']) {
    if (!env[name]?.trim()) throw new Error(`Missing ${name}. Set it in .env.`);
  }
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535.');
  }
  return {
    telegramToken: env.TELEGRAM_BOT_TOKEN.trim(),
    footballApiKey: env.FOOTBALL_DATA_API_KEY.trim(),
    host: env.HOST?.trim() || '127.0.0.1',
    port,
  };
}

module.exports = { loadConfig };
