require('dotenv').config()

class customError extends Error {
    constructor(message, statusCode) {
        super(message)
        this.statusCode = statusCode
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'
        this.isOperational = true

        Error.captureStackTrace(this, this.constructor)
    }
}

const errorHandler = (err, req, res, next) => {

    res.status(err.statusCode || 500).json({
        status: err.status,
        message: err.message,
        code: err.statusCode,
        isOperational: err.isOperational,
        date: Date(),
       //stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    })
}

module.exports = {
    errorHandler,
    customError,
}