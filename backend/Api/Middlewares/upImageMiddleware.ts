import multer from "multer";
import { Request, Response, NextFunction } from 'express';
import fs from 'fs'
import path from "path";
const uploadsDirectory = './uploads';

const storage = multer.diskStorage({
    destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
        const routePath = req.url;
        //console.log(routePath);
        if (!fs.existsSync(`${uploadsDirectory}/${routePath}`)) {
            fs.mkdirSync(`${uploadsDirectory}/${routePath}`, { recursive: true });
        }
        cb(null, `${uploadsDirectory}/${routePath}`);
    },
    filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

export const upload = multer({ storage: storage, limits: { fileSize: 20 * 1024 * 1024 }});