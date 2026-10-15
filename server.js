const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
require("dotenv").config();
const { generateHtmlFromPrompt } = require("./gemini");
const { generateOmniHumanVideo } = require("./omnihuman");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const ROOT = __dirname;
const SCENES_DIR = path.join(ROOT, "scenes");
const OUTPUT_DIR = path.join(ROOT, "output");
const AUDIO_DIR = path.join(ROOT, "audio");
const TEMPLATES_DIR = path.join(ROOT, "templates");

const jobs = new Map();

function log(jobId, message, type = "info") {
    const job = jobs.get(jobId);
    if (job) {
        job.lastLog = message;
        job.lastLogType = type;
        job.logs.push({ time: Date.now(), message, type });
        if (job.logs.length > 500) job.logs.shift();
    }
    console.log(`[${jobId}] ${message}`);
}

function runAsync(command, jobId, successMsg) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, { shell: true, cwd: ROOT });
        child.stdout.on("data", (data) => {
            const lines = data.toString().split("\n").filter(Boolean);
            lines.forEach((l) => log(jobId, l.slice(0, 200), "info"));
        });
        child.stderr.on("data", (data) => {
            const lines = data.toString().split("\n").filter(Boolean);
            lines.forEach((l) => log(jobId, l.slice(0, 200), "warn"));
        });
        child.on("close", (code) => {
            if (code === 0) {
                log(jobId, successMsg, "ok");
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });
    });
}

function calculateDimensions(aspectRatio, resolution) {
    const baseHeights = {
        "720p": 720,
        "1080p": 1080,
        "1440p": 1440,
        "2160p": 2160
    };
    const baseHeight = baseHeights[resolution] || 1080;
    const ratios = {
        "9:16": { w: 9, h: 16 },
        "16:9": { w: 16, h: 9 },
        "1:1":  { w: 1, h: 1 },
        "4:5":  { w: 4, h: 5 }
    };
    const r = ratios[aspectRatio] || ratios["9:16"];
    let width, height;
    if (r.h >= r.w) {
        height = baseHeight;
        width = Math.round(baseHeight * r.w / r.h);
    } else {
        width = Math.round(baseHeight * r.w / r.h);
        height = baseHeight;
    }
    width = Math.floor(width / 2) * 2;
    height = Math.floor(height / 2) * 2;
    return { width, height };
}

async function searchCoverr(query, orientation, apiKey) {
    const params = new URLSearchParams({
        query: query || "cyber security",
        page_size: "10",
        urls: "true"
    });

    const headers = { "Content-Type": "application/json" };
    // Coverr hoÃƒÂ¡Ã‚ÂºÃ‚Â¡t Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ng khÃƒÆ’Ã‚Â´ng cÃƒÂ¡Ã‚ÂºÃ‚Â§n key ÃƒÂ¡Ã‚Â»Ã…Â¸ tier miÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n phÃƒÆ’Ã‚Â­
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`https://api.coverr.co/videos?${params}`, { headers });

    if (!response.ok) {
        throw new Error(`Coverr API error: ${response.status}`);
    }

    const data = await response.json();
    const hits = data.hits || data.videos || [];
    
    if (!hits.length) {
        throw new Error("Coverr: khong tim thay video");
    }

    const video = hits[0];
    return {
        downloadUrl: video.urls?.mp4 || video.url || video.download_url,
        pageUrl: video.page_url || `https://coverr.co/videos/${video.id}`,
        title: video.title || "",
        duration: parseFloat(video.duration || 0),
        license: "Coverr License (attribution required)",
        author: video.author || "Coverr"
    };
}

