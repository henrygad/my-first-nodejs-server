const mongoose = require('mongoose')

const usersData = new mongoose.Schema({
    displayImage: String,
    email: String,
    userName: { type: String, unique: true },
    name: String,
    dateOfBirth: String,
    country: String,
    sex: String,
    website: String,
    phoneNumber: String,
    bio: { type: String, match: /[a-z]/, max: 50 },
    timeline: { type: [String] },
    followers: { type: [String] },
    following: { type: [String] },
    interests: { type: [String] },
    notifications: [{
        typeOfNotification: String,
        msg: { type: String, match: /[a-z]/ },
        url: String,
        notifyFrom: String,
        checked: { type: Boolean, default: false },
    }],
    saves: { type: [String] },
    drafts: {
        type: [{
            _id: String,
            displayImage: { type: String },
            authorUserName: { type: String },
            title: { type: String },
            body: { type: String },
            _html: { title: String, body: String },
            catigory: { type: String },
            mentions: { type: String },
            slug: { type: String },
            url: { type: String },
            preStatus: String,
            status: {type: String, default: 'draft'},
        }]
    },
},
    {
        timestamps: true

    })

module.exports = mongoose.model("users", usersData)
