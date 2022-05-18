const { Scenes } = require('telegraf')
const logger = require('../../../logger')
const messages = require('../../messages')

exports.middleware = () => {
    const stage = new Scenes.Stage([
        findCommWizard
    ])
    return stage.middleware()
}

const findCommWizard = exports.findCommWizard = new Scenes.WizardScene(
    'FIND_COMMUNITY_WIZARD',
    async ctx => {
        try {
            ctx.wizard.state.volumeCount = ctx.wizard.state.volumeCount || {}
            ctx.wizard.state.inline_keyboard = ctx.wizard.state.inline_keyboard || makeCommunitiesInlineKeyboard(ctx.wizard.state)

            const initialMessage = {
                text: 'Selecciona la comunidad',
                extras: {
                    reply_markup: {
                        inline_keyboard: ctx.wizard.state.inline_keyboard
                    }
                }
            }
            if (ctx.wizard.state.message) {
                await ctx.editMessageText(initialMessage.text, initialMessage.extras)
                return ctx.wizard.next()
            }
            const message = await ctx.reply(initialMessage.text, initialMessage.extras)
            ctx.wizard.state.message = message
            return ctx.wizard.next()
        } catch (error) { logger.error(error) }
    },
    async ctx => {
        try {
            if (!ctx.callbackQuery) return
            const commId = ctx.callbackQuery.data
            const community = ctx.wizard.state.communities.find(comm => comm._id == commId)

            const { orderCount, userCount, volumeCount } = ctx.wizard.state
            if (undefined === volumeCount[commId]) {
                volumeCount[commId] = await getVolumeNDays(1, commId)
            }

            const inline_keyboard = []
            inline_keyboard.push([
                { text: '<<', callback_data: `step0` }
            ])
            inline_keyboard.push([
                { text: 'Orders 24hs', callback_data: `none` },
                { text: orderCount[commId] || 0, callback_data: `none` }
            ])
            inline_keyboard.push([
                { text: 'Volume 24hs', callback_data: `none` },
                { text: `${volumeCount[commId]} sats`, callback_data: `none` }
            ])
            inline_keyboard.push([
                { text: 'Users', callback_data: `none` },
                { text: userCount[commId] || 0, callback_data: `none` }
            ])
            inline_keyboard.push([
                { text: 'Utilizar por defecto', callback_data: commId }
            ])
            await ctx.editMessageText(`${community.name}\n${community.group}`, {
                reply_markup: { inline_keyboard }
            })
            return ctx.wizard.next()
        } catch (error) { logger.error(error) }
    },
    async ctx => {
        try {
            if (!ctx.callbackQuery) return
            if (ctx.callbackQuery.data === 'step0') {
                await ctx.scene.leave()
                return ctx.scene.enter('FIND_COMMUNITY_WIZARD', ctx.wizard.state)
            }
            const commId = ctx.callbackQuery.data
            ctx.wizard.state.user.default_community_id = commId
            await ctx.wizard.state.user.save()
            await messages.operationSuccessfulMessage(ctx)
            return ctx.scene.leave()
        } catch (error) { logger.error(error) }
    }
)
findCommWizard.command('exit', ctx => ctx.scene.leave())

function makeCommunitiesInlineKeyboard(state) {
    const communities = [].concat(state.communities)
    communities.map(comm => {
        const users = state.userCount[comm._id] || 0
        const orders = state.orderCount[comm._id] || 0
        comm.weight = orders + users
    })
    communities.sort((a, b) => a.weight - b.weight)
    const inline_keyboard = []
    while (communities.length > 0) {
        const lastTwo = communities.splice(-2)
        const lineBtn = lastTwo.reverse().map(comm => ({
            text: `${comm.name}`,
            callback_data: comm._id
        }))
        inline_keyboard.push(lineBtn)
    }
    return inline_keyboard
}

async function getVolumeNDays(days, community_id) {
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - days * 24)
    const filter = {
        status: 'SUCCESS',
        created_at: {
            $gte: yesterday
        }
    }
    if (community_id) filter.community_id = community_id
    const [row] = await Order.aggregate([{
        $match: filter
    }, {
        $group: {
            _id: null,
            amount: { $sum: "$amount" },
            routing_fee: { $sum: "$routing_fee" },
            fee: { $sum: "$fee" },
        }
    }])
    if (!row) return 0
    return row.amount
}
