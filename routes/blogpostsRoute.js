const authorization = require("../middlewares/authorization")
const { customError } = require("../middlewares/error")
const router = require("express").Router()
const blogpostsData = require('../schema/blogpostsSchema')
const { validationResult, body } = require('express-validator')
const mongoose = require('mongoose')

router.get('/blogposts', async (req, res, next) => {
    const { query: { status = 'published', skip = 0, limit = 0 } } = req

    try {

        const blogposts = await blogpostsData // get all blogposts
            .find({ status })
            .skip(skip)
            .limit(limit)

        if (!blogposts.length) throw new Error('Not Found: no blogposts found')

        res.json(blogposts.sort((a, b) => b.views.length - a.views.length))

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.get('/blogposts/:authorUserName', authorization, async (req, res, next) => {
    const { params: { authorUserName }, query: { status = 'published', skip = 0, limit = 0 } } = req

    try {

        if (!authorUserName.startsWith('@')) throw new Error('Bad Request: invalid username!')

        // get all user blogposts
        const userBlogposts = await blogpostsData
            .find({ authorUserName, status })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        if (!userBlogposts.length) throw new Error('Not Found: no blogposts found')

        res.json(userBlogposts)

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.get('/blogpost/:authorUserName/:slug', async (req, res, next) => {
    const { params: { authorUserName, slug } } = req
    const url = authorUserName + '/' + slug

    try {

        if (!url) throw new Error('Bad Request: invalid url!')

        const blogpost = await blogpostsData.findOne({ url })

        if (!blogpost) throw new Error('Not Found: no blogpost found')

        res.json(blogpost);
    } catch (error) {

        next(new customError(error, 404))
    }
})

router.get('/blogposts/timeline/:timeline', authorization, async (req, res, next) => {
    const { params: { timeline }, query: { status = 'published', skip = 0, limit = 0 } } = req

    try {

        if (timeline.trim() === '') throw new Error('Bad Request: empty field!')

        const getArrOfUserNames = timeline.split('&');
        getArrOfUserNames.map(item => {
            if (!item.startsWith('@')) throw new Error('Bad Request: invalid username!')
        })

        const getFeeds = await blogpostsData
            .find({ authorUserName: { $in: getArrOfUserNames }, status: 'published' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
        if (!getFeeds.length) throw new Error('Bad Request: no blogpost found!')

        res.json(getFeeds)

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.get('/stream/changes/blogposts/timeline/:timeline', async (req, res, next) => {
    const { params: { timeline }, query: { status = 'published', skip = 0, limit = 0 } } = req

    try {

        // set headers SSE live streaming
        res.setHeader('Content-Type', 'text/event-stream') // setup sse live connection to info client
        res.setHeader('Cache-Control', 'no-cache') // disable caching to ensure live data
        res.setHeader('Connection', 'keep-alive') //  keep the connection alive for continues data streaming
        res.flushHeaders() // send headers

        if (timeline.trim() === '') throw new Error('Bad Request: empty field!')

        const getArrOfUserNames = timeline.split('&')
        getArrOfUserNames.map(item => {
            if (!item.startsWith('@')) throw new Error('Bad Request: invalid username!')
        })

        const watchStream = blogpostsData.watch() // wtach for changes

        const sendData = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`) // send streaming data 
        }

        watchStream.on('change', (change) => { // on change
            if (change.operationType === 'insert') {
                const data = change.fullDocument // get changes
                if (getArrOfUserNames.includes(data.authorUserName) &&
                    data.status === 'published') { // if author is part of the user timeline and a published blogpost
                    sendData(change.fullDocument) // send data one at the time
                }
            }
        });

        watchStream.on('error', () => {
            throw new Error('Stream error: an error occured while streaming')
        })

        req.on('close', () => { // if clien disconnect
            watchStream.close() // close stream
            res.end() // end streaming 
        })

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.get('/blogposts/saves/:_ids', authorization, async (req, res, next) => {
    const { params: { _ids }, query: { status = 'published', skip = 0, limit = 0 } } = req

    try {

        if (_ids.trim() === '') throw new Error('Bad Request: empty field!')

        const getArrOfBlogpostIds = _ids.split('&');
        getArrOfBlogpostIds.map(_id => {
            if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: invalid blogpost id!') // verify blogpost id
        })

        const getSavedBlogpost = await blogpostsData
            .find({ _id: { $in: getArrOfBlogpostIds }, status })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
        if (!getSavedBlogpost.length) throw new Error('Bad Request: no blogpost found!')

        res.json(getSavedBlogpost)

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.post('/addblogpost',
    [body('slug')
        .trim()
        .notEmpty().withMessage('slug field must not be empty')
        .isString().withMessage('slug must be a string'),

    body(['slug, displayImage', 'title', 'body', 'catigory', 'status', '_html.body', '_html.title',])
        .optional()
        .trim()
        .isString().withMessage("slug, displayImage, title, body, catigory, status, _html.title, and _html.body must be a string data type"),
    ], authorization, async (req, res, next) => {
        const { body: { displayImage, title, body, _html, catigory, slug }, authorizeUser } = req

        try {

            const error = validationResult(req)
            if (!error.isEmpty()) throw new Error(error.array().map((error) => error.msg + ' ').join('')) // if there is errors durring validating body throw error

            let validateSlug = ''; // prevent duplicated blogpost slug
            const blogpostSlugExist = await blogpostsData.findOne({ slug }) // check if there is a bleogpost with this new blogpost slug

            if (blogpostSlugExist) {
                validateSlug = slug + Date.now(); // change the new blogpost slug
            } else {
                validateSlug = slug // else continue with the new blogpost slug
            }

            const createUrl = authorizeUser + '/' + validateSlug

            const addBlogpost = await blogpostsData.create({  // create blogpost
                displayImage,
                authorUserName: authorizeUser,
                title,
                body,
                _html,
                catigory,
                url: createUrl,
                slug: validateSlug,
                status: 'published'
            })

            if (!addBlogpost) throw new Error('Bad Request: blogpost not created!')

            res.json(addBlogpost)

        } catch (error) {

            next(new customError(error, 400))
        }
    })

router.patch('/editblogpost/:_id',
    [body(['displayImage', 'title', 'body', 'catigory', 'status', '_html.title', '_html.body'])
        .optional()
        .trim()
        .isString().withMessage("displayImage, title, body, catigory, status,  _html.title, and _html.body must be a string data type"),
    ], authorization, async (req, res, next) => {
        const { params: { _id }, body: { displayImage, title, body, _html, catigory, status } } = req

        try {

            if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: invalid blogpost id!') // verify blogpost id

            const error = validationResult(req)
            if (!error.isEmpty()) throw new Error(error.array().map((error) => error.msg + ' ').join('')) // if there is errors durring validating body throw error

            const updateBlogpost = await blogpostsData.findByIdAndUpdate({ _id },  // update this blogpost
                {
                    displayImage,
                    title,
                    body,
                    _html,
                    catigory,
                    status: status || 'published',
                },
                { new: true }
            )
            if (!updateBlogpost) throw new Error('Bad Request: blogpost was not updated!')

            res.json(updateBlogpost)

        } catch (error) {

            next(new customError(error, 400))
        }
    })

router.delete('/deleteblogpost/:_id', authorization, async (req, res, next) => {
    const { params: { _id, } } = req

    try {
        // verify blogpost id
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: empty field!')

        // delete blogpost
        const deleteBlogpost = await blogpostsData.findByIdAndDelete({ _id })
        if (!deleteBlogpost) throw new Error('Bad Request: blogpost was not deleted')

        res.json({ deleted: 'sucessfully deleted blogpost' })

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.get('/blogpost/like/:_id', authorization, async (req, res, next) => {
    const { params: { _id } } = req

    try {

        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('bad request: inavlid comment id') // verify comment id

        const getBlogpost = await blogpostsData.findById({ _id }) // get comment
        if (!getBlogpost.likes) throw new Error('Bad Request: blogpost was not found!') // error if blogpost was not found

        res.json(getBlogpost.likes)

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/likeblogpost/:_id', authorization, async (req, res, next) => {
    const { params: { _id }, authorizeUser } = req
    try {
        // verify blogpost id
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: empty field!')

        // check if the blogpost has beem liked by this user, if yes return
        const getBlogpost = await blogpostsData.findById({ _id });
        if (getBlogpost.likes.includes(authorizeUser)) throw new Error('Bad Request: blogpost already been liked by this user!')

        // like blogpost
        const likedBlogpost = await blogpostsData.findByIdAndUpdate({ _id: getBlogpost._id },
            { $push: { likes: authorizeUser } },
            { new: true }
        )
        if (!likedBlogpost.likes) throw new Error('Bad Request: blogpost was not liked!')

        res.json({ like: authorizeUser });

    } catch (error) {
        next(new customError(error, 400))
    }
})

router.patch('/unlikeblogpost/:_id', authorization, async (req, res, next) => {
    const { params: { _id }, authorizeUser } = req

    try {
        // verify blogpost id
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: empty field!')

        // unlike blogpost
        const unlikedBlogpost = await blogpostsData.findByIdAndUpdate({ _id },
            { $pull: { likes: authorizeUser } },
            { new: true }
        )
        if (!unlikedBlogpost.likes) throw new Error('Bad Request: blogpost was not unliked!')

        res.json({ unlike: authorizeUser });

    } catch (error) {
        next(new customError(error, 400))
    }
})

router.get('/blogpost/share/:_id', authorization, async (req, res, next) => {
    const { params: { _id } } = req

    try {

        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('bad request: inavlid comment id') // verify comment id

        const getBlogpost = await blogpostsData.findById({ _id }) // get comment
        if (!getBlogpost.likes) throw new Error('Bad Request: blogpost was not found!') // error if blogpost was not found

        res.json(getBlogpost.shares)

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/blogposts/share/:_id', async (req, res, next) => {
    const { params: { _id }, session } = req

    try {
        // verify blogpost id
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: empty field!')

        let sharedBogpost = null
        const getBlogpost = await blogpostsData.findById({ _id }) // get blogpost

        if (getBlogpost.shares.includes(session.id)) { // if this user (browser) has share this blogpost, then retrun the exising data
            sharedBogpost = getBlogpost.shares
        } else { // add new you session id to the blospost shares
            const response = await blogpostsData.findByIdAndUpdate({ _id: getBlogpost._id },
                { $push: { shares: session.id } },
                { new: true }
            )
            sharedBogpost = response.shares
        }
        if (!sharedBogpost) throw new Error('Bad Request: blogpost shared was not added!');

        res.json({ share: session.id })

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.get('/blogpost/view/:_id', authorization, async (req, res, next) => {
    const { params: { _id } } = req

    try {

        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('bad request: inavlid comment id') // verify comment id

        const getBlogpost = await blogpostsData.findById({ _id }) // get comment
        if (!getBlogpost.likes) throw new Error('Bad Request: blogpost was not found!') // error if blogpost was not found

        res.json(getBlogpost.views)

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/viewblogpost/:_id', async (req, res, next) => {
    const { params: { _id }, session } = req

    try {

        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: empty field!') // verify blogpost id

        let viewedBlogpost = null
        const getBlogpost = await blogpostsData.findById({ _id }) // get blogpost

        if (getBlogpost.views.includes(session.id)) { // if this user (browser) has view this blogpost
            viewedBlogpost = getBlogpost.views  //  retrun the exising data
        } else {
            const response = await blogpostsData.findByIdAndUpdate({ _id: getBlogpost._id }, // add new view to the blogpost views
                { $push: { views: session.id } },
                { new: true }
            )

            viewedBlogpost = response.views
        }
        if (!viewedBlogpost) throw new Error('Bad Request: blogpost view was not added!')

        res.json({ view: session.id })

    } catch (error) {

        next(new customError(error, 400))
    }
})

module.exports = router
