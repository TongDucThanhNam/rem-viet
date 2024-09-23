import {Socket} from 'socket.io';

export interface UserPayload {
    userId: string;
}

export interface ExtendedSocket extends Socket {
    user?: UserPayload;

}

export interface UserSocket {
    [userId: string]: string;
}