const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema({
    data: Buffer,
    contentType: String,
    fileName: String,
    size: Number,
    fieldname: String,
    uploader: String,
})


module.exports = mongoose.model('Images', imageSchema)