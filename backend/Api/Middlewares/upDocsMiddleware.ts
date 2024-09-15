import express, { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import fs from 'fs';
import path from 'path';

const uploadsDirectory = './uploads';

const storage = multer.diskStorage({
    destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
        const routePath = req.url;
        if (!fs.existsSync(`${uploadsDirectory}/${routePath}`)) {
            fs.mkdirSync(`${uploadsDirectory}/${routePath}`, { recursive: true });
        }
        cb(null, `${uploadsDirectory}/${routePath}`);
    },
    filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
        const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, Date.now() + '-' + filename);
    }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/msword' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
    } else {
        const error = new Error('Invalid file type. Only PDF and Word documents are allowed.');
        (error as any).code = 'INVALID_FILE_TYPE';
        cb(error);
    }
};

export const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: fileFilter
});
