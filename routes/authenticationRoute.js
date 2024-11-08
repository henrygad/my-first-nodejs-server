const router = require('express').Router()
const authenticatedUsers = require('../schema/authenticatedUsersSchema')
const usersData = require('../schema/usersDataSchema')
const hashPassword = require('../utils/hashPassword')
const { body, validationResult } = require('express-validator')
const jwt = require('jsonwebtoken')
const bcypt = require('bcryptjs')
const authorization = require('../middlewares/authorization')
const { customError } = require('../middlewares/error')
const sendEmail = require('../middlewares/sendEmails')
require('dotenv').config()

const SECRETE = process.env.SECRETE

router.get('/status', authorization, (req, res, next) => {
    const { authorizeUser, session, } = req
    try {

        if (!session?.searchHistory?.length) {
            session.searchHistory = [] // add an arr of search history property to the session for the first time
        }

        const isLogin = session?.isLogin
        res.json({
            greetings: `Hi! ${authorizeUser} you, ${isLogin ? ' login' : ' loged out'}`,
            isLogin,
            loginUserName: authorizeUser,
            sessionId: session.id,
            searchHistory: session.searchHistory,
        })

    } catch (error) {
        next(new customError(error, 400))
    }

})

router.post('/signup',
    [
        body('userName')
            .trim()
            .isLength({ min: 5 }).withMessage('Username must be at least 5 characters long.')
            .escape(),

        body('email')
            .trim()
            .isEmail().withMessage('Must be a valid email.'),

        body('password')
            .trim()
            .escape()
            .isStrongPassword()
            .withMessage('Password is not strong enough, must be at least 8 characters long.')

    ], async (req, res, next) => {
        const { body: { userName, email, password, comfirmPassword }, session } = req

        try {

            const error = validationResult(req)
            if (!error.isEmpty()) throw new Error(error.array().map((error) => error.msg + ' ').join('')) // if there is errors durring validating body throw error
            if (password !== comfirmPassword) throw new Error('Comfirmation passwords did not match!') // comfirm whether password and comfirmation password is the same for accurrancy

            const userNameUnavialiable = await authenticatedUsers.findOne({ userName: '@' + userName })  // check if username is available
            if (userNameUnavialiable) throw new Error('This username is not avaliable!')

            const emailUnavialable = await authenticatedUsers.findOne({ email }) // also check if therr is a user with this email
            if (emailUnavialable) throw new Error('There is an account with this email, try login!')

            const hashedPassword = hashPassword(password) // hash password 

            const createNewUser = await authenticatedUsers.create({ userName: '@' + userName, email, password: hashedPassword }) // create a new authenticated user
            if (!createNewUser) throw new Error('Bad resquest: user was not created')

            await usersData.create({ userName: createNewUser.userName, email: createNewUser.email, timeline: [createNewUser.userName] }) // create a new user space for each new user

            const token = jwt.sign({ _id: createNewUser._id }, SECRETE, { expiresIn: '24h' }) // generate authentication token and assign it to user
            req.session.jwtToken = token // attach authentication  token to req property
            req.session.isLogin = req.session.jwtToken ? true : false // login user

            const emailOTP = Math.floor(Math.random() * 10000) // generate new OPT Token

            sendEmail({ // send an email verification OPT token to the user mail box
                to: createNewUser.email, // recipient email
                subject: 'OTP Email Verification', // email subject
                // text: 'This is a test email sent using Nodemailer!', // plain text body
                html: `<h1 style="color: green, font-weight: bold" >Blogger Logo</h1> 
                 <div>
                   <div style=" display: font-size:20px">Verify your email henrygad.orji@gmail.com</div>
                   <div>Verification Token: ${emailOTP}</div>
                 </div>`, // html body
            })

            req.session.emailVerificationToken = null // clear up any avaliable email verification OTP token
            const jwtEmailOTPToken = jwt.sign({ emailOTP }, SECRETE, { expiresIn: '24h' }) // assign new one
            req.session.emailVerificationToken = jwtEmailOTPToken //  attached the new email verification OTP token to the req session object

            const isLogin = req.session.isLogin
            res.json({  //send back athorizetion
                greetings: `Hi! ${createNewUser.userName}`,
                isLogin,
                loginUserName: createNewUser.userName,
                sessionId: session.id,
                searchHistory: session.searchHistory,
            })

        } catch (error) {

            next(new customError(error, 500))
        }
    })

