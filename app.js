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


    // บันทึกเฉพาะเซตและเวลา (ตัด count ออกตามโครงสร้างปัจจุบัน)
    results.push({
        set: currentSet,
        time: sec
    });


    showResults();


    currentSet++;
    document.getElementById("currentSet").textContent = currentSet;
    document.getElementById("timer").textContent = "0 s";
   
    // รีเซ็ตเวลาเริ่มต้นใหม่สำหรับเซตถัดไป
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
   ORIENTATION (Roll, Pitch, Yaw) - REAL-TIME
========================== */
window.addEventListener("deviceorientation", (event) => {
    if (!training) return;


    const roll = event.gamma || 0;
    const pitch = event.beta || 0;
    const yaw = event.alpha || 0;


    const nextRoll = currentRoll + FILTER_ALPHA * (roll - currentRoll);
    const nextPitch = currentPitch + FILTER_ALPHA * (pitch - currentPitch);
    const nextYaw = currentYaw + FILTER_ALPHA * (yaw - currentYaw);


    if (Math.abs(nextRoll - currentRoll) > ORIENTATION_THRESHOLD) currentRoll = nextRoll;
    if (Math.abs(nextPitch - currentPitch) > ORIENTATION_THRESHOLD) currentPitch = nextPitch;
    if (Math.abs(nextYaw - currentYaw) > ORIENTATION_THRESHOLD) currentYaw = nextYaw;


    document.getElementById("roll").textContent = currentRoll.toFixed(1);
    document.getElementById("pitch").textContent = currentPitch.toFixed(1);
    document.getElementById("yaw").textContent = currentYaw.toFixed(1);
});


/* ==========================
   ACCELEROMETER (X, Y, Z) - REAL-TIME
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


    if (Math.abs(nextAx - currentAx) > MOTION_THRESHOLD) currentAx = nextAx;
    if (Math.abs(nextAy - currentAy) > MOTION_THRESHOLD) currentAy = nextAy;
    if (Math.abs(nextAz - currentAz) > MOTION_THRESHOLD) currentAz = nextAz;


    document.getElementById("ax").textContent = currentAx.toFixed(2);
    document.getElementById("ay").textContent = currentAy.toFixed(2);
    document.getElementById("az").textContent = currentAz.toFixed(2);
});
