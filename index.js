require('dotenv').config({ quiet: true });
const { loadConfig } = require('./src/config');
const { createApp } = require('./src/createApp');

// Точка входа отвечает за запуск и завершение приложения.
async function main() {
  const config = loadConfig();
  const { server, bot } = createApp(config);
  let closing = false;
  async function shutdown(exitCode) {
    if (closing) return;
    closing = true;
    // Ограничиваем ожидание, если внешний запрос завис при завершении.
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    try {
      await server.close();
    } catch {
      exitCode = 1;
    }
    process.exit(exitCode);
  }

  process.once('SIGINT', () => shutdown(0));
  process.once('SIGTERM', () => shutdown(0));
  try {
    await server.listen({ host: config.host, port: config.port });
    // launch() остаётся активным на протяжении всего long polling.
    await bot.launch();
    await shutdown(0);
  } catch {
    console.error('Failed to run the application. Check configuration and network connection.');
    await shutdown(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
