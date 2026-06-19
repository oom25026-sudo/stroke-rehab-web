const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" } // อนุญาตให้ทุกอุปกรณ์เชื่อมต่อเข้ามาได้
});

// ดักจับเมื่อมีอุปกรณ์เชื่อมต่อเข้ามา
io.on('connection', (socket) => {
  console.log('มีอุปกรณ์เชื่อมต่อสำเร็จ: ' + socket.id);

  // 1. ถ้ารับข้อมูลมุมจากมือถือ ให้ส่งต่อไปยังหน้าจอคอมทันที
  socket.on('phone-orientation', (data) => {
    socket.broadcast.emit('update-orientation', data);
  });

  // 2. ถ้ารับข้อมูลความเร่งจากมือถือ ให้ส่งต่อไปยังหน้าจอคอมทันที
  socket.on('phone-motion', (data) => {
    socket.broadcast.emit('update-motion', data);
  });

  socket.on('disconnect', () => {
    console.log('อุปกรณ์ตัดการเชื่อมต่อ');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`เซิร์ฟเวอร์เปิดใช้งานแล้วที่พอร์ต ${PORT}`);
});