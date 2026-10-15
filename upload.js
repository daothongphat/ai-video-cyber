const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Upload file len GitHub Releases, tra ve URL cong khai
 * @param {string} filePath - Duong dan file local
 * @param {string} repo - "username/repo-name"
 * @param {string} tag - Tag release (vi du "v1.0")
 * @param {string} assetName - Ten file tren GitHub
 * @returns {string} - URL cong khai
 */
function uploadToGitHubRelease(filePath, repo, tag, assetName) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File khong ton tai: ${filePath}`);
    }
    if (!repo || !repo.includes("/")) {
        throw new Error(`GITHUB_REPO khong hop le: ${repo}`);
    }

    // Kiem tra release da ton tai chua
    let releaseExists = false;
    try {
        execSync(`gh release view ${tag} --repo ${repo}`, { stdio: "pipe" });
        releaseExists = true;
    } catch {
        releaseExists = false;
    }

    // Tao release moi neu chua co
    if (!releaseExists) {
        console.log(`[Upload] Tao release moi: ${tag}`);
        execSync(
            `gh release create ${tag} --repo ${repo} --title "AI Video Assets ${tag}" --notes "Auto-uploaded assets"`,
            { stdio: "inherit" }
        );
    }

    // Upload file (--clobber de ghi de neu trung ten)
    console.log(`[Upload] Dang upload: ${assetName} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
    execSync(
        `gh release upload ${tag} "${filePath}" --repo ${repo} --clobber`,
        { stdio: "inherit" }
    );

    // Tra ve URL
    const url = `https://github.com/${repo}/releases/download/${tag}/${assetName}`;
    console.log(`[Upload] URL: ${url}`);
    return url;
}

/**
 * Upload nhieu file cung luc
 */
function uploadMultipleToGitHubRelease(files, repo, tag) {
    const urls = {};
    for (const [name, filePath] of Object.entries(files)) {
        urls[name] = uploadToGitHubRelease(filePath, repo, tag, path.basename(filePath));
    }
    return urls;
}

module.exports = { uploadToGitHubRelease, uploadMultipleToGitHubRelease };