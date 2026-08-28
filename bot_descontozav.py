import io
import re
import os
import requests
import random
from PIL import Image, ImageDraw, ImageFont, ImageChops
from telethon import TelegramClient, events

# ==========================================
# CONFIGURAÇÕES DE API E CANAIS
# ==========================================
API_ID = 27118804
API_HASH = "75f348c0e076af779df3d61aaddb69b1"
CANAL_ORIGEM = "descontosAinanas"
MEU_CANAL = "descontoZav"

# Lista com os ficheiros dos teus templates (garante que estão na mesma pasta do script)
TEMPLATES = [
    "template1.png",
    "template2.png",
    "template3.png"
]
MINHA_TAG_AMAZON = "zav0f-20"

# Configuração do WhatsApp
WHATSAPP_API_URL = "http://localhost:3000/send-media"
WHATSAPP_CANAL_ID = "120363424620479144@g.us"


# ==========================================
# 1. TRATAMENTO DE IMAGEM E MARGENS
# ==========================================
def recortar_margens_brancas(img):
    """ Corta as margens brancas ou transparentes em redor do produto para o expandir ao máximo """
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    fundo_branco = Image.new('RGBA', img.size, (255, 255, 255, 255))
    diferenca = ImageChops.difference(img, fundo_branco)
    
    bbox = diferenca.getbbox()
    if bbox:
        return img.crop(bbox)
    return img


def obter_imagem_limpa_produto(url_link):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7"
    }

    asin_match = re.search(r"/(?:dp|gp/product|amz)/([A-Z0-9]{10})", url_link)
    
    if asin_match:
        asin = asin_match.group(1)
        img_url_direct = f"https://m.media-amazon.com/images/P/{asin}.01._SCLZZZZZZZ_.jpg"
        try:
            res = requests.get(img_url_direct, headers=headers, timeout=10)
            if res.status_code == 200 and len(res.content) > 5000:
                print(f"[✓] Imagem HD obtida via ASIN ({asin})")
                return Image.open(io.BytesIO(res.content)).convert("RGBA")
        except Exception as e:
            print(f"[!] Erro ao carregar imagem via ASIN: {e}")

    return None


