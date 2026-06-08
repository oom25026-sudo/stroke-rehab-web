// ==========================================
// 0. FIREBASE REALTIME DATABASE SETUP
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

// ==========================================
// 1. THREE.JS SCENE SETUP
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

// ==========================================
// 2. LOAD 3D MODEL
// ==========================================
let phoneGroup = new THREE.Group();
phoneGroup.rotation.order = 'YXZ';
scene.add(phoneGroup);

const loader = new THREE.GLTFLoader();
loader.load(
   "models/phone.glb",
   (gltf) => { phoneGroup.add(gltf.scene); },
   undefined,
   (err) => console.error("โหลดโมเดลไม่ขึ้น:", err)
);

// ==========================================
// 3. STATE & SENSOR LOGIC (Low-Pass Filter & Training)
// ==========================================
let roll = 0, pitch = 0, yaw = 0;
let offsetRoll = 0, offsetPitch = 0, offsetYaw = 0;
let isTrackingRealSensor = false;
let q = [1.0, 0.0, 0.0, 0.0];
const beta = 0.1;

// ระบบควบคุมเซตและเวลาฝึก
let training = false;
let startTime = 0;
let timerInterval;
let currentSet = 1;
let results = [];

// ตัวแปรสำหรับ Low-Pass Filter ค่านิ่งเสถียร
let filteredRoll = 0, filteredPitch = 0, filteredYaw = 0;
const FILTER_ALPHA = 0.25;         // ค่าความไวการตอบสนอง
const ORIENTATION_THRESHOLD = 0.2;  // ล็อกค่านิ่งเมื่อขยับต่ำกว่ากำหนด

function receiveSensorData(data) {
   let rawRoll = (data.roll ?? 0) - offsetRoll;
   let rawPitch = (data.pitch ?? 0) - offsetPitch;
   let rawYaw = (data.yaw ?? 0) - offsetYaw;

   // คำนวณผ่านสัญญาณ Low-pass filter
   const nextRoll = filteredRoll + FILTER_ALPHA * (rawRoll - filteredRoll);
   const nextPitch = filteredPitch + FILTER_ALPHA * (rawPitch - filteredPitch);
   const nextYaw = filteredYaw + FILTER_ALPHA * (rawYaw - filteredYaw);

   let isMoving = false;
   if (Math.abs(nextRoll - filteredRoll) > ORIENTATION_THRESHOLD) { filteredRoll = nextRoll; isMoving = true; }
   if (Math.abs(nextPitch - filteredPitch) > ORIENTATION_THRESHOLD) { filteredPitch = nextPitch; isMoving = true; }
   if (Math.abs(nextYaw - filteredYaw) > ORIENTATION_THRESHOLD) { filteredYaw = nextYaw; isMoving = true; }

   roll = filteredRoll;
   pitch = filteredPitch;
   yaw = filteredYaw;

   // แสดงผลบนหน้าเว็บแดชบอร์ด
   document.getElementById("roll").innerText = roll.toFixed(1);
   document.getElementById("pitch").innerText = pitch.toFixed(1);
   document.getElementById("yaw").innerText = yaw.toFixed(1);
   
   updateChart();
   updateMobileIndicator(roll, pitch);

   // ส่งค่าขึ้นไปยังฐานข้อมูล Firebase Realtime Database แบบเรียลไทม์ (ส่งเฉพาะเมื่อเปิดปุ่มระบบ Start)
   if (training && isMoving) {
       set(ref(db, "sensor"), {
           roll: parseFloat(roll.toFixed(1)),
           pitch: parseFloat(pitch.toFixed(1)),
           yaw: parseFloat(yaw.toFixed(1)),
           timestamp: Date.now()
       });
   }
}

// ==========================================
// 4. TRAINING CONTROL BUTTON ACTIONS
// ==========================================
document.getElementById("startBtn").onclick = async () => {
    if (training) return;
    training = true;
    startTime = Date.now();

    // ดึงสิทธิ์ใช้งานตัวเซนเซอร์ของมือถือ iOS/Android
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        try { await DeviceMotionEvent.requestPermission(); } catch (e) {}
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

    filteredRoll = 0; filteredPitch = 0; filteredYaw = 0;
    roll = 0; pitch = 0; yaw = 0;
    currentSet = 1;
    results = [];

    document.getElementById("timer").textContent = "0 s";
    document.getElementById("currentSet").textContent = "1";
    document.getElementById("resultArea").innerHTML = "";
    document.getElementById("roll").textContent = "0.0";
    document.getElementById("pitch").textContent = "0.0";
    document.getElementById("yaw").textContent = "0.0";
};

