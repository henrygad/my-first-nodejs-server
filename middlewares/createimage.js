const imageFiles = require('../schema/imagefilesSchema')
const { customError } = require('../middlewares/error')

const createimage = async (req, res, next) => {
    const {file, authorizeUser} = req;

    try {
    
        if (typeof req.file === 'object') { // if file is available
            const addImage = await imageFiles.create({ // create image
                data: file.buffer,
                contentType: file.mimetype,
                fileName: file.originalname,
                size: file.size,
                fieldname: file.fieldname,
                uploader: authorizeUser
            })

            if (!addImage) throw new Error('bad request: image not save')
            req.image = addImage // assign image to request object
        }
        
        next()
        
    } catch (error) {

        next(new customError(error, 400))
    }
}

module.exports = createimage;
