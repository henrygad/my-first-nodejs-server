const bcrypt = require('bcryptjs')

const saltRound = 10

const hashpassword = (plainpassword)=>{
    const salt = bcrypt.genSaltSync(saltRound)
    return bcrypt.hashSync(plainpassword, salt)
}

module.exports = hashpassword;