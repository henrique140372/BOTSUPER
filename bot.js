const { Telegraf } = require('telegraf');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const fs = require('fs');
const path = require('path');

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBNmKDC--6hxxXTQAPZOz377MpJsiXPgvQ",
  authDomain: "streambox-7713e.firebaseapp.com",
  projectId: "streambox-7713e",
  storageBucket: "streambox-7713e.firebasestorage.app",
  messagingSenderId: "543604813497",
  appId: "1:543604813497:android:508d8fd795cb3f2fa3f568"
};
const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

// Inicializa o bot
const bot = new Telegraf('7930140423:AAHb-c0sThvAP-fUZN8bRmiFj2Dj4yLi4ks');
const dataFile = path.join(__dirname, 'data.json');

// Função para carregar publicações
const loadData = () => {
  if (!fs.existsSync(dataFile)) return [];
  return JSON.parse(fs.readFileSync(dataFile));
};

// Função para salvar publicações
const saveData = (data) => {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
};

bot.start((ctx) => ctx.reply('Bem-vindo! Envie uma imagem, texto, GIF ou escolha uma categoria para sua publicação.'));

bot.on('photo', async (ctx) => {
  const fileId = ctx.message.photo.pop().file_id;
  const fileUrl = await ctx.telegram.getFileLink(fileId);
  const filePath = path.join(__dirname, 'temp.jpg');

  // Baixa a imagem temporariamente
  const response = await fetch(fileUrl);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));

  // Faz upload para o Firebase Storage
  const fileRef = ref(storage, `uploads/${fileId}.jpg`);
  const fileBuffer = fs.readFileSync(filePath);
  await uploadBytes(fileRef, fileBuffer);
  const downloadURL = await getDownloadURL(fileRef);

  // Salva no JSON
  let posts = loadData();
  posts.push({ id: fileId, type: 'image', url: downloadURL });
  saveData(posts);

  fs.unlinkSync(filePath);
  ctx.reply(`Imagem salva! Link: ${downloadURL}`);
});

bot.on('text', (ctx) => {
  let posts = loadData();
  posts.push({ id: Date.now(), type: 'text', content: ctx.message.text });
  saveData(posts);
  ctx.reply('Texto salvo!');
});

bot.on('animation', async (ctx) => {
  const fileId = ctx.message.animation.file_id;
  const fileUrl = await ctx.telegram.getFileLink(fileId);
  
  let posts = loadData();
  posts.push({ id: fileId, type: 'gif', url: fileUrl });
  saveData(posts);
  ctx.reply('GIF salvo!');
});

bot.command('categorias', (ctx) => {
  ctx.reply('Escolha uma categoria:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Casa de Apostas', callback_data: 'categoria_Casa_de_Apostas' }],
        [{ text: 'Aplicativo', callback_data: 'categoria_Aplicativo' }],
        [{ text: 'App', callback_data: 'categoria_App' }],
        [{ text: 'Renda Extra', callback_data: 'categoria_Renda_Extra' }]
      ]
    }
  });
});

bot.on('callback_query', (ctx) => {
  const category = ctx.callbackQuery.data.split('_')[1];
  let posts = loadData();
  posts.push({ id: Date.now(), type: 'category', category });
  saveData(posts);
  ctx.answerCbQuery(`Categoria escolhida: ${category}`);
  ctx.reply(`Você escolheu a categoria: ${category}`);
});

bot.launch();
