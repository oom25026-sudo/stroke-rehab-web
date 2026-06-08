let training = false;
let startTime = 0;
let timerInterval;

// --- ระบบตัวกรองสัญญาณ (Low-Pass Filter) เพื่อให้ค่านิ่งและเรียลไทม์ ---
let currentRoll = 0, currentPitch = 0, currentYaw = 0;
let currentAx = 0, currentAy = 0, currentAz = 0;

// ค่า ALPHA ยิ่งมากจะยิ่งตอบสนองไว (Real-time ขึ้น) แต่ถ้าขยับมากไปเลขจะแกว่ง
// ค่า 0.2 ถึง 0.3 เป็นค่าที่สมดุลมากสำหรับความเร็วแบบเรียลไทม์และค่านิ่งสนิท
const FILTER_ALPHA = 0.25;        
const ORIENTATION_THRESHOLD = 0.2; // ปรับเกณฑ์ให้ต่ำลงเพื่อให้ตอบสนองต่อการขยับเล็กๆ ได้ทันที
const MOTION_THRESHOLD = 0.03;      
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

    // รีเซ็ตค่าตัวกรองกลับเป็นศูนย์
    currentRoll = 0; currentPitch = 0; currentYaw = 0;
    currentAx = 0; currentAy = 0; currentAz = 0;

    document.getElementById("timer").textContent = "0 s";
    document.getElementById("roll").textContent = "0.0";
    document.getElementById("pitch").textContent = "0.0";
    document.getElementById("yaw").textContent = "0.0";
    document.getElementById("ax").textContent = "0.00";
    document.getElementById("ay").textContent = "0.00";
    document.getElementById("az").textContent = "0.00";
};

/* ==========================
   ORIENTATION (Roll, Pitch, Yaw) - REAL-TIME
========================== */
window.addEventListener("deviceorientation", (event) => {
    if (!training) return;

    const roll = event.gamma || 0;
    const pitch = event.beta || 0;
    const yaw = event.alpha || 0;

    // คำนวณค่าผ่าน Low-Pass Filter แบบตอบสนองความเร็วสูง
    const nextRoll = currentRoll + FILTER_ALPHA * (roll - currentRoll);
    const nextPitch = currentPitch + FILTER_ALPHA * (pitch - currentPitch);
    const nextYaw = currentYaw + FILTER_ALPHA * (yaw - currentYaw);

    // ตรวจสอบทับ Threshold (ถ้าขยับพ้นเกณฑ์นิดเดียวจะอัปเดตทันที)
    if (Math.abs(nextRoll - currentRoll) > ORIENTATION_THRESHOLD) currentRoll = nextRoll;
    if (Math.abs(nextPitch - currentPitch) > ORIENTATION_THRESHOLD) currentPitch = nextPitch;
    if (Math.abs(nextYaw - currentYaw) > ORIENTATION_THRESHOLD) currentYaw = nextYaw;

    // อัปเดตลงหน้าจอแสดงผลโดยตรงทันทีแบบ Real-time
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

    // คำนวณค่าความเร่งผ่าน Low-Pass Filter
    const nextAx = currentAx + FILTER_ALPHA * (ax - currentAx);
    const nextAy = currentAy + FILTER_ALPHA * (ay - currentAy);
    const nextAz = currentAz + FILTER_ALPHA * (az - currentAz);

    if (Math.abs(nextAx - currentAx) > MOTION_THRESHOLD) currentAx = nextAx;
    if (Math.abs(nextAy - currentAy) > MOTION_THRESHOLD) currentAy = nextAy;
    if (Math.abs(nextAz - currentAz) > MOTION_THRESHOLD) currentAz = nextAz;

    // อัปเดตลงหน้าจอแสดงผลโดยตรงทันทีแบบ Real-time
    document.getElementById("ax").textContent = currentAx.toFixed(2);
    document.getElementById("ay").textContent = currentAy.toFixed(2);
    document.getElementById("az").textContent = currentAz.toFixed(2);
});
