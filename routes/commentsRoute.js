const { validationResult, body } = require("express-validator")
const authorization = require("../middlewares/authorization")
const { customError } = require("../middlewares/error")
const router = require("express").Router()
const commentsData = require('../schema/commentsSchema')
const mongoose = require('mongoose')

router.get('/comments', async (req, res, next) => {
    const { query: { skip = 0, limit = 0 } } = req

    try {

        const comments = await commentsData  // get all comments
            .find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        if (!comments.length) throw new Error('Not Found: no comment found') // error if none found

        res.json(comments)

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.get('/comments/:_id', async (req, res, next) => {
    const { params: { _id } } = req

    try {

        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Not Found: invalid comment id') // verify comment id

        const comment = await commentsData  // get single comment with it children
            .findById({ _id })

        if (!comment) throw new Error('Not Found: no comment was found') // error if no comment found

        res.json(comment)

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.get('/comments/blogpost/:blogpostId', async (req, res, next) => {
    const { params: { blogpostId }, query: { parentId = null, skip = 0, limit = 0 } } = req

    try {

        if (!mongoose.Types.ObjectId.isValid(blogpostId)) throw new Error('Not Found: invalid blogpost id') // verify blogpost id

        const comment = await commentsData   // get all blogpost releted comments
            .find({  blogpostId, parentId })
            .skip(skip)
            .limit(limit)
        if (!comment) throw new Error('Not Found: no comment was found') // error if no comment found

        res.json(comment)

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.get('/usercomments/:authorUserName', authorization, async (req, res, next) => {
    const { params: { authorUserName }, query: { skip = 0, limit = 0 } } = req

    try {

        // get all user comments
        const userComments = await commentsData
            .find({ authorUserName })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })

        if (!userComments.length) throw new Error('Not Found: no comment found')

        res.json(userComments)

    } catch (error) {

        next(new customError(error, 404))
    }
})

router.post('/addcomment', [
    body('blogpostId')
        .trim()
        .notEmpty().withMessage('blogpostId field must not be empty')
        .isString().withMessage('blogpostId must be a string'),

    body(['parentUrl', 'body._html', 'body.text', 'children.*', 'commentIsAReplyTo.*', 'likes.*', 'shares.*'])
        .optional()
        .trim()
        .isString().withMessage("parentUrl, body._html, body.text must be a string data type"),
], authorization, async (req, res, next) => {
    const { authorizeUser, body: { blogpostId, parentId, parentUrl, children, body, commentIsAReplyTo, likes, shares } } = req

    try {

        const error = validationResult(req)
        if (!error.isEmpty()) throw new Error(error.array().map((error) => error.msg + ' ').join('')) // if there is errors durring validating body throw error
        if (!mongoose.Types.ObjectId.isValid(blogpostId)) throw new Error('bad request: invalid blogpost id') // varify comment id

        const addComment = await commentsData.create({ // create blogpost
            authorUserName: authorizeUser,
            blogpostId, parentId, parentUrl, children, body, commentIsAReplyTo, likes, shares
        })

        if (!addComment) throw new Error('bad request: comment not created ')

        if (parentId) {// new comment is a child comment, push it id to it parent arrar of child key
            if (!mongoose.Types.ObjectId.isValid(parentId)) throw new Error('bad request: invalid comment id')

            await commentsData.findByIdAndUpdate({ _id: parentId }, {
                $push: { children: addComment._id }
            })
        };

        res.json(addComment)
    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/editcomment/:_id', authorization, async (req, res, next) => {
    const { params: { _id }, body: { blogpostId, parentId, parentUrl, children, body, commentIsAReplyTo, likes, shares } } = req

    try {

        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('bad request: invalid comment id') // varify comment id
        const error = validationResult(req)
        if (!error.isEmpty()) throw new Error(error.array().map((error) => error.msg + ' ').join('')) // if there is errors durring validating body throw error

        const updateComment = await commentsData.findByIdAndUpdate({ _id }, // update comment
            { blogpostId, parentId, parentUrl, children, body, commentIsAReplyTo, likes, shares },
            { new: true }
        )
        if (!updateComment) throw new Error('bad request: comment not updated')

        res.json(updateComment)

    } catch (error) {
        next(new customError(error, 400))
    }
})

router.delete('/deletecomment/:_id', authorization, async (req, res, next) => {
    const { params: { _id, } } = req

    try {

        // verify comment id
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('bad request: inavlid comment is')

        // delete comment
        const deleteComment = await commentsData.findByIdAndDelete({ _id })
        if (!deleteComment) throw new Error('bad request: comment was not deleted')

        res.json({ deleted: 'sucessfully deleted comment' })

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.get('/comment/like/:_id', async (req, res, next) => {
    const { params: { _id } } = req

    try {
        // verify comment id
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('bad request: inavlid comment id')

        const getComment = await commentsData.findById({ _id })// get comment
        if (!getComment.likes) throw new Error('Bad Request: comment was not found!')

        res.json(getComment.likes)

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/likecomment/:_id', authorization, async (req, res, next) => {
    const { params: { _id }, authorizeUser } = req

    try {
        // verify comment id
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('bad request: inavlid comment id')

        // check if the comment has beem liked by this user, if yes return
        const getComment = await commentsData.findById({ _id })
        if (getComment.likes.includes(authorizeUser)) throw new Error('Bad Request: comment already been liked by this user!')

        const likedComment = await commentsData.findByIdAndUpdate({ _id: getComment._id },  // like comment
            { $push: { likes: authorizeUser } },
            { new: true }
        )
        if (!likedComment.likes) throw new Error('Bad Request: comment was not liked!')

        res.json({ like: authorizeUser })

    } catch (error) {

        next(new customError(error, 400))
    }
})

router.patch('/unlikecomment/:_id', authorization, async (req, res, next) => {
    const { params: { _id }, authorizeUser } = req

    try {
        // verify comment id
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('bad request: inavlid comment is')

        // unlik comment 
        const unlikedComment = await commentsData.findByIdAndUpdate({ _id },
            { $pull: { likes: authorizeUser } },
            { new: true }
        )
        if (!unlikedComment.likes) throw new Error('Bad Request: comment was not unliked!')

        res.json({ like: authorizeUser })

    } catch (error) {

        next(new customError(error, 400))
    }
})

module.exports = router
