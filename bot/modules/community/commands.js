//@ts-check
const logger = require('../../../logger');
const { Community, Order, User } = require("../../../models");
const { parseArgs, getCurrency, countGroupBy } = require("../../../util");
const { validateUser } = require("../../validations");

exports.findCommunity = async ctx => {
    try {
        const user = await validateUser(ctx, false)
        if (!user) return

        const [com, u_fiatCode] = parseArgs(ctx.message.text)
        const currency = getCurrency(u_fiatCode.toUpperCase())
        if (!currency) return ctx.reply('InvalidCurrencyCode')

        const communities = await Community.find({ currencies: currency.code })

        const userCount = await countGroupBy(User, 'default_community_id', {})
        const yesterday = new Date()
        yesterday.setHours(yesterday.getHours() - 24 * 10)
        const orderCount = await countGroupBy(Order, 'community_id', {
            status: 'SUCCESS',
            created_at: {
                $gte: yesterday
            }
        })

        return ctx.scene.enter('FIND_COMMUNITY_WIZARD', {
            user,
            communities,
            orderCount,
            userCount
        })
    } catch (error) {
        logger.error(error)
    }
}
