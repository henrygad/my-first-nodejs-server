const authorization = require('../middlewares/authorization');
const { body, validationResult } = require('express-validator');
const { customError } = require('../middlewares/error');
const router = require('express').Router();
const usersData = require('../schema/usersDataSchema')


router.patch('/profile/drafts/add', [
    body(['_id', 'slug', 'displayImage', 'title', 'body', 'catigory', 'status', 'preStatus', '_html.title', '_html.body'])
        .optional()
        .trim()
        .isString().withMessage("slug, displayImage, title, body, catigory, status, 'preStatus', _html.title, and _html.body must be a string data type")
], authorization, async (req, res, next) => {
    const { body: { _id, displayImage, title, body, _html, catigory, slug, status, preStatus }, authorizeUser } = req

    try {

        const error = validationResult(req)
        if (!error.isEmpty()) throw new Error(error.array().map((error) => error.msg + ' ').join('')) // if there is errors durring validating body throw error

        const getUser = await usersData.findOne({ userName: authorizeUser })
        const drafts = getUser.drafts
        let user = null;
        const draftId = _id || Date.now().toString();

        if (drafts.map((item) => item._id).includes(draftId)) {
            user = await usersData.findOneAndUpdate({ userName: authorizeUser, "drafts._id": drafts },
                {
                    $set: {
                        "drafts.$.displayImage": displayImage,
                        "drafts.$.title": title,
                        "drafts.$.body": body,
                        "drafts.$._html": _html,
                        "drafts.$.catigory": catigory,
                        "drafts.$.slug": slug,
                        "drafts.$preStatus": preStatus,
                        "drafts.$.status": 'draft'
                    }
                },
                { new: true }
            )

        } else {

            user = await usersData.findOneAndUpdate({ userName: authorizeUser },
                { $push: { drafts: { _id: draftId, authorUserName: authorizeUser, displayImage, title, body, _html, catigory, slug, preStatus, status: 'draft' } } },
                { new: true }
            )
        }

        if (!user.drafts) throw new Error('Bad request: draft was not added')

        res.json(user.drafts.find(item => item._id === draftId))

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.patch('/profile/drafts/delete', [
    body('_id')
        .trim()
        .notEmpty().withMessage('_id was not provided')
], authorization, async (req, res, next) => {
    const { body: { _id }, authorizeUser } = req

    try {

        const error = validationResult(req)
        if (!error.isEmpty()) throw new Error(error.array().map((error) => error.msg + ' ').join('')) // if there is errors durring validating body throw error

        const user = await usersData.findOneAndUpdate({ userName: authorizeUser }, // get user
            { $pull: { drafts: { _id } } },
            { new: true }
        )

        if (!user.drafts) throw new Error('Bad request: draft was not delete')

        res.json({ _id })

    } catch (error) {

        next(new customError(error, 404))
    }
})

module.exports = router
