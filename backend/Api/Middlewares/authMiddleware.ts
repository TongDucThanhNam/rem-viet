const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const CryptoJS = require("crypto-js")
require('dotenv').config();
// const Company = require('');
import {ExtendedSocket} from "../../Domain/Interface/ExtendSocket";
import CompanyRepository from "../../Infrastructure/Persistences/Respositories/CompanyRepository";
import ICompanyRepository from "../../Application/Persistences/IRepositories/ICompanyRepository";
import mongoose from 'mongoose';

function getAccessToken(req: any): string | null | undefined {
    if (req.headers.authorization)
        return req.headers.authorization.indexOf(' ') >= 0 ? req.headers.authorization.split(' ')[1] : req.headers.authorization;
    if (req.cookies || req.signedCookies)
        return req.cookies?.access_token || req.signedCookies?.access_token;
    if (req.headers?.cookie)
        return getTokenFromHeaderCookie(req.headers?.cookie)
    return null
}

function getTokenFromHeaderCookie(headerCookie: string): string | undefined {
    const splitCookie = headerCookie.split(';')
    let token: string = '';
    for (let element of splitCookie) {
        const key: string = element.split('=')[0].trim();
        if (key === 'access_token') {
            token = element.split('=')[1].trim();
            break;
        }
    }
    return token;
}

export async function authenticateMiddleware(req: any, res: any, next: any): Promise<any> {
    try {
        const accessToken: string | null | undefined = getAccessToken(req);
        if (!accessToken || accessToken === 'undefined' || accessToken.split('.').length !== 3)
            return res.status(401).json({error: 'No access token provided'})

        const verified = await jwt.verify(accessToken, process.env.REACT_APP_JWT_SECRET || '')

        if (!verified)
            return res.status(400).json({error: 'Cannot authenticate, please check login status'});

        const data: any = {
            userId: verified.userId
        }

        if (verified.companyId)
            data.companyId = verified.companyId

        req.user = data;
        return next()
    } catch (error: any) {
        return res.status(500).json({error: `Error occured at authentication middleware: ${error.message}`})
    }
}

export async function checkAuthenticateMiddleware(req: any, res: any, next: any): Promise<any> {
    try {
        const accessToken: string | null | undefined = getAccessToken(req);
        if (!accessToken || accessToken === 'undefined' || accessToken.split('.').length !== 3)
            return next()

        const verified = await jwt.verify(accessToken, process.env.REACT_APP_JWT_SECRET || '')

        if (!verified)
            return next();

        req.user = {userId: verified.userId};
        return next()
    } catch (error: any) {
        return res.status(500).json({error: `Error occured at checkAuthentication middleware: ${error.message}`})
    }
}

async function authenticateTokenSocketIo(socket: ExtendedSocket, next: (err?: Error) => void) {
    try {
        const token = socket.handshake.auth.token as string;
        if (!token || token == 'undefined') return next(new Error('Authentication error'));
        const verified = await jwt.verify(token, process.env.REACT_APP_JWT_SECRET || '')
        if (!verified) return next(new Error('Authentication error'));
        socket.user = verified;
        next();
    } catch (error: any) {
        console.error(`Error occured at authenticateToken: ${error.message}`)
        return next(new Error(`Authentication error: ${error.message}`));
    }

}

export async function checkApiKey(req: any, res: any, next: any) {
    const companyRepository: ICompanyRepository = new CompanyRepository()
    try {
        // console.log("checkApiKey")

        // #swagger.auto = false
        /*
            #swagger.security = [{
                "apiKeyAuth": []
            }] 
        */
        // console.log(await generateApiKey('6673c5eb9d595d89fd369481'))
        if (!req.headers.authorization)
            return res.status(400).json({error: `Please provide your api key`});
        const authorizeString = req.headers.authorization.indexOf(' ') >= 0 ? req.headers.authorization.split(' ')[1] : req.headers.authorization
        const apiKey: string = decodeURIComponent(authorizeString)
        // console.log("apiKey", apiKey)
        // console.log("process.env.API_KEY_SECRET", process.env.API_KEY_SECRET)

        const bytes = CryptoJS.AES.decrypt(apiKey, process.env.API_KEY_SECRET);
        // console.log("bytes", bytes)
        let dataInfor = bytes.toString(CryptoJS.enc.Utf8)

        // console.log("dataInfor", dataInfor)
        // console.log("dataInfor.split('-')[0]", dataInfor.split('-')[0])

        const companyId = dataInfor.split('-')[0]
        if (!mongoose.Types.ObjectId.isValid(companyId))
            return res.status(400).json({error: `Api key is not authenticate`})
        // console.log("companyId", companyId)
        const company: any = await companyRepository.getCompanyById({
            _id: companyId as string,
            isDeleted: false,
            isActive: true,
            status: 'Accept'
        })

        // console.log("company", company)


        // console.log(company)
        // const company = {
        //     apiKey: '$2a$10$gW1vXUspNeEtxCf8S7sIJesENoCSvKnX3F/mVND.YE1c2zmkpN.r2',
        //     _id: '667269d32412f22b89c30d71'
        // };
        if (!company) return res.status(400).json({error: `Api key is not authenticate`});
        const isVerify = await bcrypt.compare(encodeURIComponent(apiKey), company.apiKey);
        if (!isVerify) return res.status(400).json({error: `Api key is not authenticate`});

        req.user = {companyId: company._id}

        return next()
    } catch (error: any) {
        return res.status(500).json({error: `Error occured at checkApiKey middleware: ${error.message}`})
    }
}

module.exports = {
    authenticateMiddleware,
    checkAuthenticateMiddleware,
    authenticateTokenSocketIo,
    checkApiKey
}