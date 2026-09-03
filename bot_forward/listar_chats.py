"""
Script auxiliar: lista todos os seus chats (grupos, canais, etc.) com o ID
de cada um, para você identificar o ID correto do seu grupo de destino.

Uso:
    python listar_chats.py
"""

from telethon import TelegramClient

API_ID = 27118804
API_HASH = "75f348c0e076af779df3d61aaddb69b1"

client = TelegramClient("copy_bot_session", API_ID, API_HASH)


async def main():
    async for dialog in client.iter_dialogs():
        tipo = "Grupo" if dialog.is_group else "Canal" if dialog.is_channel else "Outro"
        print(f"{tipo:8} | ID: {dialog.id:15} | {dialog.name}")


with client:
    client.loop.run_until_complete(main())