async function searchVidevo(query, orientation, apiKey) {
    const params = new URLSearchParams({
        query: query || "cyber security",
        page: "1",
        per_page: "10",
        free: "true"
    });
    if (orientation) params.append("orientation", orientation);

    const response = await fetch(`https://api.videvo.net/v1/search?${params}`, {
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`Videvo API error: ${response.status}`);
    }

    const data = await response.json();
    const hits = data.data || data.results || data.clips || [];
    
    if (!hits.length) {
        throw new Error("Videvo: khong tim thay video");
    }

    // Chon video dau tien co duration >= 5s
    for (const v of hits) {
        const duration = parseFloat(v.duration || 0);
        if (duration >= 5) {
            return {
                downloadUrl: v.download_url || v.url || v.file_url,
                pageUrl: v.page_url || `https://www.videvo.net/video/${v.id}/`,
                title: v.title || "",
                duration: duration,
                license: v.license_type || "Videvo Attribution License",
                author: v.author || v.creator || "Videvo"
            };
        }
    }
    throw new Error("Videvo: tat ca video qua ngan");
}

async function searchCoverr(query, orientation, apiKey) {
    const params = new URLSearchParams({
        query: query || "cyber security",
        page_size: "10",
        urls: "true"
    });

    const headers = { "Content-Type": "application/json" };
    // Coverr hoÃƒÂ¡Ã‚ÂºÃ‚Â¡t Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ng khÃƒÆ’Ã‚Â´ng cÃƒÂ¡Ã‚ÂºÃ‚Â§n key ÃƒÂ¡Ã‚Â»Ã…Â¸ tier miÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¦n phÃƒÆ’Ã‚Â­
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`https://api.coverr.co/videos?${params}`, { headers });

    if (!response.ok) {
        throw new Error(`Coverr API error: ${response.status}`);
    }

    const data = await response.json();
    const hits = data.hits || data.videos || [];
    
    if (!hits.length) {
        throw new Error("Coverr: khong tim thay video");
    }

    const video = hits[0];
    return {
        downloadUrl: video.urls?.mp4 || video.url || video.download_url,
        pageUrl: video.page_url || `https://coverr.co/videos/${video.id}`,
        title: video.title || "",
        duration: parseFloat(video.duration || 0),
        license: "Coverr License (attribution required)",
        author: video.author || "Coverr"
    };
}

async function searchVidevo(query, orientation, apiKey) {
    const params = new URLSearchParams({
        query: query || "cyber security",
        page: "1",
        per_page: "10",
        free: "true"
    });
    if (orientation) params.append("orientation", orientation);

    const response = await fetch(`https://api.videvo.net/v1/search?${params}`, {
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`Videvo API error: ${response.status}`);
    }

    const data = await response.json();
    const hits = data.data || data.results || data.clips || [];
    
    if (!hits.length) {
        throw new Error("Videvo: khong tim thay video");
    }

    // Chon video dau tien co duration >= 5s
    for (const v of hits) {
        const duration = parseFloat(v.duration || 0);
        if (duration >= 5) {
            return {
                downloadUrl: v.download_url || v.url || v.file_url,
                pageUrl: v.page_url || `https://www.videvo.net/video/${v.id}/`,
                title: v.title || "",
                duration: duration,
                license: v.license_type || "Videvo Attribution License",
                author: v.author || v.creator || "Videvo"
            };
        }
    }
    throw new Error("Videvo: tat ca video qua ngan");
}