# ==========================================
# 2. GERAÇÃO DO BANNER (SELEÇÃO ALEATÓRIA DE TEMPLATE)
# ==========================================
def gerar_banner(produto_img, preco_antes, preco_agora, veio_do_post=False):
    # Escolhe aleatoriamente um dos templates definidos na lista TEMPLATES
    template_escolhido = random.choice(TEMPLATES)
    print(f"[✓] Template selecionado: {template_escolhido}")
    
    template = Image.open(template_escolhido).convert("RGBA")
    
    if template.size != (1400, 1400):
        template = template.resize((1400, 1400), Image.Resampling.LANCZOS)
        
    largura_tpl, altura_tpl = 1400, 1400

    # 1. Canvas Fundo Branco Limpo (1400x1400)
    canvas = Image.new("RGBA", (largura_tpl, altura_tpl), (255, 255, 255, 255))
    
    if produto_img.mode != 'RGBA':
        produto_img = produto_img.convert('RGBA')

    # 2. Se a foto veio do post do canal de origem, corta a parte inferior
    if veio_do_post:
        w_p, h_p = produto_img.size
        produto_img = produto_img.crop((0, 0, w_p, int(h_p * 0.70)))

    # Corta margens brancas/transparentes para obter o produto limpo
    produto_img = recortar_margens_brancas(produto_img)

    # 3. REDIMENSIONAMENTO UNIFORME E CENTRALIZAÇÃO
    CAIXA_LARGURA = 1100
    CAIXA_ALTURA = 900
    
    CENTRO_X = 700
    CENTRO_Y = 520

    w_orig, h_orig = produto_img.size

    # Calcula a escala proporcional
    escala = min(CAIXA_LARGURA / w_orig, CAIXA_ALTURA / h_orig)
    
    novo_w = int(w_orig * escala)
    novo_h = int(h_orig * escala)

    produto_redim = produto_img.resize((novo_w, novo_h), Image.Resampling.LANCZOS)

    pos_x = CENTRO_X - (novo_w // 2)
    pos_y = CENTRO_Y - (novo_h // 2)

    # 4. SOBREPOSIÇÃO DAS CAMADAS
    canvas.paste(produto_redim, (pos_x, pos_y), produto_redim)
    canvas.paste(template, (0, 0), template)

    # 5. DESENHO DOS PREÇOS
    draw = ImageDraw.Draw(canvas)

    try:
        font_antes = ImageFont.truetype("arialbd.ttf", 90)   # Preço antigo
        font_agora = ImageFont.truetype("arialbd.ttf", 135)  # Preço novo
    except:
        font_antes = font_agora = ImageFont.load_default()

    txt_antes = f"{preco_antes:.2f}€".replace('.', ',')
    txt_agora = f"{preco_agora:.2f}€".replace('.', ',')

    # Coordenadas do Template
    X_ANTES = 1080
    Y_ANTES = 1105

    X_AGORA = 1050
    Y_AGORA = 1278

    # Preço Antigo
    draw.text((X_ANTES, Y_ANTES), txt_antes, fill=(35, 35, 35, 255), font=font_antes, anchor="mm")

    # Preço Novo
    draw.text((X_AGORA, Y_AGORA), txt_agora, fill=(255, 255, 255, 255), font=font_agora, anchor="mm")

    output = io.BytesIO()
    canvas.save(output, format="PNG", optimize=False)
    output.seek(0)
    return output


# ==========================================
# 3. TRATAMENTO DE LINKS E MENSAGENS
# ==========================================
def resolver_e_converter_link(url):
    if not url:
        return url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    }

    url_final = url

    if any(domain in url for domain in ["link.amazon", "amzn.to", "amzn.eu", "a.co"]):
        try:
            res = requests.get(url, headers=headers, allow_redirects=True, timeout=10)
            url_final = res.url
            print(f"[✓] Link encurtado expandido para: {url_final}")
        except Exception as e:
            print(f"[!] Erro ao expandir link encurtado ({url}): {e}")

    asin_match = re.search(r"/(?:dp|gp/product|product|ASIN)/([A-Z0-9]{10})", url_final, re.IGNORECASE)
    
    if not asin_match:
        asin_match = re.search(r"\b(B0[A-Z0-9]{8})\b", url_final, re.IGNORECASE)

    if asin_match:
        asin = asin_match.group(1).upper()
        link_afiliado = f"https://www.amazon.es/dp/{asin}?tag={MINHA_TAG_AMAZON}"
        print(f"[✓] Link de Afiliado Gerado: {link_afiliado}")
        return link_afiliado

    print(f"[!] Não foi possível extrair o ASIN. A manter URL: {url_final}")
    return url_final


def extrair_dados_mensagem(texto):
    linhas = [l.strip() for l in texto.split('\n') if l.strip()]
    titulo = linhas[0] if linhas else "Oferta em Destaque"
    
    match_antes = re.search(r"Antes:\s*([\d\.,]+)\s*€", texto, re.IGNORECASE)
    match_agora = re.search(r"Agora:\s*([\d\.,]+)\s*€", texto, re.IGNORECASE)
    match_link = re.search(r"https?://[^\s\)]+", texto)
    
    preco_antes = float(match_antes.group(1).replace(',', '.')) if match_antes else None
    preco_agora = float(match_agora.group(1).replace(',', '.')) if match_agora else None
    link_original = match_link.group(0) if match_link else None

    link_afiliado = resolver_e_converter_link(link_original)

    return titulo, preco_antes, preco_agora, link_afiliado


# ==========================================
# 4. ENVIO PARA O WHATSAPP
# ==========================================
def enviar_para_whatsapp(caminho_imagem, legenda_texto):
    caminho_absoluto = os.path.abspath(caminho_imagem)
    
    payload = {
        "number": WHATSAPP_CANAL_ID,
        "caption": legenda_texto,
        "path": caminho_absoluto
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        res = requests.post(WHATSAPP_API_URL, json=payload, headers=headers, timeout=15)
        if res.status_code == 200:
            print("[✓] Publicado no WhatsApp com sucesso!")
        else:
            print(f"[!] Erro ao enviar para o WhatsApp ({res.status_code}): {res.text}")
    except Exception as e:
        print(f"[!] Erro de ligação à API do WhatsApp: {e}")


# ==========================================
# 5. MONITORIZAÇÃO E EXECUÇÃO (TELEGRAM)
# ==========================================
client = TelegramClient('sessao_bot', API_ID, API_HASH)

@client.on(events.NewMessage(chats=CANAL_ORIGEM))
async def monitorar_canal(event):
    texto = event.message.message or ""
    print("\n----------------------------------------")
    print("📢 MENSAGEM DETETADA NO CANAL ORIGEM!")
    
    titulo, preco_antes, preco_agora, link = extrair_dados_mensagem(texto)
    
    if not (preco_antes and preco_agora and link):
        print("[!] Ignorado: Faltam preços ou link no formato esperado.")
        return

    print(f"--> Título: {titulo}")
    print(f"--> Preços: {preco_antes:.2f}€ -> {preco_agora:.2f}€")
    print(f"--> Link Limpo: {link}")

    veio_do_post = False
    produto_img = obter_imagem_limpa_produto(link)
    
    if not produto_img and event.message.photo:
        print("[!] A descarregar imagem anexada no post do Telegram...")
        caminho_temp = "temp_input.png"
        await event.message.download_media(file=caminho_temp)
        produto_img = Image.open(caminho_temp).convert("RGBA")
        veio_do_post = True

    if not produto_img:
        print("[X] Ignorado: Nenhuma imagem encontrada para o produto.")
        return

    # Gera o banner escolhendo aleatoriamente entre template1.png, template2.png e template3.png
    banner_io = gerar_banner(produto_img, preco_antes, preco_agora, veio_do_post=veio_do_post)
    banner_io.name = "banner.png"

    desconto_pct = round(((preco_antes - preco_agora) / preco_antes) * 100)
    
    legenda = (
        f"**{titulo}**\n\n"
        f"❌ Antes: {preco_antes:.2f}€\n"
        f"✅ Agora: {preco_agora:.2f}€\n"
        f"🔥 Poupa {desconto_pct}%\n\n"
        f"🛒 Comprar Aqui: {link}\n\n"
        f"⚡Descontos Zav, os melhores descontos!"
    )
    
    # 3. Publica no Telegram
    await client.send_file(MEU_CANAL, banner_io, caption=legenda, parse_mode='markdown')
    print("[✓] Publicado com sucesso no @descontoZav!")

    # 4. Guarda em disco e envia para o WhatsApp
    caminho_banner_out = "banner_final.png"
    with open(caminho_banner_out, "wb") as f:
        f.write(banner_io.getvalue())

    enviar_para_whatsapp(caminho_banner_out, legenda)

    # 5. Limpeza de ficheiros temporários
    if os.path.exists(caminho_banner_out):
        os.remove(caminho_banner_out)
    if os.path.exists("temp_input.png"):
        os.remove("temp_input.png")


if __name__ == "__main__":
    print("Bot a funcionar e a monitorizar...")
    client.start()
    client.run_until_disconnected()