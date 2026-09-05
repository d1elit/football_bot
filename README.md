# Telegram bot

Minimal Node.js bot written in JavaScript using [Telegraf](https://telegraf.js.org/).

1. Install dependencies: `npm install`.
2. Set `TELEGRAM_BOT_TOKEN` and `FOOTBALL_API_KEY` in `.env` (see `.env.example`). Use a direct API-SPORTS key.
3. Run `npm start`.

Use Node.js 18 or newer (the API module uses native `fetch`).

Send `/leagues` and select Premier League, La Liga, Bundesliga, Serie A, or Ligue 1. The bot displays position, team, matches played, goal difference, and points for the season marked current by API-Football. Each selection makes up to two API requests. Your API plan must allow access to that season.

`footballApi.js` handles requests, timeouts, and API errors. `index.js` handles Telegram commands and buttons. See the [API-Football current season guide](https://www.api-football.com/news/post/how-to-get-standings-for-all-current-seasons).

The bot also responds to `/start` and `/help`, and echoes text messages. Stop it with Ctrl+C.
