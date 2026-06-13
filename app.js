// เปลี่ยน URL ตรงนี้ให้เป็นลิงก์เซิร์ฟเวอร์ของคุณที่ได้จากขั้นตอนที่ 1 (เช่น ของ Glitch หรือ Replit)
const SERVER_URL = "https://your-project.glitch.me"; 
const socket = io(SERVER_URL);

let training = false;
let startTime = 0;
let timerInterval;

// --- สำหรับเก็บผลลัพธ์การฝึก (Training Results) ---
let currentSet = 1;
let results = [];

// ตรวจสอบประเภทอุปกรณ์ (ว่าเป็นโทรศัพท์มือถือ/แท็บเล็ต หรือคอมพิวเตอร์)
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// --- ระบบตัวกรองสัญญาณ (SMA Filter) สำหรับฝั่งรับข้อมูล (คอมพิวเตอร์) ---
const WINDOW_SIZE = 12;            // จำนวนข้อมูลที่จะนำมาเฉลี่ย (ยิ่งเยอะยิ่งนิ่ง แต่จะหน่วงขึ้นเล็กน้อย)
const ORIENTATION_THRESHOLD = 0.4; // เกณฑ์ล็อกค่านิ่งของมุม (องศา)
const MOTION_THRESHOLD = 0.05;     // เกณฑ์ล็อกค่านิ่งของความเร่ง (m/s²)

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


/* ===========================================================
   1. ฝั่งโทรศัพท์มือถือ: อ่านค่าเซนเซอร์ ดึงค่าดิบ + ชดเชยค่า แล้วส่งขึ้นเซิร์ฟเวอร์
=========================================================== */
if (isMobile) {
    console.log("อุปกรณ์นี้ทำหน้าที่: [ส่งข้อมูลเซนเซอร์]");

    window.addEventListener("deviceorientation", (event) => {
        if (!training) return;
        
        // ดึงค่าเซนเซอร์ดิบ และทำการบวก Offset ตามกำหนด (Roll + 1, Pitch + 0, Yaw + 0)
        socket.emit("phone-orientation", {
            roll: (event.gamma || 0) + 1,
            pitch: (event.beta || 0) + 0,
            yaw: (event.alpha || 0) + 0
        });
    });

    window.addEventListener("devicemotion", (event) => {
        if (!training) return;
        
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;
        
        socket.emit("phone-motion", {
            ax: acc.x || 0,
            ay: acc.y || 0,
            az: acc.z || 0
        });
    });
}


/* ===========================================================
   2. ฝั่งคอมพิวเตอร์: รอรับข้อมูลเรียลไทม์ นำมากรองสัญญาณ (SMA) แล้วอัปเดตหน้าจอ
=========================================================== */
if (!isMobile) {
    console.log("อุปกรณ์นี้ทำหน้าที่: [รับข้อมูลมาแสดงผลบนแดชบอร์ด]");

    // รับข้อมูลมุมเอียง (Orientation) จากมือถือ
    socket.on("update-orientation", (data) => {
        // 1. กรองข้อมูลผ่าน Moving Average
        const avgRoll = getAverage(historyRoll, data.roll, WINDOW_SIZE);
        const avgPitch = getAverage(historyPitch, data.pitch, WINDOW_SIZE);
        const avgYaw = getAverage(historyYaw, data.yaw, WINDOW_SIZE);

        // 2. ตรวจสอบกับค่าขอบเขต (Threshold) เพื่อป้องกันตัวเลขสั่นขยับยิบๆ
        if (Math.abs(avgRoll - currentRoll) > ORIENTATION_THRESHOLD) currentRoll = avgRoll;
        if (Math.abs(avgPitch - currentPitch) > ORIENTATION_THRESHOLD) currentPitch = avgPitch;
        if (Math.abs(avgYaw - currentYaw) > ORIENTATION_THRESHOLD) currentYaw = avgYaw;

        // 3. แสดงผลบนแดชบอร์ดคอมพิวเตอร์
        document.getElementById("roll").textContent = currentRoll.toFixed(1);
        document.getElementById("pitch").textContent = currentPitch.toFixed(1);
        document.getElementById("yaw").textContent = currentYaw.toFixed(1);
    });

    // รับข้อมูลความเร่ง (Accelerometer) จากมือถือ
    socket.on("update-motion", (data) => {
        // 1. กรองข้อมูลผ่าน Moving Average
        const avgAx = getAverage(historyAx, data.ax, WINDOW_SIZE);
        const avgAy = getAverage(historyAy, data.ay, WINDOW_SIZE);
        const avgAz = getAverage(historyAz, data.az, WINDOW_SIZE);

        // 2. ตรวจสอบกับค่าขอบเขต (Threshold) เพื่อล็อกค่านิ่งสนิท
        if (Math.abs(avgAx - currentAx) > MOTION_THRESHOLD) currentAx = avgAx;
        if (Math.abs(avgAy - currentAy) > MOTION_THRESHOLD) currentAx = avgAy; // หมายเหตุ: อิงตามระบบตัวแปรล็อกค่าของเดิม
        if (Math.abs(avgAz - currentAz) > MOTION_THRESHOLD) currentAz = avgAz;

        // 3. แสดงผลบนแดชบอร์ดคอมพิวเตอร์
        document.getElementById("ax").textContent = currentAx.toFixed(2);
        document.getElementById("ay").textContent = currentAy.toFixed(2);
        document.getElementById("az").textContent = currentAz.toFixed(2);
    });
}


