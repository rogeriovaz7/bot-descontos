const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(express.json({ limit: '50mb' }));

let qrCodeBase64 = '';
let clientGlobal = null;

// Rota /qr com atualização automática a cada 5 segundos
app.get('/qr', (req, res) => {
  if (!qrCodeBase64) {
    return res.send(`
      <html>
        <head><meta http-equiv="refresh" content="5"></head>
        <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
          <h2>A aguardar geração do QR Code ou Sessão já conectada...</h2>
          <p>Esta página atualiza automaticamente a cada 5 segundos.</p>
        </body>
      </html>
    `);
  }
  
  res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="5">
      </head>
      <body style="font-family:sans-serif; text-align:center; background-color:#f0f2f5; padding-top:30px;">
        <h2>Escaneie o QR Code abaixo no WhatsApp</h2>
        <p>A imagem atualiza automaticamente para garantir que o QR Code está ativo.</p>
        <div style="background:white; display:inline-block; padding:20px; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
          <img src="${qrCodeBase64}" style="width:300px; height:300px;" />
        </div>
      </body>
    </html>
  `);
});

// Inicialização do WPPConnect
wppconnect
  .create({
    session: 'sessao-descontos',
    catchQR: (base64Qrimg) => {
      qrCodeBase64 = base64Qrimg;
      console.log('>>> NOVO QR CODE GERADO - Aceda a /qr <<<');
    },
    statusFind: (statusSession) => {
      console.log('Status da Sessao:', statusSession);
      if (statusSession === 'isLogged' || statusSession === 'inChat' || statusSession === 'qrReadSuccess') {
        qrCodeBase64 = '';
      }
    },
    headless: 'new',
    useChrome: false,
    autoClose: 0,
    waitForLogin: true,
    protocolTimeout: 60000,

        puppeteerOptions: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/usr/bin/chromium'),
        protocolTimeout: 120000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process', // Ajuda a reduzir o consumo de memória em ambientes restritos (pode testar se estabiliza)
            '--disable-software-rasterizer',
            '--disable-extensions'
        ]
    },

    

// Rota de envio
app.post('/send-media', async (req, res) => {
  if (!clientGlobal) {
    return res.status(500).json({ status: 'error', message: 'WhatsApp nao inicializado' });
  }
  const { phone, base64Data, fileName, caption } = req.body;
  try {
    await clientGlobal.sendFile(`${phone}@c.us`, base64Data, fileName, caption);
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.toString() });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor ativo na porta ${PORT}`);
});
