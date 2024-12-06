const { default: mongoose } = require('mongoose')
const authorization = require('../middlewares/authorization')
const { customError } = require('../middlewares/error')
const usersData = require('../schema/usersDataSchema')
const router = require('express').Router()

router.get('/notifications', authorization, async (req, res, next) => {
    const { authorizeUser } = req

    try {
        const getUser = await usersData.findOne({ userName: authorizeUser }) // check if the user exist
        if (!getUser) throw new Error('bad request: user not found') // throw error if user was not found

        res.json({notifications: getUser.notifications}) // send notifications

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/notification/:userToNotify', async (req, res, next) => {
    const { params: { userToNotify }, body } = req

    try {

        if (!userToNotify.startsWith('@')) throw new Error('bad request: empty fields or invalid userName')  // check if it is a valid username

        const getUser = await usersData.findOne({ userName: userToNotify }) // check if the user exist
        if (!getUser) throw new Error('bad request: user not found') // throw error if user was not found

        const notifyUser = await usersData.findOneAndUpdate({ userName: getUser.userName }, // notify user
            { $push: { notifications: { ...body, checked: false, } } },
            { new: true }
        )
        if (!notifyUser.notifications) throw new Error('Bad request: user not notifyUser')

        res.json({ notified: 'ok' })
    } catch (error) {
        next(new customError(error, 400))
    }

})

router.patch('/notification/viewed/:_id', authorization, async (req, res, next) => {
    const { params: { _id }, authorizeUser } = req

    try {

        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: empty field!')  // verify blogpost id

        const updataNotification = await usersData.findOneAndUpdate(  // edit notification
            { userName: authorizeUser, "notifications._id": _id },
            { $set: { "notifications.$.checked": true } },
            { new: true }
        )
        if (!updataNotification.notifications) throw new Error('Bad request: notificaton was not updated!')

        const notification = updataNotification.notifications.find(item => item._id === _id)
        res.json({ notification })

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/notification/delete/:_id', authorization, async (req, res, next) => {
    const { params: { _id }, authorizeUser } = req

    try {

        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: empty field!')  // verify blogpost id

        const deleteNotification = await usersData.findOneAndUpdate({ userName: authorizeUser },  // delete notification
            { $pull: { notifications: { _id } } },
            { new: true }
        )

        if (!deleteNotification.notifications) throw new Error('Bad request: notificaton was not deleted!')

        res.json({ _id })

    } catch (error) {

        next(new customError(error, 400))
    }
})

module.exports = router