/* ===========================================================
   3. ระบบสลับแผงการ์ดแสดงผลเซนเซอร์ (Tabs)
=========================================================== */
const tabOrientation = document.getElementById("tabOrientation");
const tabAccelerometer = document.getElementById("tabAccelerometer");
const cardOrientation = document.getElementById("cardOrientation");
const cardAccelerometer = document.getElementById("cardAccelerometer");

tabOrientation.onclick = () => {
    tabOrientation.classList.add("active");
    tabAccelerometer.classList.remove("active");
    cardOrientation.classList.remove("hidden");
    cardAccelerometer.classList.add("hidden");
};

tabAccelerometer.onclick = () => {
    tabAccelerometer.classList.add("active");
    tabOrientation.classList.remove("active");
    cardAccelerometer.classList.remove("hidden");
    cardOrientation.classList.add("hidden");
};


/* ===========================================================
   4. ระบบควบคุมปุ่มกดและการทำงานหลัก (Control Actions)
=========================================================== */

/* START */
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

/* STOP */
document.getElementById("stopBtn").onclick = () => {
    training = false;
    clearInterval(timerInterval);
};

/* RESET */
document.getElementById("resetBtn").onclick = () => {
    training = false;
    clearInterval(timerInterval);

    // รีเซ็ตตัวกรองและชุดข้อมูลทั้งหมด
    resetFilterHistory();
   
    currentSet = 1;
    results = [];

    document.getElementById("timer").textContent = "0 s";
    document.getElementById("currentSet").textContent = "1";
    document.getElementById("resultArea").innerHTML = `<p class="placeholder-text">ยังไม่มีข้อมูลการบันทึกเซต</p>`;
   
    document.getElementById("roll").textContent = "0.0";
    document.getElementById("pitch").textContent = "0.0";
    document.getElementById("yaw").textContent = "0.0";
    document.getElementById("ax").textContent = "0.00";
    document.getElementById("ay").textContent = "0.00";
    document.getElementById("az").textContent = "0.00";
};

/* SAVE SET */
document.getElementById("saveSetBtn").onclick = () => {
    const sec = startTime === 0 ? 0 : Math.floor((Date.now() - startTime) / 1000);

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

/* DOWNLOAD CSV */
document.getElementById("downloadBtn").onclick = () => {
    if (results.length === 0) {
        alert("ไม่มีข้อมูลให้ดาวน์โหลด กรุณาบันทึกเซตก่อนครับ");
        return;
    }

    let csv = "Set,Time(s)\n";

    results.forEach(r => {
        csv += `${r.set},${r.time}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);
    a.download = "training_results.csv";
    a.click();
};

/* SHOW RESULTS */
function showResults() {
    if (results.length === 0) {
        document.getElementById("resultArea").innerHTML = `<p class="placeholder-text">ยังไม่มีข้อมูลการบันทึกเซต</p>`;
        return;
    }
    
    let html = "";
    results.forEach(r => {
        html += `<p>Set ${r.set} : ${r.time} วินาที</p>`;
    });
    document.getElementById("resultArea").innerHTML = html;
}
