function get_room_key(){
    var url = window.location.href;
    var base = "https://webrtc.kyso.dev/room/";
    var n = base.length;
    var key = url.substr(n, url.length);
    return key;
}
const room_key = get_room_key();

// // What kind of stream tracks to send
var stream_types= {
    video: true,
    audio: true
};

// // WebRTC Peer configuration
const ice_config = {
    sdpSemantics: 'unified-plan',
    iceServers: [
        {
            urls: ['stun:stun.l.google.com:19302']
        },
        {
            urls: ['turn:3.23.105.166:3478'],
            credential: 'hpv',
            username: 'rathma'
    }
    ],
    // iceTransportPolicy: 'relay'
};

async function on_success(){

}

async function on_error(error){
    console.error(error);
}


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
media0.muted = true;
var media1 = document.querySelector("#user2-webcam")
var media2 = document.querySelector("#user3-webcam")
var media3 = document.querySelector("#user4-webcam")
var mute0 = document.querySelector("#mute");
var mute1 = document.querySelector("#mute2");
var mute2 = document.querySelector("#mute3");
var mute3 = document.querySelector("#mute4");
var stream0 = null;
var stream1 = null;
var stream2 = null;
var stream3 = null;

mute0.onclick = () =>{
    if(stream0.getAudioTracks()[0].enabled){
        stream0.getAudioTracks()[0].enabled = false;
        mute0.className = "button is-danger";
    }
    else{
        stream0.getAudioTracks()[0].enabled = true;
        mute0.className = "button is-primary";
    }
}
mute1.onclick = () =>{
    if(media1.muted){
        media1.muted=false;
        mute1.className = "button is-primary";

    }
    else{
        media1.muted=true;
        mute1.className = "button is-danger";
    }
}
mute2.onclick = () =>{
    if(media2.muted){
        media2.muted=false;
        mute2.className = "button is-primary";

    }
    else{
        media2.muted=true;
        mute2.className = "button is-danger";
    }
}
mute3.onclick = () =>{
    if(media3.muted){
        media3.muted=false;
        mute3.className = "button is-primary";

    }
    else{
        media3.muted=true;
        mute3.className = "button is-danger";
    }
}

