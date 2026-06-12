let training = false;
let startTime = 0;
let timerInterval;

// --- สำหรับเก็บผลลัพธ์การฝึก (Training Results) ---
let currentSet = 1;
let results = [];

// --- ระบบตัวกรองสัญญาณแบบ Moving Average + Threshold เพื่อให้นิ่งสนิท ---
const WINDOW_SIZE = 12;            // จำนวนข้อมูลที่จะนำมาเฉลี่ย (ยิ่งเยอะยิ่งนิ่ง แต่จะหน่วงขึ้นเล็กน้อย)
const ORIENTATION_THRESHOLD = 0.4; // เกณฑ์ล็อกค่านิ่งของมุม (องศา)
const MOTION_THRESHOLD = 0.05;     // เกณฑ์ล็อกค่านิ่งของความเร่ง (m/s^2)

// ตัวแปรสำหรับเก็บประจุข้อมูลย้อนหลัง (Queue)
let historyRoll = [], historyPitch = [], historyYaw = [];
let historyAx = [], historyAy = [], historyAz = [];

// ตัวแปรสำหรับล็อกค่าปัจจุบันที่แสดงบนหน้าจอ
let currentRoll = 0, currentPitch = 0, currentYaw = 0;
let currentAx = 0, currentAy = 0, currentAz = 0;

// ฟังก์ชันสำหรับคำนวณค่าเฉลี่ยเคลื่อนที่
function getAverage(array, newValue, size) {
    array.push(newValue);
    if (array.length > size) {
        array.shift(); // เอาค่าเก่าสุดออก
    }
    const sum = array.reduce((a, b) => a + b, 0);
    return sum / array.length;
}

// ฟังก์ชันล้างประวัติการกรอง
function resetFilterHistory() {
    historyRoll = []; historyPitch = []; historyYaw = [];
    historyAx = []; historyAy = []; historyAz = [];
    currentRoll = 0; currentPitch = 0; currentYaw = 0;
    currentAx = 0; currentAy = 0; currentAz = 0;
}
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

    // รีเซ็ตตัวกรองและชุดข้อมูลทั้งหมด
    resetFilterHistory();
   
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
   ORIENTATION (Roll, Pitch, Yaw) - REAL-TIME SMA FILTER
========================== */
window.addEventListener("deviceorientation", (event) => {
    if (!training) return;

    const roll = event.gamma || 0;
    const pitch = event.beta || 0;
    const yaw = event.alpha || 0;

    // 1. กรองด้วย Moving Average
    const avgRoll = getAverage(historyRoll, roll, WINDOW_SIZE);
    const avgPitch = getAverage(historyPitch, pitch, WINDOW_SIZE);
    const avgYaw = getAverage(historyYaw, yaw, WINDOW_SIZE);

    // 2. ครอบด้วย Threshold เพื่อล็อกค่านิ่งสนิทตอนไม่ขยับ
    if (Math.abs(avgRoll - currentRoll) > ORIENTATION_THRESHOLD) currentRoll = avgRoll;
    if (Math.abs(avgPitch - currentPitch) > ORIENTATION_THRESHOLD) currentPitch = avgPitch;
    if (Math.abs(avgYaw - currentYaw) > ORIENTATION_THRESHOLD) currentYaw = avgYaw;

    // 3. แสดงผล
    document.getElementById("roll").textContent = currentRoll.toFixed(1);
    document.getElementById("pitch").textContent = currentPitch.toFixed(1);
    document.getElementById("yaw").textContent = currentYaw.toFixed(1);
});


/* ==========================
   ACCELEROMETER (X, Y, Z) - REAL-TIME SMA FILTER
========================== */
window.addEventListener("devicemotion", (event) => {
    if (!training) return;

    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    const ax = acc.x || 0;
    const ay = acc.y || 0;
    const az = acc.z || 0;

    // 1. กรองด้วย Moving Average
    const avgAx = getAverage(historyAx, ax, WINDOW_SIZE);
    const avgAy = getAverage(historyAy, ay, WINDOW_SIZE);
    const avgAz = getAverage(historyAz, az, WINDOW_SIZE);

    // 2. ครอบด้วย Threshold เพื่อล็อกค่านิ่งสนิทตอนไม่ขยับ
    if (Math.abs(avgAx - currentAx) > MOTION_THRESHOLD) currentAx = avgAx;
    if (Math.abs(avgAy - currentAy) > MOTION_THRESHOLD) currentAy = avgAy;
    if (Math.abs(avgAz - currentAz) > MOTION_THRESHOLD) currentAz = avgAz;

    // 3. แสดงผล
    document.getElementById("ax").textContent = currentAx.toFixed(2);
    document.getElementById("ay").textContent = currentAy.toFixed(2);
    document.getElementById("az").textContent = currentAz.toFixed(2);
});
