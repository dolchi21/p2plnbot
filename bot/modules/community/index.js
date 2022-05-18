const commands = require('./commands')
const scenes = require('./scenes')

exports.configure = bot => {
    bot.use(scenes.middleware())
    bot.command('findcomms', commands.findCommunity)
}
