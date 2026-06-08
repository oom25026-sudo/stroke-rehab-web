// ==========================================
// 1. FIREBASE REALTIME DATABASE CONFIGURATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const sensorRef = ref(db, "rehab_session");

// ==========================================
// 2. THREE.JS SETUP (สำหรับคอมพิวเตอร์และเว็บหลัก)
// ==========================================
const container = document.getElementById("scene-container");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf8fafc);

const camera = new THREE.PerspectiveCamera(40, container.clientWidth / 400, 0.1, 1000);
camera.position.set(0, 0, 7);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, 400);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

let phoneGroup = new THREE.Group();
phoneGroup.rotation.order = 'YXZ';
scene.add(phoneGroup);

const loader = new THREE.GLTFLoader();
loader.load(
   "models/phone.glb",
   (gltf) => { phoneGroup.add(gltf.scene); },
   undefined,
   (err) => console.error("3D Model load error:", err)
);

// ==========================================
// 3. GLOBAL VARIABLES & FILTERS
// ==========================================
let training = false;
let startTime = 0;
let timerInterval;

let currentSet = 1;
let count = 0;
let armUp = false;
let results = [];

// ตัวแปรเก็บค่าองศาและความเร่งแบบเรียลไทม์
let roll = 0, pitch = 0, yaw = 0;
let ax = 0, ay = 0, az = 0;
let offsetRoll = 0, offsetPitch = 0, offsetYaw = 0;

let currentRoll = 0, currentPitch = 0, currentYaw = 0;
let currentAx = 0, currentAy = 0, currentAz = 0;

const FILTER_ALPHA = 0.25;         
const ORIENTATION_THRESHOLD = 0.2; 
const MOTION_THRESHOLD = 0.03;

// ==========================================
// 4. ฝั่งคอมพิวเตอร์: รอรับค่าจาก FIREBASE (Real-time Listener)
// ==========================================
// ฟังก์ชันนี้จะทำงานทันทีเมื่อโทรศัพท์ขยับแล้วอัปเดตข้อมูลขึ้น Firebase
onValue(sensorRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    // ดึงค่าองศาและความเร่งลงมาแสดงผลที่คอมพิวเตอร์
    roll = data.roll ?? 0;
    pitch = data.pitch ?? 0;
    yaw = data.yaw ?? 0;
    ax = data.ax ?? 0;
    ay = data.ay ?? 0;
    az = data.az ?? 0;
    count = data.count ?? 0;
    training = data.training ?? false;

    // อัปเดตตัวเลขที่แน่ชัดบนหน้าจอคอมพิวเตอร์
    document.getElementById("roll").textContent = roll.toFixed(1);
    document.getElementById("pitch").textContent = pitch.toFixed(1);
    document.getElementById("yaw").textContent = yaw.toFixed(1);
    
    document.getElementById("ax").textContent = ax.toFixed(2);
    document.getElementById("ay").textContent = ay.toFixed(2);
    document.getElementById("az").textContent = az.toFixed(2);
    
    document.getElementById("count").textContent = count;

    // วาดกราฟความคืบหน้าและอัปเดตแถบบนมือถือ
    updateChart();
    updateMobileIndicator(roll, pitch);
});

