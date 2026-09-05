const Fastify = require('fastify');

// HTTP-сервер создаётся отдельно от запуска, чтобы тестировать его через inject().
function createServer({ logger = true } = {}) {
  const server = Fastify({ logger });
  server.get('/health', async () => ({ status: 'ok' }));
  return server;
}

module.exports = { createServer };
