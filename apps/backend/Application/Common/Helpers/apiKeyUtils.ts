const bcrypt = require('bcryptjs')
const CryptoJS = require("crypto-js")
const crypto = require('crypto')
require('dotenv').config()
import {GenerateKey} from "../../../Domain/Interface/GenerateKey"

export async function generateApiKey(companyId: string): Promise<GenerateKey | undefined> {
    try {
        const rawData = companyId + '-' + crypto.randomBytes(8).toString('hex');
        const apiKey: string = encodeURIComponent(CryptoJS.AES.encrypt(rawData, process.env.API_KEY_SECRET).toString())
        const saltRounds: number = 10;
        const apiKeyHash: string = await bcrypt.hash(apiKey, saltRounds);
        return {
            apiKey, //send mail for admin
            apiKeyHash //storage to database
        };
    } catch (error: any) {
        console.log(`Error occured at generateApiKey helper: ${error.message}`)
        return undefined;
    }
}