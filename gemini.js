const { GoogleGenAI } = require("@google/genai");

const SYSTEM_PROMPT = `BÃ¡ÂºÂ¡n lÃƒÂ  chuyÃƒÂªn gia tÃ¡ÂºÂ¡o HyperFrames video composition tÃ¡Â»Â« mÃƒÂ´ tÃ¡ÂºÂ£ tiÃ¡ÂºÂ¿ng ViÃ¡Â»â€¡t.

NHIÃ¡Â»â€ M VÃ¡Â»Â¤: TÃ¡ÂºÂ¡o HTML + GSAP animation hoÃƒÂ n chÃ¡Â»â€°nh cho video.

HÃ¡Â»Â¢P Ã„ÂÃ¡Â»â€™NG BÃ¡ÂºÂ®T BUÃ¡Â»ËœC (HyperFrames deterministic):
1. Root element phÃ¡ÂºÂ£i cÃƒÂ³ Ã„â€˜Ã¡ÂºÂ§y Ã„â€˜Ã¡Â»Â§ attributes:
   <div id="root"
        data-composition-id="custom"
        data-start="0"
        data-duration="{{duration}}"
        data-width="{{width}}"
        data-height="{{height}}"
        class="clip">
2. GSAP timeline PHÃ¡ÂºÂ¢I paused:
   const tl = gsap.timeline({ paused: true });
3. Ã„ÂÃ„Æ’ng kÃƒÂ½ timeline vÃƒÂ o window:
   window.__timelines = window.__timelines || {};
   window.__timelines["custom"] = tl;
4. DÃƒÂ¹ng position parameter cho timing: tl.to(el, {...}, 1.5)
5. CÃ¡ÂºÂ¤M TUYÃ¡Â»â€ T Ã„ÂÃ¡Â»ÂI:
   - Date.now(), Math.random(), performance.now()
   - repeat: -1 (dÃƒÂ¹ng sÃ¡Â»â€˜ hÃ¡Â»Â¯u hÃ¡ÂºÂ¡n nhÃ†Â° repeat: 3)
   - Animate display, visibility, autoAlpha (dÃƒÂ¹ng opacity)
   - Comment trong code
   - Markdown code block

STYLE:
- Background transparent (sÃ¡ÂºÂ½ chÃ¡Â»â€œng lÃƒÂªn video nÃ¡Â»Ân)
- Font: Orbitron, Share Tech Mono cho cyber theme
- MÃƒÂ u chÃ¡Â»Â§ Ã„â€˜Ã¡ÂºÂ¡o: #00ff64 (xanh lÃƒÂ¡ cyber)
- HiÃ¡Â»â€¡u Ã¡Â»Â©ng: glow, scan line, glitch, particle
- Responsive theo {{width}} vÃƒÂ  {{height}}

OUTPUT: ChÃ¡Â»â€° trÃ¡ÂºÂ£ vÃ¡Â»Â HTML thuÃ¡ÂºÂ§n, bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u bÃ¡ÂºÂ±ng <!DOCTYPE html> vÃƒÂ  kÃ¡ÂºÂ¿t thÃƒÂºc bÃ¡ÂºÂ±ng </html>. KhÃƒÂ´ng cÃƒÂ³ bÃ¡ÂºÂ¥t kÃ¡Â»Â³ text nÃƒÂ o khÃƒÂ¡c.`;

async function generateHtmlFromPrompt(userPrompt, width, height, duration, fps) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY chÃ†Â°a Ã„â€˜Ã†Â°Ã¡Â»Â£c cÃ¡ÂºÂ¥u hÃƒÂ¬nh trong .env");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const fullPrompt = `${SYSTEM_PROMPT}

THÃƒâ€NG SÃ¡Â»Â VIDEO:
- Width: ${width}px
- Height: ${height}px
- Duration: ${duration} giÃƒÂ¢y
- FPS: ${fps}

MÃƒâ€ TÃ¡ÂºÂ¢ VIDEO CÃ¡Â»Â¦A NGÃ†Â¯Ã¡Â»Å“I DÃƒâ„¢NG:
${userPrompt}

HÃƒÂ£y tÃ¡ÂºÂ¡o HTML composition ngay bÃƒÂ¢y giÃ¡Â»Â.`;

    const response = await ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: fullPrompt,
        config: {
            temperature: 0.7,
            maxOutputTokens: 8000
        }
    });

    let html = response.text || "";
    
    // XÃƒÂ³a markdown code block nÃ¡ÂºÂ¿u cÃƒÂ³
    html = html.replace(/^```html\s*/i, "");
    html = html.replace(/^```\s*/i, "");
    html = html.replace(/\s*```\s*$/i, "");
    
    // XÃƒÂ³a cÃƒÂ¡c dÃƒÂ²ng comment HTML (khÃƒÂ´ng Ã¡ÂºÂ£nh hÃ†Â°Ã¡Â»Å¸ng chÃ¡Â»Â©c nÃ„Æ’ng)
    // GiÃ¡Â»Â¯ lÃ¡ÂºÂ¡i vÃƒÂ¬ cÃƒÂ³ thÃ¡Â»Æ’ cÃ¡ÂºÂ§n cho debug
    
    // KiÃ¡Â»Æ’m tra contract cÃ†Â¡ bÃ¡ÂºÂ£n
    if (!html.includes("data-composition-id")) {
        throw new Error("Gemini khÃƒÂ´ng tuÃƒÂ¢n thÃ¡Â»Â§: thiÃ¡ÂºÂ¿u data-composition-id");
    }
    if (!html.includes("window.__timelines")) {
        throw new Error("Gemini khÃƒÂ´ng tuÃƒÂ¢n thÃ¡Â»Â§: thiÃ¡ÂºÂ¿u window.__timelines");
    }
    if (!html.includes("paused: true")) {
        throw new Error("Gemini khÃƒÂ´ng tuÃƒÂ¢n thÃ¡Â»Â§: timeline chÃ†Â°a paused");
    }
    
    // Thay thÃ¡ÂºÂ¿ placeholder nÃ¡ÂºÂ¿u Gemini khÃƒÂ´ng thay
    html = html.replace(/\{\{width\}\}/g, width);
    html = html.replace(/\{\{height\}\}/g, height);
    html = html.replace(/\{\{duration\}\}/g, duration);
    html = html.replace(/\{\{fps\}\}/g, fps);
    
    return html;
}

module.exports = { generateHtmlFromPrompt };