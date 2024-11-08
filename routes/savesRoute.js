const router = require('express').Router()
const authorization = require('../middlewares/authorization')
const { customError } = require('../middlewares/error')
const usersData = require('../schema/usersDataSchema')
const mongoose = require('mongoose')

router.patch('/profile/saves/add', authorization, async (req, res, next) => {
    const { body: { _id }, authorizeUser } = req

    try {
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: invalid blogpost _id!')

        const getUser = await usersData.findOne({ userName: authorizeUser })
        if (getUser.saves.includes(_id)) throw new Error('Bad request: blogpost already saved by you')

        const user = await usersData.findOneAndUpdate({ userName: authorizeUser },
            { $push: { saves: _id } },
            { new: true }
        )
        if (!user.saves.length) throw new Error('Bad request: blogpost was not saved')

        res.json({ _id })

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.patch('/profile/saves/delete', authorization, async (req, res, next) => {
    const { body: { _id }, authorizeUser } = req

    try {
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: invalid blogpost _id!')

        const user = await usersData.findOneAndUpdate({ userName: authorizeUser },
            { $pull: { saves: _id } },
            { new: true }
        )
        
        res.json({ _id })

    } catch (error) {

        next(new customError(error, 404))
    }
})

module.exports = router