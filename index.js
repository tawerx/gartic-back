import express, { json } from 'express';
const app = express();
import { createServer } from 'http';
const server = createServer(app);
import { Server } from 'socket.io';
const io = new Server(server);
import cors from 'cors';
import pool from './db.js';
import {
  addMessage,
  addUser,
  checkEmptyRoom,
  checkRoles,
  clearCanvas,
  createRoom,
  deleteUser,
  getCanvasData,
  getMessages,
  getUsers,
  setCanvasData,
  setGameWord,
} from './sql.js';

app.use(json());
app.use(cors());

app.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    res.json(await getMessages(id));
  } catch (error) {
    const msg = 'Ошибка запроса сообщений';
    console.log(msg);
  }
});

app.get('/:id/canvas', async (req, res) => {
  try {
    const { id } = req.params;
    res.json(await getCanvasData(id));
  } catch (error) {
    const msg = 'Ошибка запроса canvasData';
    console.log(msg);
  }
});

app.get('/checkRoom', async (req, res) => {
  try {
    const { roomId } = req.query;
    const answer = (await pool.query(`SELECT id FROM rooms WHERE id = $1`, [roomId])).rows[0];
    if (answer) {
      res.status(200).json(true);
    } else {
      res.status(200).json(false);
    }
  } catch (error) {
    const msg = 'Ошибка проверки комнаты';
    console.log(error);
    console.log(msg);
  }
});

const checkGameWord = async (msg, winner, roomId) => {
  try {
    const gameWord = (await pool.query(`SELECT gameword FROM rooms WHERE id = $1`, [roomId]))
      .rows[0].gameword;
    const userWrite = (
      await pool.query(`SELECT socket FROM users WHERE roomid = $1 AND role = $2`, [
        roomId,
        'writer',
      ])
    ).rows[0];
    if (msg.toLowerCase() == gameWord.toLowerCase() && winner != userWrite.socket) {
      const oldWriter = await pool.query(
        `UPDATE users SET role = $1 WHERE role = $2 AND roomid = $3`,
        ['user', 'writer', roomId],
      );
      const newWriter = (
        await pool.query(
          `UPDATE users SET role = $1 WHERE socket = $2 AND roomid = $3 RETURNING username`,
          ['writer', winner, roomId],
        )
      ).rows[0].username;

      io.to(roomId).emit('endGame', `${newWriter} отгадал загаданное слово`);
      io.to(roomId).emit('clearCanvas');
      await clearCanvas(roomId);
      await setGameWord(roomId, '');
      const users = await getUsers(roomId);
      io.to(userWrite.socket).emit('role', 'user');
      io.to(winner).emit('role', 'writer');
      io.to(roomId).emit('getUsers', users);
    }
  } catch (error) {
    const err = 'Ошибка проверки игрового слова';
    console.log(err);
  }
};

