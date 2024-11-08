const nodeMailer = require('nodemailer');
const { customError } = require('./error');
require('dotenv').config();

const transporter = nodeMailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.GMAIL,
        pass: process.env.EMAIL_PASSWORD,
    }
})

const sendEmail = (clientInfo, callBack = (info) => { }) => {
    if (!clientInfo.to.trim()) return;

    const mailOptions = {
        from: `<${process.env.GMAIL}>`, // sender address
        ...clientInfo
    }

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            new customError(err, 400)
        } else {
            callBack(info);
        };
    })
}

module.exports = sendEmail



/* 
 sendEmail({
            to: 'henrygad.orji@gmail.com', // recipient email
            subject: 'Welcome back Henry!', // email subject
           // text: 'This is a test email sent using Nodemailer!', // plain text body
            html: `<h1 style="color: green, font-weight: bold" >Blogger</h1> 
             <p>
               <span style=" display: block, size: 20px" >Welcome back Henry!</span>
               <span>You login to your account</span>
             </p>`, // html body
        }) */