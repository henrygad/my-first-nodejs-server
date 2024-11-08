const router = require('express').Router()
const authorization = require('../middlewares/authorization')
const mongoose = require('mongoose')
const { customError } = require('../middlewares/error')
const imageFiles = require('../schema/imagefilesSchema')
const createimage = require("../middlewares/createimage")
const multer = require('multer')

const storage = multer.memoryStorage()
const upload = multer({ storage })

router.get('/images', async (req, res, next) => {
    const { query: { skip = 0, limit = 0 } } = req

    try {
        const images = await imageFiles
            .find()
            .skip(skip)
            .limit(limit)

        if (!images.length) throw new Error('Not Found: no image found')

        res.json(images.map((image) => image._id))
    } catch (error) {

        next(new customError(error, 404))
    }

})

router.get('/images/:authorUserName', authorization, async (req, res, next) => {
    const { params: { authorUserName }, query: { fieldname = 'avater', skip = 0, limit = 0 } } = req

    try {
        const userImages = await imageFiles // get display advater image
            .find({ uploader: authorUserName, fieldname })
            .skip(skip)
            .limit(limit)

        if (!userImages.length) throw new Error('Not Found: no image found')

        res.json(userImages.map((image) => ({
            _id: image._id,
            fileName: image.fileName,
            size: image.size,
            uploader: image.uploader,
            fieldname: image.fieldname,
        })))

    } catch (error) {

        next(new customError(error, 404))
    }

})

router.get('/image/:_id', async (req, res, next) => {
    const { params: { _id } } = req

    try {

        // verify image id
        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Not Found: invalid image id')

        // get display advater image
        const displayImage = await imageFiles.findById({ _id })
        if (!displayImage) throw new Error('Not Found: no image found')

        res.contentType(displayImage.contentType)
        res.send(displayImage.data)
    } catch (error) {

        next(new customError(error, 404))
    }

})

router.post('/image/avater/add', authorization, upload.single('avater'), createimage, async (req, res, next) => {
    const { image } = req
    res.json({
        _id: image._id,
        fileName: image.fileName,
        size: image.size,
        uploader: image.uploader,
        fieldname: image.fieldname,
    })
})

router.post('/image/blogpostimage/add', authorization, upload.single('blogpostimage'), createimage, async (req, res, next) => {
    const { image } = req
    res.json({
        _id: image._id,
        fileName: image.fileName,
        size: image.size,
        uploader: image.uploader,
        fieldname: image.fieldname,
    })
})

router.delete('/deleteimage/:_id', authorization, async (req, res, next) => {
    const { params: { _id } } = req

    try {

        if (!mongoose.Types.ObjectId.isValid(_id)) throw new Error('Bad Request: invalid image id!') // verify image id

        const deleteImage = await imageFiles.findByIdAndDelete({ _id }) // get display advater image
        if (!deleteImage) throw new Error('Bad Request: image not deleted!')

        res.json({ deleted: 'sucessfully deleted image' })

    } catch (error) {

        next(new customError(error, 404))
    }
})

module.exports = router