async function prepareBackground(source, query, url, outputPath) {
    if (source === "omnihuman") {
        log("background", "Dang tao video nguoi noi bang OmniHuman 1.5...", "info");
        try {
            const apiKey = process.env.AIML_API_KEY;
            if (!apiKey) throw new Error("AIML_API_KEY chua cau hinh");
            
            // Can co anh va audio URL cong khai
            // Trong truong hop nay, ta dung anh tu thu muc assets va audio tu TTS
            const imageUrl = job.portraitUrl || process.env.OMNIHUMAN_DEFAULT_IMAGE;
            const audioUrl = job.audioPublicUrl; // Can upload audio len storage cong khai
            
            if (!imageUrl) throw new Error("Thieu portrait image URL");
            if (!audioUrl) throw new Error("Thieu audio public URL");
            
            const videoUrl = await generateOmniHumanVideo({
                imageUrl: imageUrl,
                audioUrl: audioUrl,
                prompt: job.prompt || "The person is speaking naturally",
                resolution: "720p"
            }, apiKey);
            
            // Tai video ve
            const response = await fetch(videoUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(outputPath, Buffer.from(buffer));
            
            log("background", `Da tai OmniHuman video: ${outputPath}`, "ok");
            return outputPath;
        } catch (err) {
            log("background", `OmniHuman that bai: ${err.message}`, "warn");
            return null;
        }
    }
    if (source === "coverr") {
        log("background", "Dang tai tu Coverr...", "info");
        try {
            const apiKey = process.env.COVERR_API_KEY || "";
            const orientation = (query && query.includes("portrait")) ? "portrait" : "landscape";
            const video = await searchCoverr(query || "cyber security", orientation, apiKey);
            log("background", `Tim thay: ${video.title} (${video.duration}s)`, "ok");
            log("background", `License: ${video.license}`, "warn");
            log("background", `Credit: Coverr / ${video.author}`, "warn");
            
            if (!video.downloadUrl) {
                throw new Error("Khong co download URL");
            }
            
            const response = await fetch(video.downloadUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(outputPath, Buffer.from(buffer));
            
            log("background", `Da tai: ${outputPath}`, "ok");
            return outputPath;
        } catch (err) {
            log("background", `Coverr that bai: ${err.message}`, "warn");
            return null;
        }
    }
    if (source === "videvo") {
        log("background", "Dang tai tu Videvo...", "info");
        try {
            const apiKey = process.env.VIDEVO_API_KEY;
            if (!apiKey) throw new Error("VIDEVO_API_KEY chua cau hinh");
            
            // Xac dinh orientation tu aspect ratio
            const orientation = (query && query.includes("portrait")) ? "portrait" : "landscape";
            const video = await searchVidevo(query || "cyber security", orientation, apiKey);
            log("background", `Tim thay: ${video.title} (${video.duration}s)`, "ok");
            log("background", `License: ${video.license}`, "warn");
            log("background", `Credit: Videvo / ${video.author}`, "warn");
            
            // Tai file
            const response = await fetch(video.downloadUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(outputPath, Buffer.from(buffer));
            
            log("background", `Da tai: ${outputPath}`, "ok");
            return outputPath;
        } catch (err) {
            log("background", `Videvo that bai: ${err.message}`, "warn");
            return null;
        }
    }
    if (source === "omnihuman") {
        log("background", "Dang tao video nguoi noi bang OmniHuman 1.5...", "info");
        try {
            const apiKey = process.env.AIML_API_KEY;
            if (!apiKey) throw new Error("AIML_API_KEY chua cau hinh");
            
            // Can co anh va audio URL cong khai
            // Trong truong hop nay, ta dung anh tu thu muc assets va audio tu TTS
            const imageUrl = job.portraitUrl || process.env.OMNIHUMAN_DEFAULT_IMAGE;
            const audioUrl = job.audioPublicUrl; // Can upload audio len storage cong khai
            
            if (!imageUrl) throw new Error("Thieu portrait image URL");
            if (!audioUrl) throw new Error("Thieu audio public URL");
            
            const videoUrl = await generateOmniHumanVideo({
                imageUrl: imageUrl,
                audioUrl: audioUrl,
                prompt: job.prompt || "The person is speaking naturally",
                resolution: "720p"
            }, apiKey);
            
            // Tai video ve
            const response = await fetch(videoUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(outputPath, Buffer.from(buffer));
            
            log("background", `Da tai OmniHuman video: ${outputPath}`, "ok");
            return outputPath;
        } catch (err) {
            log("background", `OmniHuman that bai: ${err.message}`, "warn");
            return null;
        }
    }
    if (source === "coverr") {
        log("background", "Dang tai tu Coverr...", "info");
        try {
            const apiKey = process.env.COVERR_API_KEY || "";
            const orientation = (query && query.includes("portrait")) ? "portrait" : "landscape";
            const video = await searchCoverr(query || "cyber security", orientation, apiKey);
            log("background", `Tim thay: ${video.title} (${video.duration}s)`, "ok");
            log("background", `License: ${video.license}`, "warn");
            log("background", `Credit: Coverr / ${video.author}`, "warn");
            
            if (!video.downloadUrl) {
                throw new Error("Khong co download URL");
            }
            
            const response = await fetch(video.downloadUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(outputPath, Buffer.from(buffer));
            
            log("background", `Da tai: ${outputPath}`, "ok");
            return outputPath;
        } catch (err) {
            log("background", `Coverr that bai: ${err.message}`, "warn");
            return null;
        }
    }
    if (source === "videvo") {
        log("background", "Dang tai tu Videvo...", "info");
        try {
            const apiKey = process.env.VIDEVO_API_KEY;
            if (!apiKey) throw new Error("VIDEVO_API_KEY chua cau hinh");
            
            // Xac dinh orientation tu aspect ratio
            const orientation = (query && query.includes("portrait")) ? "portrait" : "landscape";
            const video = await searchVidevo(query || "cyber security", orientation, apiKey);
            log("background", `Tim thay: ${video.title} (${video.duration}s)`, "ok");
            log("background", `License: ${video.license}`, "warn");
            log("background", `Credit: Videvo / ${video.author}`, "warn");
            
            // Tai file
            const response = await fetch(video.downloadUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(outputPath, Buffer.from(buffer));
            
            log("background", `Da tai: ${outputPath}`, "ok");
            return outputPath;
        } catch (err) {
            log("background", `Videvo that bai: ${err.message}`, "warn");
            return null;
        }
    }
    if (source === "pexels") {
        log("background", "Dang tai tu Pexels...", "info");
        try {
            const { fetchVideo } = require("pexelkit");
            await fetchVideo({
                query: query || "cyber security",
                outPath: outputPath,
                quality: "hd"
            });
            log("background", "Da tai tu Pexels: " + outputPath, "ok");
            return outputPath;
        } catch (err) {
            log("background", "Pexels that bai: " + err.message, "warn");
            return null;
        }
    }
    if (source === "url" && url) {
        log("background", "Dang tai tu URL: " + url, "info");
        try {
            const { YtDlp } = require("ytdlp-nodejs");
            const ytdlp = new YtDlp();
            await ytdlp.downloadAsync(url, {
                output: outputPath,
                format: "mergevideo"
            });
            log("background", "Da tai tu URL: " + outputPath, "ok");
            return outputPath;
        } catch (err) {
            log("background", "Tai URL that bai: " + err.message, "warn");
            return null;
        }
    }
    return null;
}

// ============ JOB PROCESSING ============

async function processJob(jobId) {
    const job = jobs.get(jobId);
    job.status = "running";
    const dims = calculateDimensions(job.aspectRatio, job.resolution);
    log(jobId, `Kich thuoc: ${dims.width}x${dims.height} @ ${job.fps}fps (${job.aspectRatio})`, "info");

    let overlayPath = path.join(OUTPUT_DIR, `${jobId}.webm`);
    let title, subtitle;

    // ===== NHANH 0: Gemini sinh HTML =====
    if (job.useGemini && job.prompt) {
        log(jobId, "Mode: Gemini tu dong sinh HTML/GSAP", "info");
        try {
            log(jobId, "Dang goi Gemini API...", "info");
            const generatedHtml = await generateHtmlFromPrompt(
                job.prompt,
                dims.width,
                dims.height,
                job.duration,
                job.fps
            );
            log(jobId, `Gemini da sinh ${generatedHtml.length} ky tu HTML`, "ok");
            
            // Luu HTML de debug
            const geminiHtmlPath = path.join(OUTPUT_DIR, `${jobId}_gemini.html`);
            fs.writeFileSync(geminiHtmlPath, generatedHtml, "utf-8");
            log(jobId, `Da luu: ${geminiHtmlPath}`, "ok");
            
            // Render
            log(jobId, "Rendering Gemini HTML...", "info");
            const relGemini = `./output/${jobId}_gemini.html`;
            const relOverlay = `./output/${jobId}.webm`;
            await runAsync(
                `npx hyperframes render -c "${relGemini}" --format webm --fps ${job.fps} -o "${relOverlay}"`,
                jobId,
                "Gemini HTML rendered"
            );
            
            title = "GEMINI VIDEO";
            subtitle = job.prompt.slice(0, 80);
        } catch (err) {
            log(jobId, `Gemini that bai: ${err.message}`, "error");
            log(jobId, "Fallback ve template cyber_security", "warn");
            job.useGemini = false;
        }
    }

    // ===== NHANH 1: Custom HTML =====
    if (!job.useGemini && job.customHtml) {
        log(jobId, "Mode: Custom HTML", "info");
        let html = job.customHtml;
        html = html.replace(/\{\{width\}\}/g, dims.width);
        html = html.replace(/\{\{height\}\}/g, dims.height);
        html = html.replace(/\{\{fps\}\}/g, job.fps);
        html = html.replace(/\{\{duration\}\}/g, job.duration);
        
        const customHtmlPath = path.join(OUTPUT_DIR, `${jobId}_custom.html`);
        fs.writeFileSync(customHtmlPath, html, "utf-8");
        log(jobId, `Da ghi HTML: ${customHtmlPath}`, "ok");
        
        log(jobId, "Rendering custom HTML...", "info");
        // Dung relative path de tranh lap
        const relHtml = `./output/${jobId}_custom.html`;
        const relOverlay = `./output/${jobId}.webm`;
        await runAsync(
            `npx hyperframes render -c "${relHtml}" --format webm --fps ${job.fps} -o "${relOverlay}"`,
            jobId,
            "Custom HTML rendered"
        );
        
        title = "CUSTOM VIDEO";
        subtitle = "";
    }
    // ===== NHANH 2: JSON hoac Prompt =====
    if (!job.useGemini && !job.customHtml) {
        let scene;
        if (job.sceneJson) {
            scene = job.sceneJson;
            scene.scene_id = jobId;
            title = scene.data.title || "VIDEO";
            subtitle = scene.data.subtitle || "";
            log(jobId, "Su dung JSON thu cong: " + title, "info");
        } else {
            const words = job.prompt.split(/[.!?]/).filter(Boolean);
            title = (words[0] || job.prompt).trim().slice(0, 60).toUpperCase();
            subtitle = (words.slice(1).join(". ") || "AI GENERATED CONTENT").trim().slice(0, 80);
            scene = {
                scene_id: jobId,
                template_name: job.template,
                template_version: "1.0",
                duration: job.duration,
                data: { title, subtitle }
            };
            log(jobId, "Parse tu prompt: " + title, "info");
        }
        
        scene.width = dims.width;
        scene.height = dims.height;
        scene.fps = job.fps;
        
        const scenePath = path.join(SCENES_DIR, `${jobId}.json`);
        fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2), "utf-8");
        log(jobId, `Scene JSON created: ${scenePath}`, "ok");
        
        log(jobId, "Rendering HTML overlay...", "info");
        await runAsync(`node render.js "${scenePath}"`, jobId, "Overlay rendered");
    }

    // ===== BUOC CHUNG: Audio =====
    log(jobId, "Generating voiceover...", "info");
    const tempText = path.join(AUDIO_DIR, `temp_${jobId}.txt`);
    fs.writeFileSync(tempText, `${title}. ${subtitle}`, "utf-8");
    const audioFile = path.join(AUDIO_DIR, `${jobId}.mp3`);
    await runAsync(
        `python -m edge_tts --voice ${job.voice} --file "${tempText}" --write-media "${audioFile}"`,
        jobId,
        "Voiceover created"
    );

    // ===== BUOC CHUNG: Background =====
    let bgPath = path.join(OUTPUT_DIR, "background_test.mp4");
    
    if (job.backgroundSource && job.backgroundSource !== "black") {
        const bgOutput = path.join(OUTPUT_DIR, `bg_${jobId}.mp4`);
        try {
            const downloaded = await prepareBackground(
                job.backgroundSource, job.prompt, job.backgroundUrl, bgOutput
            );
            if (downloaded && fs.existsSync(downloaded) && fs.statSync(downloaded).size > 10000) {
                bgPath = downloaded;
                log(jobId, `Su dung nen: ${path.basename(bgPath)}`, "ok");
            } else {
                log(jobId, "Khong tai duoc nen, dung nen den", "warn");
            }
        } catch (err) {
            log(jobId, `Loi tai nen: ${err.message}, dung nen den`, "warn");
        }
    }
    
    // Fallback: tao nen den neu thieu
    if (!fs.existsSync(bgPath)) {
        log(jobId, "Tao nen den bang FFmpeg", "info");
        await runAsync(
            `ffmpeg -f lavfi -i "color=c=black:s=${dims.width}x${dims.height}:d=${job.duration}:r=${job.fps}" ` +
            `-c:v libx264 -pix_fmt yuv420p -y "${bgPath}"`,
            jobId, "Da tao nen den"
        );
    }

    // ===== BUOC CUOI: Ghep tat ca =====
    log(jobId, "Compositing final video...", "info");
    const finalPath = path.join(OUTPUT_DIR, `${jobId}_final.mp4`);
    await runAsync(
        `ffmpeg -i "${bgPath}" -c:v libvpx-vp9 -i "${overlayPath}" -i "${audioFile}" ` +
        `-filter_complex "[0:v]scale=${dims.width}:${dims.height}:force_original_aspect_ratio=decrease,pad=${dims.width}:${dims.height}:(ow-iw)/2:(oh-ih)/2:black[bg];[bg][1:v]overlay=0:0:format=auto[v]" ` +
        `-map "[v]" -map 2:a ` +
        `-c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -r ${job.fps} ` +
        `-c:a aac -b:a 128k -ar 44100 -ac 2 ` +
        `-y "${finalPath}"`,
        jobId, "Final video composited"
    );

    job.outputFile = path.basename(finalPath);
    job.status = "completed";
    log(jobId, ` Completed: ${job.outputFile}`, "ok");
}

// ============ ROUTES ============

app.post("/api/generate", (req, res) => {
    const { prompt, voice, duration, template, sceneJson, customHtml } = req.body;

    if (!sceneJson && !customHtml && (!prompt || !prompt.trim())) {
        return res.status(400).json({ error: "Can co prompt, sceneJson hoac customHtml" });
    }

    const jobId = `job_${Date.now()}`;
    jobs.set(jobId, {
        id: jobId,
        status: "pending",
        prompt: prompt || "",
        sceneJson: sceneJson || null,
        customHtml: customHtml || null,
        useGemini: req.body.useGemini || false,
        voice: voice || "vi-VN-NamMinhNeural",
        duration: duration || 15,
        template: template || "cyber_security",
        backgroundSource: req.body.backgroundSource || "black",
        backgroundUrl: req.body.backgroundUrl || "",
        portraitPath: req.body.portraitPath || "./assets/portrait.jpg",
        aspectRatio: req.body.aspectRatio || "9:16",
        resolution: req.body.resolution || "1080p",
        fps: req.body.fps || 30,
        lastLog: "Job created",
        lastLogType: "info",
        logs: [],
        outputFile: null,
        error: null,
        createdAt: Date.now()
    });

    processJob(jobId).catch((err) => {
        const job = jobs.get(jobId);
        job.status = "failed";
        job.error = err.message;
        log(jobId, `FAILED: ${err.message}`, "error");
    });

    res.json({ jobId });
});

app.get("/api/status/:jobId", (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json({
        status: job.status,
        lastLog: job.lastLog,
        lastLogType: job.lastLogType,
        outputFile: job.outputFile,
        error: job.error
    });
});

app.get("/api/download/:jobId", (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job || !job.outputFile) return res.status(404).json({ error: "Not ready" });
    const filePath = path.join(OUTPUT_DIR, job.outputFile);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing" });
    res.sendFile(filePath);
});

app.get("/api/jobs", (req, res) => {
    const jobList = Array.from(jobs.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50)
        .map(j => ({
            id: j.id,
            status: j.status,
            prompt: j.prompt || "(JSON/HTML mode)",
            outputFile: j.outputFile,
            createdAt: j.createdAt,
            duration: j.duration,
            aspectRatio: j.aspectRatio,
            resolution: j.resolution
        }));
    res.json({ jobs: jobList });
});

app.use(express.static(path.join(ROOT, "ui")));

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n`);
    console.log(`   CYBER VIDEO SERVER  ONLINE         `);
    console.log(`   http://localhost:${PORT}              `);
    console.log(`\n`);
});