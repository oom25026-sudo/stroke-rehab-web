// ⚠️ เปลี่ยน URL ตรงนี้ให้เป็นลิงก์เซิร์ฟเวอร์ Socket.io ของคุณ (เช่น ที่รันบน Glitch หรือ Replit)
const SERVER_URL = "https://your-project.glitch.me"; 
const socket = io(SERVER_URL);

let training = false;
let startTime = 0;
let timerInterval;

// --- สำหรับเก็บผลลัพธ์การฝึก (Training Results) ---
let currentSet = 1;
let results = [];

// ตรวจสอบประเภทอุปกรณ์ (แยกฝั่งส่งข้อมูลบนมือถือ และฝั่งรับข้อมูลบนคอมพิวเตอร์)
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// --- ระบบตัวกรองสัญญาณ (Simple Moving Average - SMA) สำหรับฝั่งคอมพิวเตอร์ ---
const WINDOW_SIZE = 12;            // จำนวนข้อมูลที่จะนำมาเฉลี่ย
const ORIENTATION_THRESHOLD = 0.4; // เกณฑ์ล็อกค่านิ่งของมุม (องศา)
const MOTION_THRESHOLD = 0.05;     // เกณฑ์ล็อกค่านิ่งของความเร่ง (m/s²)

// ตัวแปรสำหรับเก็บข้อมูลย้อนหลัง (คิวเพื่อหาค่าเฉลี่ย)
let historyRoll = [], historyPitch = [], historyYaw = [];
let historyAx = [], historyAy = [], historyAz = [];

// ตัวแปรสำหรับล็อกค่าปัจจุบันที่แสดงบนหน้าจอคอมพิวเตอร์
let currentRoll = 0, currentPitch = 0, currentYaw = 0;
let currentAx = 0, currentAy = 0, currentAz = 0;

// ฟังก์ชันคำนวณค่าเฉลี่ยเคลื่อนที่ (Moving Average Filter)
function getAverage(array, newValue, size) {
    array.push(newValue);
    if (array.length > size) {
        array.shift(); 
    }
    const sum = array.reduce((a, b) => a + b, 0);
    return sum / array.length;
}

// ฟังก์ชันล้างประวัติการกรองสัญญาณ
function resetFilterHistory() {
    historyRoll = []; historyPitch = []; historyYaw = [];
    historyAx = []; historyAy = []; historyAz = [];
    currentRoll = 0; currentPitch = 0; currentYaw = 0;
    currentAx = 0; currentAy = 0; currentAz = 0;
}
// -----------------------------------------------------------


