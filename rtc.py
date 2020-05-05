#!/usr/bin/env python3
import asyncio
import json
from copy import deepcopy

# from aiortc import (RTCConfiguration, RTCIceServer, RTCPeerConnection,
#                     RTCSessionDescription)
from sanic.websocket import ConnectionClosed, WebSocketProtocol

rtc_peers = {}
rooms = {}
room_names = {}

# Peers connected to the main index
index_peers = {}


async def send_rooms(ws):
    """Pushes updated room list to a specific user
    """
    payload = { "method": "room_update", "rooms": rooms }
    await ws.send(json.dumps(payload))

async def push_room_update():
    """Pushes the updated room list info to all users on the index.
    """
    for user,ws in index_peers.items():
        await send_rooms(ws)

async def on_message(message):
    # Username room name uuid content
    print(message)
    for user in rooms[message["room"]]["users"]:
        await rtc_peers[user]["socket"].send(json.dumps(message))

async def init_negotiations(user_id, room_key):
    """Initializes the negotiations with every user in the room when a user is ready."""
    for user in rooms[room_key]["users"]:
        if user != user_id:
            print("Initializing connection between %s & %s" % (user_id, user))
            await rtc_peers[user]["socket"].send(json.dumps({
                "method": "negotiation_request",
                "uuid": user_id
            }))

async def rtc_handler(user, socket, room_key):
    """Handles the websocket connection for RTC chat users
    """
   
    while(socket.open):
        try:
            recv = json.loads(await socket.recv())
            method = recv["method"]
            if(method=="message"):
                recv["username"] = user
                await on_message(recv)
            elif(method=="ready"):
                # User has setup their webcam, begin negotiations with their peers in the room
                await init_negotiations(user, room_key)

            elif(method=="offer"):
                print("received offer")
                await rtc_peers[recv["dest_uuid"]]["socket"].send(json.dumps({
                    "uuid": user,
                    "method": "offer",
                    "sdp": recv["sdp"]
                }))
            elif(method=="answer"):
                await rtc_peers[recv["dest_uuid"]]["socket"].send(json.dumps({
                    "uuid": user,
                    "method": "answer",
                    "sdp": recv["sdp"]
                }))
            elif(method=="candidate"):
                await rtc_peers[recv["dest_uuid"]]["socket"].send(json.dumps({
                    "uuid": user,
                    "method": "candidate",
                    "candidate": recv["candidate"]
                }))

        except:
            await on_disconnect(user)

async def on_disconnect(user):
    print("Connection closed - removing user")
    rtc_peers.pop(user)
    to_rm = []
    for key,room in rooms.items():
        if user in room["users"]:
            room["users"].remove(user)
            room["avail"]+=1
            room["user_count"]-=1
            if(room["user_count"]==0):
                to_rm.append(key)
            for u in room["users"]:
                await rtc_peers[u]["socket"].send(json.dumps({
                    "method": "peer_disconnect",
                    "uuid": user
                }))
    for r in to_rm:
        rooms.pop(r)
    print(rooms)
    await push_room_update()


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
        await rtc_peers[recv["uuid"]]["socket"].send(json.dumps(req))

def get_other_peer(uid):
    """Simple utility method to grab the uuid & socket of the other user.
    Basically a stand-in for username routing.

    Just returns the first user id that doesn't match the user.
    """
    for key in rtc_peers.keys():
        if(key!=uid):
            return key
