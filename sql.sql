create table users(
    id SERIAL PRIMARY KEY,
    socket text,
    username text,
    role text,
    roomid text,
    FOREIGN KEY (roomid) REFERENCES rooms (id)
);
create table rooms(
    id text PRIMARY KEY,
    gameword text,
    canvas text
);
create table messages(
    id SERIAL PRIMARY KEY,
    roomid text,
    message text,
    userid int,
    FOREIGN KEY (roomid) REFERENCES rooms (id)
);