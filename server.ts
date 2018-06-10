import * as restify from 'restify';
import * as socketio from 'socket.io';
import * as util from 'util';

const server = restify.createServer();
const io = socketio.listen(server.server, { origins: '*:*'});

server.get('/', (_req, res, next) => {
    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.end('<html><head><title>OK</title></head><body><h1>OK</h1></body></html>');
    next();
});

io.sockets.on('error', (err: Error) => {
    console.error(`Socket error: ${util.inspect(err)}`);
});

io.sockets.on('connect', (socket) => {
    console.log('socket.io connection');
    let i = 0;
    setInterval(() => {
        socket.emit('APPEND', { id: i++, hello: 'world' });
    }, 3000)
    socket.on('my other event', (data) => {
        console.log(data);
    });
});

server.listen(8008, () => {
    console.log('socket.io server listening at %s', server.url);
});
