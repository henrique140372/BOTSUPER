require('dotenv').config(); // Carrega as variáveis de ambiente a partir do arquivo .env
const { Telegraf } = require('telegraf');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, getDocs } = require('firebase/firestore');

// Configuração do Firebase usando variáveis de ambiente
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Inicializa o bot com a chave da API do Telegram (também usando variável de ambiente)
const bot = new Telegraf(process.env.TELEGRAM_API_KEY);

// Lista de palavras proibidas
const bannedWords = ["banca pix", "golpe", "chama pv", "eu vendo", "https://7bslot.com/", "palavrão", "banca de 20", "viado"]; // Adicione mais palavras aqui

// Função para verificar se a mensagem contém palavras proibidas
function checkForBannedWords(message) {
  return bannedWords.some(word => message.toLowerCase().includes(word));
}

// Função para salvar dados no Firestore
const saveData = async (data) => {
  try {
    const docRef = await addDoc(collection(db, "posts"), data);
    console.log("Documento escrito com ID: ", docRef.id);
  } catch (e) {
    console.error("Erro ao adicionar documento: ", e.message);
  }
};

// Função para verificar se a categoria já existe
const checkCategoryExists = async (category) => {
  const q = query(collection(db, "posts"), where("category", "==", category));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty; // Retorna true se a categoria já existe
};

// Função para extrair links de texto
const extractLinks = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex);
};

// Função para salvar dados da publicação (texto, imagem, vídeo, GIF)
const savePostData = async (category, text, userId, username, platform, fileType, fileLink = '') => {
  const links = extractLinks(text);  // Extrai links do texto

  // Verifica se a categoria já existe
  const categoryExists = await checkCategoryExists(category);
  
  // Se a categoria não existir, salva a publicação
  if (!categoryExists) {
    const postData = {
      category: category || 'sem categoria', // Garante que category tenha um valor se não fornecido
      text,  // Salva o texto, incluindo emojis e formatação
      userId,
      username: `@${username}`, // Salva o nome do usuário no formato @nome
      platform, // Salva o nome da plataforma
      fileType,  // Tipo de arquivo (imagem, vídeo, GIF, texto)
      fileLink: links && links.length > 0 ? links : (fileType !== 'text' ? fileLink : null),  // Salva links extraídos ou o fileLink
      timestamp: new Date()
    };

    await saveData(postData);
  } else {
    console.log(`A categoria '${category}' já existe. Publicação não salva.`);
  }
};

// Função para tratar a moderação
// Função para tratar a moderação
async function moderateMessage(ctx, text) {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;

  // Verifica se a mensagem contém palavras proibidas
  if (checkForBannedWords(text)) {
    try {
      // Apaga a mensagem
      await ctx.deleteMessage();
      
      // Envia uma resposta informando que o usuário foi identificado
      const response = `
        Olá ${username} (ID: ${userId}),
        Você foi identificado enviando uma mensagem com conteúdo impróprio. 
        Seu objetivo pode ser uma tentativa de golpe. 
        Saiba que você foi registrado na operação Fênix e está em nossa lista negra. 
        Por favor, não tente mais violar as regras.`;
      
      await ctx.reply(response);
    } catch (error) {
      console.error("Erro ao apagar a mensagem: ", error.message);
    }
  }
}


// Comando de boas-vindas
bot.start((ctx) => {
  const username = ctx.from.username || ctx.from.first_name;
  const platform = 'Telegram'; // Defina aqui a plataforma como Telegram (ou altere conforme necessário)
  savePostData('Boas-vindas', 'Bem-vindo!', ctx.from.id, username, platform, 'text');
  ctx.reply(`Bem-vindo, @${username}! 👋\nEnvie uma imagem, vídeo, texto, GIF ou escolha uma categoria para sua publicação.`);
});

// Comando para receber texto
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  // Verifica a moderação antes de salvar
  await moderateMessage(ctx, text);

  const username = ctx.from.username || ctx.from.first_name;
  const userId = ctx.from.id;
  const platform = 'Telegram';

  // Salvar o texto enviado se não for bloqueado
  await savePostData('Texto', text, userId, username, platform, 'text');
  ctx.reply(`Texto recebido: "${text}"`);
});

// Comando para receber imagens
bot.on('photo', async (ctx) => {
  const username = ctx.from.username || ctx.from.first_name;
  const userId = ctx.from.id;
  const platform = 'Telegram'; // Defina aqui a plataforma como Telegram (ou altere conforme necessário)
  const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Pega a imagem com maior resolução

  try {
    // Tenta obter o link da imagem
    const fileLink = await bot.telegram.getFileLink(photo.file_id);
    
    // Acessa a propriedade 'href' para pegar o link direto
    const imageUrl = fileLink.href;

    // Verifica se o imageUrl é uma string válida e salva
    if (typeof imageUrl !== 'string') {
      console.error("Erro ao obter o link da imagem, retorno inválido:", imageUrl);
      return ctx.reply("Erro ao obter o link da imagem.");
    }

    // Salvar imagem
    await savePostData('Imagem', 'Imagem enviada', userId, username, platform, 'image', imageUrl);
    ctx.reply(`Imagem recebida!`);
  } catch (error) {
    // Captura erro detalhado
    console.error("Erro ao tentar obter o link da imagem:", error);
    ctx.reply("Houve um erro ao tentar obter o link da imagem. Tente novamente.");
  }
});

// Comando para receber vídeos
bot.on('video', async (ctx) => {
  const username = ctx.from.username || ctx.from.first_name;
  const userId = ctx.from.id;
  const platform = 'Telegram'; // Defina aqui a plataforma como Telegram (ou altere conforme necessário)
  const video = ctx.message.video;
  const fileLink = await bot.telegram.getFileLink(video.file_id);

  // Verifica se o fileLink é uma string e salva
  if (typeof fileLink !== 'string') {
    return ctx.reply("Erro ao obter o link do vídeo.");
  }

  // Salvar vídeo
  await savePostData('Vídeo', 'Vídeo enviado', userId, username, platform, 'video', fileLink);
  ctx.reply(`Vídeo recebido!`);
});

// Comando para receber GIFs
bot.on('animation', async (ctx) => {
  const username = ctx.from.username || ctx.from.first_name;
  const userId = ctx.from.id;
  const platform = 'Telegram'; // Defina aqui a plataforma como Telegram (ou altere conforme necessário)
  const animation = ctx.message.animation;
  const fileLink = await bot.telegram.getFileLink(animation.file_id);

  // Verifica se o fileLink é uma string e salva
  if (typeof fileLink !== 'string') {
    return ctx.reply("Erro ao obter o link do GIF.");
  }

  // Salvar GIF
  await savePostData('GIF', 'GIF enviado', userId, username, platform, 'gif', fileLink);
  ctx.reply(`GIF recebido!`);
});

// Lançar o bot
bot.launch();
