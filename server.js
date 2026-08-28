const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 10000;

let clientGlobal = null;
let qrCodeBase64 = null; // Guarda a imagem do QR Code em memória

wppconnect.create({
  session: 'sessao-descontos',
  catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
    qrCodeBase64 = base64Qrimg; // Guarda a imagem base64
    console.log(`[QR] Novo QR Code gerado (tentativa ${attempts})`);
  },
  statusFind: (statusSession, session) => {
    console.log('Status da Sessão:', statusSession);
    if (statusSession === 'isLogged' || statusSession === 'inChat') {
      qrCodeBase64 = null; // Limpa o QR Code após o login
    }
  },
  autoClose: 0, // Desativa o fecho automático após 60 segundos
  headless: true,
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
.then(async (client) => {
    clientGlobal = client;
    console.log('✅ WhatsApp ligado e pronto!');

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
        console.log('Erro ao carregar chats:', e);
    }
})
.catch((error) => console.log('Erro no WPPConnect:', error));

// Endpoint para ver o QR Code diretamente no browser
app.get('/qr', (req, res) => {
    if (!qrCodeBase64) {
        if (clientGlobal) {
            return res.send('<h3>O WhatsApp já está autenticado e ligado!</h3>');
        }
        return res.send('<h3>QR Code ainda a gerar... Atualize a página em instantes.</h3>');
    }

    res.send(`
        <html>
            <head><title>WhatsApp QR Code</title></head>
            <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
                <h2>Digitalize o QR Code com o WhatsApp</h2>
                <img src="${qrCodeBase64}" alt="QR Code WhatsApp" style="width:300px; height:300px;" />
                <p>A página atualiza automaticamente a cada 10 segundos.</p>
                <script>setTimeout(() => location.reload(), 10000);</script>
            </body>
        </html>
    `);
});

app.post('/send-media', async (req, res) => {
    try {
        if (!clientGlobal) {
            return res.status(500).json({ error: 'WhatsApp ainda não está autenticado.' });
        }

        const { number, caption, path } = req.body;
        if (!number || !path) {
            return res.status(400).json({ error: 'Campos "number" e "path" são obrigatórios.' });
        }

        await clientGlobal.sendImage(number, path, 'banner.png', caption || '');
        console.log(`[✓] Imagem enviada para: ${number}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao enviar imagem:', err);
        res.status(500).json({ error: err.toString() });
    }
});

app.listen(PORT, () => console.log(`🚀 API WhatsApp a rodar na porta ${PORT}`));