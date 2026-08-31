const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 10000;

let clientGlobal = null;
let qrCodeBase64 = null;

wppconnect
  .create({
    session: 'sessao-descontos',
    catchQR: (base64Qrimg) => {
      qrCodeBase64 = base64Qrimg;
      console.log('>>> NOVO QR CODE GERADO - Aceda a /qr <<<');
    },
    statusFind: (statusSession) => {
      console.log('Status da Sessao:', statusSession);
      if (statusSession === 'isLogged' || statusSession === 'inChat') {
        qrCodeBase64 = '';
      }
    },
    headless: true,
    useChrome: false,
    autoClose: 0,             // Impede o bot de fechar sozinho
    waitForLogin: false,      // Evita o erro de timeout na autenticação
    puppeteerOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      ]
    }
  })
.then((client) => {
    clientGlobal = client;
    console.log('✅ WhatsApp ligado e pronto no Render!');
})
.catch((error) => console.log('Erro WPPConnect:', error));

app.get('/qr', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    if (!qrCodeBase64) {
        if (clientGlobal) return res.send('<h2 style="font-family:sans-serif; text-align:center; color:#2e7d32; margin-top:50px;">✅ WhatsApp Autenticado!</h2>');
        return res.send('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px;">⏳ A carregar QR Code...</h2>');
    }
    res.send(`
        <html>
            <head><title>WhatsApp QR Code</title><meta http-equiv="refresh" content="6"></head>
            <body style="display:flex; justify-content:center; align-items:center; height:100vh; background:#f0f2f5; margin:0;">
                <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
                    <img src="${qrCodeBase64}" style="width:280px; height:280px; display:block;" />
                </div>
            </body>
        </html>
    `);
});

app.post('/send-media', async (req, res) => {
    try {
        if (!clientGlobal) {
            return res.status(500).json({ error: 'WhatsApp ainda não está autenticado.' });
        }

        const { number, caption, imageUrl } = req.body;
        if (!number || !imageUrl) {
            return res.status(400).json({ error: 'Campos "number" e "imageUrl" são obrigatórios.' });
        }

        // Envia a imagem diretamente a partir do URL gerado/hospedado
        await clientGlobal.sendImage(number, imageUrl, 'banner.png', caption || '');
        console.log(`[✓] Imagem enviada com sucesso para: ${number}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao enviar imagem:', err);
        res.status(500).json({ error: err.toString() });
    }
});

app.listen(PORT, () => console.log(`🚀 API WhatsApp ativa na porta ${PORT}`));