// ==========================================
// 5. ฝั่งโทรศัพท์: อัปเดตค่าจากอุปกรณ์ขึ้น FIREBASE
// ==========================================
function initMobileSensor() {
    // 5.1 ตรวจจับมุมและการหมุน (DeviceOrientation)
    window.addEventListener("deviceorientation", (event) => {
        if (!training) return;

        let rawRoll = (event.gamma || 0) - offsetRoll;
        let rawPitch = (event.beta || 0) - offsetPitch;
        let rawYaw = (event.alpha || 0) - offsetYaw;

        // คำนวณผ่านสัญญาณ Low-Pass Filter ค่านิ่งเสถียร
        const nextRoll = currentRoll + FILTER_ALPHA * (rawRoll - currentRoll);
        const nextPitch = currentPitch + FILTER_ALPHA * (rawPitch - currentPitch);
        const nextYaw = currentYaw + FILTER_ALPHA * (rawYaw - currentYaw);

        if (Math.abs(nextRoll - currentRoll) > ORIENTATION_THRESHOLD) currentRoll = nextRoll;
        if (Math.abs(nextPitch - currentPitch) > ORIENTATION_THRESHOLD) currentPitch = nextPitch;
        if (Math.abs(nextYaw - currentYaw) > ORIENTATION_THRESHOLD) currentYaw = nextYaw;

        // อัปเดตค่ายิงขึ้นคลาวด์ Firebase เพื่อส่งให้คอมพิวเตอร์
        set(sensorRef, {
            roll: currentRoll,
            pitch: currentPitch,
            yaw: currentYaw,
            ax: currentAx,
            ay: currentAy,
            az: currentAz,
            count: count,
            training: training,
            timestamp: Date.now()
        });
    });

    // 5.2 ตรวจจับความเร่งและการนับครั้ง (DeviceMotion)
    window.addEventListener("devicemotion", (event) => {
        if (!training) return;

        const acc = event.accelerationIncludingGravity;
        if (!acc) return;

        const rawAx = acc.x || 0;
        const rawAy = acc.y || 0;
        const rawAz = acc.z || 0;

        const nextAx = currentAx + FILTER_ALPHA * (rawAx - currentAx);
        const nextAy = currentAy + FILTER_ALPHA * (rawAy - currentAy);
        const nextAz = currentAz + FILTER_ALPHA * (rawAz - currentAz);

        if (Math.abs(nextAx - currentAx) > MOTION_THRESHOLD) currentAx = nextAx;
        if (Math.abs(nextAy - currentAy) > MOTION_THRESHOLD) currentAy = nextAy;
        if (Math.abs(nextAz - currentAz) > MOTION_THRESHOLD) currentAz = nextAz;

        // ตรรกะนับครั้ง (Counting Logic จากแกน Y)
        if (currentAy > 7.0 && !armUp) {
            armUp = true;
            const statusLabel = document.getElementById("m-arm-status");
            if (statusLabel) statusLabel.textContent = "ยกแขนขึ้น ⬆️";
        }
        if (currentAy < 3.0 && armUp) {
            count++;
            armUp = false;
            const statusLabel = document.getElementById("m-arm-status");
            if (statusLabel) statusLabel.textContent = "หย่อนแขนลง ⬇️";
        }
    });
}

// ==========================================
// 6. ปุ่มควบคุมระบบการฝึก (TRAINING ACTIONS)
// ==========================================
document.getElementById("startBtn").onclick = async () => {
    if (training) return;
    training = true;
    startTime = Date.now();

    // ขออนุญาตเข้าถึงเซนเซอร์สำหรับระบบ iOS
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        try { await DeviceMotionEvent.requestPermission(); } catch (e) {}
    }

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById("timer").textContent = sec + " s";
    }, 1000);

    // Sync สถานะการเริ่มฝึกขึ้น Firebase
    set(sensorRef, { training: true, count: count, roll: roll, pitch: pitch, yaw: yaw });
};

document.getElementById("stopBtn").onclick = () => {
    training = false;
    clearInterval(timerInterval);
    set(sensorRef, { training: false, count: count, roll: roll, pitch: pitch, yaw: yaw });
};

document.getElementById("resetBtn").onclick = () => {
    training = false;
    clearInterval(timerInterval);

    count = 0; armUp = false; currentSet = 1; results = [];
    currentRoll = 0; currentPitch = 0; currentYaw = 0;
    currentAx = 0; currentAy = 0; currentAz = 0;

    document.getElementById("count").textContent = "0";
    document.getElementById("timer").textContent = "0 s";
    document.getElementById("currentSet").textContent = "1";
    document.getElementById("resultArea").innerHTML = "";

    // ล้างค่าในฐานข้อมูลเริ่มต้นใหม่
    set(sensorRef, { training: false, count: 0, roll: 0, pitch: 0, yaw: 0, ax: 0, ay: 0, az: 0 });
};

