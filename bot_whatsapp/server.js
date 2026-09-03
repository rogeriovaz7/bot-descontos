const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const pathModule = require('path');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let clientGlobal = null;
let qrCodeGlobal = null; // Variável para armazenar o QR Code atual

wppconnect.create({
    session: 'sessao-descontos',
    autoClose: 0,
    timeAutoClose: 0,
    headless: true,
    qrTimeout: 0,
    useChrome: true,
    protocolTimeout: 120000,
    puppeteerOptions: {
        executablePath: '/usr/bin/chromium', // Corrigido para o caminho correto do Debian slim
        protocolTimeout: 120000,
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
        qrCodeGlobal = base64Qr; // Guarda o QR Code em formato base64/data-url
    },
    statusFind: (statusSession, session) => {
        console.log('Status da Sessão:', statusSession);
        if (statusSession === 'isLogged' || statusSession === 'successChats') {
            qrCodeGlobal = null; // Limpa o QR code assim que estiver autenticado
        }
    }
})
.then((client) => {
    clientGlobal = client;
    console.log('[✓] Cliente WhatsApp inicializado com sucesso!');
})
.catch((error) => {
    console.error('Erro ao inicializar wppconnect:', error);
});

// Nova rota para ver o QR Code facilmente no browser
app.get('/qr', (req, res) => {
    if (!qrCodeGlobal) {
        return res.send(`
            <html>
                <body style="font-family: Arial; text-align: center; margin-top: 50px; background: #f0f2f5;">
                    <h2>O WhatsApp já está conectado ou o QR Code ainda está a ser gerado!</h2>
                    <p>Atualiza esta página em alguns segundos.</p>
                </body>
            </html>
        `);
    }

    // O wppconnect emite o base64 diretamente ou como data-url
    const qrImage = qrCodeGlobal.startsWith('data:image') 
        ? qrCodeGlobal 
        : `data:image/png;base64,${qrCodeGlobal}`;

    res.send(`
        <html>
            <body style="font-family: Arial; text-align: center; margin-top: 40px; background: #f0f2f5;">
                <h2>Escaneie o QR Code para ligar o WhatsApp</h2>
                <div style="background: white; display: inline-block; padding: 20px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <img src="${qrImage}" alt="QR Code WhatsApp" style="width: 300px; height: 300px;" />
                </div>
                <p style="color: #666; margin-top: 20px;">A página atualiza automaticamente...</p>
                <script>
                    setTimeout(() => window.location.reload(), 5000);
                </script>
            </body>
        </html>
    `);
});

app.post('/send-media', async (req, res) => {
    try {
        if (!clientGlobal) {
            return res.status(500).json({ error: 'WhatsApp ainda não está autenticado.' });
        }

        const isConnected = await clientGlobal.isConnected();
        if (!isConnected) {
            console.log('[!] Aguardando 3s para o WhatsApp concluir a sincronização...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        const { number, caption, path: filePath } = req.body;

        if (!number || !filePath) {
            return res.status(400).json({ error: 'Campos "number" e "path" são obrigatórios.' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: `Ficheiro não encontrado no caminho: ${filePath}` });
        }

        const ext = pathModule.extname(filePath).toLowerCase();
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

        const fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
        const dataUrl = `data:${mimeType};base64,${fileBase64}`;

        let formattedCaption = caption || '';
        formattedCaption = formattedCaption.replace(/\*\*(.*?)\*\*/g, '*$1*');

        await clientGlobal.sendImageFromBase64(
            number,
            dataUrl,
            `banner${ext}`,
            formattedCaption
        );

        console.log(`[✓] Imagem enviada com sucesso para: ${number}`);
        return res.json({ success: true });

    } catch (err) {
        console.error('Erro ao enviar imagem:', err);
        return res.status(500).json({ error: err.toString() });
    }
});

app.listen(3000, () => console.log('🚀 API WhatsApp a rodar na porta 3000'));