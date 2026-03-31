const { TamTamBotAPI } = require('@maxhub/max-bot-api');
const { BOT_TOKEN } = require('./config');

const bot = new TamTamBotAPI(BOT_TOKEN);

module.exports = bot;
