require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4-5',
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  PORT: process.env.PORT || 3000,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  // Comma-separated list of staff user IDs who can use /queue in personal chat
  STAFF_USER_IDS: (process.env.STAFF_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
  // FAQ content links
  BOOSTY_URL: process.env.BOOSTY_URL || 'https://boosty.to/mishka_max/posts/cd8ce060-2eb2-4ac3-b075-c7f11b4e506f?share=post_link',
  LAVA_TOP_URL: process.env.LAVA_TOP_URL || 'https://app.lava.top/ru/products/7453f309-e575-459d-ace7-fee14b8dffa6?currency=RUB',
  HELPER_BOT_URL: process.env.HELPER_BOT_URL || 'https://max.ru/id320203526914_bot',
};
