const fs = require("fs");
const { uploadToGitHubRelease } = require("./upload");
const path = require("path");
const fetch = require("node-fetch");

const AIMLAPI_BASE = "https://api.aimlapi.com/v2";

/**
 * Tao video tu anh + audio bang OmniHuman 1.5
 * @param {Object} params
 * @param {string} params.imageUrl - URL cong khai hoac Base64 cua anh
 * @param {string} params.audioUrl - URL cong khai cua file audio (duoi 30s)
 * @param {string} params.prompt - Mo ta hanh dong (tuy chon)
 * @param {string} params.resolution - "720p" hoac "1080p" (mac dinh: 720p)
 * @param {string} apiKey - AIML API key
 * @returns {Promise<string>} - URL video ket qua
 */
async function generateOmniHumanVideo({ imageUrl, audioUrl, prompt, resolution = "720p" }, apiKey) {
    // Neu imageUrl la file local, upload len GitHub
    let finalImageUrl = imageUrl;
    if (imageUrl && fs.existsSync(imageUrl)) {
        const repo = process.env.GITHUB_REPO;
        const tag = process.env.GITHUB_RELEASE_TAG || "v1.0";
        const assetName = "portrait.jpg";
        console.log(`[OmniHuman] Upload anh len GitHub: ${imageUrl}`);
        finalImageUrl = uploadToGitHubRelease(imageUrl, repo, tag, assetName);
        console.log(`[OmniHuman] Anh URL: ${finalImageUrl}`);
    }

    // Neu audioUrl la file local, upload len GitHub
    let finalAudioUrl = audioUrl;
    if (audioUrl && fs.existsSync(audioUrl)) {
        const repo = process.env.GITHUB_REPO;
        const tag = process.env.GITHUB_RELEASE_TAG || "v1.0";
        const assetName = require("path").basename(audioUrl);
        console.log(`[OmniHuman] Upload audio len GitHub: ${audioUrl}`);
        finalAudioUrl = uploadToGitHubRelease(audioUrl, repo, tag, assetName);
        console.log(`[OmniHuman] Audio URL: ${finalAudioUrl}`);
    }

    imageUrl = finalImageUrl;
    audioUrl = finalAudioUrl;
    if (!apiKey) {
        throw new Error("AIML_API_KEY chua duoc cau hinh trong .env");
    }
    if (!imageUrl) throw new Error("Thieu imageUrl");
    if (!audioUrl) throw new Error("Thieu audioUrl");

    const payload = {
        model: "bytedance/omnihuman/v1.5",
        image_url: imageUrl,
        audio_url: audioUrl,
        resolution: resolution
    };

    if (prompt) {
        payload.prompt = prompt;
    }

    console.log("[OmniHuman] Dang gui task...");

    const createResponse = await fetch(`${AIMLAPI_BASE}/video/generations`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`OmniHuman API error: ${createResponse.status} - ${errorText}`);
    }

    const createData = await createResponse.json();
    const generationId = createData.id;

    if (!generationId) {
        throw new Error("Khong nhan duoc generation ID tu OmniHuman");
    }

    console.log(`[OmniHuman] Task ID: ${generationId}`);

    // Poll cho den khi xong
    const maxWaitMs = 5 * 60 * 1000; // 5 phut
    const pollIntervalMs = 10000; // 10 giay
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

        const statusResponse = await fetch(
            `${AIMLAPI_BASE}/video/generations?generation_id=${generationId}`,
            {
                headers: { "Authorization": `Bearer ${apiKey}` }
            }
        );

        if (!statusResponse.ok) {
            console.log(`[OmniHuman] Poll error: ${statusResponse.status}`);
            continue;
        }

        const statusData = await statusResponse.json();
        console.log(`[OmniHuman] Status: ${statusData.status}`);

        if (statusData.status === "completed") {
            const videoUrl = statusData.video?.url;
            if (!videoUrl) throw new Error("Task hoan thanh nhung khong co video URL");
            console.log(`[OmniHuman] Video san sang: ${videoUrl}`);
            return videoUrl;
        }

        if (statusData.status === "failed" || statusData.status === "error") {
            throw new Error(`OmniHuman that bai: ${statusData.error?.name || "Unknown error"}`);
        }
    }

    throw new Error("OmniHuman timeout sau 5 phut");
}

module.exports = { generateOmniHumanVideo };