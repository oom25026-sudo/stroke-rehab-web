import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ==========================
   FIREBASE
========================== */

const firebaseConfig = {
    apiKey: "AIzaSyBdcc-uTdG3bwpwOmW2104T_pmb4zM6OPs",
    authDomain: "stroke-rehab-eec16.firebaseapp.com",
    databaseURL: "https://stroke-rehab-eec16-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "stroke-rehab-eec16",
    storageBucket: "stroke-rehab-eec16.firebasestorage.app",
    messagingSenderId: "606765795152",
    appId: "1:606765795152:web:48a431ab1dfa19a7850e55"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ==========================
   TRAINING
========================== */

let currentSet = 1;
let count = 0;

let training = false;

let startTime = 0;

let timerInterval = null;

let results = [];

let armUp = false;

// --- ส่วนที่เพิ่มเข้ามาเพื่อให้ค่านิ่ง (Low-Pass Filter) โดยไม่กระทบโค้ดเก่า ---
let currentRoll = 0, currentPitch = 0, currentYaw = 0;
let currentAx = 0, currentAy = 0, currentAz = 0;

const FILTER_ALPHA = 0.12;        // ค่าความนิ่ง (ยิ่งน้อยยิ่งนิ่ง แนะนำในช่วง 0.05 - 0.15)
const ORIENTATION_THRESHOLD = 0.5; // ถ้านิ่งต่ำกว่า 0.5 องศา จะล็อกค่าไว้ไม่ให้ตัวเลขวิ่งแกว่ง
const MOTION_THRESHOLD = 0.06;      // ถ้านิ่งต่ำกว่าค่านี้ จะล็อกค่า Accelerometer ไว้
// -----------------------------------------------------------------------

/* ==========================
   START
========================== */

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

    clearInterval(timerInterval);

    timerInterval =
    setInterval(()=>{

        const sec =
            Math.floor(
                (Date.now()-startTime)/1000
            );

        document.getElementById("timer")
            .textContent =
            sec + " s";

    },1000);
};

/* ==========================
   STOP
========================== */

document.getElementById("stopBtn").onclick =
() => {

    training = false;

    clearInterval(timerInterval);
};

/* ==========================
   RESET
========================== */

document.getElementById("resetBtn").onclick =
() => {

    training = false;

    clearInterval(timerInterval);

    count = 0;

    armUp = false;

    // รีเซ็ตค่าตัวแปรกรองสัญญาณด้วยเมื่อกด Reset
    currentRoll = 0; currentPitch = 0; currentYaw = 0;
    currentAx = 0; currentAy = 0; currentAz = 0;

    document.getElementById("count")
        .textContent = "0";

    document.getElementById("timer")
        .textContent = "0 s";

    document.getElementById("progressBar")
        .style.width = "0%";
};

/* ==========================
   SAVE SET
========================== */

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
        .textContent = "0";

    document.getElementById("timer")
        .textContent = "0 s";

    document.getElementById("progressBar")
        .style.width = "0%";
};

/* ==========================
   CSV
========================== */

document.getElementById("downloadBtn").onclick =
() => {

    let csv =
        "Set,Count,Time\n";

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

/* ==========================
   RESULT
========================== */

function showResults(){

    let html = "";

    results.forEach(r=>{

        html +=
        `<p>
        Set ${r.set}
        :
        ${r.count} ครั้ง
        |
        ${r.time} วินาที
        </p>`;
    });

    document.getElementById("resultArea")
        .innerHTML =
        html;
}

/* ==========================
   SEND SENSOR TO FIREBASE
========================== */

window.addEventListener(
"deviceorientation",
(event)=>{

    if(!training) return;

    const roll =
        event.gamma || 0;

    const pitch =
        event.beta || 0;

    const yaw =
        event.alpha || 0;

    // --- ประยุกต์ใช้ตัวกรองสยบอาการแกว่งก่อนส่งข้อมูล ---
    const nextRoll = currentRoll + FILTER_ALPHA * (roll - currentRoll);
    const nextPitch = currentPitch + FILTER_ALPHA * (pitch - currentPitch);
    const nextYaw = currentYaw + FILTER_ALPHA * (yaw - currentYaw);

    let isMoving = false;

    if (Math.abs(nextRoll - currentRoll) > ORIENTATION_THRESHOLD) { currentRoll = nextRoll; isMoving = true; }
    if (Math.abs(nextPitch - currentPitch) > ORIENTATION_THRESHOLD) { currentPitch = nextPitch; isMoving = true; }
    if (Math.abs(nextYaw - currentYaw) > ORIENTATION_THRESHOLD) { currentYaw = nextYaw; isMoving = true; }

    // ส่งค่าไปยัง Firebase ต่อเมื่อเซนเซอร์ขยับเกิน Threshold เพื่อป้องกันตัวเลขสั่นตอนวางนิ่งๆ
    if (isMoving) {
        set(
            ref(db,"sensor"),
            {
                roll: currentRoll,
                pitch: currentPitch,
                yaw: currentYaw,
                timestamp:Date.now()
            }
        );
    }
});

/* ==========================
   SEND ACCEL
========================== */

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

    // --- ประยุกต์ใช้ตัวกรองความเร่งให้นิ่งสนิท ---
    const nextAx = currentAx + FILTER_ALPHA * (ax - currentAx);
    const nextAy = currentAy + FILTER_ALPHA * (ay - currentAy);
    const nextAz = currentAz + FILTER_ALPHA * (az - currentAz);

    let isMoving = false;

    if (Math.abs(nextAx - currentAx) > MOTION_THRESHOLD) { currentAx = nextAx; isMoving = true; }
    if (Math.abs(nextAy - currentAy) > MOTION_THRESHOLD) { currentAy = nextAy; isMoving = true; }
    if (Math.abs(nextAz - currentAz) > MOTION_THRESHOLD) { currentAz = nextAz; isMoving = true; }

    if (isMoving) {
        set(
            ref(db,"accelerometer"),
            {
                x: currentAx,
                y: currentAy,
                z: currentAz
            }
        );
    }

    // ใช้ค่าที่นิ่งแล้ว (currentAy) ในการจับสัญญาณขึ้น-ลงเพื่อความแม่นยำสูงสุด
    if(currentAy > 7 && !armUp){

        armUp = true;
    }

    if(currentAy < 3 && armUp){

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

/* ==========================
   RECEIVE FROM FIREBASE
========================== */

onValue(
    ref(db,"sensor"),
    (snapshot)=>{

        const data =
            snapshot.val();

        if(!data) return;

        document.getElementById("roll")
            .textContent =
            Number(data.roll)
            .toFixed(1);

        document.getElementById("pitch")
            .textContent =
            Number(data.pitch)
            .toFixed(1);

        document.getElementById("yaw")
            .textContent =
            Number(data.yaw)
            .toFixed(1);

    }
);

onValue(
    ref(db,"accelerometer"),
    (snapshot)=>{

        const data =
            snapshot.val();

        if(!data) return;

        document.getElementById("ax")
            .textContent =
            Number(data.x)
            .toFixed(2);

        document.getElementById("ay")
            .textContent =
            Number(data.y)
            .toFixed(2);

        document.getElementById("az")
            .textContent =
            Number(data.z)
            .toFixed(2);

    }
);
