// 1. นำเข้าโมดูล Firebase สำหรับเชื่อมต่อ Realtime Database
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 2. ตั้งค่า Firebase Config ของระบบคุณ
const firebaseConfig = {
    apiKey: "AIzaSyBdcc-uTdG3bwpwOmW2104T_pmb4zM6OPs",
    authDomain: "stroke-rehab-eec16.firebaseapp.com",
    databaseURL: "https://stroke-rehab-eec16-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "stroke-rehab-eec16",
    storageBucket: "stroke-rehab-eec16.firebasestorage.app",
    messagingSenderId: "606765795152",
    appId: "1:606765795152:web:48a431ab1dfa19a7850e55"
};

// เริ่มต้นทำงาน Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let training = false;
let startTime = 0;
let timerInterval;

// --- สำหรับเก็บผลลัพธ์การฝึก (Training Results) ---
let currentSet = 1;
let results = [];

// --- ระบบตัวกรองสัญญาณ (Low-Pass Filter) เพื่อให้ค่านิ่งและเรียลไทม์ ---
let currentRoll = 0, currentPitch = 0, currentYaw = 0;
let currentAx = 0, currentAy = 0, currentAz = 0;

const FILTER_ALPHA = 0.25;        // ค่าความสมูทแบบตอบสนองไว (Real-time)
const ORIENTATION_THRESHOLD = 0.2; // เกณฑ์ล็อกค่านิ่งของมุม
const MOTION_THRESHOLD = 0.03;      // เกณฑ์ล็อกค่านิ่งของความเร่ง
// -----------------------------------------------------------

/* ==========================
   START
========================== */
document.getElementById("startBtn").onclick = async () => {
    if (training) return;
    training = true;
    startTime = Date.now();

    if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
    ) {
        try {
            await DeviceMotionEvent.requestPermission();
        } catch (e) {}
    }

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById("timer").textContent = sec + " s";
    }, 1000);
};

/* ==========================
   STOP
========================== */
document.getElementById("stopBtn").onclick = () => {
    training = false;
    clearInterval(timerInterval);
};

/* ==========================
   RESET
========================== */
document.getElementById("resetBtn").onclick = () => {
    training = false;
    clearInterval(timerInterval);

    // รีเซ็ตค่าตัวกรองและชุดข้อมูล
    currentRoll = 0; currentPitch = 0; currentYaw = 0;
    currentAx = 0; currentAy = 0; currentAz = 0;
    
    currentSet = 1;
    results = [];

    document.getElementById("timer").textContent = "0 s";
    document.getElementById("currentSet").textContent = "1";
    document.getElementById("resultArea").innerHTML = "";
    
    document.getElementById("roll").textContent = "0.0";
    document.getElementById("pitch").textContent = "0.0";
    document.getElementById("yaw").textContent = "0.0";
    document.getElementById("ax").textContent = "0.00";
    document.getElementById("ay").textContent = "0.00";
    document.getElementById("az").textContent = "0.00";
};

/* ==========================
   SAVE SET
========================== */
document.getElementById("saveSetBtn").onclick = () => {
    const sec = Math.floor((Date.now() - startTime) / 1000);

    results.push({
        set: currentSet,
        time: sec
    });

    showResults();

    currentSet++;
    document.getElementById("currentSet").textContent = currentSet;
    document.getElementById("timer").textContent = "0 s";
    
    if (training) {
        startTime = Date.now();
    }
};

/* ==========================
   DOWNLOAD CSV
========================== */
document.getElementById("downloadBtn").onclick = () => {
    let csv = "Set,Time(s)\n";

    results.forEach(r => {
        csv += `${r.set},${r.time}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);
    a.download = "training_results.csv";
    a.click();
};

/* ==========================
   SHOW RESULTS
========================== */
function showResults() {
    let html = "";
    results.forEach(r => {
        html += `<p>Set ${r.set} : ${r.time} วินาที</p>`;
    });
    document.getElementById("resultArea").innerHTML = html;
}

/* ==========================
   ORIENTATION (Roll, Pitch, Yaw) - REAL-TIME & FIREBASE
========================== */
window.addEventListener("deviceorientation", (event) => {
    if (!training) return;

    const roll = event.gamma || 0;
    const pitch = event.beta || 0;
    const yaw = event.alpha || 0;

    const nextRoll = currentRoll + FILTER_ALPHA * (roll - currentRoll);
    const nextPitch = currentPitch + FILTER_ALPHA * (pitch - currentPitch);
    const nextYaw = currentYaw + FILTER_ALPHA * (yaw - currentYaw);

    let isMoving = false;
    if (Math.abs(nextRoll - currentRoll) > ORIENTATION_THRESHOLD) { currentRoll = nextRoll; isMoving = true; }
    if (Math.abs(nextPitch - currentPitch) > ORIENTATION_THRESHOLD) { currentPitch = nextPitch; isMoving = true; }
    if (Math.abs(nextYaw - currentYaw) > ORIENTATION_THRESHOLD) { currentYaw = nextYaw; isMoving = true; }

    if (isMoving) {
        document.getElementById("roll").textContent = currentRoll.toFixed(1);
        document.getElementById("pitch").textContent = currentPitch.toFixed(1);
        document.getElementById("yaw").textContent = currentYaw.toFixed(1);

        // อัปเดตขึ้น Firebase Realtime Database
        set(ref(db, "sensor"), {
            roll: parseFloat(currentRoll.toFixed(1)),
            pitch: parseFloat(currentPitch.toFixed(1)),
            yaw: parseFloat(currentYaw.toFixed(1)),
            timestamp: Date.now()
        });
    }
});

/* ==========================
   ACCELEROMETER (X, Y, Z) - REAL-TIME & FIREBASE
========================== */
window.addEventListener("devicemotion", (event) => {
    if (!training) return;

    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    const ax = acc.x || 0;
    const ay = acc.y || 0;
    const az = acc.z || 0;

    const nextAx = currentAx + FILTER_ALPHA * (ax - currentAx);
    const nextAy = currentAy + FILTER_ALPHA * (ay - currentAy);
    const nextAz = currentAz + FILTER_ALPHA * (az - currentAz);

    let isMoving = false;
    if (Math.abs(nextAx - currentAx) > MOTION_THRESHOLD) { currentAx = nextAx; isMoving = true; }
    if (Math.abs(nextAy - currentAy) > MOTION_THRESHOLD) { currentAy = nextAy; isMoving = true; }
    if (Math.abs(nextAz - currentAz) > MOTION_THRESHOLD) { currentAz = nextAz; isMoving = true; }

    if (isMoving) {
        document.getElementById("ax").textContent = currentAx.toFixed(2);
        document.getElementById("ay").textContent = currentAy.toFixed(2);
        document.getElementById("az").textContent = currentAz.toFixed(2);

        // อัปเดตขึ้น Firebase Realtime Database
        set(ref(db, "accelerometer"), {
            x: parseFloat(currentAx.toFixed(2)),
            y: parseFloat(currentAy.toFixed(2)),
            z: parseFloat(currentAz.toFixed(2))
        });
    }
});
