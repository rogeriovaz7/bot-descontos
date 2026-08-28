const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 10000;

let clientGlobal = null;
let qrCodeBase64 = null;

wppconnect.create({
  session: 'sessao-descontos',
  logQR: false, // Desativa a impressão distorcida no terminal
  catchQR: (base64Qrimg) => {
    qrCodeBase64 = base64Qrimg;
    console.log('✅ Novo QR Code gerado! Acede a /qr no navegador para ler.');
  },
  statusFind: (statusSession) => {
    console.log('Status da Sessão:', statusSession);
    if (statusSession === 'isLogged' || statusSession === 'inChat') {
      qrCodeBase64 = null;
    }
  },
  autoClose: 0,
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

// Endpoint para ver o QR Code limpo no navegador
app.get('/qr', (req, res) => {
    if (!qrCodeBase64) {
        if (clientGlobal) {
            return res.send('<h2>O WhatsApp já está autenticado!</h2>');
        }
        return res.send('<h2>A gerar QR Code... Atualize em 5 segundos.</h2>');
    }

    res.send(`
        <html>
            <head><title>WhatsApp QR Code</title></head>
            <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#f0f2f5;">
                <h2>Digitalize com o WhatsApp</h2>
                <div style="background:white; padding:20px; border-radius:10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <img src="${qrCodeBase64}" alt="QR Code" style="width:280px; height:280px;" />
                </div>
                <p style="color:#666; margin-top:15px;">Atualiza automaticamente a cada 8 segundos.</p>
                <script>setTimeout(() => location.reload(), 8000);</script>
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