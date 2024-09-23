import {Server} from 'socket.io';
import http from 'http';

const authenticate = require('../../../Api/Middlewares/authMiddleware');

export function initializeSocket(server: http.Server): Server {
    const io = new Server(server, {
        cors: {
            origin: '*',
        },
        cleanupEmptyChildNamespaces: true,
    });

    io.use(authenticate.authenticateTokenSocketIo);

    return io;
}