document.getElementById("saveSetBtn").onclick = () => {
    if (!startTime) return;
    const sec = Math.floor((Date.now() - startTime) / 1000);

    results.push({ set: currentSet, time: sec });
    showResults();

    currentSet++;
    document.getElementById("currentSet").textContent = currentSet;
    document.getElementById("timer").textContent = "0 s";
    
    if (training) {
        startTime = Date.now();
    }
};

document.getElementById("downloadBtn").onclick = () => {
    let csv = "Set,Time(s)\n";
    results.forEach(r => { csv += `${r.set},${r.time}\n`; });

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rehab_training_results.csv";
    a.click();
};

function showResults() {
    let html = "";
    results.forEach(r => { html += `<p style="margin:4px 0;">Set ${r.set} : ${r.time} วินาที</p>`; });
    document.getElementById("resultArea").innerHTML = html;
}

// ==========================================
// 5. MOBILE CONNECT & TARE
// ==========================================
document.getElementById('btn-connect').addEventListener('click', async () => {
   if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
       const permission = await DeviceMotionEvent.requestPermission();
       if (permission === 'granted') initMobileSensor();
   } else {
       initMobileSensor();
   }
});

document.getElementById('btn-tare').addEventListener('click', () => {
   offsetRoll = roll + offsetRoll;
   offsetPitch = pitch + offsetPitch;
   offsetYaw = yaw + offsetYaw;
});

function initMobileSensor() {
   isTrackingRealSensor = true;
   window.addEventListener('devicemotion', (e) => {
       const accel = e.accelerationIncludingGravity;
       const gyro = e.rotationRate;
       if(accel && gyro) {
           updateMadgwickFilter(accel.x/9.8, accel.y/9.8, accel.z/9.8, gyro.alpha*Math.PI/180, gyro.beta*Math.PI/180, gyro.gamma*Math.PI/180, 0.01);
           const angles = getEulerAngles(q);
           receiveSensorData({ roll: angles.roll, pitch: angles.pitch, yaw: angles.yaw });
       }
   });
}

function updateMadgwickFilter(ax, ay, az, gx, gy, gz, dt) {
   let qDot1 = 0.5 * (-q[1]*gx - q[2]*gy - q[3]*gz);
   let qDot2 = 0.5 * (q[0]*gx + q[2]*gz - q[3]*gy);
   let qDot3 = 0.5 * (q[0]*gy - q[1]*gz + q[3]*gx);
   let qDot4 = 0.5 * (q[0]*gz + q[1]*gy - q[2]*gx);
   q[0] += qDot1*dt; q[1] += qDot2*dt; q[2] += qDot3*dt; q[3] += qDot4*dt;
   const norm = Math.sqrt(q[0]**2 + q[1]**2 + q[2]**2 + q[3]**2);
   q = q.map(v => v/norm);
}

function getEulerAngles(q) {
   return {
       roll: Math.atan2(2*(q[0]*q[1]+q[2]*q[3]), 1-2*(q[1]**2+q[2]**2)) * (180/Math.PI),
       pitch: Math.asin(2*(q[0]*q[2]-q[3]*q[1])) * (180/Math.PI),
       yaw: Math.atan2(2*(q[0]*q[3]+q[1]*q[2]), 1-2*(q[2]**2+q[3]**2)) * (180/Math.PI)
   };
}

// ==========================================
// 6. ANIMATION LOOP & CHARTS
// ==========================================
function animate() {
   requestAnimationFrame(animate);
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
           data: { labels: [], datasets: [{ label: "Pitch", data: [], borderColor: "#2563eb", fill: true }] },
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

// ฟังก์ชันสลับมุมกล้อง 3D
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

// ดักจับการทำงานสำหรับปุ่ม Mobile View
document.getElementById('m-btn-connect')?.addEventListener('click', () => {
   document.getElementById('btn-connect').click();
});
document.getElementById('m-btn-tare')?.addEventListener('click', () => {
   document.getElementById('btn-tare').click();
});
