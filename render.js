const fs = require("fs");
const { execSync } = require("child_process");

const scenePath = process.argv[2] || "./scenes/cyber_01.json";
const scene = JSON.parse(fs.readFileSync(scenePath, "utf-8"));

console.log(`Scene: ${scene.scene_id}`);
console.log(`Template: ${scene.template_name}`);
console.log(`Size: ${scene.width || 1080}x${scene.height || 1920} @ ${scene.fps || 30}fps`);

const templatePath = `./templates/${scene.template_name}.html`;
let html = fs.readFileSync(templatePath, "utf-8");

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

for (const [key, value] of Object.entries(scene.data)) {
    html = html.replace(new RegExp(`{{${key}}}`, "g"), escapeHtml(value));
}

const width = scene.width || 1080;
const height = scene.height || 1920;
const fps = scene.fps || 30;

html = html.replace(/\{\{width\}\}/g, width);
html = html.replace(/\{\{height\}\}/g, height);
html = html.replace(/\{\{fps\}\}/g, fps);

// DUNG RELATIVE PATH
const outputHtml = `./output/${scene.scene_id}.html`;
fs.writeFileSync(outputHtml, html, "utf-8");
console.log(`Da inject data -> ${outputHtml}`);

console.log("Dang render...");
try {
    const overlayFile = `./output/${scene.scene_id}.webm`;
    execSync(
        `npx hyperframes render -c "${outputHtml}" --format webm --fps ${fps} -o "${overlayFile}"`,
        { stdio: "inherit", cwd: process.cwd() }
    );
    console.log(`Render thanh cong -> ${overlayFile}`);
} catch (err) {
    console.error("Render that bai:", err.message);
    process.exit(1);
}