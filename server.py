import asyncio
import uvloop
import websockets
from uuid import uuid4
import pickle
import json
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from copy import deepcopy
from sanic import Sanic
from sanic.response import file, text
from sanic.websocket import WebSocketProtocol, ConnectionClosed
import pathlib
import ssl

# This file is a functional demonstration of a signaling server connecting two clients directly.
# When two users are connected, the signaling server will tell one of the clients to initiate the request.
#
# Communication in the signaling server will be handled using JSON & Serialization
# Each request will contain two minimum properties
# - method: that will tell the client what to do with the request.
# - uuid: if incoming, then the intended destination uuid, if outgoing, the senders uuid
# Defined methods
# - id: The user's id
# - init: Initialize an offer with the passed uuid
# - offer: An SDP offer to be passed to the uuid
# - answer: an SDP answer to be passed to the uuid

peers = {}
rooms = {}

async def on_disconnect(user):
    print("Connection closed - removing user")
    peers.pop(user)
    for room in rooms:
        if user in room["users"]:
            room["users"].pop(user)


async def peer_listener(user, socket):
    """Websocket peer listener"""
    while(socket.open):
        try:
            recv = json.loads(await socket.recv())
        except ConnectionClosed:
            on_disconnect(user)
            return

        # Pretty much no matter what, we're just going to swap uuids and copy it to the other user
        req = deepcopy(recv)
        if(req["method"]=="ready"):
            continue
        req["uuid"] = user
        await peers[recv["uuid"]]["socket"].send(json.dumps(req))

def get_other_peer(uid):
    """Simple utility method to grab the uuid & socket of the other user.
    Basically a stand-in for username routing.

    Just returns the first user id that doesn't match the user.
    """
    for key in peers.keys():
        if(key!=uid):
            return key


app = Sanic("WebRTC Example")

@app.websocket('/sock')
async def on_connect(request, websocket):
    """This method is run when the users connect to the websocket server. It adds them to the connected dictionary & starts their event loop"""
    user = str(uuid4())
    print("Peer connected {:s}".format(str(user)))
    peers[user] = {"socket": websocket}

    recv = await websocket.recv() # Initial ready check
    # Send the user their ID
    await websocket.send(json.dumps({"uuid": user, "method": "id", "connected": len(peers)}))

    if(len(peers)==2):
        # If two peers are connected, then let's tell the second peer to initiate contact
        req = { "uuid": get_other_peer(user), "method": "init"}
        await websocket.send(json.dumps(req))

    await asyncio.ensure_future(peer_listener(user, websocket))

def create_room(tag):
    rooms[tag] = {"users": [], "chat": []}

@app.route('/room/<tag>')
async def serve_room(request, tag):
    print("Got a request for room tag {:s}".format(tag))
    if(tag not in rooms.keys()):
        create_room(tag)

    # Max 2 members per room
    if(len(rooms[tag]["users"])>=2):
        return text("room at maximum occupancy")

    return await file("index.html")


@app.route('/')
async def index(request):
    print("Index request!")
    return await file("index.html")

@app.route('/webrtc.js')
async def javascript(request):
    print("Javascript request")
    return await file("webrtc.js")

@app.route("/style.css")
async def css(request):
    print("CSS request")
    return await file("style.css")

if __name__=="__main__":
    uvloop.install()
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    local_pem = pathlib.Path(__file__).with_name("new.pem")
    ssl_context.load_cert_chain("selfsigned.cert", "selfsigned.key")

    wsgi_server = app.create_server(host="0.0.0.0", port=8000, return_asyncio_server=True, ssl=ssl_context)

    loop = asyncio.get_event_loop()
    wsgi_task = asyncio.ensure_future(wsgi_server)
    try:
        loop.run_forever()
    except:
        loop.stop()
