import ejs from 'ejs'
import nodemailer from 'nodemailer';

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.REACT_APP_EMAIL,
        pass: process.env.REACT_APP_PASSWORD
    }
})

export async function renderTemplate(data: any, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        ejs.renderFile(path, data, (err: any, html: any) => {
            if (err) {
                reject(err);
            } else {
                resolve(html);
            }
        })
    })
}

export async function sendMail(Mailto: string, subject: string, user: any, templateName: string): Promise<string> {
    const path = "./src/view/emailTemplate/" + templateName;
    const htmlContent = await renderTemplate(user, path) as string;
    const mailOptions = {
        from: 'nhanngo1711@gmail.com',
        to: Mailto,
        subject: subject,
        html: htmlContent
    };

    transporter.sendMail(mailOptions, (error: any, info: any) => {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    })
    return "Sent Mail Successfully"
}
