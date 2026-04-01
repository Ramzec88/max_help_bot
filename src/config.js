require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4-5',
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  PORT: process.env.PORT || 3000,
};