document.getElementById("saveSetBtn").onclick = () => {
    if (!startTime) return;
    const sec = Math.floor((Date.now() - startTime) / 1000);

    results.push({ set: currentSet, count: count, time: sec });
    showResults();

    currentSet++;
    document.getElementById("currentSet").textContent = currentSet;
    
    // เคลียร์ค่านับใหม่ในเซตถัดไป
    count = 0;
    armUp = false;
    document.getElementById("count").textContent = "0";
    document.getElementById("timer").textContent = "0 s";
    if (training) startTime = Date.now();
};

document.getElementById("downloadBtn").onclick = () => {
    let csv = "Set,Count,Time(s)\n";
    results.forEach(r => { csv += `${r.set},${r.count},${r.time}\n`; });

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rehab_realtime_results.csv";
    a.click();
};

function showResults() {
    let html = "";
    results.forEach(r => { 
        html += `<p style="margin:4px 0;">Set ${r.set} : ทำได้ ${r.count} ครั้ง ขยับ ${r.time} วินาที</p>`; 
    });
    document.getElementById("resultArea").innerHTML = html;
}

// ปุ่มเชื่อมต่อและเซ็ตระนาบศูนย์
document.getElementById('btn-connect').addEventListener('click', () => { initMobileSensor(); });
document.getElementById('btn-tare').addEventListener('click', () => {
   offsetRoll = currentRoll + offsetRoll;
   offsetPitch = currentPitch + offsetPitch;
   offsetYaw = currentYaw + offsetYaw;
});

// ==========================================
// 7. ANIMATION RENDERING & PLOTTING GRAPH
// ==========================================
function animate() {
   requestAnimationFrame(animate);
   // อัปเดตมุมโมเดล 3D บนจอคอมตามค่าองศาที่ได้จาก Firebase แบบเรียลไทม์
   phoneGroup.rotation.set(pitch * Math.PI/180, yaw * Math.PI/180, roll * Math.PI/180);
   renderer.render(scene, camera);
}
animate();

let chart = null;
window.addEventListener("load", () => {
   const canvas = document.getElementById("chart");
   if (canvas) {
       chart = new Chart(canvas.getContext("2d"), {
           type: "line",
           data: { labels: [], datasets: [{ label: "Pitch Angle Trend", data: [], borderColor: "#2563eb", fill: true }] },
           options: { responsive: true, maintainAspectRatio: false }
       });
   }
});

function updateChart() {
   if (!chart) return;
   chart.data.labels.push(new Date().toLocaleTimeString().slice(-8));
   chart.data.datasets[0].data.push(pitch);
   if (chart.data.labels.length > 15) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); }
   chart.update();
}

// ควบคุมมุมมองกล้อง 3D
function switchView(view) {
   if (view === 'front') camera.position.set(0, 0, 7);
   if (view === 'side') camera.position.set(7, 0, 0);
   if (view === 'top') camera.position.set(0, 7, 0.01);
   camera.lookAt(0, 0, 0);
}
document.getElementById('view-front').onclick = () => switchView('front');
document.getElementById('view-side').onclick = () => switchView('side');
document.getElementById('view-top').onclick = () => switchView('top');

setInterval(() => {
   const clock = document.getElementById("live-clock");
   if(clock) clock.innerText = new Date().toLocaleTimeString();
}, 1000);

function updateMobileIndicator(r, p) {
   const rollBar = document.getElementById('bar-roll');
   const pitchBar = document.getElementById('bar-pitch');
   if (rollBar) {
       let rPercent = Math.min(Math.max((r + 90) / 1.8, 0), 100);
       rollBar.style.width = rPercent + '%';
       rollBar.style.background = (Math.abs(r) > 45) ? '#ef4444' : '#38bdf8';
   }
   if (pitchBar) {
       let pPercent = Math.min(Math.max((p + 90) / 1.8, 0), 100);
       pitchBar.style.width = pPercent + '%';
   }
}

// รองรับชุดปุ่มสำหรับหน้าจอมือถือเล็ก
document.getElementById('m-btn-connect')?.addEventListener('click', () => { initMobileSensor(); });
document.getElementById('m-btn-tare')?.addEventListener('click', () => { document.getElementById('btn-tare').click(); });
