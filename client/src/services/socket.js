import { io } from 'socket.io-client';

let socket = null;

export function initSocket() {
  if (socket) return socket;

  const token = localStorage.getItem('accessToken');
  socket = io({
    auth: { token },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {});
  socket.on('disconnect', () => {});

  return socket;
}

export function getSocket() {
  if (!socket) return initSocket();
  return socket;
}

export function joinVideo(videoUuid) {
  const s = getSocket();
  s.emit('join-video', videoUuid);
}

export function leaveVideo(videoUuid) {
  const s = getSocket();
  s.emit('leave-video', videoUuid);
}

export function onLiveViewers(callback) {
  const s = getSocket();
  s.on('live-viewers', callback);
  return () => s.off('live-viewers', callback);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
