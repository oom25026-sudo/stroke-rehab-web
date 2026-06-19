// ⚠️ โครงสร้างคอนฟิกพื้นฐานของ Firebase (เดี๋ยวเอาค่าจริงมาใส่ในสเต็ปถัดไป)
const firebaseConfig = {
    databaseURL: "https://llllllll-3c932-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};

// เริ่มต้นเปิดระบบฐานข้อมูล
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let training = false;
let startTime = 0;
let timerInterval;
let currentSet = 1;
let results = [];

// ตรวจสอบชนิดอุปกรณ์ (มือถือส่ง / คอมรับ)
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// --- ระบบตัวกรองสัญญาณ (Low-Pass Filter) เพื่อให้ค่านิ่งสนิท ---
let currentRoll = 0, currentPitch = 0, currentYaw = 0;
let currentAx = 0, currentAy = 0, currentAz = 0;

const FILTER_ALPHA = 0.25;        
const ORIENTATION_THRESHOLD = 0.2; 
const MOTION_THRESHOLD = 0.03;      

/* ===========================================================
   📱 1. [ฝั่งโทรศัพท์มือถือ] ดักจับค่าเซนเซอร์แล้วเขียน (Set) ลง Firebase
=========================================================== */
function startMobileStreaming() {
    window.addEventListener("deviceorientation", (event) => {
        if (!training) return;
        
        // อัปเดตข้อมูลเอียงตัวเครื่องขึ้นฐานข้อมูล Firebase วิ่งเรียลไทม์
        database.ref("sensor/orientation").set({
            roll: (event.gamma || 0) + 1, // ชดเชยค่า Roll + 1 ตามสั่ง
            pitch: (event.beta || 0) + 0,
            yaw: (event.alpha || 0) + 0
        });
    });

    window.addEventListener("devicemotion", (event) => {
        if (!training) return;
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;

        // อัปเดตข้อมูลความเร่งขึ้นฐานข้อมูล Firebase
        database.ref("sensor/motion").set({
            ax: acc.x || 0,
            ay: acc.y || 0,
            az: acc.z || 0
        });
    });
}

/* ===========================================================
   💻 2. [ฝั่งหน้าจอคอมพิวเตอร์] คอยดักฟัง (On) ค่าจาก Firebase ตลอดเวลา
=========================================================== */
if (!isMobile) {
    console.log("💻 ระบบ: โหมดแดชบอร์ดคอมพิวเตอร์ (กำลังดักจับค่าจาก Firebase...)");

    // เมื่อมีค่าอัปเดตจากฝั่ง Orientation
    database.ref("sensor/orientation").on("value", (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const nextRoll = currentRoll + FILTER_ALPHA * (data.roll - currentRoll);
        const nextPitch = currentPitch + FILTER_ALPHA * (data.pitch - currentPitch);
        const nextYaw = currentYaw + FILTER_ALPHA * (data.yaw - currentYaw);

        if (Math.abs(nextRoll - currentRoll) > ORIENTATION_THRESHOLD) currentRoll = nextRoll;
        if (Math.abs(nextPitch - currentPitch) > ORIENTATION_THRESHOLD) currentPitch = nextPitch;
        if (Math.abs(nextYaw - currentYaw) > ORIENTATION_THRESHOLD) currentYaw = nextYaw;

        document.getElementById("roll").textContent = currentRoll.toFixed(1);
        document.getElementById("pitch").textContent = currentPitch.toFixed(1);
        document.getElementById("yaw").textContent = currentYaw.toFixed(1);
    });

    // When มีค่าอัปเดตจากฝั่ง Motion
    database.ref("sensor/motion").on("value", (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const nextAx = currentAx + FILTER_ALPHA * (data.ax - currentAx);
        const nextAy = currentAy + FILTER_ALPHA * (data.ay - currentAy);
        const nextAz = currentAz + FILTER_ALPHA * (data.az - currentAz);

        if (Math.abs(nextAx - currentAx) > MOTION_THRESHOLD) currentAx = nextAx;
        if (Math.abs(nextAy - currentAy) > MOTION_THRESHOLD) currentAy = nextAy;
        if (Math.abs(nextAz - currentAz) > MOTION_THRESHOLD) currentAz = nextAz;

        document.getElementById("ax").textContent = currentAx.toFixed(2);
        document.getElementById("ay").textContent = currentAy.toFixed(2);
        document.getElementById("az").textContent = currentAz.toFixed(2);
    });
}

/* ===========================================================
   🔘 3. ระบบควบคุมปุ่มกดควบคุม
=========================================================== */
document.getElementById("startBtn").onclick = async () => {
    if (training) return;
    training = true;
    startTime = Date.now();

    if (isMobile) {
        if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === "granted") startMobileStreaming();
            } catch (e) { console.error(e); }
        } else {
            startMobileStreaming();
        }
    }

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById("timer").textContent = sec + " s";
    }, 1000);
};

document.getElementById("stopBtn").onclick = () => {
    training = false;
    clearInterval(timerInterval);
};

document.getElementById("resetBtn").onclick = () => {
    training = false;
    clearInterval(timerInterval);
    currentSet = 1;
    results = [];
    document.getElementById("timer").textContent = "0 s";
    document.getElementById("currentSet").textContent = "1";
    document.getElementById("resultArea").innerHTML = "";
    if(!isMobile) {
        document.getElementById("roll").textContent = "0.0";
        document.getElementById("pitch").textContent = "0.0";
        document.getElementById("yaw").textContent = "0.0";
        document.getElementById("ax").textContent = "0.00";
        document.getElementById("ay").textContent = "0.00";
        document.getElementById("az").textContent = "0.00";
    }
};

document.getElementById("saveSetBtn").onclick = () => {
    const sec = startTime === 0 ? 0 : Math.floor((Date.now() - startTime) / 1000);
    results.push({ set: currentSet, time: sec });
    let html = "";
    results.forEach((r) => { html += `<p>Set ${r.set} : ${r.time} s</p>`; });
    document.getElementById("resultArea").innerHTML = html;
    currentSet++;
    document.getElementById("currentSet").textContent = currentSet;
    document.getElementById("timer").textContent = "0 s";
    if (training) startTime = Date.now();
};

document.getElementById("downloadBtn").onclick = () => {
    if (results.length === 0) return alert("ไม่มีข้อมูลให้ดาวน์โหลด");
    let csv = "Set,Time(s)\n";
    results.forEach((r) => { csv += `${r.set},${r.time}\n`; });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "project_data.csv";
    a.click();
};