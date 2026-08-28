process.env.PUPPETEER_CACHE_DIR = require('path').join(__dirname, '.cache');
const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');
const puppeteer = require('puppeteer'); // Adicionado para obter o caminho do executável

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let clientGlobal = null;

wppconnect.create({
  session: 'sessao-descontos',
  puppeteerOptions: {
    executablePath: puppeteer.executablePath(), // Indica o caminho exato descarregado pelo Puppeteer
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  },
  catchQR: (base64Qr, asciiQR) => {
    console.log(asciiQR);
  },
  statusFind: (statusSession, session) => {
    console.log('Status da Sessão:', statusSession);
  }
})
.then(async (client) => {
    clientGlobal = client;
    console.log('✅ WhatsApp ligado e pronto a enviar!');

    try {
        const chats = await client.getAllChats();
        console.log('\n--- LISTA DE GRUPOS E CANAIS ---');
        chats.forEach(chat => {
            if (chat.isGroup || chat.kind === 'newsletter') {
                console.log(`Nome: ${chat.name} | ID: ${chat.id._serialized}`);
            }
        });
        console.log('--------------------------------\n');
    } catch (e) {
        console.log('Erro ao carregar lista de chats:', e);
    }
})
.catch((error) => console.log(error));

// Endpoint chamado pelo bot em Python
app.post('/send-media', async (req, res) => {
    try {
        if (!clientGlobal) {
            return res.status(500).json({ error: 'WhatsApp ainda não está autenticado.' });
        }

        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: 'O corpo da requisição veio vazio.' });
        }

        const { number, caption, path } = req.body;

        if (!number || !path) {
            return res.status(400).json({ error: 'Campos "number" e "path" são obrigatórios.' });
        }

        await clientGlobal.sendImage(
            number,
            path,
            'banner.png',
            caption || ''
        );

        console.log(`[✓] Imagem enviada com sucesso para: ${number}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao enviar imagem:', err);
        res.status(500).json({ error: err.toString() });
    }
});

app.listen(3000, () => console.log('🚀 API WhatsApp a rodar na porta 3000'));