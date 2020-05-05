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


async def rtc_handler(user, socket):
    """Handles the websocket connection for RTC chat users
    """
    pass

async def on_disconnect(user):
    print("Connection closed - removing user")
    rtc_peers.pop(user)
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
        await rtc_peers[recv["uuid"]]["socket"].send(json.dumps(req))

def get_other_peer(uid):
    """Simple utility method to grab the uuid & socket of the other user.
    Basically a stand-in for username routing.

    Just returns the first user id that doesn't match the user.
    """
    for key in rtc_peers.keys():
        if(key!=uid):
            return key
