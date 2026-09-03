import requests

def enviar_whatsapp(numero, legenda, url_imagem):
    url_api = "https://whatsapp-api-z5nq.onrender.com/send-media"
    payload = {
        "number": numero,
        "caption": legenda,
        "imageUrl": url_imagem
    }
    try:
        res = requests.post(url_api, json=payload)
        print("Resposta WhatsApp:", res.json())
    except Exception as e:
        print("Erro ao chamar API WhatsApp:", e)