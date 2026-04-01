const { Bot } = require('@maxhub/max-bot-api');
const { BOT_TOKEN } = require('./config');

const bot = new Bot(BOT_TOKEN);

module.exports = bot;
