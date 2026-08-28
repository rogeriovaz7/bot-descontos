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
  logQR: false,
  autoClose: 0,
  headless: true,
  catchQR: (base64Qrimg, asciiQR, attempts) => {
    qrCodeBase64 = base64Qrimg;
    console.log(`[QR] Novo QR Code gerado (tentativa ${attempts})`);
  },
  statusFind: (statusSession) => {
    console.log('Status da Sessão:', statusSession);
    if (statusSession === 'isLogged' || statusSession === 'inChat') {
      qrCodeBase64 = null;
    }
  },
  puppeteerOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--single-process',
      '--no-default-browser-check',
      '--disable-features=site-per-process'
    ]
  }
})
.then(async (client) => {
    clientGlobal = client;
    console.log('✅ WhatsApp ligado e autenticado com sucesso!');

    // Aguarda 5 segundos para a sincronização inicial terminar antes de listar os grupos
    setTimeout(async () => {
        try {
            // Usa listChats() em vez do antigo getAllChats()
            const chats = await client.listChats();
            console.log('\n--- LISTA DE GRUPOS E CANAIS ---');
            chats.forEach(chat => {
                if (chat.isGroup || chat.kind === 'newsletter') {
                    console.log(`Nome: ${chat.name || chat.formattedTitle} | ID: ${chat.id._serialized}`);
                }
            });
            console.log('--------------------------------\n');
        } catch (e) {
            console.log('Erro ao carregar chats:', e);
        }
    }, 5000);
})
.catch((error) => console.log('Erro no WPPConnect:', error));

app.get('/qr', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    if (!qrCodeBase64) {
        if (clientGlobal) {
            return res.send('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px; color:#2e7d32;">✅ WhatsApp autenticado e operacional!</h2>');
        }
        return res.send('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px;">⏳ A carregar sessão...</h2>');
    }

    res.send(`
        <html>
            <head>
                <title>WhatsApp QR Code</title>
                <meta http-equiv="refresh" content="6">
            </head>
            <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#f0f2f5; margin:0;">
                <h2 style="color:#111b21;">Digitalize com o WhatsApp</h2>
                <div style="background:white; padding:20px; border-radius:12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <img src="${qrCodeBase64}" alt="QR Code" style="width:280px; height:280px; display:block;" />
                </div>
                <p style="color:#667781; margin-top:16px; font-size:14px;">A página atualiza automaticamente a cada 6 segundos.</p>
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