io.on('connection', (socket) => {
  socket.on('createRoom', async ({ roomId, userName }) => {
    try {
      const roomRes = await createRoom(roomId, '', '');
      const user = await addUser(userName, roomId, socket.id);
      socket.join(roomId);

      io.to(socket.id).emit('role', user.role);
      const users = await getUsers(roomId);
      io.to(roomId).emit('getUsers', users);
      // io.to(socket.id).emit()
    } catch (error) {
      const msg = 'Ошибка создания частной комнаты';
      console.log(msg);
    }
  });

  socket.on('joinPublic', async ({ userName }) => {
    try {
      const roomId = 'public';
      const user = await addUser(userName, roomId, socket.id);
      socket.join(roomId);

      io.to(socket.id).emit('role', user.role);
      const users = await getUsers(roomId);
      io.to(roomId).emit('getUsers', users);
    } catch (error) {
      const msg = 'Ошибка подключения к публичной комнате';
      console.log(msg);
    }
  });

  socket.on('joinByLink', async ({ roomId, userName }) => {
    try {
      const user = await addUser(userName, roomId, socket.id);
      socket.join(roomId);
      io.to(socket.id).emit('role', user.role);
      const users = await getUsers(roomId);
      io.to(roomId).emit('getUsers', users);
    } catch (error) {
      const msg = 'Ошибка подключения по ссылке';
      console.log(msg);
    }
  });

  socket.on('checkRoom', async (roomId) => {
    const answer = (await pool.query(`SELECT id FROM rooms WHERE id = $1`, [roomId])).rows[0];
    if (answer) {
      socket.emit('getAnswerAboutRoom', true);
    } else {
      socket.emit('getAnswerAboutRoom', false);
    }
  });

  socket.on('sendMessage', async ({ roomId, message }) => {
    try {
      await addMessage(roomId, message);
      await checkGameWord(message.slice(message.indexOf(':') + 2), socket.id, roomId);
      socket.broadcast.to(roomId).emit('getMessage', message);
    } catch (error) {
      const msg = 'Ошибка добавления сообщения в базу данных';
      console.log(msg);
    }
  });

  socket.on('clearCanvas', async ({ roomId, data }) => {
    try {
      await clearCanvas(roomId);
      socket.broadcast.to(roomId).emit('clearCanvas', data);
    } catch (error) {
      const msg = 'Ошибка очистки canvas';
      console.log(msg);
    }
  });

  socket.on('setGameWord', async ({ roomId, gameWord }) => {
    try {
      await setGameWord(roomId, gameWord);
    } catch (error) {
      const msg = 'Ошибка установки игрового слова';
      console.log(msg);
    }
  });

  socket.on('canvasImg', async ({ roomId, data }) => {
    try {
      await setCanvasData(roomId, data);
      socket.broadcast.to(roomId).emit('canvasImg', data);
    } catch (error) {
      const msg = 'Ошибка установки canvasData';
      console.log(msg);
    }
  });

  // socket.on('afkWriter', () => {
  //     const users = config.get('users');
  //     const findItem = users.findIndex((obj) => obj.id == socket.id);
  //     users[findItem].role = 'user';
  //     io.to(socket.id).emit('role', users[findItem].role);

  //     const randomNum = Math.floor(Math.random() * users.length);
  //     users[randomNum].role = 'writer';
  //     config.set('users', users);
  //     io.to(users[randomNum].id).emit('role', users[randomNum].role);
  //     const user = users[findItem].nick;
  //     io.emit('endGame', `${user} бездействует`);
  //     io.emit('clearCanvas');
  //     config.set('gameWord', '');
  //     config.set('canvasImage', '');
  //     io.emit('getUsers', config.get('users'));
  //     console.log(config);
  //   });

  socket.on('sessionInfo', async (roomId) => {
    try {
      const userRole = (await pool.query(`SELECT role FROM users WHERE socket = $1`, [socket.id]))
        .rows[0].role;
      console.log(userRole);
      const users = await getUsers(roomId);
      io.to(socket.id).emit('role', userRole);
      io.to(roomId).emit('getUsers', users);
    } catch (error) {
      const msg = 'Ошибка информации игровой сессии';
      console.log(error);
      console.log(msg);
    }
  });

  socket.on('leaveGame', async () => {
    try {
      const roomId = (await pool.query(`SELECT roomid FROM users WHERE socket = $1`, [socket.id]))
        .rows[0].roomid;
      socket.leave(roomId);
      await deleteUser(socket.id);

      const emptyRes = await checkEmptyRoom(roomId);
      if (!emptyRes) {
        const user = await checkRoles(roomId);
        const users = await getUsers(roomId);
        io.to(roomId).emit('getUsers', users);
        io.to(user.socket).emit('role', user.role);
      }
    } catch (error) {
      const msg = 'Ошибка выхода пользователя';
      console.log(error);
      console.log(msg);
    }
  });

  socket.on('disconnect', async () => {
    try {
      const roomId = (await pool.query(`SELECT roomid FROM users WHERE socket = $1`, [socket.id]))
        .rows[0].roomid;
      socket.leave(roomId);
      await deleteUser(socket.id);

      const emptyRes = await checkEmptyRoom(roomId);
      if (!emptyRes) {
        const user = await checkRoles(roomId);
        const users = await getUsers(roomId);
        io.to(roomId).emit('getUsers', users);
        io.to(user.socket).emit('role', user.role);
      }
    } catch (error) {
      const msg = 'Ошибка выхода пользователя';
      console.log(error);
      console.log(msg);
    }
  });
});

server.listen(process.env.PORT || 5000, () => {
  console.log('server started');
});
