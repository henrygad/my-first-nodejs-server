const { default: mongoose } = require('mongoose')
const authorization = require('../middlewares/authorization')
const { customError } = require('../middlewares/error')
const usersData = require('../schema/usersDataSchema')
const router = require('express').Router()

router.get('/stream/notification', authorization, async (req, res, next) => {
    const { authorizeUser } = req

    try {
        // set headers SSE live streaming
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders() // send headers

        const watchStream = usersData.watch([ // wtach for changes made on the user document
            { $match: { 'documentKey.userName': authorizeUser } }
        ])

        const sendData = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`) // send streaming data 
        }

        watchStream.on('change', (change) => { // on change
            if (change.operationType === 'update' && // check for updates made on the notificaion array, only
                change.updateDescription.updateFields['notifications'] &&
                change.updateDescription.updateFields['notifications'].$push
            ) {
                const data = change.updateDescription.updateFields['notifications'].$push // get the newly added notification
                sendData(data) // send notification
            }
        })

        watchStream.on('error', () => {
            throw new Error('Stream error: an error occured while streaming')
        })

        req.on('close', () => { // if clien disconnect
            watchStream.close() // close stream
            res.end() // end streaming 
        })

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/notification/:userToNotify', authorization, async (req, res, next) => {
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
