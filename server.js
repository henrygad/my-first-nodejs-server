const fs = require('fs');
const https = require('https');
const express = require("express")
const Mongoose = require('mongoose')
const MongoStore = require('connect-mongo')
const routes = require('./routes/index')
const session = require('express-session')
const { errorHandler, customError } = require("./middlewares/error")
const cors = require('cors');
const { Domain } = require('domain');
require('dotenv').config()

const app = express()
Mongoose.set('strictQuery', false)

const PORT = process.env.PORT || 4000
const DBURI = process.env.DBURI
const SECRETE = process.env.SECRETE
const NODE_ENV = process.env.NODE_ENV
const oneHour = 3600000

// Middlewares
if (NODE_ENV === 'production') {
    app.set('trust proxy', 1) // needed for sending secure cookies from host servers

    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') { // if req headers is not https req
            return res.redirect(`https://${req.headers.host}${req.url}`) // redirect to https
        }

        next() // continue if https
    })
}

app.use(cors({
    origin: ['https://blogsupapp.netlify.app', 'https://localhost:5173', 'https://localhost:4173'],
    credentials: true // send cookies to cross-orgin request resourse
}))

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

Mongoose.connect(DBURI) // connect DB
    .then(() => {

        app.use(session({ // create client session
            name: 'blogbackser',
            secret: SECRETE,
            resave: false,
            saveUninitialized: false,
            cookie: {
                expires: new Date(Date.now() + (oneHour * 24 * 7)), // expires in 25hrs from now
                maxAge: (oneHour * 24 * 7), // live for 24hrs
                httpOnly: true, // prevents client-side access for security
                secure: true, // ensures cookies are sent over HTTPS
                sameSite: 'None', // for cross-origin request (to sent cookies to a different domain)
            },
            store: MongoStore.create({
                client: Mongoose.connection.getClient() // save session to DB store
            })
        }))

        app.get('/', (req, res) => {
            const { session } = req

            req.session.visited = true
            req.session.save(err => {
                if (err) {
                    console.log('Session save error:', err);
                }
            });

            res.json({
                greetings: `Hi!, you ${session.isLogin ? 'login' : ' loged out'}`,
                sessionId: session.id,
                searchHistory: session.searchHistory,
            })
        })

        app.use('/api', routes)

        app.all('*', (req, res, next) => {
            next(new customError(`Can't find ${req.originalUrl} on this server!`, 404))
        })

        app.use(errorHandler) // middleware to handle error globally

        if (NODE_ENV === 'production') {
            app.listen(PORT, () =>
                console.log('serving running on a Host Server' + ' ' + PORT)
            )
        } else {
            const options = {
                key: fs.readFileSync('./certs/localhost-key.pem'),
                cert: fs.readFileSync('./certs/localhost.pem'),
            };

            https.createServer(options, app).listen(PORT, () =>
                console.log('Server running on localhost' + ' ' + PORT)
            )
        }

    })
    .catch((err) => {
        const error = new customError('Network or server error')
        console.log(error.message)
    })
