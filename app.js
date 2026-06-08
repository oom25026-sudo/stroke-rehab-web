let currentSet = 1;
let count = 0;

let training = false;

let startTime = 0;

let timerInterval;

let results = [];

let armUp = false;

document.getElementById("startBtn").onclick =
async () => {

    if(training) return;

    training = true;

    startTime = Date.now();

    if(
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
    ){
        try{
            await DeviceMotionEvent.requestPermission();
        }catch(e){}
    }

    timerInterval = setInterval(()=>{

        const sec =
            Math.floor(
                (Date.now()-startTime)/1000
            );

        document.getElementById("timer")
            .textContent =
            sec + " s";

    },1000);
};

document.getElementById("stopBtn").onclick =
() => {

    training = false;

    clearInterval(timerInterval);
};

document.getElementById("resetBtn").onclick =
() => {

    training = false;

    clearInterval(timerInterval);

    count = 0;

    armUp = false;

    document.getElementById("count")
        .textContent = 0;

    document.getElementById("timer")
        .textContent = "0 s";

    document.getElementById("progressBar")
        .style.width = "0%";
};

document.getElementById("saveSetBtn").onclick =
() => {

    const sec =
        Math.floor(
            (Date.now()-startTime)/1000
        );

    results.push({
        set:currentSet,
        count:count,
        time:sec
    });

    showResults();

    currentSet++;

    document.getElementById("currentSet")
        .textContent =
        currentSet;

    count = 0;

    document.getElementById("count")
        .textContent = 0;

    document.getElementById("timer")
        .textContent = "0 s";

    document.getElementById("progressBar")
        .style.width = "0%";
};

document.getElementById("downloadBtn").onclick =
() => {

    let csv = "Set,Count,Time\n";

    results.forEach(r=>{

        csv +=
        `${r.set},${r.count},${r.time}\n`;

    });

    const blob =
        new Blob(
            [csv],
            {type:"text/csv"}
        );

    const a =
        document.createElement("a");

    a.href =
        URL.createObjectURL(blob);

    a.download =
        "training_results.csv";

    a.click();
};

function showResults(){

    let html = "";

    results.forEach(r=>{

        html +=
        `<p>
        Set ${r.set}
        : ${r.count} ครั้ง
        | ${r.time} วินาที
        </p>`;
    });

    document.getElementById("resultArea")
        .innerHTML = html;
}

window.addEventListener(
"deviceorientation",
(event)=>{

    if(!training) return;

    document.getElementById("roll")
        .textContent =
        (event.gamma || 0).toFixed(1);

    document.getElementById("pitch")
        .textContent =
        (event.beta || 0).toFixed(1);

    document.getElementById("yaw")
        .textContent =
        (event.alpha || 0).toFixed(1);
});

window.addEventListener(
"devicemotion",
(event)=>{

    if(!training) return;

    const acc =
        event.accelerationIncludingGravity;

    if(!acc) return;

    const ax = acc.x || 0;
    const ay = acc.y || 0;
    const az = acc.z || 0;

    document.getElementById("ax")
        .textContent =
        ax.toFixed(2);

    document.getElementById("ay")
        .textContent =
        ay.toFixed(2);

    document.getElementById("az")
        .textContent =
        az.toFixed(2);

    if(ay > 7 && !armUp){

        armUp = true;
    }

    if(ay < 3 && armUp){

        armUp = false;

        count++;

        document.getElementById("count")
            .textContent =
            count;

        const percent =
            Math.min(
                count * 5,
                100
            );

        document.getElementById("progressBar")
            .style.width =
            percent + "%";
    }
});
