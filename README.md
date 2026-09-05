# Telegram football bot

JavaScript (CommonJS), Telegraf, and Fastify. Requires Node.js 20 or newer.

## Run

1. Run `npm install`.
2. Set `TELEGRAM_BOT_TOKEN` and `FOOTBALL_API_KEY` in `.env` (see `.env.example`). Use a direct API-SPORTS key.
3. Run `npm start`.

Fastify listens at http://127.0.0.1:3000 by default. Optional `HOST` and `PORT` variables override the address. `GET /health` returns `{"status":"ok"}`; it checks the HTTP process, not external service availability.

The bot uses Telegram long polling. Send `/leagues` to choose Premier League, La Liga, Bundesliga, Serie A, or Ligue 1. Standings use season **2024** and display 2024/2025. Each selection makes one API request. Existing Russian messages, `/start`, `/help`, and text echoes are preserved. Stop with Ctrl+C.

## Architecture

C4 diagrams in PlantUML format:

- [Level 1: System context](docs/c4-context.puml)
- [Level 2: Containers](docs/c4-container.puml)
- [Level 3: Components](docs/c4-component.puml)

Render these files with PlantUML and its bundled C4 standard library. The application is one Node.js process containing both the Telegram bot and the HTTP health endpoint. The operator represents a person checking the existing health route; no external monitoring system is assumed.

- `index.js`: entry point, environment loading, startup, and shutdown.
- `src/config.js`: environment validation.
- `src/createApp.js`: connects the use case and concrete adapters through dependency injection.
- `src/domain/leagues.js`: supported league identifiers and names.
- `src/application/getStandings.js`: framework-independent use case; validates the league, selects 2024, and sorts the table.
- `src/infrastructure/football/footballApi.js`: API-SPORTS HTTP adapter, authentication, timeout, response mapping, and failure logging.
- `src/presentation/telegram/createBot.js`: Telegram commands, inline buttons, and message formatting.
- `src/presentation/http/createServer.js`: Fastify server and health endpoint.
- `footballApi.js`: compatibility export for existing root-level imports.

The application layer depends on an injected object exposing `getStandings(leagueId, season)`, not on an HTTP library. The domain has no framework dependencies. Factories do not open network connections; the entry point owns startup. Fastify closes the bot through an `onClose` hook; process shutdown has a 10-second limit.

Run `npm test` for offline tests of the use case, API adapter and failure logs, Telegram commands/callbacks, configuration, and Fastify health route.

References: [Fastify server lifecycle](https://fastify.dev/docs/latest/Reference/Server/), [API-Football](https://www.api-football.com/documentation-v3).
