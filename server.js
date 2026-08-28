const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Exemplo de uso da API WHATWG URL moderna para evitar DeprecationWarning
function validarUrl(inputUrl) {
  try {
    return new URL(inputUrl);
  } catch (err) {
    return null;
  }
}

let clientInstance = null;

wppconnect
  .create({
    session: 'sessao-descontos',
    catchQR: (base64Qr, asciiQR) => {
      console.log('QR Code recebido');
    },
    statusFind: (statusSession, session) => {
      console.log('Status da Sessão:', statusSession);
    },
    headless: true,
    devtools: false,
    useChrome: true,
    debug: false,
    logQR: true,
    // Configurações do Puppeteer sem a flag descontinuada browserFetcher
    puppeteerOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  })
  .then((client) => {
    clientInstance = client;
    start(client);
  })
  .catch((erro) => {
    console.error('Erro ao iniciar WPPConnect:', erro);
  });

function start(client) {
  client.onMessage((message) => {
    // Lógica para tratar mensagens recebidas
  });
}

app.get('/', (req, res) => {
  res.send('API WhatsApp está online!');
});

app.post('/send-message', async (req, res) => {
  const { phone, message } = req.body;

  if (!clientInstance) {
    return res.status(503).json({ error: 'Cliente WhatsApp ainda não inicializado' });
  }

  try {
    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;
    await clientInstance.sendText(chatId, message);
    return res.json({ status: 'sucesso', message: 'Mensagem enviada com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return res.status(500).json({ error: 'Falha ao enviar mensagem' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API WhatsApp a rodar na porta ${PORT}`);
});