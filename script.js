let count = 0;
let running = false;

let armUp = false;

document.getElementById("startBtn").onclick = async () => {

    running = true;

    // iPhone ต้องขอสิทธิ์
    if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
    ) {

        const permission =
            await DeviceMotionEvent.requestPermission();

        if (permission !== "granted") {
            alert("ต้องอนุญาต Motion Sensor");
            return;
        }
    }
};

document.getElementById("stopBtn").onclick = () => {

    running = false;
};

document.getElementById("resetBtn").onclick = () => {

    count = 0;

    document.getElementById("count").textContent = 0;

    document.getElementById("progressBar").style.width = "0%";

    armUp = false;
};

window.addEventListener(
    "deviceorientation",
    (event) => {

        if (!running) return;

        const roll = event.gamma || 0;
        const pitch = event.beta || 0;
        const yaw = event.alpha || 0;

        document.getElementById("roll").textContent =
            roll.toFixed(1);

        document.getElementById("pitch").textContent =
            pitch.toFixed(1);

        document.getElementById("yaw").textContent =
            yaw.toFixed(1);
    }
);

window.addEventListener(
    "devicemotion",
    (event) => {

        if (!running) return;

        const acc =
            event.accelerationIncludingGravity;

        if (!acc) return;

        const ax = acc.x || 0;
        const ay = acc.y || 0;
        const az = acc.z || 0;

        document.getElementById("ax").textContent =
            ax.toFixed(2);

        document.getElementById("ay").textContent =
            ay.toFixed(2);

        document.getElementById("az").textContent =
            az.toFixed(2);

        // ตัวอย่างนับครั้งจากการยกแขน

        if (ay > 7 && !armUp) {

            armUp = true;
        }

        if (ay < 3 && armUp) {

            armUp = false;

            count++;

            document.getElementById("count").textContent =
                count;

            let percent =
                Math.min(count * 5, 100);

            document.getElementById(
                "progressBar"
            ).style.width =
                percent + "%";
        }
    }
);