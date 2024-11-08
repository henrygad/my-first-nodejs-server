const mongoose = require('mongoose')

const authenticatedUsers = new mongoose.Schema(
    {
        userName: {
            type: String,
            unique: true,
            min: 5,
        },
        email: {
            type: String,
            unique: true,
        },
        password: { type: String, require: true }
    },
    {
        timestamps: true
    }
)


module.exports = mongoose.model("AuthenticatedUsers", authenticatedUsers);