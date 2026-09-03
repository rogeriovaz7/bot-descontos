const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const pathModule = require('path');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let clientGlobal = null;


wppconnect.create({
    session: 'sessao-descontos',
    autoClose: 0,
    timeAutoClose: 0,
    headless: true,
    qrTimeout: 0,
    useChrome: false,
    protocolTimeout: 120000,
    puppeteerOptions: {
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
    catchQR: (base64Qr, asciiQR) => console.log(asciiQR),
    statusFind: (statusSession, session) => console.log('Status da Sessão:', statusSession)
})


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

        // 1. Identificar extensão do ficheiro para obter o mime type correto
        const ext = pathModule.extname(filePath).toLowerCase();
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

        // 2. Converter imagem para Base64
        const fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
        const dataUrl = `data:${mimeType};base64,${fileBase64}`;

        // 3. Converter Markdown do Telegram (**) para o formato do WhatsApp (*)
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