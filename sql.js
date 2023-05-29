import pool from './db.js';

const defineRole = async (roomId) => {
  const user = (
    await pool.query(`SELECT id FROM users WHERE roomid = $1 AND role = $2`, [roomId, 'writer'])
  ).rows[0];
  if (user) {
    return 'user';
  } else {
    return 'writer';
  }
};

export const addUser = async (username, roomId, socketId) => {
  try {
    const role = await defineRole(roomId);
    const user = (
      await pool.query(
        `INSERT INTO users (username, role, roomid, socket) values ($1, $2, $3, $4) RETURNING *`,
        [username, role, roomId, socketId],
      )
    ).rows[0];
    return user;
  } catch (error) {
    const msg = `Ошибка добавления пользователя в базу данных`;
    console.log(error);
    console.log(msg);
  }
};

export const createRoom = async (id, gameWord, canvasData) => {
  try {
    await pool.query(`INSERT INTO rooms (id, gameword, canvas) values ($1, $2, $3)`, [
      id,
      gameWord,
      canvasData,
    ]);
    return 'Комната успешно создана';
  } catch (error) {
    const msg = 'Ошибка создания комнаты';
    console.log(msg);
    return msg;
  }
};

export const addMessage = async (roomId, data) => {
  try {
    const username = data.slice(0, data.indexOf(':'));
    const message = data.substring(data.indexOf(':') + 2);
    await pool.query(
      `INSERT INTO messages (roomid, message, userid) values ($1, $2, (SELECT id FROM users WHERE username = $3))`,
      [roomId, message, username],
    );
  } catch (error) {
    const msg = 'Ошибка добавления сообщения в базу данных';
    console.log(msg);
  }
};

export const clearCanvas = async (roomId) => {
  try {
    await pool.query(`UPDATE rooms SET canvas = $2 WHERE id = $1`, [roomId, '']);
  } catch (error) {
    const msg = 'Ошибка очистки canvas';
    console.log(msg);
  }
};

export const setGameWord = async (roomId, data) => {
  try {
    await pool.query(`UPDATE rooms SET gameword = $1 WHERE id = $2`, [data, roomId]);
  } catch (error) {
    const msg = 'Ошибка добавления игрового слова в базу данных';
    console.log(msg);
  }
};

export const setCanvasData = async (roomId, data) => {
  try {
    await pool.query(`UPDATE rooms SET canvas = $2 WHERE id = $1`, [roomId, data]);
  } catch (error) {
    const msg = 'Ошибка добавления canvasData в базу данных';
    console.log(msg);
  }
};

export const deleteUser = async (socketId) => {
  try {
    await pool.query(`DELETE FROM users * WHERE socket = $1`, [socketId]);
  } catch (error) {
    const msg = 'Ошибка удаления пользователя из базы данных';
    console.log(error);
    console.log(msg);
  }
};

const deleteRoom = async (roomId) => {
  try {
    await pool.query(`DELETE FROM messages * WHERE roomid = $1`, [roomId]);
    await pool.query(`DELETE FROM rooms * WHERE id = $1 AND id != $2`, [roomId, 'public']);
  } catch (error) {
    const msg = 'Ошибка в удалении комнаты';
    console.log(msg);
  }
};

export const checkEmptyRoom = async (roomId) => {
  try {
    const users = (await pool.query(`SELECT id FROM users WHERE roomid = $1`, [roomId])).rows;
    if (users.length == 0) {
      await deleteRoom(roomId);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    const msg = 'Ошибка в проверке на пустую комнату';
    console.log(msg);
  }
};

export const checkRoles = async (roomId) => {
  try {
    const writer = (
      await pool.query(`SELECT id FROM users WHERE roomid = $1 AND role = $2`, [roomId, 'writer'])
    ).rows[0];

    if (!writer) {
      const userId = (
        await pool.query(`SELECT * FROM users WHERE roomid = $1 ORDER BY id ASC LIMIT 1`, [roomId])
      ).rows[0].id;
      const user = (
        await pool.query(`UPDATE users SET role = $3 WHERE roomid = $1 AND id = $2 RETURNING *`, [
          roomId,
          userId,
          'writer',
        ])
      ).rows[0];
      return user;
    }
  } catch (error) {
    const msg = 'Ошибка в проверки ролей';
    console.log(error);
    console.log(msg);
  }
};

export const getMessages = async (roomId) => {
  try {
    const messages = (
      await pool.query(
        `SELECT message, username FROM messages JOIN users ON users.id = userid WHERE messages.roomid = $1 `,
        [roomId],
      )
    ).rows;
    return messages.map(({ message, username }) => `${username}: ${message}`);
  } catch (error) {
    const msg = 'Ошибка извлечения сообщений из базы данных';
    console.log(msg);
  }
};

export const getCanvasData = async (roomId) => {
  try {
    const canvasData = (await pool.query(`SELECT canvas FROM rooms WHERE id = $1`, [roomId]))
      .rows[0].canvas;

    return canvasData;
  } catch (error) {
    const msg = 'Ошибка извлечения canvasData из базы данных';
    console.log(msg);
  }
};

export const getUsers = async (roomId) => {
  try {
    const users = (
      await pool.query(`SELECT username, id, role FROM users WHERE roomid = $1`, [roomId])
    ).rows;
    return users.map(({ username, id, role }) => {
      return {
        username,
        id,
        role,
      };
    });
  } catch (error) {
    const msg = 'Ошибка извелчения пользователей из базы данных';
    console.log(msg);
  }
};
