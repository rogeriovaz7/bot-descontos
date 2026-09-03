
import re
import json
import os
import logging
from telethon import TelegramClient, events


# ── CONFIGURAÇÃO ──────────────────────────────────────────────────────
API_ID = 27118804                  # substitua pelo seu api_id (int)
API_HASH = "75f348c0e076af779df3d61aaddb69b1"   # substitua pela sua api_hash
SESSION_NAME = "copy_bot_session"

SOURCE_CHANNEL = "-1001362841540"   # username ou ID do canal de origem
DEST_CHANNEL = "-1003645799422"        # username OU ID numérico do seu grupo
                                    # (para grupo privado sem username, use o
                                    # ID numérico obtido com listar_chats.py,
                                    # ex: DEST_CHANNEL = -1001234567890)





MAP_FILE = "id_map.json"  # guarda a relação msg original -> msg copiada,
                           # para que edições no canal original também
                           # sejam refletidas na cópia

# Padrões a remover do texto (menções e links do canal de origem)
MENTION_PATTERNS = [
    re.escape(SOURCE_CHANNEL),                          # @canal_origem
    r"t\.me/" + re.escape(SOURCE_CHANNEL.lstrip("@")),  # t.me/canal_origem
    r"telegram\.me/" + re.escape(SOURCE_CHANNEL.lstrip("@")),
]
# ──────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
log = logging.getLogger(__name__)

client = TelegramClient(SESSION_NAME, API_ID, API_HASH)


def _carregar_mapa() -> dict:
    """Carrega do disco a relação {id_msg_original: id_msg_copiada}."""
    if os.path.exists(MAP_FILE):
        try:
            with open(MAP_FILE, "r", encoding="utf-8") as f:
                bruto = json.load(f)
                return {int(k): v for k, v in bruto.items()}
        except Exception as e:
            log.error("Não consegui carregar %s: %s", MAP_FILE, e)
    return {}


def _salvar_mapa(mapa: dict) -> None:
    try:
        with open(MAP_FILE, "w", encoding="utf-8") as f:
            json.dump(mapa, f)
    except Exception as e:
        log.error("Não consegui salvar %s: %s", MAP_FILE, e)


id_map = _carregar_mapa()  # id da msg no canal de origem -> id da cópia


def limpar_texto(texto: str) -> str:
    """Remove menções e links que referenciam o canal de origem."""
    if not texto:
        return texto
    limpo = texto
    for padrao in MENTION_PATTERNS:
        limpo = re.sub(padrao, "", limpo, flags=re.IGNORECASE)
    # remove espaços/linhas em branco extras deixados pela remoção
    limpo = re.sub(r"[ \t]{2,}", " ", limpo)
    limpo = re.sub(r"\n{3,}", "\n\n", limpo)
    return limpo.strip()


async def handler(event, dest_entity):
    msg = event.message
    texto_limpo = limpar_texto(msg.raw_text)

    try:
        if msg.media:
            # Envia a mídia por REFERÊNCIA (o próprio servidor do Telegram
            # copia o arquivo original), sem baixar/reenviar bytes crus.
            # Isso preserva o tipo (foto, vídeo, etc.) corretamente e evita
            # o problema de aparecer como "arquivo genérico/unnamed".
            enviada = await client.send_file(
                dest_entity,
                file=msg.media,
                caption=texto_limpo or None,
            )
        elif texto_limpo:
            enviada = await client.send_message(dest_entity, texto_limpo)
        else:
            return

        # guarda a relação pra permitir editar depois, se o original mudar
        id_map[msg.id] = enviada.id
        _salvar_mapa(id_map)

        log.info("Mensagem %s copiada com sucesso.", msg.id)

    except Exception as e:
        log.error("Falha ao copiar mensagem %s: %s", msg.id, e)


async def handler_editado(event, dest_entity):
    """Quando a mensagem original é editada, atualiza a cópia correspondente."""
    msg = event.message
    dest_id = id_map.get(msg.id)

    if dest_id is None:
        log.info(
            "Mensagem %s foi editada na origem, mas não achei a cópia "
            "correspondente (provavelmente foi postada antes do bot ligar).",
            msg.id,
        )
        return

    texto_limpo = limpar_texto(msg.raw_text)

    try:
        await client.edit_message(dest_entity, dest_id, texto_limpo or None)
        log.info("Mensagem %s editada com sucesso (cópia %s).", msg.id, dest_id)
    except Exception as e:
        log.error("Falha ao editar mensagem %s (cópia %s): %s", msg.id, dest_id, e)


def _ids_batem(dialog_id: int, alvo) -> bool:
    """Compara o ID de um diálogo com o alvo configurado, aceitando tanto
    o formato 'marcado' (-100xxxxxxxxxx) quanto o ID cru (xxxxxxxxxx)."""
    if isinstance(alvo, str):
        return False
    alvo_str = str(alvo).replace("-100", "").lstrip("-")
    dialog_str = str(dialog_id).replace("-100", "").lstrip("-")
    return alvo_str == dialog_str


def _normalizar_alvo(alvo):
    """Se o valor configurado for uma string puramente numérica (ex: vindo
    com aspas por engano: "-1001234567890"), converte para int. Usernames
    como "@meucanal" continuam como string normalmente."""
    if isinstance(alvo, str):
        limpo = alvo.strip()
        try:
            return int(limpo)
        except ValueError:
            return alvo  # é um @username mesmo, mantém como string
    return alvo


async def _resolver_por_dialogos(client, alvo):
    """Encontra a entidade certa varrendo os diálogos da conta — mais
    confiável do que client.get_entity() para IDs numéricos crus."""
    alvo = _normalizar_alvo(alvo)

    if isinstance(alvo, str):
        return await client.get_entity(alvo)

    async for dialog in client.iter_dialogs():
        if _ids_batem(dialog.id, alvo) or _ids_batem(dialog.entity.id, alvo):
            return dialog.entity

    raise ValueError(
        f"Não encontrei nenhum chat com ID {alvo} entre os diálogos desta conta. "
        "Confirme com listar_chats.py se o ID está certo e se esta conta "
        "realmente é membro dele."
    )


async def main():
    log.info("Iniciando cliente Telegram...")
    await client.start()

    log.info("Resolvendo entidades de origem e destino...")
    source_entity = await _resolver_por_dialogos(client, SOURCE_CHANNEL)
    dest_entity = await _resolver_por_dialogos(client, DEST_CHANNEL)
    log.info("Entidades resolvidas com sucesso.")

    client.add_event_handler(
        lambda event: handler(event, dest_entity),
        events.NewMessage(chats=source_entity),
    )
    client.add_event_handler(
        lambda event: handler_editado(event, dest_entity),
        events.MessageEdited(chats=source_entity),
    )

    log.info("Bot rodando. Escutando %s -> %s", SOURCE_CHANNEL, DEST_CHANNEL)
    await client.run_until_disconnected()


if __name__ == "__main__":
    client.loop.run_until_complete(main())