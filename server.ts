import * as restify from 'restify';
import * as socketio from 'socket.io';
import * as util from 'util';
import { MongoClient } from 'mongodb';

const pkg: any = require('../package.json');

const main = async () => {
    console.log('main start');
    const server = restify.createServer();
    const io = socketio.listen(server.server, { origins: '*:*'});
    const connections: socketio.Socket[] = [];

    const state = { latest: null };
    
    buildApi(server);
    buildWebsocket(io, connections, state);
    await buildListener(server);

    await tailCollection(connections, state);
};

const buildApi = (server: restify.Server) => {
    server.get('/', (_req, res, next) => {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(pkg));
        next();
    });
};

const buildWebsocket = (io: socketio.Server, connections: socketio.Socket[], state: any) => {
    io.sockets.on('error', (err: Error) => {
        console.error(`Socket error: ${util.inspect(err)}`);
    });
    io.sockets.on('connect', (socket) => {
        console.log(`socket.io connect: ${socket.id}`);
        connections.push(socket);
        if (state.latest != null) {
            socket.emit('APPEND_MESSAGE', state.latest);
        }
        socket.on('disconnect', () => {
            console.log(`socket.io disconnect: ${socket.id}`);
            const idx = connections.indexOf(socket);
            if (idx >= 0) {
                connections.splice(idx, 1);
            } else {
                console.error(`Disconnected socket: ${socket.id} not in list!`);
            }
        });
    });
};

const buildListener = async (server: restify.Server) => {
    await new Promise(resolve => server.listen(8008, resolve));
    console.log(`socket.io server listening at: ${server.url}`);
};

const tailCollection = async (connections: socketio.Socket[], state: any) => {
    const client = await MongoClient.connect('mongodb://localhost:27017');
    const db = client.db('log');
    const coll = db.collection('managementServer');
    const latest = await coll.findOne({}, {
        sort: { $natural: -1 },
    });
    const cursor = coll
        .find({
            _id: { $gte: latest._id },
        }, {
            tailable: true,
        })
        .addCursorFlag('noCursorTimeout', true)
        .addCursorFlag('awaitData', true);
    while (await cursor.hasNext()) {
        const msg = await cursor.next();
        connections.forEach(conn => {
            conn.emit('APPEND_MESSAGE', msg);
        });
        state.latest = msg;
    }
};

main()
    .then(() => {
        console.log('main end');
    })
    .catch(err => {
        console.error(`main error: ${util.inspect(err)}`);
    });
