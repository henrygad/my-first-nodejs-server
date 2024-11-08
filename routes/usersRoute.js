const router = require('express').Router()
const authorization = require('../middlewares/authorization')
const authenticatedUser = require('../schema/authenticatedUsersSchema')
const usersData = require('../schema/usersDataSchema')
const bcypt = require('bcryptjs')
const hashPassword = require('../utils/hashPassword')
const { customError } = require('../middlewares/error')
const { validationResult, body } = require('express-validator')

router.get('/users', async (req, res, next) => {// all users
    const { query: { skip = 0, limit = 0 } } = req

    try {
        const users = await usersData // get the login user data
            .find()
            .skip(skip)
            .limit(limit)
            .select('userName name displayImage')

        if (!users) throw new Error('Not Found: no user found')

        res.json(users)

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.get('/users/:userName', async (req, res, next) => { // single user
    const { params: { userName } } = req

    try {

        if (!userName.startsWith('@')) throw new Error('Bad Request: invalid username!')

        const users = await usersData  // get the login user data
            .findOne({ userName })
            .select('email userName name bio country phoneNumber dateOfBirth website displayImage sex followers following interests updatedAt createdAt')

        if (!users) throw new Error('Not Found: no user found')

        res.json(users)

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.get('/authorizeduser', authorization, async (req, res, next) => { // single authorized user
    const { authorizeUser } = req

    try {
        // get the login user data
        const user = await usersData.findOne({ userName: authorizeUser })
        if (!user) throw new Error('Not Found: no user found')

        res.json(user)

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.patch('/editprofile',
    [body(['displayImage', 'name', 'bio', 'dateOfBirth', 'phoneNumber', 'website', 'country', 'sex'])
        .optional()
        .trim()
        .isString().withMessage("displayImage, name, bio, dateOfBirth, phoneNumber, website, country, and sex must be a string data type"),

    body('email')
        .trim()
        .isEmail().withMessage('Must be a valid email.'),
    ], authorization, async (req, res, next) => {
        const { body: { displayImage, name, bio, dateOfBirth, email, phoneNumber, website, country, sex }, authorizeUser } = req

        try {
            const error = validationResult(req)
            if (!error.isEmpty()) throw new Error(error.array().map((error) => error.msg + ' ').join('')) // if there is errors durring validating body throw error

            const updateUserData = await usersData.findOneAndUpdate({ userName: authorizeUser },  // update other user data
                { displayImage, name, bio, dateOfBirth, email, phoneNumber, website, country, sex },
                { new: true }
            )
            if (!updateUserData) throw new Error('bad request: user data was not updated')

            res.json(updateUserData)

        } catch (error) {

            next(new customError(error, 400))
        }

    })

router.delete('/deleteprofile', authorization, async (req, res, next) => {
    const { authorizeUser } = req

    try {
        // logout user
        req.session.jwtToken = null

        // delete user authenticated data
        const deleteAuthenticatedUser = await authenticatedUser.findOneAndDelete({ userName: authorizeUser })
        if (!deleteAuthenticatedUser) throw new Error('bad request: user authenticated data was not deleted ')

        // delete user data            
        const deleteUserData = await usersData.findOneAndDelete({ userName: authorizeUser })
        if (!deleteUserData) throw new Error('bad request: user data was not deleted ')

        res.json({ deleted: 'we are sad to see you go' })

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/changepassword', authorization, async (req, res, next) => {
    const { body: { formalPassword, newPassword }, authorizeUser } = req

    try {

        if (
            !formalPassword ||
            !newPassword
        ) throw new Error('bad request: empty fields')

        // get the user formal password
        const getAuthenticatedUserPassword = await authenticatedUser.findOne({ userName: authorizeUser }).password

        // check if password is authenticated
        const checkOldPassword = bcypt.compareSync(formalPassword, getAuthenticatedUserPassword)
        if (!checkOldPassword) throw new Error('bad request: invalid credentials')

        // hash new password
        const hashedPassword = hashPassword(newPassword)

        // updated password
        const updateAuthenticatedUser = await authenticatedUser.findOneAndUpdate({ userName: authorizeUser }, { password: hashedPassword })
        if (!updateAuthenticatedUser) throw new Error('bad request: password was not changed')

        res.json({ password: 'password sucessfully change to' })

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/changeemail', authorization, async (req, res, next) => {
    const { body: { newEmail }, authorizeUser } = req

    try {

        if (!newEmail) new Error('bad request: empty fields')

        // validate new email

        // updated email
        const updateAuthenticatedUser = await authenticatedUser.findOneAndUpdate({ userName: authorizeUser }, { email: newEmail })
        if (!updateAuthenticatedUser) new Error('bad request: email was not updated')

        // grap the updated user data
        const getUpdatedAuthenticatedUser = await authenticatedUser.findOne({ userName: authorizeUser })

        res.json({ email: getUpdatedAuthenticatedUser.email })

    } catch (error) {

        next(new customError(error, 400))
    }
})

module.exports = router;