router.post('/login',
    [
        body(['value', 'password'])
            .trim()
            .notEmpty().withMessage('Field cannot be empty')
            .escape(),

    ], async (req, res, next) => {
        const { body: { value, password }, session } = req

        try {

            const error = validationResult(req)
            if (!error.isEmpty()) throw new Error(error.array().map((error) => error.msg + ' ').join('')) // if there is errors durring validating body throw error

            let userExist = null // declear a exiting user varible

            userExist = await authenticatedUsers.findOne({ userName: "@" + value }) // check if user already exist by username 
            if (!userExist) userExist = await authenticatedUsers.findOne({ email: value })  // if user does'nt already exist by userName, check if user exist by email
            if (!userExist) throw new Error('Invalid credentials!') // if user does'nt exist either by userName or email

            const validPassword = bcypt.compareSync(password, userExist.password) // compare raw password with hashed password
            if (!validPassword) throw new Error('Invalid credentials!') // if password is not valid

            const token = jwt.sign({ _id: userExist._id }, SECRETE, { expiresIn: '24h' }) // generate authentication token and assign it to user
            req.session.jwtToken = token // attach authentication  token to req property
            req.session.isLogin = req.session.jwtToken ? true : false // login user
            const isLogin = req.session.isLogin // get login  status

            res.json({ //send back athorizetion
                greetings: `Hi! ${userExist.userName}`,
                isLogin,
                loginUserName: userExist.userName,
                sessionId: session.id,
                searchHistory: session.searchHistory,
            })

        } catch (error) {

            next(new customError(error, 400))
        }
    })

router.post('/logout', authorization, async (req, res, next) => {
    const { authorizeUser, session } = req
    try {
        session.isLogin = false // logout user
        const isLogin = session.isLogin
        res.json({
            isLogin,
            loginUserName: '',
            greetings: `Hi! ${authorizeUser} you loged out `,
            sessionId: session.id,
            searchHistory: session.searchHistory,
        })

    } catch (error) {
        next(new customError(error, 400))
    }
})

router.post('/forgetpassword', async (req, res, next) => {
    const { body: { value } } = req
    let userExist = null

    try {

        // if fields are empty
        if (!value) throw new Error('empty field!')

        // check if user already exist by username 
        userExist = await authenticatedUsers.findOne({ userName: "@" + value })

        // if user does'nt already exist by userName, check if user exist by email
        if (!userExist) userExist = await authenticatedUsers.findOne({ email: value })

        // if user does'nt exist either by userName or email
        if (!userExist) throw new Error(`no user with this ${value}!`)

        // send a part to change password
        res.json({ email: userExist.email, url: `api/changeforgetpassword/:${tokenFor30min}` })

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.post('/verifyemail',
    [
        body('OTP')
            .trim()
            .notEmpty().withMessage('No OTP provided!')
            .escape()
    ], authorization, async (req, res, next) => {
        const { body: { OTP }, session, authorizeUser } = req;

        try {
            const error = validationResult(req)
            if (!error.isEmpty()) throw new Error(error.array().map((error) => error.msg + ' ').join('')) // if there is errors durring validating body throw error

            jwt.verify(session.emailVerificationToken, SECRETE, (err, decoded) => {// veriry email OTP jwt token
                if (err) {
                    if (err.name === 'TokenExpiredError') { // check whether login jwtToken has expired
                        throw new Error('Invalid OPT token!')
                    } else { // check whether jwtToken is valid
                        throw new Error('Invalid OPT token!')
                    }
                }
                const emailOTP = decoded.emailOTP // get OTP
                if (emailOTP !== parseFloat(OTP)) throw new Error('Invalid OPT token!') // throw error if decode opt did not match with the incoming opt
            })

            res.json({  // send back athorizetion
                greetings: `Hi! ${authorizeUser}`,
                isLogin: session.isLogin,
                loginUserName: authorizeUser,
                sessionId: session.id,
                searchHistory: session.searchHistory,
            })

        } catch (error) {

            next(new customError(error, 400))
        }
    })

router.patch('/changeforgetpassword/:jwtTokenFor30min', async (req, res, next) => {
    const { params: { jwtTonkenFor30min } } = req

    try {

        // if fields are empty
        if (!jwtTonkenFor30min) throw new Error('empty field!')

        // validate jwtTonkenFor30min

        // check if user exist by email
        const userExist = await authenticatedUsers.findOne({ email: value })
        if (!userExist) throw new Error('invalid credentials!')

        // allowed this user to change password
        res.json({ userName: userExist.userName, email: userExist.email })

    } catch (error) {

        next(new customError(error, 400))
    }
})


module.exports = router
