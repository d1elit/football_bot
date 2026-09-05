// Загружаем переменные из файла .env в process.env.
// quiet: true отключает служебные сообщения библиотеки dotenv.
require('dotenv').config({ quiet: true });
// Telegraf — библиотека для работы с Telegram Bot API.
const { Telegraf } = require('telegraf');
// Фильтр message позволяет выбирать сообщения нужного типа, например текстовые.
const { message } = require('telegraf/filters');

// Проверяем, что токен API_KEY задан и не состоит только из пробелов.
// ?. позволяет вызвать trim() только если API_KEY существует.
if (!process.env.API_KEY?.trim()) {
  console.error('Missing API_KEY. Set your Telegram bot token in .env.');
  // Завершаем программу с кодом ошибки, если токена нет.
  process.exit(1);
}

// Создаём бота с токеном из .env. trim() убирает пробелы по краям.
const bot = new Telegraf(process.env.API_KEY.trim());

// Регистрируем обработчик команды /start.
// ctx содержит данные текущего события, а ctx.reply() отправляет ответ в тот же чат.
bot.start((ctx) => ctx.reply('Hello! Send me a message and I will echo it back.'));
// Отвечаем подсказкой на команду /help.
bot.help((ctx) => ctx.reply('Send any text message to get an echo.'));
// Остальные текстовые сообщения отправляем обратно без изменений (эхо).
// ctx.message.text — текст входящего сообщения.
bot.on(message('text'), (ctx) => ctx.reply(ctx.message.text));

// Обрабатываем ошибки, возникшие при обработке входящих событий.
bot.catch(() => {
  console.error('Failed to handle a Telegram update.');
});

// Запускаем получение событий от Telegram через long polling:
// бот регулярно запрашивает новые события и вызывает подходящие обработчики.
// catch() перехватывает ошибку запуска или работы цикла получения событий.
bot.launch().catch(() => {
  console.error('Failed to start the bot. Check API_KEY and your network connection.');
  // Устанавливаем код ошибки для завершения процесса.
  process.exitCode = 1;
});

// Останавливаем бота при Ctrl+C (SIGINT) или сигнале завершения (SIGTERM).
// once() означает, что обработчик сработает только один раз для каждого сигнала.
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
