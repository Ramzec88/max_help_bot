require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4-5',
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  PORT: process.env.PORT || 3000,
  // FAQ content links
  BOOSTY_URL: process.env.BOOSTY_URL || 'https://boosty.to/mishka_max',
  LAVA_TOP_URL: process.env.LAVA_TOP_URL || 'https://lava.top/mishka_max',
  HELPER_BOT_URL: process.env.HELPER_BOT_URL || 'https://max.ru/id320203526914_bot',
};
