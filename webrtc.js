
function get_room_key(){
    var url = window.location.href;
    var base = "https://webrtc.kyso.dev/room/";
    var n = base.length;
    var key = url.substr(n, url.length);
    return key;
}
const room_key = get_room_key();

// // Elements
// var user1_name = document.querySelector("#user1-name");
// var user2_name = document.querySelector("#user2-name");
// var user1_video = document.querySelector("#user1-webcam");
// var user2_video = document.querySelector("#user2-webcam");

// // Signaling stuff
// var uuid1 = null;
// var uuid2 = null;

// // What kind of stream tracks to send
// var stream_types= {
//     video: true,
//     audio: false
// };

// //Streams
// var local_stream = null;
// var remote_stream = null;

// // WebRTC Peer configuration
// const config = {
//     sdpSemantics: 'unified-plan',
//     iceServers: [
//         {
//             urls: ['stun:stun.l.google.com:19302']
//         },
//         // {
//         //     urls: ['turn:3.23.105.166:3478'],
//         //     credential: 'hpv',
//         //     username: 'rathma'
//     // }

//     ],
//     // iceTransportPolicy: 'relay'
// };

// async function on_success(){

// }

// async function on_error(error){
//     console.error(error);
// }

// //WebRTC state callbacks
// async function onIceCandidate(pc, event){
//     //If we receive a candidate, we want to maybe notify the other client
//     console.log("Received ice candidate");
//     console.log(event.candidate);
//     socket.send({uuid: uuid2, method: "candidate", candidate: event.candidate})
// }

// var peer;

// function create_peer_connection(create_offer){
//     //Creates the peer connection and related callbacks and starts the negotiation
//     peer = new RTCPeerConnection(config);

//     peer.onicecandidate = event => {
//         if(event.candidate){
//             socket.send(JSON.stringify({uuid: uuid2, method: "candidate", candidate: event.candidate}));
//         }
//     };

//     peer.ontrack = event => {
//         console.log("Adding remote media tracks");
//         remote_stream = event.streams[0];
//         user2_video.srcObject = remote_stream;
//     };

//     // We know local_stream exists since it triggers the webrtc initialization
//     local_stream.getTracks().forEach(track => peer.addTrack(track, local_stream));
//     console.log("Added local media tracks to peer connection");

//     //If we are the first user we need to generate the offers
//     if(create_offer){
//         peer.onnegotiationneeded = () => {
//             console.log(peer);
//             peer.createOffer().then(desc => {
//                 peer.setLocalDescription(
//                     desc,
//                     () => socket.send(JSON.stringify({uuid: uuid2, method: "offer", sdp: peer.localDescription})),
//                     () => {}
//                 );
//             });
//         };
//     }
// }

function enable_card(n){
    //Enables the nth user 2-4
    var id = "";
    switch(n){
        case 2:
            id="#user2-container";
            break;
        case 3:
            id="#user3-container";
            break;
        case 4:
            id="#user4-container";
            break;
    }
    var element = document.querySelector(id);
    element.className = "column";
}

function disable_card(n){
    //Disables the nth user 2-4
    var id = "";
    switch(n){
        case 2:
            id="#user2-container";
            break;
        case 3:
            id="#user3-container";
            break;
        case 4:
            id="#user4-container";
            break;
    }
    var element = document.querySelector(id);
    element.className = "column is-hidden";
}

var text_in = document.querySelector("#text-input");
var messages = document.querySelector("#messages");
var media0 = document.querySelector("#user-webcam");
var media1 = document.querySelector("#user2-webcam")
var media2 = document.querySelector("#user3-webcam")
var media3 = document.querySelector("#user4-webcam")
var mute0 = document.querySelector("#mute");
var mute1 = document.querySelector("#mute2");
var mute2 = document.querySelector("#mute3");
var mute3 = document.querySelector("#mute4");

mute0.onclick = () =>{
    media0.muted=true;
}
mute1.onclick = () =>{
    media1.muted=true;
}
mute2.onclick = () =>{
    media2.muted=true;
}
mute3.onclick = () =>{
    media3.muted=true;
}

text_in.onkeydown = () => {
    if(event.keyCode==13){
        var val = text_in.value;
        if(val===""){
            //donothing
        }
        else{
            //TODO - Fix these values
            var message = {
                uuid: "Fake ID",
                method: "message",
                room: "Fake uuid",
                content: val
                          };
            socket.send(JSON.stringify(message));
        }
        text_in.value = "";
    }
}

function on_message(message){
    messages.innerHTML += `
<div class="columns">
<div class="column is-1">
<strong>` + message.username +  ` </strong>
</div>
<div class="column is-11">` + message.content +
    `
</div>
</div>
`
}

on_message({username: "Rathma", content: "Hello world!"});

function mutebtn(){
    webcam.muted=true;
}
navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(stream => {
    media0.srcObject = stream;
});

socket = new WebSocket("wss://webrtc.kyso.dev/rtc");

socket.onopen = async function(){
    console.log(room_key);
    socket.send(room_key);
}

socket.onmessage = async function (event){

    var data = JSON.parse(event.data);
    switch(data.method){
    }
}

socket.onclose = async function (){
    //close out the connection
}

socket.onerror = (e) => {
    console.log(e);
}


// //Since the signaling server is kind of dumb right now, we're going to tell it we're ready for webrtc stuff after we select our media.
// navigator.mediaDevices.getUserMedia(stream_types)
//          .then( stream => {
//              //Save the streams to set on the peer later & set local video player.
//              local_stream = stream;
//              user1_video.srcObject = local_stream;

//              //Tell signaling server we're ready.
//              socket.send(JSON.stringify({method: "ready"}));
//           })
//           .catch(function (e) {
//               console.log("We broke something");
//           });


// socket.onmessage = async function (event) {
//     console.log(event.data);
//     var data = JSON.parse(event.data);
//     switch(data.method){
//         case "id":
//             uuid1 = data.uuid;
//             user1_name.innerHTML = uuid1;
//             break;
//         case "init":
//             console.log("Received initialization command");
//             uuid2 = data.uuid;
//             user2_name.innerHTML = uuid2;
//             create_peer_connection(true);
//             break;
//         case "offer":
//             console.log("received offer");
//             uuid2 = data.uuid;
//             user2_name.innerHTML = uuid2;
//             create_peer_connection(false);
//             peer.setRemoteDescription(
//                 new RTCSessionDescription(data.sdp),
//                 () => {
//                   peer.createAnswer()
//                       .then(desc => {
//                           peer.setLocalDescription(
//                               desc,
//                               () => socket.send(JSON.stringify({uuid: uuid2, method: "answer", sdp: peer.localDescription})),
//                               () => {}
//                           );
//                       });
//                 },
//                 () => {}
//             );
//             break;
//         case "answer":
//             console.log("received answer");
//             peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
//             break;
//         case "candidate":
//             peer.addIceCandidate(new RTCIceCandidate(data.candidate), on_success, on_error);
//             break;
//     }
// }
