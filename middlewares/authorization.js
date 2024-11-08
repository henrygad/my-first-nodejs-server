const jwt = require('jsonwebtoken')
const authenticatedUsers = require('../schema/authenticatedUsersSchema')
const { customError } = require('../middlewares/error')
require('dotenv').config()

const SECRETE = process.env.SECRETE

const authorization = async (req, res, next) => {
    const { session: { jwtToken, isLogin } } = req

    try {

        if (!jwtToken?.trim()) {
            throw new Error('Unauthorized, no token provided!') // check if jwtToken is provided
        }

        const { err, decoded } = jwt.verify(jwtToken, SECRETE, (err, decoded) => { // verify jwtToken
            return { err, decoded };
        })

        if (err) {
            if (err.name === 'TokenExpiredError') { // check whether login jwtToken has expired
                throw new Error('Unauthorized, Your login session has expired')
            } else { // check whether jwtToken is valid
                throw new Error('Unauthorized, invalid token!')
            }
        }

        if (jwtToken && !isLogin) throw new Error('Unauthorized, you are log out') // user is logout

        const authenticateUser = await authenticatedUsers.findById(decoded?._id) // check if this user is a valid user
        if (!authenticateUser) throw new Error('Unauthorized, no user was found!')
        req.authorizeUser = authenticateUser.userName // if user is found, attatch the username to the req authorizeUser property

        next()

    } catch (error) {

        next(new customError(error, 401))
    }
}

module.exports = authorization;
