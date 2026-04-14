document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const imageUpload = document.getElementById("imageUpload");
    const downloadBtn = document.getElementById("downloadBtn");
    const frameImage = document.getElementById("frameImage");
    frameImage.src = FRAME_B64; // Use base64 encoded image to avoid SecurityError
    const uploadLabel = document.querySelector(".custom-file-upload");
    const dropArea = document.querySelector(".app-container");
    
    // Zoom Elements
    const zoomControl = document.getElementById("zoomControl");
    const zoomSlider = document.getElementById("imageZoom");
    
    // Canvas setup
    const canvas = document.getElementById("cardCanvas");
    const ctx = canvas.getContext("2d");
    const canvasWrapper = document.querySelector(".canvas-wrapper");
    
    // State
    const CANVAS_SIZE = 800; // Force 1:1 ratio 800x800 for high quality export
    let userImageObj = null;
    let imgOffsetX = 0;
    let imgOffsetY = 0;
    let imgScale = 1;
    
    // Confetti logic
    const confettiCanvas = document.getElementById("confettiCanvas");
    const confettiCtx = confettiCanvas.getContext("2d");
    let particles = [];
    
    function resizeConfetti() {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeConfetti);
    resizeConfetti();
    
    const colors = ['#0dbf1c', '#000000', '#dddddd', '#222222'];
    function initConfetti() {
        for (let i = 0; i < 50; i++) {
            particles.push({
                x: Math.random() * confettiCanvas.width,
                y: Math.random() * confettiCanvas.height,
                r: Math.random() * 4 + 2,
                d: Math.random() * 100, // density
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.floor(Math.random() * 10) - 10,
                tiltAngleIncrement: (Math.random() * 0.07) + 0.05,
                tiltAngle: 0
            });
        }
    }
    
    function drawConfetti() {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];
            confettiCtx.beginPath();
            confettiCtx.lineWidth = p.r;
            confettiCtx.strokeStyle = p.color;
            p.tiltAngle += p.tiltAngleIncrement;
            confettiCtx.moveTo(p.x + p.tilt + p.r, p.y);
            confettiCtx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
            confettiCtx.stroke();
            
            p.y += Math.cos(p.d) + 1 + p.r / 2;
            p.x += Math.sin(0);
            
            if (p.y > confettiCanvas.height) {
                particles[i] = { ...p, x: Math.random() * confettiCanvas.width, y: -10 };
            }
        }
        requestAnimationFrame(drawConfetti);
    }
    initConfetti();
    drawConfetti();

    // --------- Image File Handling ---------
    function handleImageFile(file) {
        uploadLabel.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                userImageObj = img;
                
                // Initialize scale and offset
                const scaleToCover = Math.max(CANVAS_SIZE / userImageObj.width, CANVAS_SIZE / userImageObj.height);
                imgScale = scaleToCover;
                
                zoomSlider.min = scaleToCover * 0.2;
                zoomSlider.max = scaleToCover * 4;
                zoomSlider.value = imgScale;
                zoomControl.style.display = "flex";
                
                imgOffsetX = (CANVAS_SIZE - (userImageObj.width * imgScale)) / 2;
                imgOffsetY = (CANVAS_SIZE - (userImageObj.height * imgScale)) / 2;
                
                renderCanvas();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    // File upload event
    imageUpload.addEventListener("change", (e) => {
        if (e.target.files[0]) handleImageFile(e.target.files[0]);
    });

    // Drag over UI for uploading
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => canvasWrapper.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => canvasWrapper.classList.remove('drag-over'), false);
    });

    dropArea.addEventListener('drop', (e) => {
        let dt = e.dataTransfer;
        let file = dt.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        }
    });

    // --------- Canvas Panning (Drag) & Zooming ---------
    let isDragging = false;
    let startX, startY;

    canvas.addEventListener('mousedown', (e) => {
        if (!userImageObj) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = canvas.getBoundingClientRect();
        // Calculate ratio to scale mouse movement distance to actual canvas rendering distance
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        imgOffsetX += (e.clientX - startX) * scaleX;
        imgOffsetY += (e.clientY - startY) * scaleY;
        
        startX = e.clientX;
        startY = e.clientY;
        renderCanvas();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });
    
    zoomSlider.addEventListener('input', (e) => {
        const newScale = parseFloat(e.target.value);
        const canvasCenterW = CANVAS_SIZE / 2;
        const canvasCenterH = CANVAS_SIZE / 2;
        
        // Find center of screen relative to un-zoomed source image
        const unscaledCenterX = (canvasCenterW - imgOffsetX) / imgScale;
        const unscaledCenterY = (canvasCenterH - imgOffsetY) / imgScale;
        
        imgScale = newScale;
        
        // Adjust offsets to keep the zooming focused around the middle of the canvas
        imgOffsetX = canvasCenterW - (unscaledCenterX * imgScale);
        imgOffsetY = canvasCenterH - (unscaledCenterY * imgScale);
        
        renderCanvas();
    });


    // --------- Rendering ---------
    if(frameImage.complete) {
        renderCanvas();
    } else {
        frameImage.addEventListener('load', () => {
            renderCanvas();
        });
    }

    function renderCanvas() {
        canvas.style.display = "block";
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        
        // Background fallback color
        ctx.fillStyle = "#0A0A0A";
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Step 1: Draw User Photo exactly where specified
        if (userImageObj) {
            canvasWrapper.classList.add("has-image");
            
            const drawW = userImageObj.width * imgScale;
            const drawH = userImageObj.height * imgScale;
            ctx.drawImage(userImageObj, imgOffsetX, imgOffsetY, drawW, drawH);
            downloadBtn.disabled = false;
        } else {
            downloadBtn.disabled = true;
        }

        // Step 2: Draw Frame on top unconditionally
        if (frameImage.complete && frameImage.naturalWidth !== 0) {
            ctx.drawImage(frameImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        }
    }

    // --------- Download ---------
    downloadBtn.addEventListener("click", () => {
        if (!userImageObj) return;
        try {
            // Generate highest quality JPEG data URL
            const dataURL = canvas.toDataURL("image/jpeg", 1.0);
            
            // Force browser to download instead of previewing by altering MIME type to octet-stream
            // This bypasses the Chromium/Safari bug on strictly local file:// environments 
            // that strips the .jpg extension from Blob URLs.
            const forcedDownloadUrl = dataURL.replace("image/jpeg", "application/octet-stream");
            
            const link = document.createElement("a");
            link.download = "noboborsho-card.jpg";
            link.href = forcedDownloadUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (error) {
            console.error(error);
            alert("Could not download due to local file security restrictions. Please use 'Live Server' or run the app via localhost to enable downloading!");
        }
    });
});
