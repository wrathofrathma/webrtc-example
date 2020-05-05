var rand_btn = document.querySelector("#random_btn");
var create_btn = document.querySelector("#create_btn");
var create_text = document.querySelector("#create_text");
var connected_text = document.querySelector("#connected");
var form = document.querySelector("#submit");
var room_container = document.querySelector("#rooms");
//For some reason I had to set this because it wasn't clearing on refresh?
create_text.value=null;

function join_random(){
    window.location.assign("https://webrtc.kyso.dev/rand")
}


//If there is no text, then we defer the submission to attempt_join
function validate_room(){
    if(create_text.value===""){
        return false;
    }
}

function attempt_join(){
    var xhttp = new XMLHttpRequest();
    xhttp.onload = () => {
        var resp = JSON.parse(xhttp.response);

        if(resp.uuid){
            console.log("Room found");
            if(resp.avail>0){
                //redirect to room
                window.location.assign(resp.url);
            }
            else{
                alert("Room is full");
            }
        }
        else{
            form.submit();
        }
    };

    var r = create_text.value;
    if(r === ""){
        join_random();
    }
    else{
        xhttp.open("GET", "/getroom/" + create_text.value, true);
        xhttp.send();
    }
}

rand_btn.onclick = () => {
    join_random();
};
create_btn.onclick = () => {
    attempt_join();

};
create_text.onkeydown = () => {
    if(event.keyCode==13){
        attempt_join();
     }
};

// Updates the # connected users
function update_connected(val){
    connected.innerHTML = "Active Rooms - Connected " + val;
}

function join_room(id){
    console.log(id.attributes.room_id);
    window.location.assign("https://webrtc.kyso.dev/room/" + id.attributes.room_id.nodeValue);
}

//Formats server room objects for the list
function format_room(val){
    var btn_color = "is-success";
    var btn_text = "Join";
    var fn = "onclick=join_room(this)";
    if(val.avail==0){
        btn_color = "is-danger";
        btn_text = "Full";
        fn = "";
    }
    console.log(val.uuid);
    var html = `
<div class="columns">
    <div class="column is-narrow">
        <a class="button ` + btn_color +`" room_id="` + val.uuid + `" ` + fn + `>` + btn_text + ` `
        + val.user_count + "/" + val.capacity +
    `
    </a>
    </div>
    <div class="column is-four-fifths">`
        + val.name + `
    </div>
</div>
`;
    return html;

}
//Updates the room list
function update_rooms(vals){
    var rooms = [];
    var thtml = "";
    Object.keys(vals).forEach(k => {
        console.log(vals[k]);
        thtml += format_room(vals[k]);
        rooms.push(format_room(vals[k]));
    });
    console.log(rooms);

    room_container.innerHTML = thtml;
}

socket = new WebSocket("wss://webrtc.kyso.dev/index");

socket.onmessage = async function (event) {
    var data = JSON.parse(event.data);
    switch(data.method){
        case "room_update":
            console.log("Room update");
            update_rooms(data.rooms);
            break;
        case "connected_update":
            update_connected(data.connected);
            break;
    }
}
