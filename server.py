import asyncio
import uvloop
import websockets
from uuid import uuid4
import pickle
import json
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from copy import deepcopy
from sanic import Sanic
from sanic.response import file, text, redirect
from sanic.response import json as r_json
from sanic.websocket import WebSocketProtocol, ConnectionClosed
import pathlib
import ssl

# Peers connected to the main index
index_peers = {}

# Peers connected to the webrtc area
peers = {}
rooms = {}
room_names = {}

async def push_room_update():
    """Pushes the updated room list info to all users on the index.
    """
    for user,ws in index_peers.items():
        await send_rooms(ws)

async def send_rooms(ws):
    payload = { "method": "room_update", "rooms": rooms }
    await ws.send(json.dumps(payload))



def create_room(params, rid=None):
    print(params)
    if(rid is None):
        room_id = str(uuid4())
    else:
        room_id = rid
    rooms[room_id] = {}
    print(params["room_name"])
    print(params["room_name"][0])
    url = "https://webrtc.kyso.dev/room/" + room_id
    room_names[params["room_name"][0]] = room_id
    rooms[room_id]["uuid"] = room_id
    rooms[room_id]["name"] = params["room_name"]
    rooms[room_id]["url"] = url
    rooms[room_id]["capacity"] = params["participants"]
    rooms[room_id]["users"] = []
    rooms[room_id]["chat"] = []
    rooms[room_id]["avail"] = params["participants"]
    rooms[room_id]["user_count"] = 0
    print("Created room %s" % str(rooms[room_id]))
    asyncio.ensure_future(push_room_update())
    return url

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
async def on_index_disconnect(user):
    index_peers.pop(user)
    await update_connected_index()

async def update_connected_index():
    for k,ws in index_peers.items():
        await ws.send(json.dumps({"method": "connected_update", "connected": len(index_peers)}))


@app.websocket('/index')
async def ws_index(request, websocket):
    user = str(uuid4())
    index_peers[user] = websocket

    await update_connected_index()
    await send_rooms(websocket)
    while(websocket.open):
        try:
            recv = await websocket.recv();
        except:
            await on_index_disconnect(user)


    

@app.websocket('/rtc')
async def ws_rtc(request, websocket):
    pass

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


@app.route('/getroom/<key>')
async def get_room_data(request, key):
    print("Requested room data for %s" % str(key))
    if(key not in room_names.keys()):
        return r_json({})
    _id = room_names[key]
    room_data = {
        "name": rooms[_id]["name"],
        "uuid": _id
    }

    return r_json(room_data)
# This allows us to share a link of a room we created
@app.route('/room/<key>')
async def serve_room(request, key):
    print("Got a request for room key {:s}".format(key))
    # If it doesn't exist, send them home
    if(key not in rooms.keys()):
        print("Room not found.")
        return await file("index.html")
    return await file("room.html")

# This is the method called from the index to create a room
@app.route('/room', methods=["POST"])
async def serve_create_room(request):
    print("Serving room")
    print(request.form)
    room_data = request.form
    url = create_room(room_data)
    return redirect(url)


@app.route('/rand')
async def serve_rand_room(request):
    rid = str(uuid4())
    url = create_room({"room_name": rid, "participants": ["2"]}, rid)
    return redirect(url)

@app.route('/favicon.ico')
async def favicon(request):
    return await file('favicon.ico')

@app.route('/')
async def index(request):
    print("Index request from: %s" % str(request.ip))
    return await file("index.html")

@app.route('/webrtc.js')
async def webrtc_js(request):
    return await file("webrtc.js")

@app.route('/index.js')
async def index_js(request):
    return await file("index.js")

@app.route("/style.css")
async def css(request):
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