/* ===========================================================
   1. 📱 ฝั่งโทรศัพท์มือถือ: ฟังก์ชันเปิดรับฟังเซนเซอร์ และส่งขึ้นเซิร์ฟเวอร์
=========================================================== */
function initMobileSensors() {
    window.addEventListener("deviceorientation", (event) => {
        if (!training) return; 
        
        // ชดเชยค่าตามที่ตั้งไว้ (Roll + 1, Pitch + 0, Yaw + 0)
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
    console.log("ระบบดักฟังเซนเซอร์บนมือถือพร้อมทำงานแล้ว");
}

if (isMobile) {
    console.log("โหมดทำงาน: [โทรศัพท์มือถือ - ส่งสัญญาณเซนเซอร์]");
    // สำหรับ Android บราวเซอร์มักจะยอมเปิดให้ใช้งานได้ทันทีเมื่อเรียกใช้ window Event
    initMobileSensors();
}


/* ===========================================================
   2. 💻 ฝั่งคอมพิวเตอร์: รอรับข้อมูลจากเซิร์ฟเวอร์ -> กรองสัญญาณ -> อัปเดตหน้าจอ
=========================================================== */
if (!isMobile) {
    console.log("โหมดทำงาน: [คอมพิวเตอร์ - แดชบอร์ดรับข้อมูล]");

    // รับข้อมูลมุมเอียงจากโทรศัพท์
    socket.on("update-orientation", (data) => {
        const avgRoll = getAverage(historyRoll, data.roll, WINDOW_SIZE);
        const avgPitch = getAverage(historyPitch, data.pitch, WINDOW_SIZE);
        const avgYaw = getAverage(historyYaw, data.yaw, WINDOW_SIZE);

        if (Math.abs(avgRoll - currentRoll) > ORIENTATION_THRESHOLD) currentRoll = avgRoll;
        if (Math.abs(avgPitch - currentPitch) > ORIENTATION_THRESHOLD) currentPitch = avgPitch;
        if (Math.abs(avgYaw - currentYaw) > ORIENTATION_THRESHOLD) currentYaw = avgYaw;

        document.getElementById("roll").textContent = currentRoll.toFixed(1);
        document.getElementById("pitch").textContent = currentPitch.toFixed(1);
        document.getElementById("yaw").textContent = currentYaw.toFixed(1);
    });

    // รับข้อมูลความเร่งจากโทรศัพท์
    socket.on("update-motion", (data) => {
        const avgAx = getAverage(historyAx, data.ax, WINDOW_SIZE);
        const avgAy = getAverage(historyAy, data.ay, WINDOW_SIZE);
        const avgAz = getAverage(historyAz, data.az, WINDOW_SIZE);

        if (Math.abs(avgAx - currentAx) > MOTION_THRESHOLD) currentAx = avgAx;
        if (Math.abs(avgAy - currentAy) > MOTION_THRESHOLD) currentAy = avgAy; // แก้ไขบั๊กตัวแปรเทียบจากโค้ดเดิม
        if (Math.abs(avgAz - currentAz) > MOTION_THRESHOLD) currentAz = avgAz;

        document.getElementById("ax").textContent = currentAx.toFixed(2);
        document.getElementById("ay").textContent = currentAy.toFixed(2);
        document.getElementById("az").textContent = currentAz.toFixed(2);
    });
}


/* ===========================================================
   3. 🔘 ระบบสลับแผงการ์ดเซนเซอร์ (Tabs Switching Logic)
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
   4. 🛠️ ระบบควบคุมและฟังก์ชันการบันทึกเวลาฝึก (Control Actions)
=========================================================== */

/* ปุ่ม START TRAINING */
document.getElementById("startBtn").onclick = async () => {
    if (training) return;
    training = true;
    startTime = Date.now();

    // 🔴 จุดสำคัญ: ร้องขอสิทธิ์เข้าถึงเซนเซอร์สำหรับ iOS (ต้องทำงานผ่าน User Interaction เช่นการกดปุ่ม)
    if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
    ) {
        try {
            const permissionState = await DeviceMotionEvent.requestPermission();
            if (permissionState === "granted") {
                initMobileSensors(); // ได้รับอนุญาตแล้ว ให้เริ่มผูก Event สัญญาณทันที
            } else {
                alert("สิทธิ์การเข้าถึง Motion Sensor ถูกปฏิเสธ! ไม่สามารถส่งข้อมูลได้");
            }
        } catch (e) {
            console.error("ข้อผิดพลาดในการขอสิทธิ์อุปกรณ์:", e);
        }
    }

    // เปิดระบบจับเวลารันเซต
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById("timer").textContent = sec + " s";
    }, 1000);
};

/* ปุ่ม STOP */
document.getElementById("stopBtn").onclick = () => {
    training = false;
    clearInterval(timerInterval);
};

/* ปุ่ม RESET ALL */
document.getElementById("resetBtn").onclick = () => {
    training = false;
    clearInterval(timerInterval);

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

/* ปุ่ม SAVE SET */
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

/* ปุ่ม DOWNLOAD CSV */
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

/* ฟังก์ชันเรนเดอร์ประวัติการบันทึกเวลาบนหน้าจอ */
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
