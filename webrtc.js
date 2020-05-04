console.log("Hello world")

function get_tag(){
    var url = window.location.href;
    console.log(url);
    var base = "https://webrtc.kyso.dev/room/";
    var n = base.length;
    var tag = url.substr(n, url.length);
}

get_tag();

// Elements
var user1_name = document.querySelector("#user1-name");
var user2_name = document.querySelector("#user2-name");
var user1_video = document.querySelector("#user1-webcam");
var user2_video = document.querySelector("#user2-webcam");

// Signaling stuff
var uuid1 = null;
var uuid2 = null;

// What kind of stream tracks to send
var stream_types= {
    video: true,
    audio: false
};

//Streams
var local_stream = null;
var remote_stream = null;

// WebRTC Peer configuration
const config = {
    sdpSemantics: 'unified-plan',
    iceServers: [
        {
            urls: ['stun:stun.l.google.com:19302']
        },
        // {
        //     urls: ['turn:3.23.105.166:3478'],
        //     credential: 'hpv',
        //     username: 'rathma'
    // }

    ],
    // iceTransportPolicy: 'relay'
};

async function on_success(){

}

async function on_error(error){
    console.error(error);
}

//WebRTC state callbacks
async function onIceCandidate(pc, event){
    //If we receive a candidate, we want to maybe notify the other client
    console.log("Received ice candidate");
    console.log(event.candidate);
    socket.send({uuid: uuid2, method: "candidate", candidate: event.candidate})
}

var peer;

function create_peer_connection(create_offer){
    //Creates the peer connection and related callbacks and starts the negotiation
    peer = new RTCPeerConnection(config);

    peer.onicecandidate = event => {
        if(event.candidate){
            socket.send(JSON.stringify({uuid: uuid2, method: "candidate", candidate: event.candidate}));
        }
    };

    peer.ontrack = event => {
        console.log("Adding remote media tracks");
        remote_stream = event.streams[0];
        user2_video.srcObject = remote_stream;
    };

    // We know local_stream exists since it triggers the webrtc initialization
    local_stream.getTracks().forEach(track => peer.addTrack(track, local_stream));
    console.log("Added local media tracks to peer connection");

    //If we are the first user we need to generate the offers
    if(create_offer){
        peer.onnegotiationneeded = () => {
            console.log(peer);
            peer.createOffer().then(desc => {
                peer.setLocalDescription(
                    desc,
                    () => socket.send(JSON.stringify({uuid: uuid2, method: "offer", sdp: peer.localDescription})),
                    () => {}
                );
            });
        };
    }
}

socket = new WebSocket("wss://webrtc.kyso.dev/sock");

//Since the signaling server is kind of dumb right now, we're going to tell it we're ready for webrtc stuff after we select our media.
navigator.mediaDevices.getUserMedia(stream_types)
         .then( stream => {
             //Save the streams to set on the peer later & set local video player.
             local_stream = stream;
             user1_video.srcObject = local_stream;

             //Tell signaling server we're ready.
             socket.send(JSON.stringify({method: "ready"}));
          })
          .catch(function (e) {
              console.log("We broke something");
          });


socket.onmessage = async function (event) {
    console.log(event.data);
    var data = JSON.parse(event.data);
    switch(data.method){
        case "id":
            uuid1 = data.uuid;
            user1_name.innerHTML = uuid1;
            break;
        case "init":
            console.log("Received initialization command");
            uuid2 = data.uuid;
            user2_name.innerHTML = uuid2;
            create_peer_connection(true);
            break;
        case "offer":
            console.log("received offer");
            uuid2 = data.uuid;
            user2_name.innerHTML = uuid2;
            create_peer_connection(false);
            peer.setRemoteDescription(
                new RTCSessionDescription(data.sdp),
                () => {
                  peer.createAnswer()
                      .then(desc => {
                          peer.setLocalDescription(
                              desc,
                              () => socket.send(JSON.stringify({uuid: uuid2, method: "answer", sdp: peer.localDescription})),
                              () => {}
                          );
                      });
                },
                () => {}
            );
            break;
        case "answer":
            console.log("received answer");
            peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
            break;
        case "candidate":
            peer.addIceCandidate(new RTCIceCandidate(data.candidate), on_success, on_error);
            break;
    }
}
