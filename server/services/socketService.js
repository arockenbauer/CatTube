import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import db from '../models/database.js';
import logger from '../utils/logger.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        socket.userId = decoded.userId;
      } catch {}
    }
    next();
  });

  io.on('connection', (socket) => {
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    socket.on('join-video', (videoUuid) => {
      socket.join(`video:${videoUuid}`);
      const room = io.sockets.adapter.rooms.get(`video:${videoUuid}`);
      const liveViewers = room ? room.size : 0;
      io.to(`video:${videoUuid}`).emit('live-viewers', { videoUuid, count: liveViewers });
    });

    socket.on('leave-video', (videoUuid) => {
      socket.leave(`video:${videoUuid}`);
      const room = io.sockets.adapter.rooms.get(`video:${videoUuid}`);
      const liveViewers = room ? room.size : 0;
      io.to(`video:${videoUuid}`).emit('live-viewers', { videoUuid, count: liveViewers });
    });

    socket.on('disconnect', () => {});
  });

  logger.info('Socket.io initialized');
  return io;
}

export function getIO() {
  return io;
}

export function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToVideo(videoUuid, event, data) {
  if (io) {
    io.to(`video:${videoUuid}`).emit(event, data);
  }
}