text_in.onkeydown = () => {
    if(event.keyCode==13){
        var val = text_in.value;
        if(val===""){
            //donothing
        }
        else{
            var message = {
                method: "message",
                room: room_key,
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
<div class="column is-narrow">
<strong>` + message.username +  ` </strong>
</div>
<div class="column is-expanded">` + message.content +
    `
</div>
</div>
`
    messages.scrollTop = messages.scrollHeight;
}

function mutebtn(){
    webcam.muted=true;
}

socket = new WebSocket("wss://webrtc.kyso.dev/rtc");

socket.onopen = async function(){
    console.log(room_key);
    socket.send(room_key);
    navigator.mediaDevices.getUserMedia({video: true, audio: true})
            .then(stream => {
                stream0 = stream;
                users.user0.stream = stream;
                media0.srcObject = stream0;
                //Notify the server we're ready to accept any and all peers
                socket.send(JSON.stringify({method: "ready"}));
                ready = true;
            }).catch(function(e){
                console.log(e);
            });
}

var users = {
    connected: 0,
    user0: {
        uuid: null,
        stream: null,
        muted: false,
        media_obj: media0
    },
};

//Set our primary user's uuid
function on_identify(id){
    users.user0.uuid=id;
    document.querySelector("#username").innerHTML = id;
}


// Set up a new PeerConnection object & offer
function on_negotiation_request(id){
    users.connected+=1;
    var user = {
        uuid: id,
        muted: false,
        stream: null,
        media_obj: null,
        connection: null
    };
    switch(users.connected){
        case 1:
            users.user1 = user;
            user.media_obj = media1;
            enable_card(2);
            break;
        case 2:
            users.user2 = user;
            user.media_obj = media2;
            enable_card(3);
            break;
        case 3:
            users.user3 = user;
            user.media_obj = media3;
            enable_card(4);
            break;
    }
    peer = new RTCPeerConnection(ice_config);
    user.connection = peer;

    //When we receive an ice candidate, we want to send it to the requesting user
    peer.onicecandidate = event => {
        if(event.candidate){
            check_gathered(peer);
            socket.send(JSON.stringify({src_uuid: users.user0.uuid, dest_uuid: id, method: "candidate", candidate: event.candidate}));
        }
    };

    peer.ontrack = event => {
        console.log("Adding remote media tracks");
        user.stream = event.streams[0];
        user.media_obj.srcObject = user.stream;
    };

    users.user0.stream.getTracks().forEach(track => peer.addTrack(track, users.user0.stream));

    peer.onnegotiationneeded = () => {
        console.log("Beginning negotiation");
        peer.createOffer().then(desc => {
            peer.setLocalDescription(
                desc,
                () => socket.send(JSON.stringify({src_uuid: users.user0.uuid, dest_uuid: id, method: "offer", sdp: peer.localDescription})),
                () => {}
            );
        });
    };
}

function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function check_gathered(peer){
    while(true){
        console.log("gathering");
        if(peer.iceGatheringState === 'complete'){
            break;
        }
        else{
            await sleep(500);
        }
    }
}

function on_offer(data){
    console.log("Received offer");
    console.log(data.sdp);
    var id = data.uuid;
    users.connected+=1;
    var user = {
        uuid: id,
        muted: false,
        stream: null,
        media_obj: null,
        connection: null
    };

    switch(users.connected){
        case 1:
            users.user1 = user;
            user.media_obj = media1;
            enable_card(2);
            break;
        case 2:
            users.user2 = user;
            user.media_obj = media2;
            enable_card(3);
            break;
        case 3:
            users.user3 = user;
            user.media_obj = media3;
            enable_card(4);
            break;
    }
    peer = new RTCPeerConnection(ice_config);
    user.connection = peer;

    peer.onicecandidate = event => {
        if(event.candidate){
            check_gathered(peer);
            socket.send(JSON.stringify({src_uuid: users.user0.uuid, dest_uuid: data.uuid, method: "candidate", candidate: event.candidate}));
        }
    };

    peer.ontrack = event => {
        console.log("Adding remote media tracks");
        user.stream = event.streams[0];
        user.media_obj.srcObject = user.stream;
    };

    users.user0.stream.getTracks().forEach(track => peer.addTrack(track, users.user0.stream));

    peer.setRemoteDescription(
        new RTCSessionDescription(data.sdp),
        () => {
            peer.createAnswer()
                .then(desc => {
                    peer.setLocalDescription(
                        desc,
                        () => socket.send(JSON.stringify({
                            src_uuid: users.user0.uuid,
                            dest_uuid: id,
                            method: "answer",
                            sdp: peer.localDescription})),
                        () => {}
                    );
                });
        },
        () => {}
    );
}
function fix_cameras(){
    if(users.user1){
        users.user1.media_obj = media1;
        media1.srcObject = users.user1.stream;
    }
    else{
        disable_card(2);
    }
    if(users.user2){
        users.user2.media_obj = media2;
        media2.srcObject = users.user2.stream;
    }
    else{
        disable_card(3);
    }
    if(users.user3){
        users.user3.media_obj = media3;
        media3.srcObject = users.user3.stream;
    }
    else{
        disable_card(4);
    }
}
//Remove the peer connection object and hide their webcam
function on_peer_disconnect(data){
    console.log("Peer disconnected");
    console.log(data);
    users.connected-=1;
    for(var user in users){
        if(users[user].uuid==data.uuid){
            console.log("Found user");
            users[user].connection.close();
            delete users[user];
            //We need to shift the cameras around
            switch(user){
                case "user1":
                    if(users.user3){
                        users.user1 = users.user3;
                        delete users.user3;
                    }
                    else if(users.user2){
                        users.user1 = users.user2;
                        delete users.user2;
                    }
                    break;
                case "user2":
                    if(users.user3){
                        users.user2 = users.user3;
                        delete users.user3;
                    }
                    break;
            }
            fix_cameras();


            break;
        }
    }
}

var ready = false;

function on_candidate(data){
   for(var u in users){
       if(users[u].uuid==data.uuid){
           console.log("Adding candidate ");
           console.log(data.candidate);
           users[u].connection.addIceCandidate(new RTCIceCandidate(data.candidate), on_success, on_error);
       }
   }
}

function on_answer(data){
    console.log("On answer");
   for(var u in users){
       if(users[u].uuid==data.uuid){
           console.log("Adding answer sdp to from ", users[u].uuid);
           console.log(data.sdp);
           users[u].connection.setRemoteDescription(new RTCSessionDescription(data.sdp));
       }
   }
}


socket.onmessage = async function (event){
    var data = JSON.parse(event.data);
    console.log(data);
    switch(data.method){
        case "message":
            on_message(data);
            break;
        case "id":
            //Received an ID from the server
            on_identify(data.uuid);
            break;
        case "negotiation_request":
            await on_negotiation_request(data.uuid);
            break;
        case "offer":
            on_offer(data);
            break;
        case "answer":
            on_answer(data);
            break;
        case "candidate":
            on_candidate(data);
            break;

        case "peer_disconnect":
            on_peer_disconnect(data);
            break;
    }
}

socket.onclose = async function (){
    //close out the connection
}

socket.onerror = (e) => {
    console.log(e);
}
