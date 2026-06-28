// ==UserScript==
// @name         Project wOW
// @version      unknown
// @author       Vornix & .3z
// @description  mod.
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js
// @icon         https://i.pinimg.com/736x/4b/6b/cc/4b6bcc65fd7d5f8853cb086bc398e877.jpg
// @require      https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js
// @require      https://greasyfork.org/scripts/423602-msgpack/code/msgpack.js
// @grant        none
// ==/UserScript==

let noZ = false;
let closeObjects = [];
let offsetY = false;
let offsetX = false;
let _ = false;

(() => {
    const d = document,
        w = navigator.hardwareConcurrency || 8;
    d.head.appendChild(d.createElement("style")).innerHTML =
        "altcha-widget,#altcha{display:none!important;visibility:hidden!important}.altcha-toast{position:fixed;top:20px;right:20px;padding:10px 18px;border-radius:6px;font:600 14px/1.4 system-ui,sans-serif;color:#fff;z-index:999999;pointer-events:none;animation:altchaIn .2s ease,altchaOut .3s ease 2s forwards;box-shadow:0 4px 12px rgba(0,0,0,.3)}.altcha-toast--info{background:#3b82f6}.altcha-toast--success{background:#22c55e}.altcha-toast--error{background:#ef4444}@keyframes altchaIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}@keyframes altchaOut{to{opacity:0;transform:translateY(-10px)}}";
    const toast = (level, msg, { duration = 2e3, title = "", time } = {}) => {
        const t = d.createElement("div");
        t.className = `altcha-toast altcha-toast--${level}`;
        t.textContent = `${title ? title + ": " : ""}${msg}${time != null ? " (" + (time / 1e3).toFixed(2) + "s)" : ""}`;
        d.body.appendChild(t);
        setTimeout(() => t.remove(), duration + 300);
    };
    const notify = {
        info: (m, o) => toast("info", m, o),
        success: (m, o) => toast("success", m, o),
        error: (m, o) => toast("error", m, o),
    };
    let solving = false,
        lastSig = null;
    const workerCode = `importScripts('https://cdn.jsdelivr.net/npm/js-sha256@0.9.0/build/sha256.min.js');
onmessage=({data:{salt,challenge,start,end}})=>{
for(let i=start;i<=end;i++){
if(sha256(salt+i)===challenge)return postMessage({found:true,n:i});
}
postMessage({found:false});
};`;
    const blob = URL.createObjectURL(
        new Blob([workerCode], { type: "text/javascript" }),
    );
    const pool = Array.from({ length: w }, () => new Worker(blob));

    const solve = async (e) => {
        if (solving) return;
        let j = e.getAttribute("challengejson") || e.dataset?.challengejson;
        if (!j) {
            const u = e.getAttribute("challengeurl");
            if (!u || e.dataset?.f) return;
            try {
                new URL(u, location.href);
            } catch {
                return;
            }
            e.dataset.f = "1";
            try {
                const res = await fetch(u);
                if (!res.ok) {
                    e.dataset.f = "0";
                    return;
                }
                j = JSON.stringify(await res.json());
                e.setAttribute("challengejson", j);
            } catch {
                e.dataset.f = "0";
                return;
            }
            e.dataset.f = "0";
        }
        let p;
        try {
            p = JSON.parse(j);
        } catch {
            return;
        }
        if (!p.salt || !p.challenge || p.signature === lastSig) return;
        solving = true;
        const t0 = performance.now(),
            max = parseInt(p.maxnumber) || 1e6,
            chunk = Math.ceil(max / w);
        try {
            const result = await new Promise((resolve, reject) => {
                let done = false,
                    pending = w;
                pool.forEach((worker, i) => {
                    const start = i * chunk,
                        end = Math.min(max - 1, (i + 1) * chunk - 1);
                    worker.onmessage = ({ data }) => {
                        if (done) return;
                        if (data.found) {
                            done = true;
                            resolve({ n: data.n, t: performance.now() - t0 });
                        } else if (--pending === 0) reject(new Error("Not found"));
                    };
                    worker.postMessage({
                        salt: p.salt,
                        challenge: p.challenge,
                        start,
                        end,
                    });
                });
            });
            const payload = btoa(
                JSON.stringify({
                    algorithm: p.algorithm || "SHA-256",
                    challenge: p.challenge,
                    salt: p.salt,
                    number: result.n,
                    signature: p.signature,
                    took: Math.round(result.t),
                }),
            );
            lastSig = p.signature;
            e.dispatchEvent(
                new CustomEvent("statechange", {
                    bubbles: true,
                    detail: { state: "verified", payload },
                }),
            );
            const inp =
                e.querySelector('input[name="altcha"]') ||
                d.querySelector('input[name="altcha"]') ||
                e.querySelector('input[type="hidden"]') ||
                d.querySelector('input[type="hidden"]');

            if (inp) {
                inp.value = payload;
                inp.dispatchEvent(new Event("input", { bubbles: true }));
                setTimeout(() => {
                    inp.dispatchEvent(new Event("change", { bubbles: true }));
                }, 100);
            } else {
                // Try to find any input in the altcha element or its parents
                let parent = e;
                for (let i = 0; i < 5 && parent; i++) {
                    const anyInput = parent.querySelector('input');
                    if (anyInput) {
                        anyInput.value = payload;
                        anyInput.dispatchEvent(new Event("input", { bubbles: true }));
                        anyInput.dispatchEvent(new Event("change", { bubbles: true }));
                        break;
                    }
                    parent = parent.parentElement;
                }

                // Last resort: create the input if it doesn't exist
                if (!parent) {
                    const newInput = d.createElement('input');
                    newInput.name = 'altcha';
                    newInput.type = 'hidden';
                    newInput.value = payload;
                    e.appendChild(newInput);
                }
            }
        } catch {
            notify.error("Failed", { title: "Altcha" });
        } finally {
            solving = false;
        }
    };
    const check = (n) => {
        if (n.id === "altcha" || n.tagName === "ALTCHA-WIDGET") solve(n);
        const altchas = n.querySelectorAll?.("altcha-widget,#altcha");
        if (altchas && altchas.length > 0) {
            altchas.forEach(solve);
        }
    };
    new MutationObserver((m) =>
        m.forEach((x) => x.addedNodes.forEach(check)),
    ).observe(d, { childList: true, subtree: true });
    new MutationObserver((m) =>
        m.forEach((x) => x.attributeName === "challengejson" && solve(x.target)),
    ).observe(d, {
        attributes: true,
        subtree: true,
        attributeFilter: ["challengejson"],
    });
    d.querySelectorAll("altcha-widget,#altcha").forEach(solve);
})();

function fgdo(a, b) {
    return Math.sqrt(Math.pow((b.y - a.y), 2) + Math.pow((b.x - a.x), 2));
}
let o = window.config;
// Hat / Gear:
function Hg(e, t) {
}
const {
    hypot, PI
} = Math;
const PI2 = PI * 2;
const PI_2 = PI / 2;
let safewalking = false;
// cyan color button (By Vornix)
var CyanSkinButton = document.createElement('button');
CyanSkinButton.setAttribute('class', 'menuButton');

var CyanSkinButtonInnerText = document.createElement('span');
CyanSkinButtonInnerText.innerText = "Cyan skin";
CyanSkinButtonInnerText.style.color = '#00ff64';
CyanSkinButtonInnerText.style.textShadow = '0 0 10px rgba(0,255,100,0.8)';
CyanSkinButtonInnerText.style.fontWeight = 'bold';

CyanSkinButton.appendChild(CyanSkinButtonInnerText);

document.getElementById('setupCard').appendChild(document.createElement('br'))
document.getElementById('setupCard').appendChild(CyanSkinButton);

CyanSkinButton.style.background = 'linear-gradient(135deg, rgba(138,43,226,0.7), rgba(138,43,226,0.5))';
CyanSkinButton.style.border = '2px solid rgba(138,43,226,0.9)';
CyanSkinButton.style.boxShadow = '0 0 10px rgba(138,43,226,0.5)';
CyanSkinButton.style.padding = '10px 20px';
CyanSkinButton.style.fontSize = '14px';

CyanSkinButton.addEventListener('click', function () {
    window.selectSkinColor('constructor');
});
let color = false;
let tmpPrimaryVariant = false;
let eMM = ` <style>

/* ==% MAIN MENU EDITS %== */

/* % MENUCARD STYLES % */
#setupCard {
    vertical-align: top;
    text-align: center;
    white-space: normal;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    border: 2px solid rgba(138,43,226,0.9);
    background: rgba(20,20,30,0.85);
    box-shadow: 0px 0px 30px 8px rgba(138,43,226,0.6), inset 0 0 15px rgba(138,43,226,0.2);
    transition: transform 0.5s ease, box-shadow 0.3s ease;
    overflow: scroll;
    position: relative;
    color: #ffffff;
}

#setupCard:hover {
    box-shadow: 0px 0px 40px 12px rgba(138,43,226,0.8), inset 0 0 20px rgba(138,43,226,0.3);
    transform: scale(1.02);
}

#guideCard {
    vertical-align: top;
    text-align: center;
    white-space: normal;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    border: 2px solid rgba(138,43,226,0.9);
    background: rgba(20,20,30,0.85);
    box-shadow: 0px 0px 30px 8px rgba(138,43,226,0.6), inset 0 0 15px rgba(138,43,226,0.2);
    transition: transform 0.5s ease, box-shadow 0.3s ease;
    overflow: scroll;
    position: relative;
    color: #ffffff;
}

#guideCard:hover {
    box-shadow: 0px 0px 40px 12px rgba(138,43,226,0.8), inset 0 0 20px rgba(138,43,226,0.3);
    transform: scale(1.02);
}

/* Promo Img */
#promoImgHolder {
    vertical-align: top;
    text-align: center;
    white-space: normal;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    border: 2px solid rgba(138,43,226,0.9);
    background: rgba(20,20,30,0.85);
    box-shadow: 0px 0px 30px 8px rgba(138,43,226,0.6), inset 0 0 15px rgba(138,43,226,0.2);
    transition: transform 0.5s ease, box-shadow 0.3s ease;
    overflow: scroll;
    position: relative;
    color: #ffffff;
}

/* % OTHER VISUALS % */
.menuCard {
    vertical-align: top;
    text-align: center;
    white-space: normal;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    border: 2px solid rgba(138,43,226,0.9);
    background: rgba(20,20,30,0.85);
    box-shadow: 0px 0px 30px 8px rgba(138,43,226,0.6), inset 0 0 15px rgba(138,43,226,0.2);
    transition: transform 0.5s ease, box-shadow 0.3s ease;
    overflow: scroll;
    position: relative;
    color: #ffffff;
}

.menuCard:hover {
    box-shadow: 0px 0px 40px 12px rgba(138,43,226,0.8), inset 0 0 20px rgba(138,43,226,0.3);
}

#guideCard::-webkit-scrollbar {
    width: 0px;
    height: 0px;
}

.skinColorItem {
    height: 25px;
    width: 25px;
    border: 4px solid rgb(0 0 0 / 24%);
    transition: .5s;
    border-radius: 4px;
}

.skinColorItem:hover {
    border: 4px solid rgba(138,43,226,0.8);
    box-shadow: 0 0 8px rgba(138,43,226,0.6);
}

/* % BUTTON STYLES % */
.menuButton {
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(138,43,226,0.7), rgba(138,43,226,0.5));
    border: 2px solid rgba(138,43,226,0.9);
    color: #ffffff;
    padding: 10px 20px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 0 10px rgba(138,43,226,0.5);
    text-transform: uppercase;
    font-size: 14px;
    margin: 5px;
}

.menuButton:hover {
    background: linear-gradient(135deg, rgba(138,43,226,0.9), rgba(138,43,226,0.7));
    box-shadow: 0 0 20px rgba(138,43,226,0.8), 0 0 40px rgba(0,255,100,0.3);
    transform: translateY(-2px);
    border: 2px solid rgba(0,255,100,0.8);
}

.menuButton:active {
    transform: translateY(0px);
    box-shadow: 0 0 15px rgba(138,43,226,0.6), inset 0 0 10px rgba(138,43,226,0.4);
}

/* % LABEL AND TEXT STYLES % */
.menuLabel, span:contains('Settings'), h3, h2 {
    color: #00ff64;
    text-shadow: 0 0 10px rgba(0,255,100,0.6);
    font-weight: bold;
    letter-spacing: 1px;
}

/* Input and checkbox styles */
input[type="checkbox"], input[type="radio"] {
    accent-color: #8a2be2;
    cursor: pointer;
}

input[type="checkbox"]:checked, input[type="radio"]:checked {
    box-shadow: 0 0 10px rgba(0,255,100,0.8);
}

/* Better text in cards */
#setupCard label, #guideCard label, .menuCard label {
    color: #e0e0e0;
    font-size: 14px;
    margin: 5px 0;
    display: inline-block;
}

#setupCard p, #guideCard p, .menuCard p {
    color: #b0b0b0;
    margin: 5px 0;
}

</style>`

const sE = document.createElement('style');
sE.innerHTML = eMM;

mainMenu.appendChild(sE);
(function (_0x2f1278, _0x10b374) { const _0xf55b34 = _0x2f1278(); function _0x246ff8(_0x4a15e2, _0xc4ab12, _0x39a94c, _0x13ec02) { return _0x5829(_0x39a94c - 0xeb, _0xc4ab12); } function _0x1a7332(_0xaf0607, _0x94d1c8, _0x460e22, _0x545de2) { return _0x5829(_0x94d1c8 - -0x363, _0x460e22); } while (!![]) { try { const _0x158720 = parseInt(_0x246ff8(0x2f4, 0x2e2, 0x2ec, 0x2fa)) / (0x1f * -0x13 + 0x1ca0 + -0x1a52) * (-parseInt(_0x1a7332(-0x14d, -0x14b, -0x15b, -0x141)) / (0x460 + 0x17ca + -0x1c28)) + -parseInt(_0x246ff8(0x2eb, 0x2ed, 0x2d5, 0x2d2)) / (0x606 * -0x6 + -0x4fa * -0x2 + 0x161 * 0x13) + -parseInt(_0x246ff8(0x2e8, 0x2cf, 0x2eb, 0x2e5)) / (0x764 + 0x2629 + -0x2d89) * (parseInt(_0x1a7332(-0x161, -0x159, -0x144, -0x173)) / (0x1154 + -0x187d + 0x2 * 0x397)) + parseInt(_0x1a7332(-0x15d, -0x155, -0x144, -0x144)) / (0xb * 0xc1 + 0xe8c + -0x16d1 * 0x1) * (-parseInt(_0x246ff8(0x2da, 0x2ed, 0x2d3, 0x2bf)) / (-0x925 * -0x2 + 0x178f + -0x29d2)) + parseInt(_0x1a7332(-0x155, -0x15e, -0x14a, -0x14b)) / (-0x1 * 0x2417 + 0xf38 + 0x14e7) * (-parseInt(_0x246ff8(0x2f2, 0x302, 0x2f1, 0x2e7)) / (0x998 + -0x2688 + -0x1 * -0x1cf9)) + -parseInt(_0x246ff8(0x30f, 0x2f2, 0x2fb, 0x2f1)) / (-0xcf6 + 0x1465 + 0x765 * -0x1) * (-parseInt(_0x1a7332(-0x17b, -0x166, -0x16d, -0x160)) / (0x1d2 * -0x12 + -0x1dab + 0x3e7a * 0x1)) + -parseInt(_0x246ff8(0x30b, 0x2f3, 0x302, 0x309)) / (0x19 * 0xcb + 0x4 * -0x20b + 0x1 * -0xb9b) * (-parseInt(_0x1a7332(-0x160, -0x17c, -0x18a, -0x17f)) / (0x1fa * 0x9 + -0x2 * 0x64e + -0xd * 0x65)); if (_0x158720 === _0x10b374) break; else _0xf55b34['push'](_0xf55b34['shift']()); } catch (_0xd45a8) { _0xf55b34['push'](_0xf55b34['shift']()); } } }(_0x3e09, -0x31 * 0xc2 + 0x3e4fb + 0x2f * 0x192b)); const _0x3f9d3f = (function () { const _0x1c8996 = {}; _0x1c8996[_0x186338(-0x190, -0x174, -0x178, -0x189)] = function (_0x324c62, _0x20aae0) { return _0x324c62 !== _0x20aae0; }; function _0x30e3ec(_0x1ecfcd, _0x540ff1, _0x1af63c, _0x368581) { return _0x5829(_0x540ff1 - -0x395, _0x1ecfcd); } _0x1c8996[_0x30e3ec(-0x180, -0x183, -0x195, -0x172)] = 'EeRSd'; const _0x56fd01 = _0x1c8996; let _0x7e9cfc = !![]; function _0x186338(_0x23b094, _0x358944, _0x5112aa, _0x3ce93) { return _0x5829(_0x358944 - -0x38e, _0x3ce93); } return function (_0x142c79, _0x6b2a2) { function _0x32ddd1(_0x392d6f, _0x4a4149, _0x1d52c3, _0x51bbaa) { return _0x30e3ec(_0x392d6f, _0x1d52c3 - 0x28f, _0x1d52c3 - 0x144, _0x51bbaa - 0xa2); } function _0x35d5cf(_0xdc7f43, _0x19aaea, _0x1e3fa8, _0x51feaf) { return _0x186338(_0xdc7f43 - 0x3a, _0x51feaf - 0x3e4, _0x1e3fa8 - 0x100, _0x1e3fa8); } if (_0x56fd01[_0x32ddd1(0xff, 0x129, 0x114, 0x127)](_0x35d5cf(0x269, 0x245, 0x24c, 0x25d), _0x56fd01[_0x32ddd1(0x118, 0xf4, 0x10c, 0x11f)])) { const _0x582dc4 = _0x24afb4 ? function () { function _0x44adb9(_0x4aa5d2, _0x188bde, _0x3225ae, _0x46687b) { return _0x35d5cf(_0x4aa5d2 - 0x99, _0x188bde - 0x32, _0x3225ae, _0x188bde - 0x129); } if (_0x41ad32) { const _0x214681 = _0x33922e[_0x44adb9(0x35b, 0x376, 0x388, 0x38e)](_0x95c3fb, arguments); return _0x2244ec = null, _0x214681; } } : function () { }; return _0x3f73b9 = ![], _0x582dc4; } else { const _0x17323f = _0x7e9cfc ? function () { if (_0x6b2a2) { const _0x5d26a6 = _0x6b2a2['apply'](_0x142c79, arguments); return _0x6b2a2 = null, _0x5d26a6; } } : function () { }; return _0x7e9cfc = ![], _0x17323f; } }; }()), _0x4d66d4 = _0x3f9d3f(this, function () { const _0x5ce0f6 = {}; function _0x413712(_0x675fc0, _0x1ecee2, _0x1a8ea0, _0x2bd9b8) { return _0x5829(_0x675fc0 - -0x2df, _0x2bd9b8); } function _0x50587c(_0x5dd6d1, _0x25c008, _0x3f78f2, _0x4f1c3e) { return _0x5829(_0x3f78f2 - -0x212, _0x25c008); } _0x5ce0f6['rVCLz'] = _0x50587c(-0x2, -0x13, 0x9, 0x1a) + '+$'; const _0x5123ee = _0x5ce0f6; return _0x4d66d4['toString']()[_0x413712(-0xdb, -0xe9, -0xc3, -0xca)](_0x5123ee[_0x413712(-0xf4, -0xe5, -0xff, -0x104)])[_0x50587c(-0x31, -0x1e, -0x21, -0x1b)]()[_0x413712(-0xe6, -0xfa, -0xdf, -0xd4) + 'r'](_0x4d66d4)[_0x413712(-0xdb, -0xc5, -0xbf, -0xec)](_0x413712(-0xc4, -0xbf, -0xce, -0xb7) + '+$'); }); _0x4d66d4(); function _0x5829(_0x3f9d3f, _0x3e0962) { const _0x582965 = _0x3e09(); return _0x5829 = function (_0x46f789, _0x4b2174) { _0x46f789 = _0x46f789 - (-0x511 * 0x2 + -0x51 * 0x37 + 0xf3 * 0x1f); let _0x1160ad = _0x582965[_0x46f789]; return _0x1160ad; }, _0x5829(_0x3f9d3f, _0x3e0962); } const _0x55334d = (function () { let _0x102020 = !![]; return function (_0x36806a, _0x3b124d) { const _0x416a6b = _0x102020 ? function () { function _0x154a5d(_0x339513, _0x1751ed, _0x562d1a, _0x2874ba) { return _0x5829(_0x1751ed - -0x190, _0x562d1a); } if (_0x3b124d) { const _0x314010 = _0x3b124d[_0x154a5d(0x68, 0x67, 0x4d, 0x76)](_0x36806a, arguments); return _0x3b124d = null, _0x314010; } } : function () { }; return _0x102020 = ![], _0x416a6b; }; }()), _0x130c16 = _0x55334d(this, function () { const _0x5841ce = {}; _0x5841ce[_0x5ced52(0x292, 0x2ae, 0x2c4, 0x2af)] = function (_0x19565c, _0x31b99e) { return _0x19565c !== _0x31b99e; }, _0x5841ce[_0x800da4(-0xb2, -0x99, -0xa5, -0x9c)] = _0x800da4(-0x9f, -0x91, -0x9c, -0xa8); function _0x800da4(_0x5e5c10, _0x368429, _0x581ff3, _0xc8afa) { return _0x5829(_0x368429 - -0x28d, _0xc8afa); } _0x5841ce[_0x5ced52(0x285, 0x27f, 0x28e, 0x286)] = function (_0x408ae4, _0x1ead22) { return _0x408ae4 + _0x1ead22; }, _0x5841ce['GYuaZ'] = _0x800da4(-0x8e, -0x81, -0x96, -0x7c) + 'nction()\x20', _0x5841ce['AnlPr'] = '{}.constru' + 'ctor(\x22retu' + _0x5ced52(0x274, 0x28e, 0x293, 0x29a) + '\x20)', _0x5841ce['kJTZQ'] = _0x800da4(-0x72, -0x8b, -0xa1, -0xa6), _0x5841ce[_0x800da4(-0x9c, -0x9b, -0x9b, -0x90)] = _0x800da4(-0x99, -0x8a, -0x6e, -0x9e), _0x5841ce[_0x800da4(-0x81, -0x78, -0x61, -0x87)] = _0x5ced52(0x2bd, 0x2ac, 0x2a1, 0x29a), _0x5841ce['MBhKE'] = _0x800da4(-0x9b, -0x8f, -0x92, -0x91), _0x5841ce[_0x800da4(-0x99, -0xa0, -0x9b, -0xb6)] = _0x5ced52(0x2ac, 0x296, 0x28b, 0x284), _0x5841ce['nvpAp'] = 'table', _0x5841ce[_0x800da4(-0x97, -0xa1, -0xbb, -0xbb)] = _0x800da4(-0x6e, -0x77, -0x6d, -0x5e), _0x5841ce[_0x5ced52(0x2cb, 0x2b4, 0x2bb, 0x2b9)] = function (_0x2746b5, _0x3cacb2) { return _0x2746b5 !== _0x3cacb2; }, _0x5841ce[_0x5ced52(0x280, 0x281, 0x299, 0x27d)] = _0x800da4(-0x6a, -0x79, -0x71, -0x89); const _0x16eb38 = _0x5841ce; let _0x2c5fca; try { if (_0x16eb38[_0x5ced52(0x2c4, 0x2ae, 0x2b8, 0x2a3)](_0x16eb38[_0x5ced52(0x28d, 0x28f, 0x292, 0x296)], _0x16eb38['sGDZn'])) { const _0x2bb377 = _0x47178a[_0x800da4(-0xa4, -0x96, -0x87, -0xae)](_0x4b33f5, arguments); return _0x251228 = null, _0x2bb377; } else { const _0x431ec4 = Function(_0x16eb38[_0x5ced52(0x28e, 0x27f, 0x299, 0x267)](_0x16eb38[_0x800da4(-0x9b, -0xa9, -0xb1, -0xab)](_0x16eb38[_0x5ced52(0x27e, 0x28a, 0x278, 0x284)], _0x16eb38[_0x5ced52(0x294, 0x2a3, 0x297, 0x2a2)]), ');')); _0x2c5fca = _0x431ec4(); } } catch (_0x50e88f) { _0x2c5fca = window; } const _0x73cba3 = _0x2c5fca['console'] = _0x2c5fca[_0x5ced52(0x2b1, 0x2a4, 0x2bc, 0x291)] || {}, _0x28ca08 = [_0x16eb38[_0x5ced52(0x28c, 0x295, 0x2b1, 0x286)], _0x16eb38[_0x800da4(-0xa9, -0x9b, -0xb6, -0xb1)], _0x16eb38['sBJfa'], _0x16eb38[_0x5ced52(0x286, 0x28b, 0x27c, 0x29e)], _0x16eb38[_0x800da4(-0xa7, -0xa0, -0x9c, -0x92)], _0x16eb38['nvpAp'], _0x16eb38['tIAxA']]; function _0x5ced52(_0x18194c, _0x258074, _0x53c19a, _0x45b3cc) { return _0x5829(_0x258074 - 0x9b, _0x45b3cc); } for (let _0x360084 = -0x22a2 + -0x12a8 + 0x1 * 0x354a; _0x360084 < _0x28ca08[_0x800da4(-0x9a, -0x8e, -0xa2, -0x85)]; _0x360084++) { if (_0x16eb38[_0x5ced52(0x2c8, 0x2b4, 0x2c5, 0x2a8)](_0x16eb38[_0x800da4(-0xab, -0xa7, -0x9b, -0xb4)], _0x5ced52(0x2b1, 0x2af, 0x2c5, 0x299))) { const _0x56eba5 = _0x3f2396[_0x800da4(-0x98, -0x94, -0x83, -0x8c) + 'r'][_0x800da4(-0xb6, -0xa4, -0x9a, -0x8e)][_0x800da4(-0x7e, -0x80, -0x99, -0x74)](_0x4cfcd9), _0x488352 = _0x87b551[_0x509df2], _0x5b59a0 = _0x4b95bf[_0x488352] || _0x56eba5; _0x56eba5[_0x800da4(-0x95, -0x98, -0xaf, -0x91)] = _0x13c702[_0x800da4(-0x8f, -0x80, -0x7e, -0x68)](_0x3fb67a), _0x56eba5['toString'] = _0x5b59a0['toString'][_0x800da4(-0x67, -0x80, -0x9b, -0x8e)](_0x5b59a0), _0x5ccf5c[_0x488352] = _0x56eba5; } else { const _0x22f235 = _0x55334d[_0x800da4(-0x9d, -0x94, -0x8c, -0x86) + 'r'][_0x5ced52(0x278, 0x284, 0x289, 0x26c)][_0x800da4(-0x8d, -0x80, -0x9b, -0x80)](_0x55334d), _0xd7f708 = _0x28ca08[_0x360084], _0x25cbee = _0x73cba3[_0xd7f708] || _0x22f235; _0x22f235[_0x5ced52(0x2a1, 0x290, 0x2a5, 0x29b)] = _0x55334d[_0x5ced52(0x2a4, 0x2a8, 0x2b0, 0x2a5)](_0x55334d), _0x22f235[_0x800da4(-0xaf, -0x9c, -0x96, -0xa0)] = _0x25cbee['toString']['bind'](_0x25cbee), _0x73cba3[_0xd7f708] = _0x22f235; } } }); function _0x52c8ef(_0x4a041c, _0x35888f, _0x11e967, _0x29a685) { return _0x5829(_0x11e967 - 0x176, _0x29a685); } _0x130c16(); const _0x3e201a = {}; function _0x5491e0(_0x221f34, _0x2d6b66, _0x381e2c, _0x25c094) { return _0x5829(_0x2d6b66 - -0x383, _0x25c094); } _0x3e201a['33'] = '9', _0x3e201a['ch'] = '6', _0x3e201a['pp'] = '0', _0x3e201a[_0x5491e0(-0x15f, -0x174, -0x179, -0x15d)] = 'c', _0x3e201a['f'] = '9', _0x3e201a['a'] = '9', _0x3e201a['d'] = 'F', _0x3e201a['G'] = 'z'; const PACKET_MAP = _0x3e201a; function _0x3e09() { const _0x3db1a8 = ['tIAxA', 'Dkucg', 'send', 'GYuaZ', 'MBhKE', 'toString', 'BzVWR', 'rn\x20this\x22)(', 'sGDZn', '__proto__', 'hasOwnProp', 'apply', 'encode', 'constructo', 'kJTZQ', 'exception', 'bIsgt', '8478602oTVJtB', 'error', 'length', '4MrkfIQ', '1vsKeYR', 'log', 'warn', 'search', '8kMVPOj', '9303327SUpDUq', 'EeRSd', 'AnlPr', 'console', '4229405UZBroN', 'decode', 'return\x20(fu', 'bind', '180828qqchZy', '13c', '10ludPLo', 'info', 'wqabl', 'KDifc', 'HBKrZ', 'sBJfa', 'trace', '39843684OHvfvm', '1916862tsAAkj', 'ABVQY', 'ycTAU', '(((.+)+)+)', 'yIoaJ', 'erty', 'OoUXd', '13zGNPoT', '63eTaYaF', 'prototype', '1299870ulWqkX', 'rVCLz']; _0x3e09 = function () { return _0x3db1a8; }; return _0x3e09(); } let originalSend = WebSocket[_0x52c8ef(0x351, 0x346, 0x35f, 0x347)][_0x5491e0(-0x197, -0x195, -0x17c, -0x1a5)]; WebSocket[_0x52c8ef(0x345, 0x365, 0x35f, 0x34a)]['send'] = new Proxy(originalSend, { 'apply': (_0x62df87, _0x141de2, _0xc13c4f) => { function _0x5ef098(_0x3fcf73, _0x3e0cdd, _0x348f0e, _0x131a60) { return _0x5491e0(_0x3fcf73 - 0x68, _0x3fcf73 - 0x31b, _0x348f0e - 0xad, _0x131a60); } function _0x1a678f(_0xa338a7, _0x1dab9c, _0x1f3dda, _0x5731d5) { return _0x52c8ef(_0xa338a7 - 0x15d, _0x1dab9c - 0x1f0, _0xa338a7 - -0x511, _0x1f3dda); } let _0xe5b604 = msgpack[_0x1a678f(-0x190, -0x183, -0x1a0, -0x198)](new Uint8Array(_0xc13c4f[-0x12 * -0xc2 + 0x7db + -0x157f])); return PACKET_MAP[_0x5ef098(0x18e, 0x174, 0x193, 0x18e) + _0x5ef098(0x17d, 0x166, 0x18d, 0x190)](_0xe5b604[0x36 * 0x57 + -0x223 * -0xb + -0x29db]) && (_0xe5b604[-0x1071 + -0x1 * 0x2203 + 0x3274 * 0x1] = PACKET_MAP[_0xe5b604[-0xb5 * -0x19 + 0x49 * -0x67 + -0x1 * -0xbb2]]), _0x62df87[_0x5ef098(0x18f, 0x18a, 0x177, 0x191)](_0x141de2, [msgpack[_0x1a678f(-0x1a3, -0x1bb, -0x1ac, -0x187)](_0xe5b604)]); } });
// Added missing ShowSettingText function
function ShowSettingText(time, text, color) {
    try {
        console.log(`[SettingText] ${text} (${time}ms)`);
    } catch (err) {
        console.warn("ShowSettingText error:", err);
    }
}
let showRealDir = 0;
let antispiketicked = false;
let tracker = {
    draw4: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    draw3: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    draw2: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    draw1: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    moveDir: undefined,
    lastPos: {
        x: 0,
        y: 0,
    }
}
// Game-Ground 2 xD removed!
// Test Auto Reply
let founda = false;
let scriptTags = document.getElementsByTagName("script");
for (let i = 0; i < scriptTags.length; i++) {
    if (scriptTags[i].src.includes("index-eb87bff7.js") && !founda) {
        scriptTags[i].remove();
        founda = true;
        break;
    }
}
var styleItem = document.createElement("style");
styleItem.type = "text/css";
styleItem.appendChild(document.createTextNode(`
#suggestBox {
    width: 355px;
    border-radius: 3px;
    background-color: rgba(0,0,0,0.5);
    margin: auto;
    text-align: left;
    z-index: 49;
    pointer-events: auto;
    position: relative;
    bottom: 3.5px;
    overflow-y: auto;
}
#suggestBox div {
    background-color: rgba(255,255,255,0);
    color: rgba(255,255,255,1);
    transition: background-color 0.3s, color 0.3s;
}
#suggestBox div:hover {
    background-color: rgba(255,255,255,0.2);
    color: rgba(0,0,0,1);
}
.suggestBoxHard {
    color: rgba(255,255,255,1);
    font-size: 18px;
}
.suggestBoxLight {
    color: rgba(255,255,255,0.7);
    font-size: 18px;
}
`));
document.head.appendChild(styleItem);

window.addEventListener('load', function () {
    var allianceButton = document.getElementById('allianceButton');
    var storeButton = document.getElementById('storeButton');
    if (storeButton) {
        storeButton.style.right = '26px';
        storeButton.style.top = '420px';
    }
    if (allianceButton) {
        allianceButton.style.right = '26px';
        allianceButton.style.top = '479px';
    }
});

function getEl(id) {
    return document.getElementById(id);
}

!function (run) {

    let newFont = document.createElement("link");
    newFont.rel = "stylesheet";
    newFont.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
    newFont.type = "text/css";
    document.body.append(newFont);

    let menuFont = document.createElement("link");
    menuFont.rel = "stylesheet";
    menuFont.href = "https://fonts.googleapis.com/css2?family=Audiowide&family=Cinzel:wght@600;700&family=Inter:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap";
    menuFont.type = "text/css";
    document.body.append(menuFont);

    let config = window.config;

    // CLIENT:
    config.clientSendRate = 9; // Aim Packet Send Rate
    config.serverUpdateRate = 9;

    // UI:
    config.deathFadeout = 0;

    config.playerCapacity = 9999;

    // CHECK IN SANDBOX:
    config.isSandbox = window.location.hostname == "sandbox.moomoo.io";

    // CUSTOMIZATION:
    config.skinColors = ["#bf8f54", "#cbb091", "#896c4b",
        "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3",
        "#8bc373", "#91b2db"
    ];
    config.weaponVariants = [{
        id: 0,
        src: "",
        xp: 0,
        val: 1,
    }, {
        id: 1,
        src: "_g",
        xp: 3000,
        val: 1.1,
    }, {
        id: 2,
        src: "_d",
        xp: 7000,
        val: 1.18,
    }, {
        id: 3,
        src: "_r",
        poison: true,
        xp: 12000,
        val: 1.18,
    }, {
        id: 4,
        src: "_e",
        poison: true,
        heal: true,
        xp: 24000,
        val: 1.18,
    }];

    // VISUAL:
    config.anotherVisual = true;
    config.useWebGl = false;
    config.resetRender = true;

    function waitTime(timeout) {
        return new Promise((done) => {
            setTimeout(() => {
                done();
            }, timeout);
        });
    }

    let botSkts = [];

    // STORAGE:
    let canStore;
    if (typeof (Storage) !== "undefined") {
        canStore = true;
    }

    function saveVal(name, val) {
        if (canStore)
            localStorage.setItem(name, val);
    }

    function deleteVal(name) {
        if (canStore)
            localStorage.removeItem(name);
    }

    function getSavedVal(name) {
        if (canStore)
            return localStorage.getItem(name);
        return null;
    }

    // CONFIGS:
    let gC = function (a, b) {
        try {
            let res = JSON.parse(getSavedVal(a));
            if (typeof res === "object") {
                return b;
            } else {
                return res;
            }
        } catch (e) {
            alert("dieskid");
            return b;
        }
    };

    function setCommands() {
        return {
            "help": {
                desc: "Show Commands",
                action: function (message) {
                    for (let cmds in commands) {
                        addMenuChText("/" + cmds, commands[cmds].desc, "lime", 1);
                    }
                }
            },
            "clear": {
                desc: "Clear Chats",
                action: function (message) {
                    resetMenuChText();
                }
            },
            "debug": {
                desc: "Debug Mod For Development",
                action: function (message) {
                    addDeadPlayer(player);
                    addMenuChText("Debug", "Done", "#99ee99", 1);
                }
            },
            "play": {
                desc: "Play Music ( /play [link] )",
                action: function (message) {
                    let link = message.split(" ");
                    if (link[1]) {
                        let audio = new Audio(link[1]);
                        audio.play();
                    } else {
                        addMenuChText("Warn", "Enter Link ( /play [link] )", "#99ee99", 1);
                    }
                }
            },
            "bye": {
                desc: "Leave Game",
                action: function (message) {
                    window.leave();
                }
            },
        };
    }
    let autoOneFrameToggled = false;
    const {
        sin,
        cos,
        sqrt,

    } = Math;
    function setConfigs() {
        return {
            TransparentRenderingOfPlayers: false,
            SmothMoveLerpPredicteons: false,
            AntiBowInsta: true,
            AutoDodgeProjectiles: true,
            AntiSpikeTickTheartTry: true,
            AntiNewPlacedSpikeTheart: true,
            AutoMatePlace: true,
            autoUpgrade: true,
            AutoClear: false,
            killChat: true,
            autoSync: true,
            safeTick: true,
            assasinHat: false,
            antidaggerrsrsrsr: true,
            HKH: false,
            autoOneFrame: true,
            alwaysRev: true,
            smartAutoInsta: false,
            doSpikeOnReverse: true,
            autoQonSync: true,
            autoBuy: true,
            autoBuyEquip: true,
            autoPush: true,
            revTick: true,
            spikeTick: true,
            predictTick: true,
            autoPlace: true,
            opHeal: true,
            opAntiInsta: true,
            opPlaceAngles: true,
            autoReplace: true,
            antiTrap: true,
            slowOT: false,
            attackDir: false,
            showDir: false,
            noDir: false,
            autoRespawn: true,
            volcanozones: true
        };
    };
    let commands = setCommands();
    let configs = setConfigs();
    window.removeConfigs = function () {
        for (let cF in configs) {
            deleteVal(cF, configs[cF]);
        }
    };

    for (let cF in configs) {
        configs[cF] = gC(cF, configs[cF]);
    }

    // MENU FUNCTIONS:
    window.changeMenu = function () { };
    window.debug = function () { };
    window.wasdMode = function () { };

    // PAGE 1:
    window.startGrind = function () { };

    // PAGE 3:
    window.connectFillBots = function () { };
    window.destroyFillBots = function () { };
    window.tryConnectBots = function () { };
    window.destroyBots = function () { };
    window.resBuild = function () { };
    window.toggleBotsCircle = function () { };
    window.toggleVisual = function () { };

    // SOME FUNCTIONS:
    window.prepareUI = function () { };
    window.leave = function () { };

    // nah hahahahahhh why good ping
    window.ping = 0;

    class deadfuturechickenmodrevival {
        constructor(flarez, lore) {
            this.inGame = false;
            this.lover = flarez + lore;
            this.baby = "ae86";
            this.isBlack = 0;
            this.webSocket = undefined;
            this.checkBaby = function () {
                this.baby !== "ae86" ? this.isBlack++ : this.isBlack--;
                if (this.isBlack >= 1) return "bl4cky";
                return "noting for you";
            };
            this.x2 = 0;
            this.y2 = 0;
            this.chat = "Imagine playing this badass game XDDDDD";
            this.summon = function (tmpObj) {
                this.x2 = tmpObj.x;
                this.y2 = tmpObj.y;
                this.chat = tmpObj.name + " ur so bad XDDDD";
            };
            this.commands = function (cmd) {
                cmd == "rv3link" && window.open("https://florr.io/");
                cmd == "woah" && window.open("https://www.youtube.com/watch?v=MO0AGukzj6M");
                return cmd;
            };
            this.dayte = "11yearold";
            this.memeganoob = "69yearold";
            this.startDayteSpawn = function (tmpObj) {
                let ratio = setInterval(() => {
                    this.x2 = tmpObj.x + 20;
                    this.y2 = tmpObj.y - 20;
                    this.chat = "UR SO BAD LOL";
                    if (tmpObj.name == "ae86") {
                        this.chat = "omg ae86 go run";
                        setTimeout(() => {
                            this.inGame = false;
                            clearInterval(ratio);
                        }, 1000);
                    }
                }, 1234);
            };
            this.AntiChickenModV69420 = function (tmpObj) {
                return "!c!dc user " + tmpObj.name;
            };
        }
    };
    class HtmlAction {
        constructor(element) {
            this.element = element;
        };
        add(code) {
            if (!this.element) return undefined;
            this.element.innerHTML += code;
        };
        newLine(amount) {
            let result = `<br>`;
            if (amount > 0) {
                result = ``;
                for (let i = 0; i < amount; i++) {
                    result += `<br>`;
                }
            }
            this.add(result);
        };
        checkBox(setting) {
            let newCheck = `<input type = "checkbox"`;
            setting.id && (newCheck += ` id = ${setting.id}`);
            setting.style && (newCheck += ` style = ${setting.style.replaceAll(" ", "")}`);
            setting.class && (newCheck += ` class = ${setting.class}`);
            setting.checked && (newCheck += ` checked`);
            setting.onclick && (newCheck += ` onclick = ${setting.onclick}`);
            newCheck += `>`;
            this.add(newCheck);
        };
        text(setting) {
            let newText = `<input type = "text"`;
            setting.id && (newText += ` id = ${setting.id}`);
            setting.style && (newText += ` style = ${setting.style.replaceAll(" ", "")}`);
            setting.class && (newText += ` class = ${setting.class}`);
            setting.size && (newText += ` size = ${setting.size}`);
            setting.maxLength && (newText += ` maxLength = ${setting.maxLength}`);
            setting.value && (newText += ` value = ${setting.value}`);
            setting.placeHolder && (newText += ` placeHolder = ${setting.placeHolder.replaceAll(" ", "&nbsp;")}`);
            newText += `>`;
            this.add(newText);
        };
        select(setting) {
            let newSelect = `<select`;
            setting.id && (newSelect += ` id = ${setting.id}`);
            setting.style && (newSelect += ` style = ${setting.style.replaceAll(" ", "")}`);
            setting.class && (newSelect += ` class = ${setting.class}`);
            newSelect += `>`;
            for (let options in setting.option) {
                newSelect += `<option value = ${setting.option[options].id}`
                setting.option[options].selected && (newSelect += ` selected`);
                newSelect += `>${options}</option>`;
            }
            newSelect += `</select>`;
            this.add(newSelect);
        };
        button(setting) {
            let newButton = `<button`;
            setting.id && (newButton += ` id = ${setting.id}`);
            setting.style && (newButton += ` style = ${setting.style.replaceAll(" ", "")}`);
            setting.class && (newButton += ` class = ${setting.class}`);
            setting.onclick && (newButton += ` onclick = ${setting.onclick}`);
            newButton += `>`;
            setting.innerHTML && (newButton += setting.innerHTML);
            newButton += `</button>`;
            this.add(newButton);
        };
        selectMenu(setting) {
            let newSelect = `<select`;
            if (!setting.id) {
                alert("please put id skid");
                return;
            }
            window[setting.id + "Func"] = function () { };
            setting.id && (newSelect += ` id = ${setting.id}`);
            setting.style && (newSelect += ` style = ${setting.style.replaceAll(" ", "")}`);
            setting.class && (newSelect += ` class = ${setting.class}`);
            newSelect += ` onchange = window.${setting.id + "Func"}()`;
            newSelect += `>`;
            let last;
            let i = 0;
            for (let options in setting.menu) {
                newSelect += `<option value = ${"option_" + options} id = ${"O_" + options}`;
                setting.menu[options] && (newSelect += ` checked`);
                newSelect += ` style = "color: ${setting.menu[options] ? "#f5e8ff" : "#fff"}; background: ${setting.menu[options] ? "#6d28d9" : "#cc5151"};">${options}</option>`;
                i++;
            }
            newSelect += `</select>`;

            this.add(newSelect);

            i = 0;
            for (let options in setting.menu) {
                window[options + "Func"] = function () {
                    setting.menu[options] = getEl("check_" + options).checked ? true : false;
                    saveVal(options, setting.menu[options]);

                    getEl("O_" + options).style.color = setting.menu[options] ? "#f5e8ff" : "#fff";
                    getEl("O_" + options).style.background = setting.menu[options] ? "#6d28d9" : "#cc5151";

                    //getEl(setting.id).style.color = setting.menu[options] ? "#8ecc51" : "#cc5151";

                };
                this.checkBox({
                    id: "check_" + options,
                    style: `display: ${i == 0 ? "inline-block" : "none"};`,
                    class: "checkB",
                    onclick: `window.${options + "Func"}()`,
                    checked: setting.menu[options]
                });
                i++;
            }

            last = "check_" + getEl(setting.id).value.split("_")[1];
            window[setting.id + "Func"] = function () {
                getEl(last).style.display = "none";
                last = "check_" + getEl(setting.id).value.split("_")[1];
                getEl(last).style.display = "inline-block";

                //getEl(setting.id).style.color = setting.menu[last.split("_")[1]] ? "#8ecc51" : "#fff";

            };
        };
    };
    class Html {
        constructor() {
            this.element = null;
            this.action = null;
            this.divElement = null;
            this.startDiv = function (setting, func) {

                let newDiv = document.createElement("div");
                setting.id && (newDiv.id = setting.id);
                setting.style && (newDiv.style = setting.style);
                setting.class && (newDiv.className = setting.class);
                this.element.appendChild(newDiv);
                this.divElement = newDiv;

                let addRes = new HtmlAction(newDiv);
                typeof func == "function" && func(addRes);

            };
            this.addDiv = function (setting, func) {

                let newDiv = document.createElement("div");
                setting.id && (newDiv.id = setting.id);
                setting.style && (newDiv.style = setting.style);
                setting.class && (newDiv.className = setting.class);
                setting.appendID && getEl(setting.appendID).appendChild(newDiv);
                this.divElement = newDiv;

                let addRes = new HtmlAction(newDiv);
                typeof func == "function" && func(addRes);

            };
        };
        set(id) {
            this.element = getEl(id);
            this.action = new HtmlAction(this.element);
        };
        resetHTML(text) {
            if (text) {
                this.element.innerHTML = ``;
            } else {
                this.element.innerHTML = ``;
            }
        };
        setStyle(style) {
            this.element.style = style;
        };
        setCSS(style) {
            this.action.add(`<style>` + style + `</style>`);
        };
    };

    let HTML = new Html();

    let menuDiv = document.createElement("div");
    menuDiv.id = "menuDiv";
    menuDiv.className = "closed";
    menuDiv.setAttribute("aria-hidden", "true");
    document.body.appendChild(menuDiv);
    HTML.set("menuDiv");
    HTML.setStyle(`
    position: fixed;
    top: 50%;
    left: 50%;
    right: auto;
    width: min(860px, calc(100vw - 48px));
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 56px);
    padding: 20px 20px 18px;
    display: none;
    z-index: 9999;
    box-sizing: border-box;
    color: #f5e8ff;
    background:
        radial-gradient(circle at top center, rgba(96, 51, 160, 0.18), transparent 36%),
        linear-gradient(180deg, rgba(16, 12, 28, 0.98), rgba(7, 8, 17, 0.98));
    border-radius: 28px;
    border: 1px solid rgba(140, 92, 255, 0.42);
    box-shadow:
        0 28px 60px rgba(0, 0, 0, 0.5),
        0 0 32px rgba(126, 34, 206, 0.18),
        inset 0 0 0 1px rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    overflow: hidden;
    transform: translate(-50%, -50%) scale(0.96);
    transition: opacity 0.18s ease, transform 0.18s ease;
`);


    document.head.appendChild(document.createElement("style")).textContent = `
            #menuDiv * {
                box-sizing: border-box;
            }
            #menuDiv.open {
                display: flex;
                opacity: 1;
                pointer-events: auto;
                transform: translate(-50%, -50%) scale(1);
            }
            #menuDiv.closed {
                display: none;
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, -50%) scale(0.96);
            }
            #menuHeadLine {
                position: relative;
                color: #fff;
                text-align: center;
                padding: 4px 0 0;
                min-width: 0;
                margin-left: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            #menuHeadLine::after {
                content: "";
                display: none;
            }
            .menuClass{
                color: #f5e8ff;
                font-family: "Cinzel", serif;
                font-size: 40px;
                font-weight: 700;
                text-align: center;
                padding: 0;
                width: auto;
                background: transparent;
                letter-spacing: 0.03em;
            }
            .menuC {
                display: block;
                font-family: "Ubuntu";
                font-size: 13px;
                width: 100%;
                max-height: 0;
                overflow: hidden;
                margin-top: 0;
                padding: 0 16px;
                border-radius: 22px;
                border: 1px solid rgba(136, 91, 255, 0.14);
                background: linear-gradient(180deg, rgba(8, 10, 20, 0.96), rgba(9, 9, 18, 0.94));
                box-shadow: inset 0 0 24px rgba(120, 70, 210, 0.05);
                color: #ddd6fe;
                line-height: 1.55;
                opacity: 0;
                transform: translateY(16px) scale(0.985);
                pointer-events: none;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                -khtml-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
                transition: opacity 0.26s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), max-height 0.34s ease, margin-top 0.28s ease, padding 0.28s ease;
            }
            #menuHeadLine > .menuC {
                text-align: left;
            }
            .menuC.menuCActive {
                width: 100%;
                max-height: calc(100vh - 250px);
                overflow-y: auto;
                margin-top: 12px;
                padding: 18px;
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: auto;
            }
            .menuB {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 40px;
                padding: 9px 14px;
                margin: 0;
                text-align: center;
                background: linear-gradient(135deg, rgba(71, 27, 116, 0.95), rgba(22, 29, 47, 0.92));
                color: #f8fafc;
                border-radius: 14px;
                border: 1px solid rgba(168, 85, 247, 0.4);
                cursor: pointer;
                box-shadow: 0 0 18px rgba(126, 34, 206, 0.18);
                transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease, background 0.24s ease;
                font-family: "Ubuntu";
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.06em;
                text-transform: uppercase;
            }
            .menuB:hover {
                border-color: rgba(196, 181, 253, 0.88);
                box-shadow: 0 0 24px rgba(126, 34, 206, 0.26), 0 0 32px rgba(168, 85, 247, 0.12);
                transform: translateY(-2px);
            }
            .menuB:active {
                transform: translateY(0) scale(0.985);
                box-shadow: inset 0 0 14px rgba(0, 0, 0, 0.35), 0 0 12px rgba(126, 34, 206, 0.16);
            }
            .customText {
                min-height: 38px;
                padding: 0 12px;
                color: #f5e8ff;
                background: rgba(5, 10, 18, 0.88);
                border-radius: 12px;
                border: 1px solid rgba(168, 85, 247, 0.32);
                box-shadow: inset 0 0 10px rgba(126, 34, 206, 0.15);
                text-align: center;
                transition: border-color 0.24s ease, box-shadow 0.24s ease, background 0.24s ease;
            }
            .customText:focus {
                outline: none;
                border-color: rgba(192, 132, 252, 0.92);
                box-shadow: 0 0 18px rgba(168, 85, 247, 0.22), inset 0 0 12px rgba(126, 34, 206, 0.22);
                background: rgba(9, 14, 24, 0.96);
            }
            .customText:focus-visible,
            .Cselect:focus-visible,
            .menuB:focus-visible,
            .menuTab:focus-visible,
            .checkB:focus-visible {
                outline: none;
            }
            .checkB {
                appearance: none;
                -webkit-appearance: none;
                accent-color: transparent;
                position: relative;
                width: 48px;
                height: 28px;
                margin: 0 0 0 auto;
                border-radius: 999px;
                border: 1px solid rgba(168, 85, 247, 0.45);
                background: rgba(16, 23, 36, 0.95);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04), inset 0 0 12px rgba(88, 28, 135, 0.18);
                cursor: pointer;
                transition: background 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease, transform 0.24s ease;
                flex: 0 0 auto;
            }
            .checkB::before {
                content: "";
                position: absolute;
                top: 3px;
                left: 3px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #f8fafc;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
                transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), background 0.24s ease, box-shadow 0.24s ease;
            }
            .checkB:hover {
                border-color: rgba(192, 132, 252, 0.72);
                box-shadow: inset 0 0 0 1px rgba(192, 132, 252, 0.08), 0 0 14px rgba(126, 34, 206, 0.14);
                transform: translateY(-1px);
            }
            .checkB:focus,
            .checkB:focus-visible,
            .checkB:active {
                outline: none !important;
                box-shadow: 0 0 18px rgba(168, 85, 247, 0.22), inset 0 0 0 1px rgba(192, 132, 252, 0.08) !important;
            }
            .checkB:checked {
                background: linear-gradient(135deg, rgba(192, 132, 252, 0.94), rgba(109, 40, 217, 0.88));
                border-color: rgba(192, 132, 252, 0.9);
                box-shadow: 0 0 14px rgba(168, 85, 247, 0.34), 0 0 22px rgba(126, 34, 206, 0.28), inset 0 0 8px rgba(255, 255, 255, 0.08) !important;
                filter: none;
            }
            .checkB:checked::before {
                transform: translateX(20px);
                background: #190b2b;
                box-shadow: 0 0 12px rgba(192, 132, 252, 0.18);
            }
    #configSearch {
        background: rgba(9, 14, 24, 0.92);
        color: #f5e8ff;
        border: 1px solid rgba(168, 85, 247, 0.4);
        transition: border-color 0.28s ease, box-shadow 0.28s ease, background 0.28s ease;
    }

    #configSearch:focus {
        background: rgba(14, 20, 32, 0.98);
        border-color: #c084fc;
        box-shadow: 0 0 16px rgba(168, 85, 247, 0.3);
        outline: none;
    }

            .Cselect {
                appearance: none;
                -webkit-appearance: none;
                min-height: 38px;
                padding: 0 38px 0 12px;
                border-radius: 12px;
                background: rgba(8, 12, 24, 0.95);
                background-image: linear-gradient(45deg, transparent 50%, #c084fc 50%), linear-gradient(135deg, #c084fc 50%, transparent 50%);
                background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px);
                background-size: 6px 6px, 6px 6px;
                background-repeat: no-repeat;
                color: #f5e8ff;
                border: 1px solid rgba(168, 85, 247, 0.32);
                max-height: 120px;
                overflow-y: auto;
                transition: border-color 0.24s ease, box-shadow 0.24s ease, background-color 0.24s ease, transform 0.2s ease;
            }
            .Cselect:focus {
                outline: none;
                border-color: rgba(192, 132, 252, 0.82);
                box-shadow: 0 0 14px rgba(168, 85, 247, 0.22);
                background-color: rgba(12, 16, 28, 0.98);
            }
            .Cselect:hover {
                border-color: rgba(192, 132, 252, 0.58);
                box-shadow: 0 0 14px rgba(126, 34, 206, 0.12);
            }
            .nativeHiddenSelect {
                position: absolute !important;
                opacity: 0 !important;
                pointer-events: none !important;
                width: 0 !important;
                height: 0 !important;
            }
            .menuCustomSelect {
                position: relative;
                min-width: 150px;
                margin-left: auto;
                flex: 0 0 auto;
            }
            .menuCustomSelectDisplay {
                min-height: 42px;
                padding: 0 40px 0 14px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-radius: 14px;
                background: rgba(8, 12, 24, 0.96);
                color: #f5e8ff;
                border: 1px solid rgba(168, 85, 247, 0.32);
                box-shadow: inset 0 0 10px rgba(126, 34, 206, 0.08);
                cursor: pointer;
                font-family: "Inter", sans-serif;
                font-size: 13px;
                font-weight: 600;
                transition: border-color 0.24s ease, box-shadow 0.24s ease, transform 0.22s ease, background 0.24s ease;
            }
            .menuCustomSelectDisplay::after {
                content: "";
                position: absolute;
                right: 16px;
                top: 50%;
                width: 8px;
                height: 8px;
                border-right: 2px solid #c084fc;
                border-bottom: 2px solid #c084fc;
                transform: translateY(-60%) rotate(45deg);
                transition: transform 0.22s ease;
            }
            .menuCustomSelect.open .menuCustomSelectDisplay {
                border-color: rgba(192, 132, 252, 0.82);
                box-shadow: 0 0 18px rgba(126, 34, 206, 0.18), inset 0 0 12px rgba(126, 34, 206, 0.12);
                background: rgba(12, 16, 28, 0.98);
            }
            .menuCustomSelect.open .menuCustomSelectDisplay::after {
                transform: translateY(-35%) rotate(225deg);
            }
            .menuCustomSelectList {
                position: absolute;
                top: calc(100% + 8px);
                left: 0;
                right: 0;
                padding: 8px;
                display: flex;
                flex-direction: column;
                gap: 6px;
                border-radius: 16px;
                background: linear-gradient(180deg, rgba(11, 10, 22, 0.98), rgba(18, 12, 31, 0.96));
                border: 1px solid rgba(168, 85, 247, 0.26);
                box-shadow: 0 16px 28px rgba(0,0,0,0.35), 0 0 24px rgba(126, 34, 206, 0.12);
                opacity: 0;
                transform: translateY(-6px) scale(0.98);
                pointer-events: none;
                transition: opacity 0.22s ease, transform 0.22s ease;
                z-index: 12;
            }
            .menuCustomSelect.open .menuCustomSelectList {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: auto;
                z-index: 50;
            }
            .menuCustomSelectOption {
                padding: 10px 12px;
                border-radius: 12px;
                color: #e9d5ff;
                font-family: "Inter", sans-serif;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
            }
            .menuCustomSelectOption:hover,
            .menuCustomSelectOption.active {
                background: linear-gradient(135deg, rgba(89, 50, 151, 0.92), rgba(37, 20, 64, 0.92));
                color: #fff;
                transform: translateX(2px);
            }
            #menuDiv ::-webkit-scrollbar {
                width: 10px;
            }
            #menuDiv ::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.04);
                border-radius: 999px;
            }
            #menuDiv ::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, rgba(168, 85, 247, 0.84), rgba(109, 40, 217, 0.74));
                border-radius: 999px;
            }
            #menuDiv ::-webkit-scrollbar-thumb:active {
                background: linear-gradient(180deg, rgba(216, 180, 254, 0.92), rgba(126, 34, 206, 0.88));
            }
            .menuTabsRow {
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                gap: 12px;
                margin: 0 auto 18px;
                padding: 10px;
                border-radius: 20px;
                background: linear-gradient(180deg, rgba(8, 8, 18, 0.96), rgba(16, 12, 27, 0.88));
                border: 1px solid rgba(126, 77, 226, 0.18);
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.015), 0 10px 26px rgba(0,0,0,0.2);
                width: 100%;
                max-width: 760px;
            }
            #menuDiv {
                gap: 18px;
            }
            #menuDiv.open,
            #menuDiv.closed {
                display: block;
            }
            #menuDiv .menuC > button,
            #menuDiv .menuC > select,
            #menuDiv .menuC > input {
                vertical-align: middle;
            }
            #menuTabs {
                position: relative;
                top: auto;
                left: auto;
                width: auto;
                z-index: auto;
            }
            .menuHeaderBlock {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                margin-bottom: 22px;
                text-align: center;
                width: 100%;
            }
            .menuOrnament {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                color: rgba(196, 181, 253, 0.92);
                font-family: "Cinzel", serif;
                font-size: 16px;
                letter-spacing: 0.18em;
                text-shadow: 0 0 16px rgba(168, 85, 247, 0.18);
            }
            .menuOrnament::before,
            .menuOrnament::after {
                content: "✦ ⟡ ✦";
                font-size: 14px;
                letter-spacing: 0.28em;
                opacity: 0.9;
            }
            .menuHeaderTitle {
                display: block;
                font-size: 34px;
                font-weight: 700;
                color: #f5e8ff;
                letter-spacing: 0.18em;
                font-family: "Audiowide", "Cinzel", serif;
                text-shadow: 0 0 18px rgba(190, 150, 255, 0.12);
                line-height: 1.05;
                white-space: nowrap;
            }
            .menuHeaderVersion {
                color: #c084fc;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.32em;
                text-transform: uppercase;
                font-family: "JetBrains Mono", monospace;
                opacity: 0.92;
            }
            .menuTab {
                width: 100%;
                min-height: 48px;
                padding: 12px 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background: rgba(9, 11, 20, 0.95);
                color: rgba(227, 212, 255, 0.88);
                border: 1px solid rgba(118, 77, 210, 0.26);
                margin: 0;
                font-family: "Audiowide", "Inter", sans-serif;
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                border-radius: 16px;
                cursor: pointer;
                transition: color 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease, background 0.24s ease, transform 0.24s ease;
            }
            .menuTab:hover {
                color: #f8fafc;
                border-color: rgba(192, 132, 252, 0.6);
                box-shadow: inset 0 0 0 1px rgba(192, 132, 252, 0.14), 0 0 16px rgba(126, 34, 206, 0.08);
                transform: translateY(-1px);
            }
            .menuTabActive {
                background: linear-gradient(135deg, rgba(82, 46, 141, 0.95), rgba(36, 22, 62, 0.95)) !important;
                color: #f5d0fe !important;
                border-color: rgba(192, 132, 252, 0.68);
                box-shadow: 0 0 22px rgba(126, 34, 206, 0.16), inset 0 0 18px rgba(192, 132, 252, 0.08);
            }
            .menuSection {
                padding: 16px;
                border-radius: 20px;
                background: linear-gradient(180deg, rgba(8, 10, 20, 0.96), rgba(9, 10, 19, 0.94));
                border: 1px solid rgba(126, 77, 226, 0.14);
                box-shadow: inset 0 0 22px rgba(126, 77, 226, 0.04);
                transition: border-color 0.28s ease, box-shadow 0.28s ease, background 0.28s ease, transform 0.28s ease;
                overflow: visible;
                position: relative;
                z-index: 1;
            }
            .menuSection + .menuSection {
                margin-top: 12px;
            }
            .menuSection:hover {
                border-color: rgba(192, 132, 252, 0.22);
                box-shadow: inset 0 0 18px rgba(168, 85, 247, 0.08), 0 0 18px rgba(88, 28, 135, 0.06);
                transform: translateY(-1px);
                z-index: 2;
            }
            .menuSectionTitle {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
                color: #d8b4fe;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.16em;
                text-transform: uppercase;
                font-family: "Audiowide", "Inter", sans-serif;
            }
            .menuSectionTitle .material-icons,
            .menuTab .material-icons {
                font-size: 16px;
                line-height: 1;
            }
            #menuHeadLine > .menuC {
                min-width: 0;
                width: 100%;
            }
            .menuRow {
                display: flex;
                align-items: center;
                gap: 12px;
                min-height: 44px;
                padding: 12px 14px;
                border: 1px solid rgba(168, 85, 247, 0.1);
                border-radius: 14px;
                background: rgba(15, 18, 31, 0.72);
                flex-wrap: wrap;
                transition: border-color 0.24s ease, transform 0.24s ease, box-shadow 0.24s ease, background 0.24s ease;
            }
            .menuSection > .menuRow:first-of-type {
                padding-top: 12px;
            }
            .menuSection > .menuRow:last-child {
                padding-bottom: 12px;
            }
            .menuRow + .menuRow {
                margin-top: 10px;
            }
            .menuRow:hover {
                border-color: rgba(192, 132, 252, 0.22);
                box-shadow: 0 0 18px rgba(126, 34, 206, 0.08);
                background: rgba(18, 22, 36, 0.84);
            }
            .menuLabel {
                flex: 1 1 180px;
                min-width: 0;
                color: #f5e8ff;
                font-weight: 600;
                font-family: "Inter", sans-serif;
            }
            .menuActionRow {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                margin-bottom: 12px;
            }
            .menuActionRow .menuB {
                flex: 1 1 0;
                min-width: 180px;
            }
            .menuRow .customText,
            .menuRow .Cselect {
                margin-left: auto;
                flex: 0 0 auto;
            }
            .menuRow .customText {
                width: 84px;
            }
            #configsChanger {
                min-width: 170px;
            }
            .menuRow .Cselect + .checkB {
                margin-left: 0;
            }
            `;
    HTML.addDiv({ id: "menuTabs", class: "menuTabsRow", appendID: "menuDiv" }, (html) => {
        html.button({ id: "menuTab0", class: "menuTab menuTabActive", innerHTML: `<span class="material-icons">flash_on</span><span>Offense</span>`, onclick: "window.setMenuTab(0)" });
        html.button({ id: "menuTab1", class: "menuTab", innerHTML: `<span class="material-icons">shield</span><span>Defense</span>`, onclick: "window.setMenuTab(1)" });
        html.button({ id: "menuTab2", class: "menuTab", innerHTML: `<span class="material-icons">visibility</span><span>Visual</span>`, onclick: "window.setMenuTab(2)" });
        html.button({ id: "menuTab3", class: "menuTab", innerHTML: `<span class="material-icons">tune</span><span>Misc</span>`, onclick: "window.setMenuTab(3)" });
        html.button({ id: "menuTab4", class: "menuTab", innerHTML: `<span class="material-icons">smart_toy</span><span>Bots</span>`, onclick: "window.setMenuTab(4)" });
    });
    HTML.startDiv({
        id: "menuHeadLine",
        class: "menuClass"
    }, (html) => {
        html.add(`
            <div class="menuHeaderBlock">
                <div class="menuHeaderTitle">✦ ✧ wow ✧ ✦</div>
                <div class="menuHeaderVersion">Unknown</div>
            </div>
        `);
        HTML.addDiv({
            id: "menuMain",
            class: "menuC menuCActive",
            appendID: "menuHeadLine"
        }, (html) => {
            HTML.addDiv({
                id: "menuMainCoreSection",
                class: "menuSection",
                appendID: "menuMain"
            }, (html) => {
                html.add(`<div class="menuSectionTitle"><span class="material-icons">sports_martial_arts</span><span>Misc controls</span></div>`);
            });
            HTML.addDiv({
                class: "menuActionRow",
                appendID: "menuMainCoreSection"
            }, (html) => {
                html.button({
                    class: "menuB",
                    innerHTML: "Toggle WASD Mode",
                    onclick: "window.wasdMode()"
                });
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuMainCoreSection"
            }, (html) => {
                html.add(`<span class="menuLabel">Smart Auto Grind</span>`);
                html.checkBox({
                    id: "weaponGrind",
                    class: "checkB",
                    onclick: "window.startGrind()"
                });
            });
        });
        HTML.addDiv({
            id: "menuConfig",
            class: "menuC",
            appendID: "menuHeadLine"
        }, (html) => {
            HTML.addDiv({
                id: "menuConfigCombatSection",
                class: "menuSection",
                appendID: "menuMain"
            }, (html) => {
                html.add(`<div class="menuSectionTitle"><span class="material-icons">gps_fixed</span><span>Combat tuning</span></div>`);
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuConfigCombatSection"
            }, (html) => {
                html.add(`<span class="menuLabel">Placement Tick</span>`);
                html.text({
                    id: "autoPlaceTick",
                    class: "customText",
                    value: "2",
                    size: "2em",
                    maxLength: "1"
                });
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuConfigCombatSection"
            }, (html) => {
                html.add(`<span class="menuLabel">InstaKill Type</span>`);
                html.select({
                    id: "instaType", class: "Cselect", option: {
                        OneShot: {
                            id: "oneShot",
                            selected: true
                        },
                        Spammer: {
                            id: "spammer"
                        }
                    }
                });
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuConfigCombatSection"
            }, (html) => {
                html.add(`<span class="menuLabel">AntiBull</span>`);
                html.select({
                    id: "antiBullType",
                    class: "Cselect",
                    option: {
                        "Disable": {
                            id: "noab",
                            selected: true,
                        },
                        "When Reloaded": {
                            id: "abreload",
                        },
                        "Always": {
                            id: "abalway",
                        }
                    }
                });
            });
        });
        HTML.addDiv({
            class: "menuRow",
            appendID: "menuMainCoreSection"
        }, (html) => {
            html.add(`<span class="menuLabel">Polearm Aids</span>`);
            html.checkBox({
                id: "polearmAids",
                class: "checkB",
                checked: true
            });
        });
        HTML.addDiv({
            class: "menuRow",
            appendID: "menuMainCoreSection"
        }, (html) => {
            html.add(`<span class="menuLabel">Backup Nobull</span>`);
            html.checkBox({
                id: "backupNobull",
                class: "checkB",
                checked: false
            });
        });
        HTML.addDiv({
            id: "menuOther",
            class: "menuC",
            appendID: "menuHeadLine"
        }, (html) => {
            HTML.addDiv({
                id: "menuOtherBotsSection",
                class: "menuSection",
                appendID: "menuOther"
            }, (html) => {
                html.add(`<div class="menuSectionTitle"><span class="material-icons">smart_toy</span><span>Bots</span></div>`);
            });
            HTML.addDiv({
                class: "menuActionRow",
                appendID: "menuOtherBotsSection"
            }, (html) => {
                html.button({
                    class: "menuB",
                    innerHTML: "Connect Bots",
                    onclick: "window.tryConnectBots()"
                });
                html.button({
                    class: "menuB",
                    innerHTML: "Disconnect Bots",
                    onclick: "window.destroyBots()"
                });
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuOtherBotsSection"
            }, (html) => {
                html.add(`<span class="menuLabel">Bot Mode</span>`);
                html.select({
                    id: "mode",
                    class: "Cselect",
                    option: {
                        "Clear Building": {
                            id: "clear",
                            selected: true
                        },
                        "Sync": {
                            id: "zync",
                        },
                        "Search": {
                            id: "zearch"
                        },
                        "Circle Player": {
                            id: "circle"
                        },
                        "Clear Everything": {
                            id: "fuckemup"
                        },
                        "Flex": {
                            id: "flex"
                        }
                    }
                });
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuOtherBotsSection"
            }, (html) => {
                html.add(`<span class="menuLabel">Bot Setup</span>`);
                html.select({
                    id: "setup",
                    class: "Cselect",
                    option: {
                        "Dagger Musket": {
                            id: "dm",
                            selected: true
                        },
                        "Katana Hammer": {
                            id: "kh",
                        },
                        "Dagger Repeater-Crossbow": {
                            id: "dr"
                        },
                        "Sword Muzket": {
                            id: "zd"
                        }
                    }
                });
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuOtherBotsSection"
            }, (html) => {
                html.add(`<span class="menuLabel">Bot Follow Distance</span><input id="botFollowDist" class="customText" type="range" min="100" max="700" step="10" value="220" style="width:180px; margin-left:auto;"><span id="botFollowDistValue" style="min-width:48px; text-align:right; color:#d8b4fe;">220</span>`);
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuOtherBotsSection"
            }, (html) => {
                html.add(`<span class="menuLabel">Bot Mills While Moving</span>`);
                html.checkBox({
                    id: "botMillsEnabled",
                    class: "checkB"
                });
            });
            HTML.addDiv({
                id: "menuOtherVisualSection",
                class: "menuSection",
                appendID: "menuOther"
            }, (html) => {
                html.add(`<div class="menuSectionTitle"><span class="material-icons">palette</span><span>Visuals</span></div>`);
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuOtherVisualSection"
            }, (html) => {
                html.add(`<span class="menuLabel">Render Movement</span>`);
                html.select({
                    id: "predictType",
                    class: "Cselect",
                    option: {
                        "Disable Render": {
                            id: "disableRender",
                            selected: true
                        },
                        "X/Y and 2": {
                            id: "pre2",
                        },
                        "X/Y and 3": {
                            id: "pre3"
                        }
                    }
                });
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuOtherVisualSection"
            }, (html) => {
                html.add(`<span class="menuLabel">Render Placers</span>`);
                html.checkBox({
                    id: "placeVis",
                    class: "checkB",
                });
            });
            HTML.addDiv({
                class: "menuRow",
                appendID: "menuOtherVisualSection"
            }, (html) => {
                html.add(`<span class="menuLabel">Alternative Visuals</span>`);
                html.checkBox({
                    id: "anotherVisualToggle",
                    class: "checkB",
                    checked: config.anotherVisual,
                    onclick: "window.toggleVisual()"
                });
            });
        });
        HTML.addDiv({
            id: "menuVisual",
            class: "menuC",
            appendID: "menuHeadLine"
        }, (html) => {
            HTML.addDiv({
                id: "menuVisualSection",
                class: "menuSection",
                appendID: "menuVisual"
            }, (html) => {
                html.add(`<div class="menuSectionTitle"><span class="material-icons">visibility</span><span>Visual settings</span></div>`);
            });
        });
        HTML.addDiv({
            id: "menuMisc",
            class: "menuC",
            appendID: "menuHeadLine"
        }, (html) => {
            HTML.addDiv({
                id: "menuMiscSection",
                class: "menuSection",
                appendID: "menuMisc"
            }, (html) => {
                html.add(`<div class="menuSectionTitle"><span class="material-icons">tune</span><span>Misc settings</span></div>`);
            });
        });
    });

    let menuHeaderLine = getEl("menuHeadLine");
    let menuTabsNode = getEl("menuTabs");
    if (menuHeaderLine && menuTabsNode) {
        let firstPanel = menuHeaderLine.querySelector(".menuC");
        menuHeaderLine.insertBefore(menuTabsNode, firstPanel || null);
    }

    function addDedicatedConfigRows() {
        if (getEl("cfgSectionOffense")) return;

        const categoryPanels = {
            offense: "menuMain",
            defense: "menuConfig",
            visual: "menuVisual",
            misc: "menuMisc",
            bots: "menuOther"
        };

        const sections = {};
        Object.entries(categoryPanels).forEach(([category, panelId]) => {
            let panel = getEl(panelId);
            if (!panel) return;
            let section = document.createElement("div");
            section.id = `cfgSection${category.charAt(0).toUpperCase() + category.slice(1)}`;
            section.className = "menuSection";
            section.innerHTML = `<div class="menuSectionTitle">${category} toggles</div>`;
            panel.appendChild(section);
            sections[category] = section;
        });

        function categorizeConfig(configKey) {
            if (/Bot|Search|Clear|mode|setup/i.test(configKey)) return "bots";
            if (/Render|show|Dir|Visual|Transparent|MoveLerp|volcanozones/i.test(configKey)) return "visual";
            if (/Anti|safe|Heal|Bull|Trap|Dodge|alwaysRev|assasin|Rev|HKH|antidagger|Bow/i.test(configKey)) return "defense";
            if (/Buy|Place|Replace|Push|Sync|Tick|Insta|attack|Spike|Qon|smartAutoInsta|predictTick|autoOneFrame|AutoMatePlace/i.test(configKey)) return "offense";
            return "misc";
        }

        function formatConfigLabel(configKey) {
            const customLabels = {
                TransparentRenderingOfPlayers: "Transparent Player Render",
                SmothMoveLerpPredicteons: "Smooth Move Lerp Predictions",
                AntiBowInsta: "Anti Bow Insta",
                AutoDodgeProjectiles: "Auto Dodge Projectiles",
                AntiSpikeTickTheartTry: "Anti Spike Tick Threat",
                AntiNewPlacedSpikeTheart: "Anti New Spike Threat",
                AutoMatePlace: "Auto Mate Place",
                autoUpgrade: "Auto Upgrade",
                AutoClear: "Auto Clear",
                killChat: "Kill Chat",
                autoSync: "Auto Sync",
                safeTick: "Safe Tick",
                assasinHat: "Assassin Hat",
                antidaggerrsrsrsr: "Anti Dagger",
                HKH: "HKH",
                autoOneFrame: "Auto One Frame",
                alwaysRev: "Always Rev",
                smartAutoInsta: "Smart Auto Insta",
                doSpikeOnReverse: "Spike On Reverse",
                autoQonSync: "Auto Q On Sync",
                autoBuy: "Auto Buy",
                autoBuyEquip: "Auto Buy Equip",
                autoPush: "Auto Push",
                revTick: "Rev Tick",
                spikeTick: "Spike Tick",
                predictTick: "Predict Tick",
                autoPlace: "Auto Place",
                autoReplace: "Auto Replace",
                antiTrap: "Anti Trap",
                slowOT: "Slow OT",
                attackDir: "Attack Direction",
                showDir: "Show Direction",
                noDir: "No Direction",
                autoRespawn: "Auto Respawn",
                volcanozones: "Volcano Zones",
                opHeal: "OP Heal",
                opAntiInsta: "OP Anti Insta",
                opPlaceAngles: "OP Place Angles"
            };
            if (customLabels[configKey]) return customLabels[configKey];
            return configKey
                .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
                .replace(/_/g, " ")
                .replace(/\s+/g, " ")
                .replace(/^./, (letter) => letter.toUpperCase());
        }

        Object.keys(configs).forEach((configKey) => {
            let category = categorizeConfig(configKey);
            let section = sections[category] || sections.misc;
            if (!section) return;

            let row = document.createElement("div");
            row.className = "menuRow";

            let label = document.createElement("span");
            label.className = "menuLabel";
            label.textContent = formatConfigLabel(configKey);

            let toggle = document.createElement("input");
            toggle.type = "checkbox";
            toggle.id = `cfg_${configKey}`;
            toggle.className = "checkB";
            toggle.checked = !!configs[configKey];
            toggle.addEventListener("change", function () {
                configs[configKey] = !!toggle.checked;
                saveVal(configKey, configs[configKey]);
            });

            row.appendChild(label);
            row.appendChild(toggle);
            section.appendChild(row);
        });
    }

    addDedicatedConfigRows();

    function setupCustomMenuSelects() {
        document.querySelectorAll("#menuDiv select.Cselect").forEach((selectEl) => {
            if (!selectEl || selectEl.dataset.customized === "1") return;
            selectEl.dataset.customized = "1";
            selectEl.classList.add("nativeHiddenSelect");

            let wrapper = document.createElement("div");
            wrapper.className = "menuCustomSelect";
            let display = document.createElement("div");
            display.className = "menuCustomSelectDisplay";
            let list = document.createElement("div");
            list.className = "menuCustomSelectList";

            let buildOptions = function () {
                list.innerHTML = "";
                Array.from(selectEl.options).forEach((optionEl) => {
                    let optionNode = document.createElement("div");
                    optionNode.className = "menuCustomSelectOption" + (optionEl.selected ? " active" : "");
                    optionNode.textContent = optionEl.textContent;
                    optionNode.dataset.value = optionEl.value;
                    optionNode.addEventListener("click", function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        selectEl.value = optionEl.value;
                        Array.from(selectEl.options).forEach((opt) => opt.selected = (opt.value === optionEl.value));
                        display.textContent = optionEl.textContent;
                        list.querySelectorAll(".menuCustomSelectOption").forEach((node) => {
                            node.classList.toggle("active", node.dataset.value === optionEl.value);
                        });
                        wrapper.classList.remove("open");
                        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
                    });
                    list.appendChild(optionNode);
                });
                display.textContent = selectEl.options[selectEl.selectedIndex]?.textContent || "Select";
            };

            buildOptions();
            display.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                document.querySelectorAll("#menuDiv .menuCustomSelect.open").forEach((node) => {
                    if (node !== wrapper) node.classList.remove("open");
                });
                wrapper.classList.toggle("open");
            });

            wrapper.appendChild(display);
            wrapper.appendChild(list);
            selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
        });

        document.addEventListener("click", function () {
            document.querySelectorAll("#menuDiv .menuCustomSelect.open").forEach((node) => node.classList.remove("open"));
        });
    }

    setupCustomMenuSelects();

    function getBotFollowDist() {
        const el = getEl("botFollowDist");
        const raw = el ? Number(el.value) : Number(getSavedVal("botFollowDist") || 220);
        return Math.max(100, Math.min(700, Number.isFinite(raw) ? raw : 220));
    }
    (function initBotFollowDistUI() {
        const slider = getEl("botFollowDist");
        const valueEl = getEl("botFollowDistValue");
        if (!slider || !valueEl) return;
        const stored = Number(getSavedVal("botFollowDist") || 220);
        const safe = Math.max(100, Math.min(700, Number.isFinite(stored) ? stored : 220));
        slider.value = safe;
        valueEl.textContent = String(safe);
        slider.addEventListener("input", function () {
            const val = Math.max(100, Math.min(700, Number(this.value) || 220));
            valueEl.textContent = String(val);
            saveVal("botFollowDist", val);
        });
    })();

    function toFancyTimeFormat(time) {
        let minutes = ~~((time % 3600) / 60);
        let seconds = ~~time % 60;
        if (seconds <= 9) seconds = `0${seconds}`;
        return `${minutes}:${seconds}`;
    }
    const songchat1 = new Audio("https://cdn.discordapp.com/attachments/1175772907931176991/1227645695796969492/Benzz_-_Je_Mappelle_Music_Video_GRM_Daily.mp3?ex=662fc0a6&is=662e6f26&hm=0b1c67270ba28a0298c01b1a3435bcc5e4aac496053bc3e9a73689cef70870bf&");
    let isPlaying = false;
    let currentPart = '';
    function toggleSong() {
        if (!isPlaying) {
            songchat1.play();
            songchat1.ontimeupdate = function (time) {
                let part = song[toFancyTimeFormat(Math.round(this.currentTime | 0))];
                if (part && part !== currentPart) {
                    currentPart = part;
                    io.send("6", part);
                }
            };
            songchat1.onended = function () {
                if (isPlaying) {
                    songchat1.play();
                }
            };
            isPlaying = true;
        } else {
            songchat1.pause();
            isPlaying = false;
        }
    }
    document.addEventListener("keypress", function (e) {
        if (e.key === "C") {
            toggleSong();
        } else if (e.key === "r" || e.key === "R") {
            if (breaking || autobreakBuild || visAim || hold != null || aim[0] != null) {
                resetBreakState("manual_R_key");
                addChatLog("", "Emergency break reset activated", "#ff6b6b", false, true);
            }
        }
    });
    let menuChatDiv = document.createElement("div");
    menuChatDiv.id = "menuChatDiv";
    document.body.appendChild(menuChatDiv);
    menuChatDiv.style.opacity = "0";
    menuChatDiv.style.transition = "opacity 0.22s ease";

    HTML.set("menuChatDiv");
    HTML.setStyle(`
    position: relative;
    display: none;
    width: 100%;
`);

    HTML.resetHTML();

    HTML.setCSS(`
/* Keyframe Animations */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes glowPulse {
    0%, 100% {
        box-shadow:
            0 0 15px rgba(168, 85, 247, 0.4),
            0 0 30px rgba(88, 28, 135, 0.3),
            inset 0 0 10px rgba(168, 85, 247, 0.15);
    }
    50% {
        box-shadow:
            0 0 20px rgba(168, 85, 247, 0.6),
            0 0 40px rgba(88, 28, 135, 0.4),
            inset 0 0 15px rgba(168, 85, 247, 0.2);
    }
}

@keyframes fadePanelIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

.chDiv {
    width: 100%;
    min-width: 460px;
    max-width: 560px;
    box-sizing: border-box;
    padding: 18px;
    color: #e9d5ff;
    background: linear-gradient(180deg, rgba(16, 10, 29, 0.98), rgba(7, 8, 18, 0.96));
    border-radius: 22px;
    font-family: "Ubuntu", monospace;
    border: 1px solid rgba(168, 85, 247, 0.32);
    box-shadow:
        0 18px 34px rgba(0, 0, 0, 0.36),
        0 0 26px rgba(88, 28, 135, 0.16),
        inset 0 0 14px rgba(168, 85, 247, 0.06);
    backdrop-filter: blur(10px);
    animation: fadePanelIn 0.28s ease-out;
    transition: all 0.3s ease;
}

.chDiv:hover {
    border: 1px solid rgba(74, 222, 128, 0.62);
    box-shadow:
        0 14px 36px rgba(0, 0, 0, 0.36),
        0 0 28px rgba(74, 222, 128, 0.18),
        inset 0 0 16px rgba(168, 85, 247, 0.12);
}

.chHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(168, 85, 247, 0.14);
    color: #d8b4fe;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
}

.chMainDiv {
    font-family: "Ubuntu";
    font-size: 14px;
    height: 156px;
    overflow-y: scroll;
    overflow-x: hidden;
    padding-right: 6px;

    scrollbar-width: thin;
    scrollbar-color: rgba(168, 85, 247, 0.6) rgba(0, 0, 0, 0.2);

    user-select: none;

    /* Smooth Scrolling */
    scroll-behavior: smooth;
}

/* Scrollbar styling */
.chMainDiv::-webkit-scrollbar {
    width: 8px;
}

.chMainDiv::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
}

.chMainDiv::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #a855f7, #6b21a8);
    border-radius: 10px;
    transition: background 0.3s ease;
}

.chMainDiv::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #c084fc, #7e22ce);
}

.chMainBox {
    display: block;
    position: relative;
    left: auto;
    bottom: auto;
    width: 100%;
    max-width: 100%;
    height: 44px;
    margin-top: 12px;
    padding: 0 16px;
    box-sizing: border-box;
    background: rgba(7, 12, 21, 0.92);
    border-radius: 12px;
    color: rgba(233, 213, 255, 0.88);
    font-family: "Ubuntu";
    font-size: 13px;
    border: 1px solid rgba(168, 85, 247, 0.24);
    box-shadow:
        inset 0 0 10px rgba(168, 85, 247, 0.12),
        0 0 12px rgba(88, 28, 135, 0.1);
    transition: all 0.3s ease;
    outline: none;
}

.chMainBox:focus {
    border: 1px solid rgba(192, 132, 252, 0.9);
    box-shadow:
        0 0 20px rgba(168, 85, 247, 0.7),
        0 0 40px rgba(88, 28, 135, 0.4),
        inset 0 0 10px rgba(168, 85, 247, 0.3);
    background: rgba(30, 0, 60, 0.95);
    color: #f3e8ff;
}

.chMainBox.fakeFocus {
    border: 1px solid rgba(192, 132, 252, 0.9);
    box-shadow:
        0 0 20px rgba(168, 85, 247, 0.7),
        0 0 40px rgba(88, 28, 135, 0.4),
        inset 0 0 10px rgba(168, 85, 247, 0.3);
    background: rgba(30, 0, 60, 0.95);
    color: #f3e8ff;
}

.chMainBox::placeholder {
    color: rgba(168, 85, 247, 0.5);
    transition: color 0.3s ease;
}

.chMainBox:focus::placeholder {
    color: rgba(192, 132, 252, 0.7);
}

.chMainBox.fakeFocus::placeholder {
    color: rgba(192, 132, 252, 0.7);
}

@keyframes pandoraCaretBlink {
    0%, 45% { opacity: 1; }
    50%, 100% { opacity: 0; }
}

/* Message styling */
.menuChDisp {
    display: block;
    padding: 4px 0;
    margin: 0;
    border-radius: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    animation: fadeInUp 0.3s ease-out;
    transition: all 0.2s ease;
}

.menuChDisp:hover {
    background: transparent;
}

.menuChMeta {
    display: inline;
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.04em;
}

.menuChTime {
    color: #c084fc;
}

.menuChName {
    font-weight: 700;
}

.menuChSep {
    color: rgba(255, 255, 255, 0.22);
}

.menuChBody {
    color: #f3e8ff;
    line-height: 1.45;
    white-space: normal;
    word-break: break-word;
    display: inline;
}
`);

    HTML.startDiv({
        id: "mChDiv",
        class: "chDiv"
    }, (html) => {
        HTML.addDiv({
            id: "mChHeader",
            class: "chHeader",
            appendID: "mChDiv"
        }, (html) => {
            html.add(`wow Chatlog`);
        });
        HTML.addDiv({
            id: "mChMain",
            class: "chMainDiv",
            appendID: "mChDiv"
        }, (html) => { });
        html.text({
            id: "mChBox",
            class: "chMainBox",
            placeHolder: `Press Enter to send or use /help`
        });
    });

    let menuChats = getEl("mChMain");
    let menuChatBox = getEl("mChBox");
    let menuCBFocus = false;
    let menuChatOpen = false;
    let menuChCounts = 0;
    let menuChatFadeTimer = null;
    let suppressMenuChatRefocusUntil = 0;
    let menuChatFocusSink = document.createElement("button");
    let menuChatConsumeEnterKeyUp = false;
    menuChatFocusSink.type = "button";
    menuChatFocusSink.tabIndex = -1;
    menuChatFocusSink.setAttribute("aria-hidden", "true");
    menuChatFocusSink.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(menuChatFocusSink);

    function showMenuChat() {
        clearTimeout(menuChatFadeTimer);
        menuChatDiv.style.display = "block";
        requestAnimationFrame(() => {
            menuChatDiv.style.opacity = "1";
        });
    }

    function scheduleMenuChatFade(delay) {
        clearTimeout(menuChatFadeTimer);
        menuChatFadeTimer = setTimeout(() => {
            if (isMenuChatFocused()) return;
            menuCBFocus = false;
            menuChatOpen = false;
            if (menuChatBox) {
                menuChatBox.classList.remove("fakeFocus");
                menuChatBox.value = "";
            }
            menuChatDiv.style.opacity = "0";
            setTimeout(() => {
                if (!isMenuChatFocused() && menuChatDiv.style.opacity == "0") {
                    menuChatDiv.style.display = "none";
                }
            }, 220);
        }, delay || 3000);
    }

    function getMenuChatNameColor(sid, fallbackColor) {
        if (sid != null && sid !== "") {
            let sidNum = Number(sid);
            if (!Number.isNaN(sidNum)) {
                if (player && sidNum === player.sid) return "#7CFF6B";
                let chatPlayer = typeof findPlayerBySID == "function" ? findPlayerBySID(sidNum) : null;
                if (chatPlayer && player && typeof chatPlayer.isTeam == "function" && chatPlayer.isTeam(player)) return "#59B7FF";
                if (chatPlayer) return "#FF6B6B";
            }
        }
        return fallbackColor || "#FFD76B";
    }

    function sanitizeMenuChatValue(value) {
        value = value == null ? "" : String(value);
        if (typeof DOMPurify != "undefined") {
            value = DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
        }
        return value.replace(/\n/g, "<br>");
    }

    function buildMenuChatEntry(name, message, color, noTimer, sid) {
        let time = new Date();
        let min = time.getMinutes();
        let hour = time.getHours();
        let displayName = name ? String(name) : "";
        let displaySid = sid;

        if ((displaySid == null || displaySid === "") && displayName) {
            let sidMatch = displayName.match(/\[(.*?)\]/);
            if (sidMatch) {
                displaySid = sidMatch[1];
            }
        }
        if (displayName) {
            displayName = displayName.replace(/\[.*?\]/g, "").trim();
        }
        let line = ``;
        let nameColor = getMenuChatNameColor(displaySid, color);
        if (!noTimer) {
            line += `<span class="menuChTime">${(hour < 10 ? '0' : '') + hour}:${(min < 10 ? '0' : '') + min}</span>`;
        }
        if (displaySid != null && displaySid !== "") {
            line += `${line ? '<span class="menuChSep"> • </span>' : ''}<span class="menuChSid" style="color: ${nameColor}; font-weight: 700;">[${sanitizeMenuChatValue(displaySid)}]</span>`;
        }
        if (displayName) {
            line += `${line ? ' ' : ''}<span class="menuChName" style="color: ${nameColor};">${sanitizeMenuChatValue(displayName)}</span>`;
        }
        if (message) {
            line += `${(displayName || (displaySid != null && displaySid !== "")) ? '<span class="menuChSep" style="color:#ffffff;">:</span> ' : ''}<span class="menuChBody" style="color: ${color};">${sanitizeMenuChatValue(message)}</span>`;
        }
        return `<div class="menuChMeta">${line}</div>`;
    }

    function bindMenuChatBoxEvents() {
        if (!menuChatBox || menuChatBox.dataset.boundMenuChat === "1") return;
        menuChatBox.dataset.boundMenuChat = "1";
        menuChatBox.value = "";
        menuChatBox.addEventListener("focus", () => {
            menuCBFocus = true;
            if (chatHolder) {
                chatHolder.style.display = "none";
                chatHolder.style.pointerEvents = "none";
                chatHolder.style.opacity = "0";
            }
            showMenuChat();
        });
        menuChatBox.addEventListener("blur", () => {
            menuCBFocus = false;
            scheduleMenuChatFade(3000);
        });
        menuChatBox.addEventListener("input", () => {
            showMenuChat();
        });
        menuChatBox.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                sendMenuChatInput();
            }
        });
    }
    function getMenuChatDraft() {
        return (menuChatBox?.value || "").replace(/▏$/, "");
    }
    function renderMenuChatDraft() {
        if (!menuChatBox) return;
        const draft = getMenuChatDraft();
        menuChatBox.value = menuCBFocus ? draft + "▏" : draft;
    }
    function hardResetMenuChatBox() {
        if (!menuChatBox || !menuChatBox.parentNode) return;
        const fresh = menuChatBox.cloneNode(true);
        fresh.value = "";
        fresh.disabled = true;
        fresh.tabIndex = -1;
        menuChatBox.parentNode.replaceChild(fresh, menuChatBox);
        menuChatBox = fresh;
        menuCBFocus = false;
        bindMenuChatBoxEvents();
    }
    bindMenuChatBoxEvents();

    function addMenuChText(name, message, color, noTimer, sid) {
        HTML.set("menuChatDiv");
        color = color || "white";
        showMenuChat();
        HTML.addDiv({ class: "menuChDisp", appendID: "mChMain" }, (html) => {
            html.add(buildMenuChatEntry(name, message, color, noTimer, sid));
        });
        menuChats.scrollTop = menuChats.scrollHeight;
        menuChCounts++;
        scheduleMenuChatFade(3000);
    }

    function chch(name, message, color, noTimer, sid) {
        HTML.set("menuChatDiv");
        color = color || "white";
        showMenuChat();
        HTML.addDiv({ class: "menuChDisp", appendID: "mChMain" }, (html) => {
            html.add(buildMenuChatEntry(name, message, color, noTimer, sid));
        });
        menuChats.scrollTop = menuChats.scrollHeight;
        menuChCounts++;
        scheduleMenuChatFade(3000);
    }

    function resetMenuChText() {
        menuChats.innerHTML = ``;
        menuChCounts = 0;
        addMenuChText(null, "/mute /unmute", "white", 1)
    }
    resetMenuChText();
    let menuIndex = 0;
    let menus = ["menuMain", "menuConfig", "menuVisual", "menuMisc", "menuOther"];
    let menuTabButtons = ["menuTab0", "menuTab1", "menuTab2", "menuTab3", "menuTab4"];
    let isMenuOpen = false;
    let menuCloseTimer = null;

    function applyMenuVisibility() {
        clearTimeout(menuCloseTimer);
        if (isMenuOpen) {
            menuDiv.style.display = "grid";
            menuDiv.style.pointerEvents = "auto";
            requestAnimationFrame(() => {
                menuDiv.style.opacity = "1";
                menuDiv.style.transform = "translate(-50%, -50%) scale(1)";
            });
        } else {
            menuDiv.style.opacity = "0";
            menuDiv.style.pointerEvents = "none";
            menuDiv.style.transform = "translate(-50%, -50%) scale(0.96)";
            menuCloseTimer = setTimeout(() => {
                if (!isMenuOpen) menuDiv.style.display = "none";
            }, 180);
        }
        menuDiv.classList.toggle("open", isMenuOpen);
        menuDiv.classList.toggle("closed", !isMenuOpen);
        menuDiv.setAttribute("aria-hidden", isMenuOpen ? "false" : "true");
        if (isMenuOpen && !menuDiv.querySelector(".menuTabActive")) {
            window.setMenuTab(menuIndex);
        }
    }

    function setMenuOpen(nextState) {
        isMenuOpen = !!nextState;
        applyMenuVisibility();
    }

    function toggleMenu() {
        setMenuOpen(!isMenuOpen);
    }
    window.setMenuTab = function (tabIndex) {
        menuIndex = ((tabIndex % menus.length) + menus.length) % menus.length;
        for (let i = 0; i < menus.length; i++) {
            let menuPanel = getEl(menus[i]);
            if (menuPanel) {
                menuPanel.classList.toggle("menuCActive", i == menuIndex);
            }
            let tabButton = getEl(menuTabButtons[i]);
            if (tabButton) {
                tabButton.classList.toggle("menuTabActive", i == menuIndex);
            }
        }
    };
    window.changeMenu = function () {
        window.setMenuTab(menuIndex + 1);
    };
    window.toggleMenu = function () {
        toggleMenu();
    };
    window.setMenuOpen = function (nextState) {
        setMenuOpen(nextState);
    };
    window.closeMenu = function () {
        setMenuOpen(false);
    };
    window.setMenuTab(0);
    applyMenuVisibility();

    let pandoraHudStack = document.createElement("div");
    pandoraHudStack.id = "pandoraHudStack";
    pandoraHudStack.style = `
    position: absolute;
    top: 10px;
    left: 20px;
    width: 390px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 15;
    pointer-events: none;
`;
    getEl("gameUI").appendChild(pandoraHudStack);

    let mStatus = document.createElement("div");
    mStatus.id = "status";
    pandoraHudStack.appendChild(mStatus);
    HTML.set("status");
    HTML.setStyle(`
    display: block;
    position: relative;
    width: 100%;
    color: #c084fc;
    font: 15px HammerSmith One;
`);
    HTML.resetHTML();
    HTML.setCSS(`
    #pandoraHudStack > div {
        pointer-events: auto;
    }
    .sizing {
        font-size: 15px;
        line-height: 1.85;
        color: #d8b4fe;
        position: relative;
        padding: 30px 16px 14px;
        border-radius: 18px;
        border: 1px solid rgba(168, 85, 247, 0.45);
        background: linear-gradient(180deg, rgba(19, 12, 34, 0.96), rgba(7, 10, 20, 0.92));
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.32), 0 0 22px rgba(126, 34, 206, 0.18), inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(10px);
    }
    .sizing::before {
        content: "";
        display: none;
    }
    #uehmod {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-start;
        width: fit-content;
        max-width: 240px;
        padding: 14px 14px 12px;
        line-height: 1.4;
        gap: 3px;
    }
    #uehmod .hudRow {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }
    .mod {
        font-size: 15px;
        display: inline-block;
        color: #f5d0fe;
        font-weight: 700;
        text-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
    }
`);
    HTML.startDiv({
        id: "uehmod",
        class: "sizing"
    }, (html) => {
        html.add(`<div class="hudRow">Ping: <span id="pingFps" class="mod">??ms | ??fps</span></div>`);
        html.add(`<div class="hudRow">Packet: <span id="packetStatus" class="mod">0/s</span></div>`);
    });
    pandoraHudStack.appendChild(menuChatDiv);

    /*function modLog() {
                let logs = [];
                for (let i = 0; i < arguments.length; i++) {
                    logs.push(arguments[i]);
                }
                getEl("modLog").innerHTML = logs;
            }*/
    let WS = undefined;
    let socketID = undefined;

    let useWasd = false;
    let secPacket = 0;
    let secMax = 120;
    let secTime = 1000;
    let firstSend = {
        sec: false
    };
    let game = {
        tick: 0,
        tickQueue: [],
        tickBase: function (set, tick) {
            if (this.tickQueue[this.tick + tick]) {
                this.tickQueue[this.tick + tick].push(set);
            } else {
                this.tickQueue[this.tick + tick] = [set];
            }
        },
        tickRate: (1000 / config.serverUpdateRate),
        tickSpeed: 0,
        lastTick: performance.now()
    };
    let modConsole = [];

    let dontSend = false;
    let fpsTimer = {
        last: 0,
        time: 0,
        ltime: 0
    }
    let lastMoveDir = undefined;
    let lastsp = ["cc", 1, "__proto__"];

    WebSocket.prototype.nsend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (message) {
        if (!WS) {
            WS = this;
            WS.addEventListener("message", function (msg) {
                getMessage(msg);
            });
            WS.addEventListener("close", (event) => {
                if (event.code == 4001) {
                    window.location.reload();
                }
            });
        }
        if (WS == this) {
            dontSend = false;

            // EXTRACT DATA ARRAY:
            let data = new Uint8Array(message);
            let parsed = window.msgpack.decode(data);
            let type = parsed[0];
            data = parsed[1];

            // SEND MESSAGE:
            if (type == "6") {

                if (data[0]) {
                    // ANTI PROFANITY:
                    let profanity = ["cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard",];
                    let tmpString;
                    profanity.forEach((profany) => {
                        if (data[0].indexOf(profany) > -1) {
                            tmpString = "";
                            for (let i = 0; i < profany.length; ++i) {
                                if (i == 1) {
                                    tmpString += String.fromCharCode(0);
                                }
                                tmpString += profany[i];
                            }
                            let re = new RegExp(profany, "g");
                            data[0] = data[0].replace(re, tmpString);
                        }
                    });

                    // FIX CHAT:
                    data[0] = data[0].slice(0, 30);
                }

            } else if (type == "L") {
                // MAKE SAME CLAN:
                data[0] = data[0] + (String.fromCharCode(0).repeat(7));
                data[0] = data[0].slice(0, 7);
            } else if (type == "M") {
                // APPLY CYAN COLOR:
                data[0].name = data[0].name == "" ? "unknown" : data[0].name;
                data[0].moofoll = true;
                data[0].skin = data[0].skin == 10 ? "__proto__" : data[0].skin;
                lastsp = [data[0].name, data[0].moofoll, data[0].skin];
            } else if (type == "D") {
                if ((my.lastDir == data[0]) || [null, undefined].includes(data[0])) {
                    dontSend = true;
                } else {
                    my.lastDir = data[0];
                }
            } else if (type == "d") {
                if (!data[2]) {
                    dontSend = true;
                } else {
                    if (![null, undefined].includes(data[1])) {
                        my.lastDir = data[1];
                    }
                }
            } else if (type == "K") {
                if (!data[1]) {
                    dontSend = true;
                }
            } else if (type == "S") {
                instaC.wait = !instaC.wait;
                dontSend = true;
            } else if (type == "a") {
                if (data[1]) {
                    if (player.moveDir == data[0]) {
                        dontSend = true;
                    } else {
                        player.moveDir = data[0];
                        if (player.moveDir) {
                            player.moveTime = Date.now();
                        }
                    }
                } else {
                    dontSend = true;
                }
            }
            if (!dontSend) {
                let binary = window.msgpack.encode([type, data]);
                this.nsend(binary);

                // START COUNT:
                if (!firstSend.sec) {
                    firstSend.sec = true;
                    setTimeout(() => {
                        firstSend.sec = false;
                        secPacket = 0;
                    }, secTime);
                }

                secPacket++;
            }
        } else {
            this.nsend(message);
        }
    }

    function packet(type) {
        // EXTRACT DATA ARRAY:
        let data = Array.prototype.slice.call(arguments, 1);

        // SEND MESSAGE:
        let binary = window.msgpack.encode([type, data]);
        WS.send(binary);
    }

    function origPacket(type) {
        // EXTRACT DATA ARRAY:
        let data = Array.prototype.slice.call(arguments, 1);

        // SEND MESSAGE:
        let binary = window.msgpack.encode([type, data]);
        WS.nsend(binary);
    }

    window.leave = function () {
        origPacket("kys", {
            "frvr is so bad": true,
            "sidney is too good": true,
            "dev are too weak": true,
        });
    };

    //...lol
    let io = {
        send: packet
    };

    function getMessage(message) {
        let data = new Uint8Array(message.data);
        let parsed = window.msgpack.decode(data);
        let type = parsed[0];
        data = parsed[1];
        let events = {
            A: setInitData, // id: setInitData,
            //B: disconnect,
            C: setupGame, // 1: setupGame,
            D: addPlayer, // 2: addPlayer,
            E: removePlayer, // 4: removePlayer,
            a: updatePlayers, // 33: updatePlayers,
            G: updateLeaderboard, // 5: updateLeaderboard,here
            H: loadGameObject, // 6: loadGameObject,
            I: loadAI, // a: loadAI,
            J: animateAI, // aa: animateAI,
            K: gatherAnimation, // 7: gatherAnimation,
            L: wiggleGameObject, // 8: wiggleGameObject,
            M: shootTurret, // sp: shootTurret,
            N: updatePlayerValue, // 9: updatePlayerValue,
            O: updateHealth, // h: updateHealth,//here
            P: killPlayer, // 11: killPlayer,
            Q: killObject, // 12: killObject,
            R: killObjects, // 13: killObjects,
            S: updateItemCounts, // 14: updateItemCounts,
            T: updateAge, // 15: updateAge,
            U: updateUpgrades, // 16: updateUpgrades,
            V: updateItems, // 17: updateItems,
            X: addProjectile, // 18: addProjectile,
            Y: remProjectile, // 19: remProjectile,
            //Z: serverShutdownNotice,
            //0: addAlliance,
            //1: deleteAlliance,
            2: allianceNotification, // an: allianceNotification,
            3: setPlayerTeam, // st: setPlayerTeam,
            4: setAlliancePlayers, // sa: setAlliancePlayers,
            5: updateStoreItems, // us: updateStoreItems,
            6: receiveChat, // ch: receiveChat,
            7: updateMinimap, // mm: updateMinimap,
            8: showText, // t: showText,
            9: pingMap, // p: pingMap,
            0: pingSocketResponse,
        };
        if (type == "io-init") {
            socketID = data[0];
        } else {
            if (events[type]) {
                events[type].apply(undefined, data);
            }
        }
    }

    // MATHS:
    Math.lerpAngle = function (value1, value2, amount) {
        let difference = Math.abs(value2 - value1);
        if (difference > Math.PI) {
            if (value1 > value2) {
                value2 += Math.PI * 2;
            } else {
                value1 += Math.PI * 2;
            }
        }
        let value = value2 + ((value1 - value2) * amount);
        if (value >= 0 && value <= Math.PI * 2) return value;
        return value % (Math.PI * 2);
    };

    // REOUNDED RECTANGLE:
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        if (r < 0)
            r = 0;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };

    // GLOBAL VALUES:
    function resetMoveDir() {
        keys = {};
        io.send("e");
    }

    let allChats = [];
    let ticks = {
        tick: 0,
        delay: 0,
        time: [],
        manage: [],
    };
    let ais = [];
    let players = [];
    let alliances = [];
    let alliancePlayers = [];
    let allianceNotifications = [];
    let gameObjects = [];
    let liztobj = [];
    let projectiles = [];
    let deadPlayers = [];

    let breakObjects = [];

    let player;
    let playerSID;
    let tmpObj;

    let enemy = [];
    let nears = [];
    let near = [];

    let my = {
        healed: false,
        reloaded: false,
        waitHit: 0,
        autoAim: false,
        revAim: false,
        ageInsta: true,
        reSync: false,
        bullTick: 0,
        anti0Tick: 0,
        antiSync: false,
        safePrimary: function (tmpObj) {
            return [0, 8].includes(tmpObj.primaryIndex);
        },
        safeSecondary: function (tmpObj) {
            return [10, 11, 14].includes(tmpObj.secondaryIndex);
        },
        lastDir: 0,
        autoPush: false,
        pushData: {}
    }

    // FIND OBJECTS BY ID/SID:
    function findID(tmpObj, tmp) {
        return tmpObj.find((THIS) => THIS.id == tmp);
    }

    function findSID(tmpObj, tmp) {
        return tmpObj.find((THIS) => THIS.sid == tmp);
    }

    function findPlayerByID(id) {
        return findID(players, id);
    }

    function findPlayerBySID(sid) {
        return findSID(players, sid);
    }

    function findAIBySID(sid) {
        return findSID(ais, sid);
    }

    function findObjectBySid(sid) {
        return findSID(gameObjects, sid);
    }

    function findProjectileBySid(sid) {
        return findSID(gameObjects, sid);
    }

    let gameName = getEl("gameName");
    gameName.innerText = "";
    let adCard = getEl("adCard");
    adCard.remove();
    let promoImageHolder = getEl("promoImgHolder");
    promoImageHolder.remove();

    let chatButton = getEl("chatButton");
    chatButton.remove();
    let gameCanvas = getEl("gameCanvas");
    let mainContext = gameCanvas.getContext("2d");
    let be = gameCanvas.getContext("2d");
    let mapDisplay = getEl("mapDisplay");
    let mapContext = mapDisplay.getContext("2d");
    mapDisplay.width = 300;
    mapDisplay.height = 300;
    let storeMenu = getEl("storeMenu");
    let storeHolder = getEl("storeHolder");
    let upgradeHolder = getEl("upgradeHolder");
    let upgradeCounter = getEl("upgradeCounter");
    let chatBox = getEl("chatBox");
    chatBox.autocomplete = "off";
    chatBox.style.textAlign = "center";
    chatBox.style.width = "18em";
    let chatHolder = getEl("chatHolder");
    if (gameCanvas) {
        gameCanvas.tabIndex = -1;
    }
    let customMenuChatEnabled = getSavedVal("customMenuChatEnabled");
    customMenuChatEnabled = customMenuChatEnabled == null ? true : customMenuChatEnabled === "true";
    function releaseMenuChatFocus() {
        if (document.activeElement && typeof document.activeElement.blur === "function") {
            document.activeElement.blur();
        }
        if (menuChatBox) {
            menuChatBox.blur();
            menuChatBox.setAttribute("readonly", "readonly");
            menuChatBox.disabled = true;
            menuChatBox.tabIndex = -1;
        }
        if (chatBox) {
            chatBox.blur();
        }
        try {
            menuChatFocusSink.focus();
        } catch (e) {
        }
        if (gameCanvas && typeof gameCanvas.focus === "function") {
            gameCanvas.focus();
        } else if (document.body && typeof document.body.focus === "function") {
            document.body.focus();
        }
    }
    function applyNativeChatVisibility(enabled) {
        if (chatHolder) {
            chatHolder.style.pointerEvents = enabled ? "auto" : "none";
            chatHolder.style.opacity = enabled ? "1" : "0.01";
            chatHolder.style.transform = enabled ? "scale(1)" : "scale(0.01)";
            chatHolder.style.position = enabled ? "" : "absolute";
            chatHolder.style.left = enabled ? "" : "-9999px";
            chatHolder.style.top = enabled ? "" : "-9999px";
            chatHolder.style.display = enabled ? "block" : "none";
        }
        if (chatBox) {
            chatBox.style.opacity = enabled ? "1" : "0.01";
            chatBox.style.width = enabled ? "18em" : "1px";
            chatBox.style.height = enabled ? "" : "1px";
            chatBox.style.pointerEvents = enabled ? "auto" : "none";
        }
    }
    if (chatHolder) {
        applyNativeChatVisibility(!customMenuChatEnabled);
    }
    let actionBar = getEl("actionBar");
    let leaderboardData = getEl("leaderboardData");
    let itemInfoHolder = getEl("itemInfoHolder");
    let menuCardHolder = getEl("menuCardHolder");
    let mainMenu = getEl("mainMenu");
    getEl("mainMenu").style.backgroundImage = "url('')";
    let diedText = getEl("diedText");
    let screenWidth;
    let screenHeight;
    let maxScreenWidth = config.maxScreenWidth;
    let maxScreenHeight = config.maxScreenHeight;
    let pixelDensity = 1;
    let delta;
    let now;
    let lastUpdate = performance.now();
    let camX;
    let camY;
    let tmpDir;
    let mouseX = 0;
    let mouseY = 0;
    let allianceMenu = getEl("allianceMenu");
    let waterMult = 1;
    let waterPlus = 0;

    let outlineColor = "#525252";
    let darkOutlineColor = "#3d3f42";
    let outlineWidth = 5.5;

    let firstSetup = true;
    let keys = {};
    let moveKeys = {
        87: [0, -1],
        38: [0, -1],
        83: [0, 1],
        40: [0, 1],
        65: [-1, 0],
        37: [-1, 0],
        68: [1, 0],
        39: [1, 0],
    };
    let attackState = 0;
    let inGame = false;

    let macro = {};
    let mills = {
        place: 0,
        placeSpawnPads: 0,
        old: null,
        lastPlaceTick: -1,
        reset() {
            this.old = null;
            this.lastPlaceTick = -1;
        }
    };
    let lastDir;

    let lastLeaderboardData = [];
    // ON LOAD:
    let inWindow = true;
    window.onblur = function () {
        inWindow = false;
    };
    window.onfocus = function () {
        inWindow = true;
        if (player && player.alive) {
            // resetMoveDir();
        }
    };
    let ms = {
        avg: 0,
        max: 0,
        min: 0,
        delay: 0
    }
    function pingSocketResponse() {
        let pingTime = window.pingTime;
        const pingDisplay = document.getElementById("pingDisplay")
        pingDisplay.innerText = "Ping: " + pingTime + " ms`";
        if (pingTime > ms.max || isNaN(ms.max)) {
            ms.max = pingTime;
        }
        if (pingTime < ms.min || isNaN(ms.min)) {
            ms.min = pingTime;
        }

        // if (pingTime >= 90) {
        //     doAutoQ = true;
        // } else {
        //     doAutoQ = false;
        // }
    }

    let placeVisible = [];

    /** CLASS CODES */


    class Utils {
        constructor() {

            // MATH UTILS:
            let mathABS = Math.abs,
                mathCOS = Math.cos,
                mathSIN = Math.sin,
                mathPOW = Math.pow,
                mathSQRT = Math.sqrt,
                mathATAN2 = Math.atan2,
                mathPI = Math.PI;

            let _this = this;

            // GLOBAL UTILS:
            this.round = function (n, v) {
                return Math.round(n * v) / v;
            };
            this.toRad = function (angle) {
                return angle * (mathPI / 180);
            };
            this.toAng = function (radian) {
                return radian / (mathPI / 180);
            };
            this.randInt = function (min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            };
            this.randFloat = function (min, max) {
                return Math.random() * (max - min + 1) + min;
            };
            this.lerp = function (value1, value2, amount) {
                return value1 + (value2 - value1) * amount;
            };
            this.decel = function (val, cel) {
                if (val > 0)
                    val = Math.max(0, val - cel);
                else if (val < 0)
                    val = Math.min(0, val + cel);
                return val;
            };
            this.getDistance = function (x1, y1, x2, y2) {
                return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
            };
            this.getDist = function (tmp1, tmp2, type1, type2) {
                if (!tmp1 || !tmp2) return Infinity;
                let tmpXY1 = {
                    x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                    y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
                };
                let tmpXY2 = {
                    x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                    y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
                };
                if (!Number.isFinite(tmpXY1.x) || !Number.isFinite(tmpXY1.y) || !Number.isFinite(tmpXY2.x) || !Number.isFinite(tmpXY2.y)) {
                    return Infinity;
                }
                return mathSQRT((tmpXY2.x -= tmpXY1.x) * tmpXY2.x + (tmpXY2.y -= tmpXY1.y) * tmpXY2.y);
            };
            this.getDirection = function (x1, y1, x2, y2) {
                return mathATAN2(y1 - y2, x1 - x2);
            };
            this.getDirect = function (tmp1, tmp2, type1, type2) {
                let tmpXY1 = {
                    x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                    y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
                };
                let tmpXY2 = {
                    x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                    y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
                };
                return mathATAN2(tmpXY1.y - tmpXY2.y, tmpXY1.x - tmpXY2.x);
            };
            this.getDirection = function (x1, y1, x2, y2) {
                return mathATAN2(y1 - y2, x1 - x2);
            };
            this.getDirect = function (tmp1, tmp2, type1, type2) {
                let tmpXY1 = {
                    x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                    y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
                };
                let tmpXY2 = {
                    x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                    y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
                };
                return mathATAN2(tmpXY1.y - tmpXY2.y, tmpXY1.x - tmpXY2.x);
            };
            this.getAngleDist = function (a, b) {
                let p = mathABS(b - a) % (mathPI * 2);
                return (p > mathPI ? (mathPI * 2) - p : p);
            };
            this.isNumber = function (n) {
                return (typeof n == "number" && !isNaN(n) && isFinite(n));
            };
            this.isString = function (s) {
                return (s && typeof s == "string");
            };
            this.kFormat = function (num) {
                return num > 999 ? (num / 1000).toFixed(1) + "k" : num;
            };
            this.sFormat = function (num) {
                let fixs = [{
                    num: 1e3,
                    string: "k"
                },
                {
                    num: 1e6,
                    string: "m"
                },
                {
                    num: 1e9,
                    string: "b"
                },
                {
                    num: 1e12,
                    string: "q"
                }
                ].reverse();
                let sp = fixs.find(v => num >= v.num);
                if (!sp) return num;
                return (num / sp.num).toFixed(1) + sp.string;
            };
            this.capitalizeFirst = function (string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
            };
            this.fixTo = function (n, v) {
                return parseFloat(n.toFixed(v));
            };
            this.sortByPoints = function (a, b) {
                return parseFloat(b.points) - parseFloat(a.points);
            };
            this.lineInRect = function (recX, recY, recX2, recY2, x1, y1, x2, y2) {
                let minX = x1;
                let maxX = x2;
                if (x1 > x2) {
                    minX = x2;
                    maxX = x1;
                }
                if (maxX > recX2)
                    maxX = recX2;
                if (minX < recX)
                    minX = recX;
                if (minX > maxX)
                    return false;
                let minY = y1;
                let maxY = y2;
                let dx = x2 - x1;
                if (Math.abs(dx) > 0.0000001) {
                    let a = (y2 - y1) / dx;
                    let b = y1 - a * x1;
                    minY = a * minX + b;
                    maxY = a * maxX + b;
                }
                if (minY > maxY) {
                    let tmp = maxY;
                    maxY = minY;
                    minY = tmp;
                }
                if (maxY > recY2)
                    maxY = recY2;
                if (minY < recY)
                    minY = recY;
                if (minY > maxY)
                    return false;
                return true;
            };
            this.containsPoint = function (element, x, y) {
                let bounds = element.getBoundingClientRect();
                let left = bounds.left + window.scrollX;
                let top = bounds.top + window.scrollY;
                let width = bounds.width;
                let height = bounds.height;

                let insideHorizontal = x > left && x < left + width;
                let insideVertical = y > top && y < top + height;
                return insideHorizontal && insideVertical;
            };
            this.mousifyTouchEvent = function (event) {
                let touch = event.changedTouches[0];
                event.screenX = touch.screenX;
                event.screenY = touch.screenY;
                event.clientX = touch.clientX;
                event.clientY = touch.clientY;
                event.pageX = touch.pageX;
                event.pageY = touch.pageY;
            };
            this.hookTouchEvents = function (element, skipPrevent) {
                let preventDefault = !skipPrevent;
                let isHovering = false;
                // let passive = window.Modernizr.passiveeventlisteners ? {passive: true} : false;
                let passive = false;
                element.addEventListener("touchstart", this.checkTrusted(touchStart), passive);
                element.addEventListener("touchmove", this.checkTrusted(touchMove), passive);
                element.addEventListener("touchend", this.checkTrusted(touchEnd), passive);
                element.addEventListener("touchcancel", this.checkTrusted(touchEnd), passive);
                element.addEventListener("touchleave", this.checkTrusted(touchEnd), passive);

                function touchStart(e) {
                    _this.mousifyTouchEvent(e);
                    window.setUsingTouch(true);
                    if (preventDefault) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (element.onmouseover)
                        element.onmouseover(e);
                    isHovering = true;
                }

                function touchMove(e) {
                    _this.mousifyTouchEvent(e);
                    window.setUsingTouch(true);
                    if (preventDefault) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (_this.containsPoint(element, e.pageX, e.pageY)) {
                        if (!isHovering) {
                            if (element.onmouseover)
                                element.onmouseover(e);
                            isHovering = true;
                        }
                    } else {
                        if (isHovering) {
                            if (element.onmouseout)
                                element.onmouseout(e);
                            isHovering = false;
                        }
                    }
                }

                function touchEnd(e) {
                    _this.mousifyTouchEvent(e);
                    window.setUsingTouch(true);
                    if (preventDefault) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (isHovering) {
                        if (element.onclick)
                            element.onclick(e);
                        if (element.onmouseout)
                            element.onmouseout(e);
                        isHovering = false;
                    }
                }
            };
            this.removeAllChildren = function (element) {
                while (element.hasChildNodes()) {
                    element.removeChild(element.lastChild);
                }
            };
            this.generateElement = function (config) {
                let element = document.createElement(config.tag || "div");

                function bind(configValue, elementValue) {
                    if (config[configValue])
                        element[elementValue] = config[configValue];
                }
                bind("text", "textContent");
                bind("html", "innerHTML");
                bind("class", "className");
                for (let key in config) {
                    switch (key) {
                        case "tag":
                        case "text":
                        case "html":
                        case "class":
                        case "style":
                        case "hookTouch":
                        case "parent":
                        case "children":
                            continue;
                        default:
                            break;
                    }
                    element[key] = config[key];
                }
                if (element.onclick)
                    element.onclick = this.checkTrusted(element.onclick);
                if (element.onmouseover)
                    element.onmouseover = this.checkTrusted(element.onmouseover);
                if (element.onmouseout)
                    element.onmouseout = this.checkTrusted(element.onmouseout);
                if (config.style) {
                    element.style.cssText = config.style;
                }
                if (config.hookTouch) {
                    this.hookTouchEvents(element);
                }
                if (config.parent) {
                    config.parent.appendChild(element);
                }
                if (config.children) {
                    for (let i = 0; i < config.children.length; i++) {
                        element.appendChild(config.children[i]);
                    }
                }
                return element;
            };
            this.checkTrusted = function (callback) {
                return function (ev) {
                    if (ev && ev instanceof Event && (ev && typeof ev.isTrusted == "boolean" ? ev.isTrusted : true)) {
                        callback(ev);
                    } else {
                        //console.error("Event is not trusted.", ev);
                    }
                };
            };
            this.randomString = function (length) {
                let text = "";
                let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                for (let i = 0; i < length; i++) {
                    text += possible.charAt(Math.floor(Math.random() * possible.length));
                }
                return text;
            };
            this.countInArray = function (array, val) {
                let count = 0;
                for (let i = 0; i < array.length; i++) {
                    if (array[i] === val) count++;
                }
                return count;
            };
            this.hexToRgb = function (hex) {
                return hex.slice(1).match(/.{1,2}/g).map(g => parseInt(g, 16));
            };
            this.getRgb = function (r, g, b) {
                return [r / 255, g / 255, b / 255].join(", ");
            };
        }
    };
    const textSpriteCache = new Map();
    const MAX_CACHE_SIZE = 50;

    function getTextSprite(char, scale, color) {
        const key = `${char}_${Math.round(scale)}_${color}`;

        if (textSpriteCache.has(key)) {
            return textSpriteCache.get(key);
        }

        if (textSpriteCache.size > MAX_CACHE_SIZE) {
            const firstKey = textSpriteCache.keys().next().value;
            textSpriteCache.delete(firstKey);
        }

        const padding = 30;
        const size = scale + padding * 2;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.font = `${scale}px Titan One`;

        const cx = size / 2;
        const cy = size / 2;

        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(142, 204, 255, 0.5)";

        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(61, 63, 66, 1)";
        ctx.strokeText(char, cx, cy);

        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(255, 255, 255, 1)";

        ctx.fillStyle = color;
        ctx.fillText(char, cx, cy);

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fillText(char, cx, cy - 1);

        textSpriteCache.set(key, canvas);
        return canvas;
    }

    class Animtext {
        constructor() {
            this.life = 0;
            this.digitData = [];
        }

        init(x, y, scale, speed, life, text, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.scale = scale;
            this.startScale = scale;
            this.speed = speed;
            this.life = life;
            this.text = String(text);
            this.maxLife = life;
            this.startTime = Date.now();
            this.maxScale = scale * 1.5;
            this.scaleSpeed = 0.7;
            this.ranX = (Math.random() - 0.5) * 2;
            this.alpha = 0;
            this.acc = 1;

            const digitDelay = 35;
            const digits = this.text.split('');
            const centerIndex = (digits.length - 1) / 2;

            this.digitData = [];

            for (let i = 0; i < digits.length; i++) {
                const offset = i - centerIndex;
                const baseAngle = offset * 0.3;
                const randomAngle = (Math.random() - 0.5) * 0.5;

                this.digitData.push({
                    char: digits[i],
                    angle: -Math.PI / 2 + baseAngle + randomAngle,
                    speed: 0.08 + Math.random() * 0.04,
                    rotationSpeed: (Math.random() - 0.5) * 0.003,
                    rotation: 0,
                    offsetX: 0,
                    offsetY: 0,
                    appearTime: i * digitDelay
                });
            }
        }

        update(delta) {
            if (this.life <= 0) return;

            this.life -= delta;

            const elapsed = Date.now() - this.startTime;

            for (let i = 0; i < this.digitData.length; i++) {
                const data = this.digitData[i];
                const digitElapsed = elapsed - data.appearTime;

                if (digitElapsed > 0) {
                    data.offsetX += Math.cos(data.angle) * data.speed * delta;
                    data.offsetY += Math.sin(data.angle) * data.speed * delta;
                    data.angle += 0.0008 * delta;
                    data.rotation += data.rotationSpeed * delta;
                }
            }

            this.y -= this.speed * delta * this.acc;
            this.acc -= delta / (this.maxLife / 2.5);
            if (this.acc < 0) this.acc = 0;

            if (this.life <= 200) {
                this.alpha = Math.max(0, this.alpha - delta / 300);
            } else if (this.alpha < 1) {
                this.alpha = Math.min(1, this.alpha + delta / 100);
            }

            this.x += this.ranX * delta * 0.01;

            this.scale += this.scaleSpeed * delta * 0.01;
            if (this.scale >= this.maxScale) {
                this.scale = this.maxScale;
                this.scaleSpeed *= -1;
            } else if (this.scale <= this.startScale) {
                this.scale = this.startScale;
                this.scaleSpeed = 0;
            }

            if (this.life <= 0) this.life = 0;
        }

        render(ctxt, xOff, yOff) {
            if (this.life <= 0 || this.alpha <= 0.01) return;

            const x = this.x - xOff;
            const y = this.y - yOff;
            const elapsed = Date.now() - this.startTime;
            const appearDuration = 100;
            const roundedScale = Math.round(this.scale);

            let totalWidth = this.digitData.length * roundedScale * 0.65;
            let currentX = x - totalWidth / 2;

            for (let i = 0; i < this.digitData.length; i++) {
                const data = this.digitData[i];
                const digitWidth = roundedScale * 0.65;
                const baseX = currentX + digitWidth / 2;
                const digitElapsed = elapsed - data.appearTime;

                if (digitElapsed < 0) {
                    currentX += digitWidth;
                    continue;
                }

                const appearProgress = Math.min(1, digitElapsed / appearDuration);
                const eased = 1 - Math.pow(1 - appearProgress, 3);

                const appearOffsetY = (1 - eased) * 25;
                const appearScale = 0.5 + 0.5 * eased;

                const finalX = baseX + data.offsetX;
                const finalY = y + appearOffsetY + data.offsetY;
                const finalScale = Math.round(roundedScale * appearScale);
                const digitAlpha = this.alpha * Math.min(1, appearProgress * 2);

                if (digitAlpha <= 0.01 || finalScale < 5) {
                    currentX += digitWidth;
                    continue;
                }

                const sprite = getTextSprite(data.char, finalScale, this.color);

                ctxt.save();
                ctxt.translate(finalX, finalY);
                ctxt.rotate(data.rotation);
                ctxt.globalAlpha = digitAlpha;
                ctxt.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
                ctxt.restore();

                currentX += digitWidth;
            }
        }
    }

    class TextManager {
        constructor() {
            this.texts = [];
        }

        update(delta, ctxt, xOff, yOff) {
            for (let i = 0; i < this.texts.length; i++) {
                const text = this.texts[i];
                if (text.life > 0) {
                    text.update(delta);
                    text.render(ctxt, xOff, yOff);
                }
            }
        }

        showText(x, y, scale, speed, life, text, color) {
            let tmpText = null;

            for (let i = 0; i < this.texts.length; i++) {
                if (this.texts[i].life <= 0) {
                    tmpText = this.texts[i];
                    break;
                }
            }

            if (!tmpText) {
                tmpText = new Animtext();
                this.texts.push(tmpText);
            }

            tmpText.init(x, y, scale, speed, life, text, color);
        }
    }

    let textManager = new TextManager();
    class GameObject {
        constructor(sid) {
            this.sid = sid;

            // INIT:
            this.init = function (x, y, dir, scale, type, data, owner) {
                data = data || {};
                this.sentTo = {};
                this.gridLocations = [];
                this.active = true;
                this.render = true;
                this.doUpdate = data.doUpdate;
                this.x = x;
                this.y = y;
                this.dir = dir;
                this.lastDir = dir;
                this.xWiggle = 0;
                this.yWiggle = 0;
                this.visScale = scale;
                this.scale = scale;
                this.type = type;
                this.id = data.id;
                this.owner = owner;
                this.name = data.name;
                this.isItem = (this.id != undefined);
                this.group = data.group;
                this.maxHealth = data.health;
                this.health = this.maxHealth;
                this.layer = 2;
                if (this.group != undefined) {
                    this.layer = this.group.layer;
                } else if (this.type == 0) {
                    this.layer = 3;
                } else if (this.type == 2) {
                    this.layer = 0;
                } else if (this.type == 4) {
                    this.layer = -1;
                }
                this.colDiv = data.colDiv || 1;
                this.blocker = data.blocker;
                this.ignoreCollision = data.ignoreCollision;
                this.dontGather = data.dontGather;
                this.hideFromEnemy = data.hideFromEnemy;
                this.friction = data.friction;
                this.projDmg = data.projDmg;
                this.dmg = data.dmg;
                this.pDmg = data.pDmg;
                this.pps = data.pps;
                this.zIndex = data.zIndex || 0;
                this.turnSpeed = data.turnSpeed;
                this.req = data.req;
                this.trap = data.trap;
                this.healCol = data.healCol;
                this.teleport = data.teleport;
                this.boostSpeed = data.boostSpeed;
                this.projectile = data.projectile;
                this.shootRange = data.shootRange;
                this.shootRate = data.shootRate;
                this.shootCount = this.shootRate;
                this.spawnPoint = data.spawnPoint;
                this.onNear = 0;
                this.breakObj = false;
                this.alpha = data.alpha || 1;
                this.maxAlpha = data.alpha || 1;
                this.damaged = 0;
            };

            // GET HIT:
            this.changeHealth = function (amount, doer) {
                this.health += amount;
                return (this.health <= 0);
            };

            // GET SCALE:
            this.getScale = function (sM, ig) {
                sM = sM || 1;
                return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4) ?
                    1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
            };

            // VISIBLE TO PLAYER:
            this.visibleToPlayer = function (player) {
                return !(this.hideFromEnemy) || (this.owner && (this.owner == player ||
                    (this.owner.team && player.team == this.owner.team)));
            };

            // UPDATE:
            this.update = function (delta) {
                if (this.active) {
                    if (this.xWiggle) {
                        this.xWiggle = Math.pow(0.99, delta);
                    }
                    if (this.yWiggle) {
                        this.yWiggle = Math.pow(0.99, delta);
                    }
                    if (this.turnSpeed && this.name === "spinning spikes") {
                        // for spinning shitty
                        this.dir += delta * 0.0005; // put actual number here
                    }
                } else if (this.alive) {
                    this.alpha -= delta / (200 / this.maxAlpha);
                    this.visScale += delta / (this.scale / 2.5);
                    if (this.alpha <= 0) {
                        this.alpha = 0;
                        this.alive = false;
                    }
                }
            };


            // CHECK TEAM:
            this.isTeamObject = function (tmpObj) {
                return this.owner == null ? true : (this.owner && tmpObj.sid == this.owner.sid || tmpObj.findAllianceBySid(this.owner.sid));
            };
        }
    }
    class Items {
        constructor() {
            // ITEM GROUPS:
            this.groups = [{
                id: 0,
                name: "food",
                layer: 0
            }, {
                id: 1,
                name: "walls",
                place: true,
                limit: 30,
                layer: 0
            }, {
                id: 2,
                name: "spikes",
                place: true,
                limit: 15,
                layer: 0
            }, {
                id: 3,
                name: "mill",
                place: true,
                limit: 7,
                layer: 1
            }, {
                id: 4,
                name: "mine",
                place: true,
                limit: 1,
                layer: 0
            }, {
                id: 5,
                name: "trap",
                place: true,
                limit: 6,
                layer: -1
            }, {
                id: 6,
                name: "booster",
                place: true,
                limit: 12,
                layer: -1
            }, {
                id: 7,
                name: "turret",
                place: true,
                limit: 2,
                layer: 1
            }, {
                id: 8,
                name: "watchtower",
                place: true,
                limit: 12,
                layer: 1
            }, {
                id: 9,
                name: "buff",
                place: true,
                limit: 4,
                layer: -1
            }, {
                id: 10,
                name: "spawn",
                place: true,
                limit: 1,
                layer: -1
            }, {
                id: 11,
                name: "sapling",
                place: true,
                limit: 2,
                layer: 0
            }, {
                id: 12,
                name: "blocker",
                place: true,
                limit: 3,
                layer: -1
            }, {
                id: 13,
                name: "teleporter",
                place: true,
                limit: 2,
                layer: -1
            }];

            // PROJECTILES:
            this.projectiles = [{
                indx: 0,
                layer: 0,
                src: "arrow_1",
                dmg: 25,
                speed: 1.6,
                scale: 103,
                range: 1000
            }, {
                indx: 1,
                layer: 1,
                dmg: 25,
                scale: 20
            }, {
                indx: 0,
                layer: 0,
                src: "arrow_1",
                dmg: 35,
                speed: 2.5,
                scale: 103,
                range: 1200
            }, {
                indx: 0,
                layer: 0,
                src: "arrow_1",
                dmg: 30,
                speed: 2,
                scale: 103,
                range: 1200
            }, {
                indx: 1,
                layer: 1,
                dmg: 16,
                scale: 20
            }, {
                indx: 0,
                layer: 0,
                src: "bullet_1",
                dmg: 50,
                speed: 3.6,
                scale: 160,
                range: 1400
            }];

            // WEAPONS:
            this.weapons = [{
                id: 0,
                type: 0,
                name: "tool hammer",
                desc: "tool for gathering all resources",
                src: "hammer_1",
                length: 140,
                width: 140,
                xOff: -3,
                yOff: 18,
                dmg: 25,
                range: 65,
                gather: 1,
                speed: 300
            }, {
                id: 1,
                type: 0,
                age: 2,
                name: "hand axe",
                desc: "gathers resources at a higher rate",
                src: "axe_1",
                length: 140,
                width: 140,
                xOff: 3,
                yOff: 24,
                dmg: 30,
                spdMult: 1,
                range: 70,
                gather: 2,
                speed: 400
            }, {
                id: 2,
                type: 0,
                age: 8,
                pre: 1,
                name: "great axe",
                desc: "deal more damage and gather more resources",
                src: "great_axe_1",
                length: 140,
                width: 140,
                xOff: -8,
                yOff: 25,
                dmg: 35,
                spdMult: 1,
                range: 75,
                gather: 4,
                speed: 400
            }, {
                id: 3,
                type: 0,
                age: 2,
                name: "short sword",
                desc: "increased attack power but slower move speed",
                src: "sword_1",
                iPad: 1.3,
                length: 130,
                width: 210,
                xOff: -8,
                yOff: 46,
                dmg: 35,
                spdMult: 0.85,
                range: 110,
                gather: 1,
                speed: 300
            }, {
                id: 4,
                type: 0,
                age: 8,
                pre: 3,
                name: "katana",
                desc: "greater range and damage",
                src: "samurai_1",
                iPad: 1.3,
                length: 130,
                width: 210,
                xOff: -8,
                yOff: 59,
                dmg: 40,
                spdMult: 0.8,
                range: 118,
                gather: 1,
                speed: 300
            }, {
                id: 5,
                type: 0,
                age: 2,
                name: "polearm",
                desc: "long range melee weapon",
                src: "spear_1",
                iPad: 1.3,
                length: 130,
                width: 210,
                xOff: -8,
                yOff: 53,
                dmg: 45,
                knock: 0.2,
                spdMult: 0.82,
                range: 142,
                gather: 1,
                speed: 700
            }, {
                id: 6,
                type: 0,
                age: 2,
                name: "bat",
                desc: "fast long range melee weapon",
                src: "bat_1",
                iPad: 1.3,
                length: 110,
                width: 180,
                xOff: -8,
                yOff: 53,
                dmg: 20,
                knock: 0.7,
                range: 110,
                gather: 1,
                speed: 300
            }, {
                id: 7,
                type: 0,
                age: 2,
                name: "daggers",
                desc: "really fast short range weapon",
                src: "dagger_1",
                iPad: 0.8,
                length: 110,
                width: 110,
                xOff: 18,
                yOff: 0,
                dmg: 20,
                knock: 0.1,
                range: 65,
                gather: 1,
                hitSlow: 0.1,
                spdMult: 1.13,
                speed: 100
            }, {
                id: 8,
                type: 0,
                age: 2,
                name: "stick",
                desc: "great for gathering but very weak",
                src: "stick_1",
                length: 140,
                width: 140,
                xOff: 3,
                yOff: 24,
                dmg: 1,
                spdMult: 1,
                range: 70,
                gather: 7,
                speed: 400
            }, {
                id: 9,
                type: 1,
                age: 6,
                name: "hunting bow",
                desc: "bow used for ranged combat and hunting",
                src: "bow_1",
                req: ["wood", 4],
                length: 120,
                width: 120,
                xOff: -6,
                yOff: 0,
                Pdmg: 25,
                projectile: 0,
                spdMult: 0.75,
                speed: 600
            }, {
                id: 10,
                type: 1,
                age: 6,
                name: "great hammer",
                desc: "hammer used for destroying structures",
                src: "great_hammer_1",
                length: 140,
                width: 140,
                xOff: -9,
                yOff: 25,
                dmg: 10,
                Pdmg: 10,
                spdMult: 0.88,
                range: 75,
                sDmg: 7.5,
                gather: 1,
                speed: 400
            }, {
                id: 11,
                type: 1,
                age: 6,
                name: "wooden shield",
                desc: "blocks projectiles and reduces melee damage",
                src: "shield_1",
                length: 120,
                width: 120,
                shield: 0.2,
                xOff: 6,
                yOff: 0,
                Pdmg: 0,
                spdMult: 0.7
            }, {
                id: 12,
                type: 1,
                age: 8,
                pre: 9,
                name: "crossbow",
                desc: "deals more damage and has greater range",
                src: "crossbow_1",
                req: ["wood", 5],
                aboveHand: true,
                armS: 0.75,
                length: 120,
                width: 120,
                xOff: -4,
                yOff: 0,
                Pdmg: 35,
                projectile: 2,
                spdMult: 0.7,
                speed: 700
            }, {
                id: 13,
                type: 1,
                age: 9,
                pre: 12,
                name: "repeater crossbow",
                desc: "high firerate crossbow with reduced damage",
                src: "crossbow_2",
                req: ["wood", 10],
                aboveHand: true,
                armS: 0.75,
                length: 120,
                width: 120,
                xOff: -4,
                yOff: 0,
                Pdmg: 30,
                projectile: 3,
                spdMult: 0.7,
                speed: 230
            }, {
                id: 14,
                type: 1,
                age: 6,
                name: "mc grabby",
                desc: "steals resources from enemies",
                src: "grab_1",
                length: 130,
                width: 210,
                xOff: -8,
                yOff: 53,
                dmg: 0,
                Pdmg: 0,
                steal: 250,
                knock: 0.2,
                spdMult: 1.05,
                range: 125,
                gather: 0,
                speed: 700
            }, {
                id: 15,
                type: 1,
                age: 9,
                pre: 12,
                name: "musket",
                desc: "slow firerate but high damage and range",
                src: "musket_1",
                req: ["stone", 10],
                aboveHand: true,
                rec: 0.35,
                armS: 0.6,
                hndS: 0.3,
                hndD: 1.6,
                length: 205,
                width: 205,
                xOff: 25,
                yOff: 0,
                Pdmg: 50,
                projectile: 5,
                hideProjectile: true,
                spdMult: 0.6,
                speed: 1500
            }];

            // ITEMS:
            this.list = [{
                group: this.groups[0],
                name: "apple",
                desc: "restores 20 health when consumed",
                req: ["food", 10],
                consume: function (doer) {
                    return doer.changeHealth(20, doer);
                },
                scale: 22,
                holdOffset: 15,
                healing: 20,
                itemID: 0,
                itemAID: 16,
            }, {
                age: 3,
                group: this.groups[0],
                name: "cookie",
                desc: "restores 40 health when consumed",
                req: ["food", 15],
                consume: function (doer) {
                    return doer.changeHealth(40, doer);
                },
                scale: 27,
                holdOffset: 15,
                healing: 40,
                itemID: 1,
                itemAID: 17,
            }, {
                age: 7,
                group: this.groups[0],
                name: "cheese",
                desc: "restores 30 health and another 50 over 5 seconds",
                req: ["food", 25],
                consume: function (doer) {
                    if (doer.changeHealth(30, doer) || doer.health < 100) {
                        doer.dmgOverTime.dmg = -10;
                        doer.dmgOverTime.doer = doer;
                        doer.dmgOverTime.time = 5;
                        return true;
                    }
                    return false;
                },
                scale: 27,
                holdOffset: 15,
                healing: 30,
                itemID: 2,
                itemAID: 18,
            }, {
                group: this.groups[1],
                name: "wood wall",
                desc: "provides protection for your village",
                req: ["wood", 10],
                projDmg: true,
                health: 380,
                scale: 50,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 3,
                itemAID: 19,
            }, {
                age: 3,
                group: this.groups[1],
                name: "stone wall",
                desc: "provides improved protection for your village",
                req: ["stone", 25],
                health: 900,
                scale: 50,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 4,
                itemAID: 20,
            }, {
                age: 7,
                group: this.groups[1],
                name: "castle wall",
                desc: "provides powerful protection for your village",
                req: ["stone", 35],
                health: 1500,
                scale: 52,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 5,
                itemAID: 21,
            }, {
                group: this.groups[2],
                name: "spikes",
                desc: "damages enemies when they touch them",
                req: ["wood", 20, "stone", 5],
                health: 400,
                dmg: 20,
                scale: 49,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5,
                itemID: 6,
                itemAID: 22,
                shadow: {
                    offsetX: 5, // Adjust the shadow's X offset as needed
                    offsetY: 5, // Adjust the shadow's Y offset as needed
                    blur: 20,  // Adjust the shadow's blur as needed
                    color: "rgba(0, 0, 0, 0.5)" // Adjust the shadow's color and transparency as needed
                }

            }, {
                age: 5,
                group: this.groups[2],
                name: "greater spikes",
                desc: "damages enemies when they touch them",
                req: ["wood", 30, "stone", 10],
                health: 500,
                dmg: 35,
                scale: 52,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5,
                itemID: 7,
                itemAID: 23,
            }, {
                age: 9,
                group: this.groups[2],
                name: "poison spikes",
                desc: "poisons enemies when they touch them",
                req: ["wood", 35, "stone", 15],
                health: 600,
                dmg: 30,
                pDmg: 5,
                scale: 52,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5,
                itemID: 8,
                itemAID: 24,
            }, {
                age: 9,
                group: this.groups[2],
                name: "spinning spikes",
                desc: "damages enemies when they touch them",
                req: ["wood", 30, "stone", 20],
                health: 500,
                dmg: 45,
                turnSpeed: 0.003,
                scale: 52,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5,
                itemID: 9,
                itemAID: 25,
            }, {
                group: this.groups[3],
                name: "windmill",
                desc: "generates gold over time",
                req: ["wood", 50, "stone", 10],
                health: 400,
                pps: 1,
                turnSpeed: 0.0016,
                spritePadding: 25,
                iconLineMult: 12,
                scale: 45,
                holdOffset: 20,
                placeOffset: 5,
                itemID: 10,
                itemAID: 26,
            }, {
                age: 5,
                group: this.groups[3],
                name: "faster windmill",
                desc: "generates more gold over time",
                req: ["wood", 60, "stone", 20],
                health: 500,
                pps: 1.5,
                turnSpeed: 0.0025,
                spritePadding: 25,
                iconLineMult: 12,
                scale: 47,
                holdOffset: 20,
                placeOffset: 5,
                itemID: 11,
                itemAID: 27,
            }, {
                age: 8,
                group: this.groups[3],
                name: "power mill",
                desc: "generates more gold over time",
                req: ["wood", 100, "stone", 50],
                health: 800,
                pps: 2,
                turnSpeed: 0.005,
                spritePadding: 25,
                iconLineMult: 12,
                scale: 47,
                holdOffset: 20,
                placeOffset: 5,
                itemID: 12,
                itemAID: 28,
            }, {
                age: 5,
                group: this.groups[4],
                type: 2,
                name: "mine",
                desc: "allows you to mine stone",
                req: ["wood", 20, "stone", 100],
                iconLineMult: 12,
                scale: 65,
                holdOffset: 20,
                placeOffset: 0,
                itemID: 13,
                itemAID: 29,
            }, {
                age: 5,
                group: this.groups[11],
                type: 0,
                name: "sapling",
                desc: "allows you to farm wood",
                req: ["wood", 150],
                iconLineMult: 12,
                colDiv: 0.5,
                scale: 110,
                holdOffset: 50,
                placeOffset: -15,
                itemID: 14,
                itemAID: 30,
            }, {
                age: 4,
                group: this.groups[5],
                name: "pit trap",
                desc: "pit that traps enemies if they walk over it",
                req: ["wood", 30, "stone", 30],
                trap: true,
                ignoreCollision: true,
                hideFromEnemy: true,
                health: 500,
                colDiv: 0.2,
                scale: 50,
                holdOffset: 20,
                placeOffset: -5,
                alpha: 0.6,
                itemID: 15,
                itemAID: 31,
            }, {
                age: 4,
                group: this.groups[6],
                name: "boost pad",
                desc: "provides boost when stepped on",
                req: ["stone", 20, "wood", 5],
                ignoreCollision: true,
                boostSpeed: 1.5,
                health: 150,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 16,
                itemAID: 32,
            }, {
                age: 7,
                group: this.groups[7],
                doUpdate: true,
                name: "turret",
                desc: "defensive structure that shoots at enemies",
                req: ["wood", 200, "stone", 150],
                health: 800,
                projectile: 1,
                shootRange: 700,
                shootRate: 2200,
                scale: 43,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 17,
                itemAID: 33,
            }, {
                age: 7,
                group: this.groups[8],
                name: "platform",
                desc: "platform to shoot over walls and cross over water",
                req: ["wood", 20],
                ignoreCollision: true,
                zIndex: 1,
                health: 300,
                scale: 43,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 18,
                itemAID: 34,
            }, {
                age: 7,
                group: this.groups[9],
                name: "healing pad",
                desc: "standing on it will slowly heal you",
                req: ["wood", 30, "food", 10],
                ignoreCollision: true,
                healCol: 15,
                health: 400,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 19,
                itemAID: 35,
            }, {
                age: 9,
                group: this.groups[10],
                name: "spawn pad",
                desc: "you will spawn here when you die but it will dissapear",
                req: ["wood", 100, "stone", 100],
                health: 400,
                ignoreCollision: true,
                spawnPoint: true,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 20,
                itemAID: 36,
            }, {
                age: 7,
                group: this.groups[12],
                name: "blocker",
                desc: "blocks building in radius",
                req: ["wood", 30, "stone", 25],
                ignoreCollision: true,
                blocker: 300,
                health: 400,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 21,
                itemAID: 37,
            }, {
                age: 7,
                group: this.groups[13],
                name: "teleporter",
                desc: "teleports you to a random point on the map",
                req: ["wood", 60, "stone", 60],
                ignoreCollision: true,
                teleport: true,
                health: 200,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 22,
                itemAID: 38
            }];

            // CHECK ITEM ID:
            this.checkItem = {
                index: function (id, myItems) {
                    return [0, 1, 2].includes(id) ? 0 : [3, 4, 5].includes(id) ? 1 : [6, 7, 8, 9].includes(id) ? 2 : [10, 11, 12].includes(id) ? 3 : [13, 14].includes(id) ? 5 : [15, 16].includes(id) ? 4 : [17, 18, 19, 21, 22].includes(id) ? [13, 14].includes(myItems) ? 6 :
                        5 :
                        id == 20 ? [13, 14].includes(myItems) ? 7 :
                            6 :
                            undefined;
                }
            }

            // ASSIGN IDS:
            for (let i = 0; i < this.list.length; ++i) {
                this.list[i].id = i;
                if (this.list[i].pre) this.list[i].pre = i - this.list[i].pre;
            }

            // TROLOLOLOL:
            if (typeof window !== "undefined") {
                function shuffle(a) {
                    for (let i = a.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [a[i], a[j]] = [a[j], a[i]];
                    }
                    return a;
                }
                //shuffle(this.list);
            }
        }
    }
    class Objectmanager {
        constructor(GameObject, liztobj, UTILS, config, players, server) {
            let mathFloor = Math.floor,
                mathABS = Math.abs,
                mathCOS = Math.cos,
                mathSIN = Math.sin,
                mathPOW = Math.pow,
                mathSQRT = Math.sqrt;

            this.ignoreAdd = false;
            this.hitObj = [];

            // DISABLE OBJ:
            this.disableObj = function (obj) {
                obj.active = false;
            };

            // ADD NEW:
            let tmpObj;
            this.add = function (sid, x, y, dir, s, type, data, setSID, owner) {
                tmpObj = findObjectBySid(sid);
                if (!tmpObj) {
                    tmpObj = gameObjects.find((tmp) => !tmp.active);
                    if (!tmpObj) {
                        tmpObj = new GameObject(sid);
                        gameObjects.push(tmpObj);
                    }
                }
                if (setSID) {
                    tmpObj.sid = sid;
                }
                tmpObj.init(x, y, dir, s, type, data, owner);
            };

            // DISABLE BY SID:
            this.disableBySid = function (sid) {
                let find = findObjectBySid(sid);
                if (find) {
                    this.disableObj(find);
                }
            };

            // REMOVE ALL FROM PLAYER:
            this.removeAllItems = function (sid, server) {
                gameObjects.filter((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach((tmp) => this.disableObj(tmp));
            };

            // CHECK IF PLACABLE:
            this.checkItemLocation = function (x, y, s, sM, indx, ignoreWater, placer) {
                let cantPlace = liztobj.find((tmp) => tmp.active && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
                if (cantPlace) return false;
                if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
                return true;
            };

        }
    }
    class Projectile {
        constructor(players, ais, objectManager, items, config, UTILS, server) {

            // INIT:
            this.init = function (indx, x, y, dir, spd, dmg, rng, scl, owner) {
                this.active = true;
                this.tickActive = true;
                this.indx = indx;
                this.x = x;
                this.y = y;
                this.x2 = x;
                this.y2 = y;
                this.dir = dir;
                this.skipMov = true;
                this.speed = spd;
                this.dmg = dmg;
                this.scale = scl;
                this.range = rng;
                this.r2 = rng;
                this.owner = owner;
            };

            // UPDATE:
            this.update = function (delta) {
                if (this.active) {
                    let tmpSpeed = this.speed * delta;
                    if (!this.skipMov) {
                        this.x += tmpSpeed * Math.cos(this.dir);
                        this.y += tmpSpeed * Math.sin(this.dir);
                        this.range -= tmpSpeed;
                        if (this.range <= 0) {
                            this.x += this.range * Math.cos(this.dir);
                            this.y += this.range * Math.sin(this.dir);
                            tmpSpeed = 1;
                            this.range = 0;
                            this.active = false;
                        }
                    } else {
                        this.skipMov = false;
                    }
                }
            };
            this.tickUpdate = function (delta) {
                if (this.tickActive) {
                    let tmpSpeed = this.speed * delta;
                    if (!this.skipMov) {
                        this.x2 += tmpSpeed * Math.cos(this.dir);
                        this.y2 += tmpSpeed * Math.sin(this.dir);
                        this.r2 -= tmpSpeed;
                        if (this.r2 <= 0) {
                            this.x2 += this.r2 * Math.cos(this.dir);
                            this.y2 += this.r2 * Math.sin(this.dir);
                            tmpSpeed = 1;
                            this.r2 = 0;
                            this.tickActive = false;
                        }
                    } else {
                        this.skipMov = false;
                    }
                }
            };
        }
    };
    class Store {
        constructor() {
            // STORE HATS:
            this.hats = [{
                id: 45,
                name: "Shame!",
                dontSell: true,
                price: 0,
                scale: 120,
                desc: "hacks are for winners"
            }, {
                id: 51,
                name: "Moo Cap",
                price: 0,
                scale: 120,
                desc: "coolest mooer around"
            }, {
                id: 50,
                name: "Apple Cap",
                price: 0,
                scale: 120,
                desc: "apple farms remembers"
            }, {
                id: 28,
                name: "Moo Head",
                price: 0,
                scale: 120,
                desc: "no effect"
            }, {
                id: 29,
                name: "Pig Head",
                price: 0,
                scale: 120,
                desc: "no effect"
            }, {
                id: 30,
                name: "Fluff Head",
                price: 0,
                scale: 120,
                desc: "no effect"
            }, {
                id: 36,
                name: "Pandou Head",
                price: 0,
                scale: 120,
                desc: "no effect"
            }, {
                id: 37,
                name: "Bear Head",
                price: 0,
                scale: 120,
                desc: "no effect"
            }, {
                id: 38,
                name: "Monkey Head",
                price: 0,
                scale: 120,
                desc: "no effect"
            }, {
                id: 44,
                name: "Polar Head",
                price: 0,
                scale: 120,
                desc: "no effect"
            }, {
                id: 35,
                name: "Fez Hat",
                price: 0,
                scale: 120,
                desc: "no effect"
            }, {
                id: 42,
                name: "Enigma Hat",
                price: 0,
                scale: 120,
                desc: "join the enigma army"
            }, {
                id: 43,
                name: "Blitz Hat",
                price: 0,
                scale: 120,
                desc: "hey everybody i'm blitz"
            }, {
                id: 49,
                name: "Bob XIII Hat",
                price: 0,
                scale: 120,
                desc: "like and subscribe"
            }, {
                id: 57,
                name: "Pumpkin",
                price: 50,
                scale: 120,
                desc: "Spooooky"
            }, {
                id: 8,
                name: "Bummle Hat",
                price: 100,
                scale: 120,
                desc: "no effect"
            }, {
                id: 2,
                name: "Straw Hat",
                price: 500,
                scale: 120,
                desc: "no effect"
            }, {
                id: 15,
                name: "Winter Cap",
                price: 600,
                scale: 120,
                desc: "allows you to move at normal speed in snow",
                coldM: 1
            }, {
                id: 5,
                name: "Cowboy Hat",
                price: 1000,
                scale: 120,
                desc: "no effect"
            }, {
                id: 4,
                name: "Ranger Hat",
                price: 2000,
                scale: 120,
                desc: "no effect"
            }, {
                id: 18,
                name: "Explorer Hat",
                price: 2000,
                scale: 120,
                desc: "no effect"
            }, {
                id: 31,
                name: "Flipper Hat",
                price: 2500,
                scale: 120,
                desc: "have more control while in water",
                watrImm: true
            }, {
                id: 1,
                name: "Marksman Cap",
                price: 3000,
                scale: 120,
                desc: "increases arrow speed and range",
                aMlt: 1.3
            }, {
                id: 10,
                name: "Bush Gear",
                price: 3000,
                scale: 160,
                desc: "allows you to disguise yourself as a bush"
            }, {
                id: 48,
                name: "Halo",
                price: 3000,
                scale: 120,
                desc: "no effect"
            }, {
                id: 6,
                name: "Soldier Helmet",
                price: 4000,
                scale: 120,
                desc: "reduces damage taken but slows movement",
                spdMult: 0.94,
                dmgMult: 0.75
            }, {
                id: 23,
                name: "Anti Venom Gear",
                price: 4000,
                scale: 120,
                desc: "makes you immune to poison",
                poisonRes: 1
            }, {
                id: 13,
                name: "Medic Gear",
                price: 5000,
                scale: 110,
                desc: "slowly regenerates health over time",
                healthRegen: 3
            }, {
                id: 9,
                name: "Miners Helmet",
                price: 5000,
                scale: 120,
                desc: "earn 1 extra gold per resource",
                extraGold: 1
            }, {
                id: 32,
                name: "Musketeer Hat",
                price: 5000,
                scale: 120,
                desc: "reduces cost of projectiles",
                projCost: 0.5
            }, {
                id: 7,
                name: "Bull Helmet",
                price: 6000,
                scale: 120,
                desc: "increases damage done but drains health",
                healthRegen: -5,
                dmgMultO: 1.5,
                spdMult: 0.96
            }, {
                id: 22,
                name: "Emp Helmet",
                price: 6000,
                scale: 120,
                desc: "turrets won't attack but you move slower",
                antiTurret: 1,
                spdMult: 0.7
            }, {
                id: 12,
                name: "Booster Hat",
                price: 6000,
                scale: 120,
                desc: "increases your movement speed",
                spdMult: 1.16
            }, {
                id: 26,
                name: "Barbarian Armor",
                price: 8000,
                scale: 120,
                desc: "knocks back enemies that attack you",
                dmgK: 0.6
            }, {
                id: 21,
                name: "Plague Mask",
                price: 10000,
                scale: 120,
                desc: "melee attacks deal poison damage",
                poisonDmg: 5,
                poisonTime: 6
            }, {
                id: 46,
                name: "Bull Mask",
                price: 10000,
                scale: 120,
                desc: "bulls won't target you unless you attack them",
                bullRepel: 1
            }, {
                id: 14,
                name: "Windmill Hat",
                topSprite: true,
                price: 10000,
                scale: 120,
                desc: "generates points while worn",
                pps: 1.5
            }, {
                id: 11,
                name: "Spike Gear",
                topSprite: true,
                price: 10000,
                scale: 120,
                desc: "deal damage to players that damage you",
                dmg: 0.45
            }, {
                id: 53,
                name: "Turret Gear",
                topSprite: true,
                price: 10000,
                scale: 120,
                desc: "you become a walking turret",
                turret: {
                    proj: 1,
                    range: 700,
                    rate: 2500
                },
                spdMult: 0.7
            }, {
                id: 20,
                name: "Samurai Armor",
                price: 12000,
                scale: 120,
                desc: "increased attack speed and fire rate",
                atkSpd: 0.78
            }, {
                id: 58,
                name: "Dark Knight",
                price: 12000,
                scale: 120,
                desc: "restores health when you deal damage",
                healD: 0.4
            }, {
                id: 27,
                name: "Scavenger Gear",
                price: 15000,
                scale: 120,
                desc: "earn double points for each kill",
                kScrM: 2
            }, {
                id: 40,
                name: "Tank Gear",
                price: 15000,
                scale: 120,
                desc: "increased damage to buildings but slower movement",
                spdMult: 0.3,
                bDmg: 3.3
            }, {
                id: 52,
                name: "Thief Gear",
                price: 15000,
                scale: 120,
                desc: "steal half of a players gold when you kill them",
                goldSteal: 0.5
            }, {
                id: 55,
                name: "Bloodthirster",
                price: 20000,
                scale: 120,
                desc: "Restore Health when dealing damage. And increased damage",
                healD: 0.25,
                dmgMultO: 1.2,
            }, {
                id: 56,
                name: "Assassin Gear",
                price: 20000,
                scale: 120,
                desc: "Go invisible when not moving. Can't eat. Increased speed",
                noEat: true,
                spdMult: 1.1,
                invisTimer: 1000
            }];

            // STORE ACCESSORIES:
            this.accessories = [{
                id: 12,
                name: "Snowball",
                price: 1000,
                scale: 105,
                xOff: 18,
                desc: "no effect"
            }, {
                id: 9,
                name: "Tree Cape",
                price: 1000,
                scale: 90,
                desc: "no effect"
            }, {
                id: 10,
                name: "Stone Cape",
                price: 1000,
                scale: 90,
                desc: "no effect"
            }, {
                id: 3,
                name: "Cookie Cape",
                price: 1500,
                scale: 90,
                desc: "no effect"
            }, {
                id: 8,
                name: "Cow Cape",
                price: 2000,
                scale: 90,
                desc: "no effect"
            }, {
                id: 11,
                name: "Monkey Tail",
                price: 2000,
                scale: 97,
                xOff: 25,
                desc: "Super speed but reduced damage",
                spdMult: 1.35,
                dmgMultO: 0.2
            }, {
                id: 17,
                name: "Apple Basket",
                price: 3000,
                scale: 80,
                xOff: 12,
                desc: "slowly regenerates health over time",
                healthRegen: 1
            }, {
                id: 6,
                name: "Winter Cape",
                price: 3000,
                scale: 90,
                desc: "no effect"
            }, {
                id: 4,
                name: "Skull Cape",
                price: 4000,
                scale: 90,
                desc: "no effect"
            }, {
                id: 5,
                name: "Dash Cape",
                price: 5000,
                scale: 90,
                desc: "no effect"
            }, {
                id: 2,
                name: "Dragon Cape",
                price: 6000,
                scale: 90,
                desc: "no effect"
            }, {
                id: 1,
                name: "Super Cape",
                price: 8000,
                scale: 90,
                desc: "no effect"
            }, {
                id: 7,
                name: "Troll Cape",
                price: 8000,
                scale: 90,
                desc: "no effect"
            }, {
                id: 14,
                name: "Thorns",
                price: 10000,
                scale: 115,
                xOff: 20,
                desc: "no effect"
            }, {
                id: 15,
                name: "Blockades",
                price: 10000,
                scale: 95,
                xOff: 15,
                desc: "no effect"
            }, {
                id: 20,
                name: "Devils Tail",
                price: 10000,
                scale: 95,
                xOff: 20,
                desc: "no effect"
            }, {
                id: 16,
                name: "Sawblade",
                price: 12000,
                scale: 90,
                spin: true,
                xOff: 0,
                desc: "deal damage to players that damage you",
                dmg: 0.15
            }, {
                id: 13,
                name: "Angel Wings",
                price: 15000,
                scale: 138,
                xOff: 22,
                desc: "slowly regenerates health over time",
                healthRegen: 3
            }, {
                id: 19,
                name: "Shadow Wings",
                price: 15000,
                scale: 138,
                xOff: 22,
                desc: "increased movement speed",
                spdMult: 1.1
            }, {
                id: 18,
                name: "Blood Wings",
                price: 20000,
                scale: 178,
                xOff: 26,
                desc: "restores health when you deal damage",
                healD: 0.2
            }, {
                id: 21,
                name: "Corrupt X Wings",
                price: 20000,
                scale: 178,
                xOff: 26,
                desc: "deal damage to players that damage you",
                dmg: 0.25
            }];
        }
    };
    class ProjectileManager {
        constructor(Projectile, projectiles, players, ais, objectManager, items, config, UTILS, server) {
            this.addProjectile = function (x, y, dir, range, speed, indx, owner, ignoreObj, layer, inWindow) {
                let tmpData = items.projectiles[indx];
                let tmpProj;
                for (let i = 0; i < projectiles.length; ++i) {
                    if (!projectiles[i].active) {
                        tmpProj = projectiles[i];
                        break;
                    }
                }
                if (!tmpProj) {
                    tmpProj = new Projectile(players, ais, objectManager, items, config, UTILS, server);
                    tmpProj.sid = projectiles.length;
                    projectiles.push(tmpProj);
                }
                tmpProj.init(indx, x, y, dir, speed, tmpData.dmg, range, tmpData.scale, owner);
                tmpProj.ignoreObj = ignoreObj;
                tmpProj.layer = layer || tmpData.layer;
                tmpProj.inWindow = inWindow;
                tmpProj.src = tmpData.src;
                return tmpProj;
            };
        }
    };
    class AiManager {

        // AI MANAGER:
        constructor(ais, AI, players, items, objectManager, config, UTILS, scoreCallback, server) {

            // AI TYPES:
            this.aiTypes = [{
                id: 0,
                src: "cow_1",
                killScore: 150,
                health: 500,
                weightM: 0.8,
                speed: 0.00095,
                turnSpeed: 0.001,
                scale: 72,
                drop: ["food", 50]
            }, {
                id: 1,
                src: "pig_1",
                killScore: 200,
                health: 800,
                weightM: 0.6,
                speed: 0.00085,
                turnSpeed: 0.001,
                scale: 72,
                drop: ["food", 80]
            }, {
                id: 2,
                name: "Bull",
                src: "bull_2",
                hostile: true,
                dmg: 20,
                killScore: 1000,
                health: 1800,
                weightM: 0.5,
                speed: 0.00094,
                turnSpeed: 0.00074,
                scale: 78,
                viewRange: 800,
                chargePlayer: true,
                drop: ["food", 100]
            }, {
                id: 3,
                name: "Bully",
                src: "bull_1",
                hostile: true,
                dmg: 20,
                killScore: 2000,
                health: 2800,
                weightM: 0.45,
                speed: 0.001,
                turnSpeed: 0.0008,
                scale: 90,
                viewRange: 900,
                chargePlayer: true,
                drop: ["food", 400]
            }, {
                id: 4,
                name: "Wolf",
                src: "wolf_1",
                hostile: true,
                dmg: 8,
                killScore: 500,
                health: 300,
                weightM: 0.45,
                speed: 0.001,
                turnSpeed: 0.002,
                scale: 84,
                viewRange: 800,
                chargePlayer: true,
                drop: ["food", 200]
            }, {
                id: 5,
                name: "Quack",
                src: "chicken_1",
                dmg: 8,
                killScore: 2000,
                noTrap: true,
                health: 300,
                weightM: 0.2,
                speed: 0.0018,
                turnSpeed: 0.006,
                scale: 70,
                drop: ["food", 100]
            }, {
                id: 6,
                name: "MOOSTAFA",
                nameScale: 50,
                src: "enemy",
                hostile: true,
                dontRun: true,
                fixedSpawn: true,
                spawnDelay: 60000,
                noTrap: true,
                colDmg: 100,
                dmg: 40,
                killScore: 8000,
                health: 18000,
                weightM: 0.4,
                speed: 0.0007,
                turnSpeed: 0.01,
                scale: 80,
                spriteMlt: 1.8,
                leapForce: 0.9,
                viewRange: 1000,
                hitRange: 210,
                hitDelay: 1000,
                chargePlayer: true,
                drop: ["food", 100]
            }, {
                id: 7,
                name: "Treasure",
                hostile: true,
                nameScale: 35,
                src: "crate_1",
                fixedSpawn: true,
                spawnDelay: 120000,
                colDmg: 200,
                killScore: 5000,
                health: 20000,
                weightM: 0.1,
                speed: 0.0,
                turnSpeed: 0.0,
                scale: 70,
                spriteMlt: 1.0
            }, {
                id: 8,
                name: "MOOFIE",
                src: "wolf_2",
                hostile: true,
                fixedSpawn: true,
                dontRun: true,
                hitScare: 4,
                spawnDelay: 30000,
                noTrap: true,
                nameScale: 35,
                dmg: 10,
                colDmg: 100,
                killScore: 3000,
                health: 7000,
                weightM: 0.45,
                speed: 0.0015,
                turnSpeed: 0.002,
                scale: 90,
                viewRange: 800,
                chargePlayer: true,
                drop: ["food", 1000]
            }, {
                id: 9,
                name: "💀MOOFIE",
                src: "wolf_2",
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                spawnDelay: 6e4,
                noTrap: !0,
                nameScale: 35,
                dmg: 12,
                colDmg: 100,
                killScore: 3e3,
                health: 9e3,
                weightM: .45,
                speed: .0015,
                turnSpeed: .0025,
                scale: 94,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 3e3],
                minSpawnRange: .85,
                maxSpawnRange: .9
            }, {
                id: 10,
                name: "💀Wolf",
                src: "wolf_1",
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                spawnDelay: 3e4,
                dmg: 10,
                killScore: 700,
                health: 500,
                weightM: .45,
                speed: .00115,
                turnSpeed: .0025,
                scale: 88,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 400],
                minSpawnRange: .85,
                maxSpawnRange: .9
            }, {
                id: 11,
                name: "💀Bully",
                src: "bull_1",
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                dmg: 20,
                killScore: 5e3,
                health: 5e3,
                spawnDelay: 1e5,
                weightM: .45,
                speed: .00115,
                turnSpeed: .0025,
                scale: 94,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 800],
                minSpawnRange: .85,
                maxSpawnRange: .9
            }];


            // SPAWN AI:
            this.spawn = function (x, y, dir, index) {
                let tmpObj = ais.find((tmp) => !tmp.active);
                if (!tmpObj) {
                    tmpObj = new AI(ais.length, objectManager, players, items, UTILS, config, scoreCallback, server);
                    ais.push(tmpObj);
                }
                tmpObj.init(x, y, dir, index, this.aiTypes[index]);
                return tmpObj;
            };
        }

    };
    class AI {
        constructor(sid, objectManager, players, items, UTILS, config, scoreCallback, server) {
            this.sid = sid;
            this.isAI = true;
            this.nameIndex = UTILS.randInt(0, config.cowNames.length - 1);

            // INIT:
            this.init = function (x, y, dir, index, data) {
                this.x = x;
                this.y = y;
                this.startX = data.fixedSpawn ? x : null;
                this.startY = data.fixedSpawn ? y : null;
                this.xVel = 0;
                this.yVel = 0;
                this.zIndex = 0;
                this.dir = dir;
                this.dirPlus = 0;
                this.showName = 'aaa';
                this.index = index;
                this.src = data.src;
                if (data.name) this.name = data.name;
                this.weightM = data.weightM;
                this.speed = data.speed;
                this.killScore = data.killScore;
                this.turnSpeed = data.turnSpeed;
                this.scale = data.scale;
                this.maxHealth = data.health;
                this.leapForce = data.leapForce;
                this.health = this.maxHealth;
                this.chargePlayer = data.chargePlayer;
                this.viewRange = data.viewRange;
                this.drop = data.drop;
                this.dmg = data.dmg;
                this.hostile = data.hostile;
                this.dontRun = data.dontRun;
                this.hitRange = data.hitRange;
                this.hitDelay = data.hitDelay;
                this.hitScare = data.hitScare;
                this.spriteMlt = data.spriteMlt;
                this.nameScale = data.nameScale;
                this.colDmg = data.colDmg;
                this.noTrap = data.noTrap;
                this.spawnDelay = data.spawnDelay;
                this.hitWait = 0;
                this.waitCount = 1000;
                this.moveCount = 0;
                this.targetDir = 0;
                this.active = true;
                this.alive = true;
                this.runFrom = null;
                this.chargeTarget = null;
                this.dmgOverTime = {};
            };

            let tmpRatio = 0;
            let animIndex = 0;
            this.animate = function (delta) {
                if (this.animTime > 0) {
                    this.animTime -= delta;
                    if (this.animTime <= 0) {
                        this.animTime = 0;
                        this.dirPlus = 0;
                        tmpRatio = 0;
                        animIndex = 0;
                    } else {
                        if (animIndex == 0) {
                            tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
                            if (tmpRatio >= 1) {
                                tmpRatio = 1;
                                animIndex = 1;
                            }
                        } else {
                            tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                        }
                    }
                }
            };

            // ANIMATION:
            this.startAnim = function () {
                this.animTime = this.animSpeed = 600;
                this.targetAngle = Math.PI * 0.8;
                tmpRatio = 0;
                animIndex = 0;
            };

        };

    };
    class addCh {
        constructor(x, y, chat, tmpObj) {
            this.x = x;
            this.y = y;
            this.alpha = 0;
            this.active = true;
            this.alive = false;
            this.chat = chat;
            this.owner = tmpObj;
        };
    };
    class DeadPlayer {
        constructor(x, y, dir, buildIndex, weaponIndex, weaponVariant, skinColor, scale, name) {
            this.x = x;
            this.y = y;
            this.lastDir = dir;
            this.dir = dir + Math.PI;
            this.buildIndex = buildIndex;
            this.weaponIndex = weaponIndex;
            this.weaponVariant = weaponVariant;
            this.skinColor = skinColor;
            this.scale = scale;
            this.visScale = 0;
            this.name = name;
            this.alpha = 1;
            this.active = true;
            this.animate = function (delta) {
                let d2 = UTILS.getAngleDist(this.lastDir, this.dir);
                if (d2 > 0.01) {
                    this.dir += d2 / 20;
                } else {
                    this.dir = this.lastDir;
                }
                if (this.visScale < this.scale) {
                    this.visScale += delta / (this.scale / 2);
                    if (this.visScale >= this.scale) {
                        this.visScale = this.scale;
                    }
                }
                this.alpha -= delta / 30000;
                if (this.alpha <= 0) {
                    this.alpha = 0;
                    this.active = false;
                }
            }
        }
    };
    let Ci = [];
    function g3(e, t, n, i, s, o, r, a) {
        var l = {
            ...e
        };
        l.skinIndex = i;
        l.tailIndex = s;
        l.vals = .8;
        l.deathAnim = true;
        l.spinSpd = 0.05; // slower spin for smoothness
        l.decay = o || 0;
        l.distance = 6e3; // longer duration
        l.fake = true;
        l.dstSpd = t;
        l.tick = game.tick + r + 1;
        l.positions = a;
        l.originDir = e.sid === player.sid ? Math.random() * 1e3 : UTILS.getDirection(e.x, e.y, player.x, player.y);
        Ci.push(l)
    }
    function h3(t) {
        function n(e, t) {
            return typeof e === "number" && (e > t || t === undefined)
        }
        const i = new Map;
        Ci.forEach(e => {
            if (e.sid) {
                const t = i.get(e.sid);
                if (!t || n(e.expire, t.expire)) {
                    i.set(e.sid, {
                        ...e
                    })
                }
            }
        });
        Ci = Array.from(i.values());
        Ci.forEach(t => {
            if (t.deathAnim === true) {
                let e = {
                    x: t.x + Math.cos(t.originDir) * t.dstSpd,
                    y: t.y + Math.sin(t.originDir) * t.dstSpd
                };
                t.t1 = void 0 === t.t2 ? Date.now() : t.t2;
                t.t2 = Date.now();
                t.distance -= t.dstSpd;
                t.dt = 0;
                t.d1 = t.d2;
                t.spinSpd ? t.d2 += t.spinSpd : t.d2 = player.dir;
                t.x1 = t.x;
                t.y1 = t.y;
                t.x2 = e.x;
                t.y2 = e.y;
                if (t.tick === game.tick + 1 && t.dstSpd === 0) {
                    // show text if needed
                }
            } else if (!isNaN(t.expire)) {
                t.t1 = void 0 === t.t2 ? Date.now() : t.t2;
                t.t2 = Date.now();
                t.distance -= t.dstSpd;
                t.dt = 0;
                t.d1 = t.d2;
                t.expire -= 1;
                t.x1 = t.x;
                t.y1 = t.y;
                t.x2 = t.NEWX;
                t.y2 = t.NEWY
            }
        });
        for (let e = 0; e < Ci.length; e++) {
            t = Ci[e];
            if (!t.deathAnim) continue;
            if (t.distance <= 0 || t.tick < game.tick + 1 && t.dstSpd === 0 || t.vals === 0) Ci.splice(e, 1)
        }
        Ci = Ci.filter(e => e.expire >= 0 || e.expire === undefined)
    }
    class Player {
        constructor(id, sid, config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories, server, scoreCallback, iconCallback) {
            this.id = id;
            this.sid = sid;
            this.tmpScore = 0;
            this.team = null;
            this.latestSkin = 0;
            this.muted = false;
            this.oldSkinIndex = 0;
            this.skinIndex = 0;
            this.latestTail = 0;
            this.oldTailIndex = 0;
            this.tailIndex = 0;
            this.hitTime = 0;
            this.lastHit = 0;
            this.showName = 'NOOO';
            this.tails = {};
            for (let i = 0; i < accessories.length; ++i) {
                if (accessories[i].price <= 0)
                    this.tails[accessories[i].id] = 1;
            }
            this.skins = {};
            for (let i = 0; i < hats.length; ++i) {
                if (hats[i].price <= 0)
                    this.skins[hats[i].id] = 1;
            }
            this.points = 0;
            this.dt = 0;
            this.hidden = false;
            this.itemCounts = {};
            this.isPlayer = true;
            this.pps = 0;
            this.moveDir = undefined;
            this.skinRot = 0;
            this.moveTime = 0;
            this.lastPing = 0;
            this.iconIndex = 0;
            this.skinColor = 0;
            this.dist2 = 0;
            this.aim2 = 0;
            this.maxSpeed = 1;
            this.chat = {
                message: null,
                count: 0
            };
            this.circle = false;
            this.cAngle = 0;
            // SPAWN:
            this.spawn = function (moofoll) {
                this.attacked = false;
                this.timeDamaged = 0;
                this.timeHealed = 0;
                this.pinge = 0;
                this.millPlace = 'NOOO';
                this.lastshamecount = 0;
                this.death = false;
                this.spinDir = 0;
                this.sync = false;
                this.antiBull = 0;
                this.bullTimer = 0;
                this.poisonTimer = 0;
                this.active = true;
                this.alive = true;
                this.lockMove = false;
                this.lockDir = false;
                this.minimapCounter = 0;
                this.chatCountdown = 0;
                this.shameCount = 0;
                this.shameTimer = 0;
                this.sentTo = {};
                this.gathering = 0;
                this.gatherIndex = 0;
                this.shooting = {};
                this.shootIndex = 9;
                this.autoGather = 0;
                this.animTime = 0;
                this.animSpeed = 0;
                this.mouseState = 0;
                this.buildIndex = -1;
                this.weaponIndex = 0;
                this.weaponCode = 0;
                this.weaponVariant = 0;
                this.primaryIndex = undefined;
                this.secondaryIndex = undefined;
                this.dmgOverTime = {};
                this.noMovTimer = 0;
                this.maxXP = 300;
                this.XP = 0;
                this.age = 1;
                this.kills = 0;
                this.upgrAge = 2;
                this.upgradePoints = 0;
                this.x = 0;
                this.y = 0;
                this.oldXY = {
                    x: 0,
                    y: 0
                };
                this.zIndex = 0;
                this.xVel = 0;
                this.yVel = 0;
                this.slowMult = 1;
                this.dir = 0;
                this.dirPlus = 0;
                this.targetDir = 0;
                this.targetAngle = 0;
                this.maxHealth = 100;
                this.health = this.maxHealth;
                this.oldHealth = this.maxHealth;
                this.damaged = 0;
                this.scale = config.playerScale;
                this.speed = config.playerSpeed;
                this.resetMoveDir();
                this.resetResources(moofoll);
                this.items = [0, 3, 6, 10];
                this.weapons = [0];
                this.shootCount = 0;
                this.weaponXP = [];
                this.reloads = {
                    0: 0,
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0,
                    5: 0,
                    6: 0,
                    7: 0,
                    8: 0,
                    9: 0,
                    10: 0,
                    11: 0,
                    12: 0,
                    13: 0,
                    14: 0,
                    15: 0,
                    53: 0,
                };
                this.bowThreat = {
                    9: 0,
                    12: 0,
                    13: 0,
                    15: 0,
                };
                this.primaryReloaded = true;
                this.secondaryReloaded = true;
                this.damageThreat = 0;
                this.damageSources = {
                    primary: 0,
                    secondary: 0,
                    turret: 0,
                    projectile: 0,
                    spike: 0,
                    DOT: 0,
                    counter: 0,
                    AI: 0,
                    totalNoSoldier: 0,
                    totalSoldier: 0,
                    sum: 0,
                };
                this.inTrap = false;
                this.lastTrap = false;
                this.hitSpike = 0;
                this.canEmpAnti = false;
                this.empAnti = false;
                this.soldierAnti = false;
                this.poisonCounter = 0;
                this.poisonTick = 0;
                this.bullTick = 0;
                this.setPoisonTick = false;
                this.setBullTick = false;
                this.antiTimer = 2;
            };

            // RESET MOVE DIR:
            this.resetMoveDir = function () {
                this.moveDir = undefined;
            };

            // RESET RESOURCES:
            this.resetResources = function (moofoll) {
                for (let i = 0; i < config.resourceTypes.length; ++i) {
                    this[config.resourceTypes[i]] = moofoll ? 100 : 0;
                }
            };

            // ADD ITEM:
            this.getItemType = function (id) {
                let findindx = this.items.findIndex((ids) => ids == id);
                if (findindx != -1) {
                    return findindx;
                } else {
                    return items.checkItem.index(id, this.items);
                }
            };

            // SET DATA:
            this.setData = function (data) {
                this.id = data[0];
                this.sid = data[1];
                this.name = data[2];
                this.x = data[3];
                this.y = data[4];
                this.dir = data[5];
                this.health = data[6];
                this.maxHealth = data[7];
                this.scale = data[8];
                this.skinColor = data[9];
            };

            // UPDATE POISON TICK:
            this.updateTimer = function () {

                this.bullTimer -= 1;
                if (this.bullTimer <= 0) {
                    this.setBullTick = false;
                    this.bullTick = game.tick - 1;
                    this.bullTimer = config.serverUpdateRate;
                }
                this.poisonTimer -= 1;
                if (this.poisonTimer <= 0) {
                    this.setPoisonTick = false;
                    this.poisonTick = game.tick - 1;
                    this.poisonTimer = config.serverUpdateRate;
                }

            };
            this.update = function (delta) {
                if (this.active) {

                    // MOVE:
                    let gear = {
                        skin: findID(hats, this.skinIndex),
                        tail: findID(accessories, this.tailIndex)
                    }
                    let spdMult = ((this.buildIndex >= 0) ? 0.5 : 1) * (items.weapons[this.weaponIndex].spdMult || 1) * (gear.skin ? (gear.skin.spdMult || 1) : 1) * (gear.tail ? (gear.tail.spdMult || 1) : 1) * (this.y <= config.snowBiomeTop ? ((gear.skin && gear.skin.coldM) ? 1 : config.snowSpeed) : 1) * this.slowMult;
                    this.maxSpeed = spdMult;

                }
            };

            let tmpRatio = 0;
            let animIndex = 0;
            this.animate = function (delta) {
                if (this.animTime > 0) {
                    this.animTime -= delta;
                    if (this.animTime <= 0) {
                        this.animTime = 0;
                        this.dirPlus = 0;
                        tmpRatio = 0;
                        animIndex = 0;
                    } else {
                        if (animIndex == 0) {
                            tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
                            if (tmpRatio >= 1) {
                                tmpRatio = 1;
                                animIndex = 1;
                            }
                        } else {
                            tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                        }
                    }
                }
            };

            // GATHER ANIMATION:
            this.startAnim = function (didHit, index) {
                this.animTime = this.animSpeed = items.weapons[index].speed;
                this.targetAngle = (didHit ? -config.hitAngle : -Math.PI);
                tmpRatio = 0;
                animIndex = 0;
            };

            // CAN SEE:
            this.canSee = function (other) {
                if (!other) return false;
                let dx = Math.abs(other.x - this.x) - other.scale;
                let dy = Math.abs(other.y - this.y) - other.scale;
                return dx <= (config.maxScreenWidth / 2) * 1.3 && dy <= (config.maxScreenHeight / 2) * 1.3;
            };

            // SHAME SYSTEM:
            this.judgeShame = function () {
                if (this.oldHealth < this.health) {
                    if (this.hitTime) {
                        let timeSinceHit = game.tick - this.hitTime;
                        this.hitTime = 0;
                        if (timeSinceHit < 2) {
                            this.shameCount++;
                        } else {
                            this.shameCount = Math.max(0, this.shameCount - 2);
                        }
                    }
                } else if (this.oldHealth > this.health) {
                    this.hitTime = game.tick;
                    this.lastHit = Date.now();
                }
            };
            this.addShameTimer = function () {
                this.shameCount = 0;
                this.shameTimer = 30;
                let interval = setInterval(() => {
                    this.shameTimer--;
                    if (this.shameTimer <= 0) {
                        clearInterval(interval);
                    }
                }, 1000);
            };
            // CHECK TEAM:
            this.isTeam = function (tmpObj) {
                return (this == tmpObj || (this.team && this.team == tmpObj.team));
            };

            // FOR THE PLAYER:
            this.findAllianceBySid = function (sid) {
                return this.team ? alliancePlayers.find((THIS) => THIS === sid) : null;
            };
            this.checkCanInsta = function (nobull) {
                let totally = 0;
                if (this.alive && inGame) {
                    let primary = {
                        weapon: this.weapons[0],
                        variant: this.primaryVariant,
                        dmg: this.weapons[0] == undefined ? 0 : items.weapons[this.weapons[0]].dmg,
                    };
                    let secondary = {
                        weapon: this.weapons[1],
                        variant: this.secondaryVariant,
                        dmg: this.weapons[1] == undefined ? 0 : items.weapons[this.weapons[1]].Pdmg,
                    };
                    let bull = this.skins[7] && !nobull ? 1.5 : 1;
                    let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1;
                    if (primary.weapon != undefined && this.reloads[primary.weapon] == 0) {
                        totally += primary.dmg * pV * bull;
                    }
                    if (secondary.weapon != undefined && this.reloads[secondary.weapon] == 0) {
                        totally += secondary.dmg;
                    }
                    if (this.skins[53] && this.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate) && near.skinIndex != 22) {
                        totally += 25;
                    }
                    totally *= near.skinIndex == 6 ? 0.75 : 1;
                    return totally;
                }
                return 0;
            };

            // UPDATE WEAPON RELOAD:
            this.manageReload = function () {
                if (this.shooting[53]) {
                    this.shooting[53] = 0;
                    this.reloads[53] = (2500 - game.tickRate);
                } else {
                    if (this.reloads[53] > 0) {
                        this.reloads[53] = Math.max(0, this.reloads[53] - game.tickRate);
                    }
                }

                // PREPLACER
                if (this.reloads[this.weaponIndex] <= 1000 / 9 && autoPlacer) {
                    autoPlacer.preplacer(this);
                }

                if (this.gathering || this.shooting[1]) {
                    if (this.gathering) {
                        this.gathering = 0;
                        this.reloads[this.gatherIndex] = (items.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1));
                        this.attacked = true;
                    }
                    if (this.shooting[1]) {
                        this.shooting[1] = 0;
                        this.reloads[this.shootIndex] = (items.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1));
                        this.attacked = true;
                    }
                } else {
                    this.attacked = false;
                    if (this.buildIndex < 0) {
                        if (this.reloads[this.weaponIndex] > 0) {
                            // Math.max(0, this.reloads[this.weaponIndex] - game.tickRate)
                            this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - 110);
                            if (this == player) {
                                if (getEl("weaponGrind").checked) {
                                    for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                                        checkPlace(player.getItemType(22), i);
                                    }
                                }
                            }
                            if (this.reloads[this.primaryIndex] == 0 && this.reloads[this.weaponIndex] == 0) {
                                this.antiBull++;
                                game.tickBase(() => {
                                    this.antiBull = 0;
                                }, 1);
                            }
                        }
                    }
                }
            };

            // FOR ANTI INSTA:
            this.resetDamageThreat = function () {
                this.damageThreat = 0;
                this.damageSources.primary = 0;
                this.damageSources.secondary = 0;
                this.damageSources.turret = 0;
                this.damageSources.projectile = 0;
                this.damageSources.spike = 0;
                this.damageSources.DOT = 0;
                this.damageSources.counter = 0;
                this.damageSources.AI = 0;
                this.damageSources.totalNoSoldier = 0;
                this.damageSources.totalSoldier = 0;
                this.damageSources.sum = 0;
            };
            this.addDamageThreat = function (typeOrTarget, damage) {
                if (typeof typeOrTarget !== "string") {
                    let target = typeOrTarget;
                    if (!target || this.isTeam(target) || this.dist2 > 300) {
                        return;
                    }
                    let primary = {
                        weapon: this.primaryIndex,
                        variant: this.primaryVariant,
                        dmg: this.primaryIndex == undefined ? 45 : items.weapons[this.primaryIndex].dmg,
                    };
                    let secondary = {
                        weapon: this.secondaryIndex,
                        variant: this.secondaryVariant,
                        dmg: this.primaryIndex == 0 ? 0 : this.secondaryIndex == undefined ? 50 : (items.weapons[this.secondaryIndex].Pdmg || items.weapons[this.secondaryIndex].dmg || 0),
                    };
                    let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
                    let sV = secondary.variant != undefined ? ([9, 12, 13, 15].includes(secondary.weapon) ? 1 : config.weaponVariants[secondary.variant].val) : 1;
                    let primaryReady = primary.weapon == undefined || this.reloads[primary.weapon] == 0;
                    let secondaryReady = secondary.weapon != undefined && this.reloads[secondary.weapon] == 0;
                    let primaryDmg = primaryReady ? primary.dmg * pV * (this.skinIndex == 7 ? 1.5 : 1) : 0;
                    let secondaryDmg = secondaryReady ? secondary.dmg * sV : 0;

                    if (primaryDmg > 0) {
                        target.addDamageThreat("primary", primaryDmg);
                    }
                    if (secondaryDmg > 0) {
                        target.addDamageThreat("secondary", secondaryDmg);
                    }
                    if (this.reloads[53] <= game.tickRate) {
                        target.addDamageThreat("turret", 25);
                    }
                    if (target.poisonCounter > 0 && [0, 7, 8].includes((game.tick - (my.bullTick || target.bullTick || 0)) % 9)) {
                        target.addDamageThreat("DOT", 5 * (target.skinIndex == 6 ? 0.75 : 1));
                    }
                    return;
                }

                let type = typeOrTarget;
                let appliedDamage = Math.max(0, damage || 0);
                if (!appliedDamage || this.damageSources[type] == undefined) {
                    return;
                }
                this.damageSources[type] += appliedDamage;
                this.damageSources.sum += type === "AI" ? appliedDamage * 0.5 : appliedDamage;
                this.damageSources.totalNoSoldier = this.damageSources.sum - Math.min(this.damageSources.primary, this.damageSources.secondary + this.damageSources.turret);
                this.damageSources.totalSoldier = this.damageSources.totalNoSoldier * 0.75;
                this.damageThreat = this.damageSources.totalNoSoldier;
            };
            this.removeDamageThreat = function (type, damage) {
                if (this.damageSources[type] == undefined) {
                    return;
                }
                if (!damage) {
                    let weighted = type === "AI" ? this.damageSources[type] * 0.5 : this.damageSources[type];
                    this.damageSources.sum -= weighted;
                    this.damageSources[type] = 0;
                } else {
                    let before = this.damageSources[type];
                    this.damageSources[type] = Math.max(0, this.damageSources[type] - damage);
                    let diff = before - this.damageSources[type];
                    this.damageSources.sum -= type === "AI" ? diff * 0.5 : diff;
                }
                this.damageSources.totalNoSoldier = this.damageSources.sum - Math.min(this.damageSources.primary, this.damageSources.secondary + this.damageSources.turret);
                this.damageSources.totalSoldier = this.damageSources.totalNoSoldier * 0.75;
                this.damageThreat = this.damageSources.totalNoSoldier;
            };
        }
    };

    // SOME CODES:
    function sendUpgrade(index) {
        player.reloads[index] = 0;
        packet("H", index);
    }

    function storeEquip(id, index) {
        packet("c", 0, id, index);
    }

    function storeBuy(id, index) {
        packet("c", 1, id, index);
    }

    function buyEquip(id, index) {
        let nID = player.skins[6] ? 6 : 0;
        if (player.alive && inGame) {
            if (index == 0) {
                if (player.skins[id]) {
                    if (player.latestSkin != id) {
                        packet("c", 0, id, 0);
                    }
                } else {
                    if (configs.autoBuyEquip) {
                        let find = findID(hats, id);
                        if (find) {
                            if (player.points >= find.price) {
                                packet("c", 1, id, 0);
                                packet("c", 0, id, 0);
                            } else {
                                if (player.latestSkin != nID) {
                                    packet("c", 0, nID, 0);
                                }
                            }
                        } else {
                            if (player.latestSkin != nID) {
                                packet("c", 0, nID, 0);
                            }
                        }
                    } else {
                        if (player.latestSkin != nID) {
                            packet("c", 0, nID, 0);
                        }
                    }
                }
            } else if (index == 1) {
                if (useWasd && (id != 11 && id != 0)) {
                    if (player.latestTail != 0) {
                        packet("c", 0, 0, 1);
                    }
                    return;
                }
                if (player.tails[id]) {
                    if (player.latestTail != id) {
                        packet("c", 0, id, 1);
                    }
                } else {
                    if (configs.autoBuyEquip) {
                        let find = findID(accessories, id);
                        if (find) {
                            if (player.points >= find.price) {
                                packet("c", 1, id, 1);
                                packet("c", 0, id, 1);
                            } else {
                                if (player.latestTail != 0) {
                                    packet("c", 0, 0, 1);
                                }
                            }
                        } else {
                            if (player.latestTail != 0) {
                                packet("c", 0, 0, 1);
                            }
                        }
                    } else {
                        if (player.latestTail != 0) {
                            packet("c", 0, 0, 1);
                        }
                    }
                }
            }
        }
    }

    function selectToBuild(index, wpn) {
        packet("G", index, wpn);
    }

    function selectWeapon(index, isPlace) {
        if (!isPlace) {
            player.weaponCode = index;
        }
        packet("G", index, 1);
    }

    function sendAutoGather() {
        packet("K", 1, 1);
    }

    function sendAtck(id, angle) {
        packet("d", id, angle, 1);
    }
    const delayWorker = `
let timeouts = {};
let intervals = {};

self.onmessage = (e) => {
const { type, id, delay } = e.data;

if (type === "setTimeout") {
    timeouts[id] = setTimeout(() => {
    self.postMessage({ type: "timeout", id });
    delete timeouts[id];
    }, delay);
}

else if (type === "clearTimeout") {
    if (timeouts[id]) {
    clearTimeout(timeouts[id]);
    delete timeouts[id];
    }
}

else if (type === "setInterval") {
    intervals[id] = setInterval(() => {
    self.postMessage({ type: "interval", id });
    }, delay);
}

else if (type === "clearInterval") {
    if (intervals[id]) {
    clearInterval(intervals[id]);
    delete intervals[id];
    }
}
};
`;
    let nextId = 0;
    const blob = new Blob([delayWorker], { type: 'application/javascript' });
    const workerList = {};
    const worker1 = new Worker(URL.createObjectURL(blob));
    function workerSetTimeout(fn, delay) {
        const id = nextId++;
        workerList[id] = fn;
        worker1.postMessage({ type: "setTimeout", id, delay });
        return id;
    }
    // PLACER:
    function place(id, rad, rmd) {
        try {
            if (id == undefined) return;
            let item = items.list[player.items[id]];
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            let tmpX = player.x2 + tmpS * Math.cos(rad);
            let tmpY = player.y2 + tmpS * Math.sin(rad);
            if ((player.alive && inGame && player.itemCounts[item.group.id] == undefined ? true : player.itemCounts[item.group.id] < (config.isSandbox ? 299 : item.group.limit ? item.group.limit : 99))) {
                selectToBuild(player.items[id]);
                sendAtck(1, rad);
                selectWeapon(player.weaponCode, 1);
                if (rmd && getEl("placeVis").checked) {
                    placeVisible.push({
                        x: tmpX,
                        y: tmpY,
                        name: item.name,
                        scale: item.scale,
                        dir: rad
                    });
                    game.tickBase(() => {
                        placeVisible.shift();
                    }, 1)
                }
            }
        } catch (e) { }
    }

    function checkPlace(id, rad) {
        try {
            if (id == undefined) return false;
            let item = items.list[player.items[id]];
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            let tmpX = player.x2 + tmpS * Math.cos(rad);
            let tmpY = player.y2 + tmpS * Math.sin(rad);
            if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player)) {
                place(id, rad, 1);
                return true;
            }
        } catch (e) { }
        return false;
    }

    // UPDATE HEALTH:
    function applCxC(value) { // just value calculator
        const skin = player.skinIndex;
        if (skin === 45 || skin === 56) return 0;
        const item = player.items[0];
        switch (item) {
            case 0:
                if (value < -80) return 5;
                if (value < -60) return 4;
                if (value < -40) return 3;
                if (value < -20) return 2;
                return 1;
            case 1:
                if (value < -80) return 3;
                if (value < -40) return 2;
                return 1;
            case 2:
                if (value < -90) return 4;
                if (value < -60) return 3;
                if (value < -30) return 2;
                return 1;
            default:
                return 4;
        }
    }
    // Ticks:
    // Aditional:
    function oneframe() {
        my.autoAim = true;
        buyEquip(19, 1);
        game.tickBase(() => {
            if (player.weapons[1] == 15) {
                my.revAim = true;
                buyEquip(20, 0); // Samurai Armor for musket fast reload
            }
            selectWeapon(player.weapons[[15].includes(player.weapons[1]) ? 1 : 0]);
            buyEquip(53, 0);
            buyEquip(19, 1);
            if ([15].includes(player.weapons[1])) {
                sendAutoGather();
            }
            game.tickBase(() => {
                my.revAim = false;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(19, 1);
                if (![15].includes(player.weapons[1])) {
                    sendAutoGather();
                }
                game.tickBase(() => {
                    sendAutoGather();
                    my.autoAim = false;
                }, 3);
            }, 1);
        }, 1);
    };
    // HEALING:
    function soldierMult() {
        return player.latestSkin == 6 ? 0.75 : 1;
    }

    function getAttacker(damaged) {
        let poisonHit = [];
        let attacker = nears.filter(tmp => {
            if (tmp.attacked) {
                let index = tmp.weaponIndex
                let dmg = index > 8 ? items.weapons[index].Pdmg : items.weapons[index].dmg;
                let variant = tmp[(index < 9 ? "prima" : "seconda") + "ryVariant"]
                dmg *= (player.skinIndex == 6 ? 0.75 : 1) * (tmp.skinIndex == 7 ? 1.5 : 1) * (tmp.tailIndex == 11 ? 0.2 : 1) * (config.weaponVariants[variant].val);
                if (damaged == dmg) {
                    poisonHit.push(variant == 3 || tmp.skinIndex == 21);
                    return true
                }
            }
            return false;
        });
        let poisonCount = poisonHit.filter(Boolean).length;
        if (poisonHit.length > 0 && poisonCount == poisonHit.length) {
            player.poisonCounter = 5;
        }
        return attacker;
    }
    function healer(extra = 0) {
        let total = Math.max(0, healthBased());
        total += Math.max(0, Number.isFinite(extra) ? extra : 0);
        for (let i = 0; i < total; i++) {
            place(0, getAttackDir());
        }
        return total;
    }
    function canUseEmpAnti(target = near) {
        if (!target || !target.sid || !player || !player.alive) return false;
        if (target.dist2 !== undefined && target.dist2 > 300) return false;
        const secondaryIndex = target.secondaryIndex ?? target.weapons?.[1];
        const secondaryReady = secondaryIndex != null && target.reloads && target.reloads[secondaryIndex] == 0;
        return !!(target.reloads && target.reloads[53] == 0 && secondaryReady);
    }
    function updateAntiHatState(target = near) {
        if (!player || !player.alive) return false;
        if (!target || !target.sid || !enemy.length) {
            player.canEmpAnti = false;
            return false;
        }
        const shouldEmp = canUseEmpAnti(target);
        player.canEmpAnti = false;
        player.empAnti = shouldEmp;
        player.soldierAnti = !shouldEmp;
        return shouldEmp;
    }
    function syncThreatHatState() {
        if (!player || !player.alive || !inGame || !enemy.length || !near || !near.sid) {
            if (player) player.canEmpAnti = false;
            return false;
        }
        if (player.canEmpAnti || player.empAnti || player.soldierAnti) {
            return updateAntiHatState(near);
        }
        return false;
    }
    function canRunAutomill() {
        if (!mills.place || !player || !player.alive || !inGame || instaC.isTrue || autoBreak.active) {
            return false;
        }
        const itemId = player.items?.[3];
        const item = items.list[itemId];
        if (!item || !item.group) return false;
        const itemCount = player.itemCounts?.[item.group.id] || 0;
        const itemLimit = config.isSandbox ? 299 : (item.group.limit || 99);
        const moveDir = Number.isFinite(player.moveDir) ? player.moveDir : (Number.isFinite(lastMoveDir) ? lastMoveDir : getMoveDir());
        return itemCount < itemLimit && Number.isFinite(moveDir);
    }
    function runAutomillPlacement() {
        if (!canRunAutomill() || mills.lastPlaceTick === game.tick) return false;
        const item = items.list[player.items[3]];
        if (!mills.old || mills.old.x == null || mills.old.y == null) {
            mills.old = { x: player.x2, y: player.y2 };
            return false;
        }
        const millDist = UTILS.getDist(mills.old, player, 0, 2);
        if (!Number.isFinite(millDist) || millDist < item.scale * 2 + 6) return false;
        const activeMoveDir = Number.isFinite(player.moveDir) ? player.moveDir : (Number.isFinite(lastMoveDir) ? lastMoveDir : getMoveDir());
        if (!Number.isFinite(activeMoveDir)) return false;
        const dir = activeMoveDir + Math.PI;
        let placed = false;
        if (macro.f && player.items[4] == 16) {
            placed = checkPlace(3, dir + 1.4) || placed;
            placed = checkPlace(3, dir - 1.4) || placed;
        } else {
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            let tmpX = player.x2 + tmpS * Math.cos(dir);
            let tmpY = player.y2 + tmpS * Math.sin(dir);
            let otherAngles = autoPlacer.closestPossibleAngles({
                x: tmpX,
                y: tmpY,
                getScale: function () {
                    return item.scale;
                },
            }, 3) || [];
            placed = checkPlace(3, dir) || placed;
            if (otherAngles[0] != null) placed = checkPlace(3, otherAngles[0]) || placed;
            if (otherAngles[1] != null) placed = checkPlace(3, otherAngles[1]) || placed;
        }
        if (placed) {
            mills.old = { x: player.x2, y: player.y2 };
            mills.lastPlaceTick = game.tick;
            sendAtck(0, getAttackDir());
        }
        return placed;
    }
    function getThreatHealShame(source = near) {
        if (!source || !source.sid) return 5;
        return source.primaryIndex == 5 && [undefined, 9, 12, 13, 15].includes(source.secondaryIndex) ? 6 : [7, 8].includes(source.primaryIndex) ? 3 : 5;
    }
    function isDotTickDamage(target, damaged) {
        const scaledDot = 5 * (target.skinIndex == 6 ? 0.75 : 1);
        return Math.abs(damaged - scaledDot) < 0.001 || ((target.latestTail == 13 || target.tailIndex == 13) && Math.abs(damaged - 2) < 0.001);
    }
    function processDotTick(target, damaged) {
        if (!isDotTickDamage(target, damaged)) {
            return false;
        }
        if (target.sid == player.sid) {
            my.bullTick = game.tick;
            player.bullTick = game.tick;
            if (my.reSync) {
                my.reSync = false;
            }
        }
        if (target.skinIndex == 7) {
            return true;
        }
        target.poisonCounter = Math.max(0, (target.poisonCounter || 0) - 1);
        return false;
    }
    function runThreatBasedHeal(target, damaged, bullTicked = false, source = near) {
        if (!target || target.sid != player.sid || !inGame || !source || !source.sid) {
            return false;
        }
        if (target.hitSpike && (target.inTrap || target.lastTrap)) {
            target.addDamageThreat("spike", target.hitSpike);
        }
        let attackers = getAttacker(damaged);
        let shame = target.hitSpike && (target.inTrap || target.lastTrap) ? 7 : getThreatHealShame(source);
        let maxHealth = player.maxHealth;
        let dmg = maxHealth - player.health;
        let bullTickDmg = 5 * soldierMult();
        let damageIfSoldier = target.damageSources.totalSoldier;
        let damageIfNoSoldier = target.damageSources.totalNoSoldier;
        let gearDmgs = [0.25, 0.45].map((val) => val * items.weapons[player.weapons[0]].dmg * soldierMult());
        let includeSpikeDmgs = enemy.length ? !bullTicked && gearDmgs.includes(damaged) && source.skinIndex == 11 && source.tailIndex == 21 : false;
        let autoheal = damaged >= 0 && damaged <= 66 && target.shameCount === 4 && player.primaryIndex !== "4";

        if (dmg + damageIfNoSoldier >= maxHealth && dmg + damageIfSoldier < maxHealth) {
            my.forceStop = true;
        }

        if (damaged >= (includeSpikeDmgs ? 8 : 20) && damageIfNoSoldier >= 20 && game.tick - target.antiTimer > 1) {
            if (canUseEmpAnti(source)) {
                target.canEmpAnti = true;
                target.empAnti = true;
                target.soldierAnti = false;
            } else {
                target.empAnti = false;
                target.soldierAnti = true;
            }
            target.antiTimer = game.tick;
        }

        const attemptThreatHeal = () => {
            if (my.healed || target.shameCount >= shame) {
                return false;
            }
            healer();
            my.healed = true;
            return true;
        };

        if (attackers.some((attacker) => [undefined, 9, 12, 13, 15].includes(attacker.secondaryIndex))) {
            if ([18.75, 22.5, 25, 26.25, 30, 35, 37.5, 50].includes(damaged) && dmg + damageIfSoldier >= maxHealth) {
                attemptThreatHeal();
            } else if (damaged > 39 && damaged < 80 && dmg + damageIfSoldier >= maxHealth) {
                if (target.damageSources.turret && game.tick - target.antiTimer > 1) {
                    target.empAnti = true;
                    target.antiTimer = game.tick;
                    target.removeDamageThreat("turret", 25);
                }
                if (target.shameCount < shame && dmg + (target.empAnti ? target.damageSources.totalNoSoldier : target.damageSources.totalSoldier) >= maxHealth) {
                    target.empAnti = false;
                    attemptThreatHeal();
                }
            } else if (damaged > bullTickDmg && dmg + damageIfSoldier >= maxHealth) {
                attemptThreatHeal();
            }
        } else if (damaged > bullTickDmg && dmg + damageIfSoldier >= maxHealth) {
            attemptThreatHeal();
        }

        if (autoheal && configs.autoHeal && !my.healed) {
            game.tickBase(() => {
                if (!my.healed) {
                    healer();
                    my.healed = true;
                }
            }, 2);
        }

        if (damaged >= 20 && player.skinIndex == 11 && attackers.length && source.weaponIndex != source.secondaryIndex) {
            instaC.canCounter = true;
        }
        return my.healed;
    }
    function runThreatBasedPassiveHeal() {
        if (!player || !player.alive || !inGame || my.healed || player.health >= player.maxHealth) {
            return false;
        }
        let damageThreat = player.latestSkin == 6 ? player.damageSources.totalSoldier : player.damageSources.totalNoSoldier;
        if (player.health <= damageThreat && player.shameCount <= 5) {
            healer();
            my.healed = true;
            return true;
        }
        return false;
    }

    // Anti-sync healing
    function antiSyncHealing(timearg) {
        my.antiSync = true;
        let healInterval = setInterval(() => {
            if (player.shameCount < 0) {
                place(0, getAttackDir());
            }
            let speed = Math.min(player.shameCount + 25, 50);
            clearInterval(healInterval);
            healInterval = setInterval(() => {
                if (player.shameCount < 0) {
                    place(0, getAttackDir());
                }
                player.heal(speed);
            }, speed);
        }, 25);

        setTimeout(() => {
            clearInterval(healInterval);
            my.antiSync = false;
        }, game.tickRate * timearg);
    }
    function detectTooFast(timearg) {
        my.antiSync = true;
        let detectInterval = setInterval(() => {
            if (near.dist2 || near.shameCount < 5) {
                clearInterval(detectInterval);
                healAnti(timearg);
            }
        }, 25);
    }
    function detectSpeed(timearg) {
        my.antiSync = true;
        let detectInterval = setInterval(() => {
            if (near.dist2 || near.shameCount < 5) {
                clearInterval(detectInterval);
                healAnti(timearg);
            } else if (player.shameCount >= 4) {
                backupSyncHeal(timearg);
                speedyHeal(timearg);
            } else if (player.shameCount >= 3) {
                tooFast(timearg);
            } else if (player.shameCount >= 2) {
                healAnti(timearg);
            }
        }, 25);
    }
    function healAnti(timearg) {
        my.antiSync = true;
        let speed = 25;
        let healInterval = setInterval(() => {
            if (player.shameCount < 2) {
                place(0, getAttackDir());
                player.heal(speed);
            }
        }, 30);
        setTimeout(() => {
            clearInterval(healInterval);
            my.antiSync = false;
        }, game.tickRate * timearg);
    }
    function tooFast(timearg) {
        my.antiSync = true;
        let speed = 40;
        let healInterval = setInterval(() => {
            if (player.shameCount < 3) {
                place(0, getAttackDir());
                player.heal(speed);
            }
        }, 40);
        setTimeout(() => {
            clearInterval(healInterval);
            my.antiSync = false;
        }, game.tickRate * timearg);
    }
    function speedyHeal(timearg) {
        my.antiSync = true;
        let speed = 50;
        let healInterval = setInterval(() => {
            if (player.shameCount < 4) {
                place(0, getAttackDir());
                player.heal(speed);
            }
        }, 35);

        setTimeout(() => {
            clearInterval(healInterval);
            my.antiSync = false;
        }, game.tickRate * timearg);
    }
    function backupSyncHeal(timearg) {
        my.antiSync = true;
        let speed = 30;
        let healInterval = setInterval(() => {
            if (player.shameCount < 1) {
                place(0, getAttackDir());
                player.heal(speed);
            }
        }, 25);

        setTimeout(() => {
            clearInterval(healInterval);
            my.antiSync = false;
        }, game.tickRate * timearg);
    }

    // THIS CODE MADE BY STARY!!
    // GENERAL SETTINGS AND VARIABLES
    const shameThreshold = 4.5;
    const syncSafetyNet = 150;
    const smallImpactDamage = 1.2;
    const baseHealingRate = 0.5;
    const maxShameCount = 5;
    const healCooldown = 0.00000000000000001;
    function antiSyncCalculation1(detectedPlayer) {
        return (Math.pow(detectedPlayer.x - player.x, 2) <= syncSafetyNet ** 2 && Math.pow(detectedPlayer.y - player.y, 2) <= syncSafetyNet ** 2 && detectedPlayer.shameCount >= shameThreshold && detectedPlayer.shameCount <= maxShameCount);
    }
    function getDist(e, t) {
        try {
            return Math.hypot((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
        } catch (e) {
            return Infinity;
        }
    }
    function healPlayer() {
        if (configs.shouldHeal) {
            place(0, getAttackDir());
        }
    }
    function antiSyncCalculation(detectedPlayer) {
        const dist2 = Math.pow(detectedPlayer.x - player.x, 2) + Math.pow(detectedPlayer.y - player.y, 2);
        return dist2 <= 300 && detectedPlayer.shameCount >= 2;
    }

    function isVeryCloseEnemy(detectedPlayer) {
        const dist2 = Math.pow(detectedPlayer.x - player.x, 2) + Math.pow(detectedPlayer.y - player.y, 2);
        return dist2 <= 100;
    }
    function antiSyncHealing1(detectedPlayer) {
        const isSynced = antiSyncCalculation(detectedPlayer);
        if (!isSynced) return false;

        const isVeryClose = isVeryCloseEnemy(detectedPlayer);
        if (!isVeryClose) return false;

        const shouldHeal = player.opponents.includes(detectedPlayer);
        if (!shouldHeal) return false;

        const healingAllowed = player.elapsedTime - player.opponents.map(opponent => opponent.elapsedTime).min() >= 60;
        if (!healingAllowed) return false;

        const healAmount = healthCalculator();
        for (let i = 0; i < healAmount; i++) {
            place(0, getAttackDir());
        }

        return true;
    }
    function healthCalculator() {
        if (player.health === 100) {
            return 0;
        }
        const baseRate = (100 - player.health) / items.list[player.items[0]].healing;
        return Math.ceil(baseRate * (player.skinIndex === 45 || player.skinIndex === 56 ? 2 : 1));
    }
    function getRandomDir() {
        let directions = [-1, 0, 1];
        return [directions[Math.floor(Math.random() * 3)], directions[Math.floor(Math.random() * 3)]];
    }
    // ADVANCED:

    function healthBased() { // healthbased X function skinIndex by nigaguy
        const playerHealth = player.health;
        const skinIndex = player.skinIndex;
        if (playerHealth === 100 || skinIndex === 45 || skinIndex === 56) {
            return 0;
        }
        const currentItemIndex = player.items[0];
        const currentItem = items.list[currentItemIndex];
        if (!currentItem || !currentItem.healing) {
            return -1;
        }
        const remainingHealth = 100 - playerHealth;
        const itemsNeeded = Math.ceil(remainingHealth / currentItem.healing);
        return itemsNeeded;
    }
    function calcDmg(value) {
        return value * player.skinIndex == 6 ? 0.75 : 1;
    }
    function antirev() {
        if (tmpObj.isPlayer) {
            for (let i = 0; i < healthBased(); i++) {
                place(0, getAttackDir());
                if (player.health == 55 && player.shameCount < 6 && player.skinIndex == 6) {
                    place(0, getAttackDir());
                } else if (player.health == 40 && player.shameCount < 6 && player.skinIndex != 6) {
                    place(0, getAttackDir());
                } else if (player.health == 43.75 && player.shameCount < 5 && player.skinIndex == 6) {
                    place(0, getAttackDir());
                    setTimeout(() => {
                        place(0, getAttackDir());
                    }, 5)
                } else if (player.health == 25 && player.shameCount < 4 && player.skinIndex == 6) {
                    place(0, getAttackDir());
                    setTimeout(() => {
                        place(0, getAttackDir());
                    }, 5)
                } else if (player.health == 58.75 && player.shameCount < 6 && player.skinIndex == 6) {
                    place(0, getAttackDir());
                    setTimeout(() => {
                        place(0, getAttackDir());
                    }, 5)
                } else if (player.health == 45 && player.shameCount < 6 && player.skinIndex != 6) {
                    place(0, getAttackDir());
                    setTimeout(() => {
                        place(0, getAttackDir());
                    }, 5)
                }
                if (player.shameCount < 6) {
                    setTimeout(() => {
                        place(0, getAttackDir());
                    }, 30)
                }
            }
        }
    }




    function getDamageThreat(tmpObj) {
        tmpObj.instaThreat = 0;
        if (isTeam(tmpObj)) {
            let primary = {
                weapon: tmpObj.primaryIndex,
                variant: tmpObj.primaryVariant,
                dmg: tmpObj.primaryIndex == undefined ? 45 : items.weapons[tmpObj.primaryIndex].dmg,
            };
            let secondary = {
                weapon: tmpObj.secondaryIndex,
                variant: tmpObj.secondaryVariant,
                dmg: tmpObj.secondaryIndex == undefined ? 50 : items.weapons[tmpObj.secondaryIndex].Pdmg,
            };
            let bull = tmpObj.skinIndex == 7 ? 1.5 : 1;
            let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
            if (primary.weapon != undefined && tmpObj.reloads[primary.weapon] == 0) {
                tmpObj.instaThreat += primary.dmg * pV * bull;
            }
            if (secondary.weapon != undefined && tmpObj.reloads[secondary.weapon] == 0) {
                tmpObj.instaThreat += secondary.dmg;
            }
            if (tmpObj.reloads[53] === 0) {
                tmpObj.instaThreat += 25;
            }
            tmpObj.instaThreat *= player.skinIndex == 6 ? 0.75 : 1;
        }
    }
    function renderAllBlood(context, f, d) {
        let now = Date.now();
        let fadeTime = 2000;

        for (let i = bloodEffects.length - 1; i >= 0; i--) {
            let effect = bloodEffects[i];
            let age = now - effect.time;

            if (age > fadeTime) {
                bloodEffects.splice(i, 1);
                continue;
            }

            let fadeAlpha = 1 - (age / fadeTime);

            effect.particles.forEach(particle => {
                context.beginPath();
                context.arc(
                    effect.x + particle.x - f,
                    effect.y + particle.y - d,
                    particle.size,
                    0,
                    Math.PI * 2
                );
                context.fillStyle = `rgba(${particle.redShade}, 0, 0, ${particle.alpha * fadeAlpha})`;
                context.fill();
            });
        }
    }

    // UPDATE HEALTH:
    let bloodEffects = [];

    function antiSyncHealing(timearg) {
        my.antiSync = true;
        player.chat.message = `Blocked Threat [ 2 ] ${window.pingTime}ms`;
        player.chat.count = 1000;
        let healAnti = setInterval(() => {
            if (player.shameCount < 5) {
                place(0, getAttackDir());
            }
        }, 75);
        setTimeout(() => {
            clearInterval(healAnti);
            setTimeout(() => {
                my.antiSync = false;
            }, game.tickRate);
        }, game.tickRate);
    }
    function detectTankGear() {
        return near.skinIndex === 40 || near.accIndex === 40;
    }

    function getTankCounterStrategy(enemyInTrap = false) {
        let hat = 7;
        let gear = 0;
        let strategy = "normal";

        if (detectTankGear()) {
            if (enemyInTrap && near.dist2 <= 160) {
                hat = 53;
                gear = 0;
                strategy = "aggressive";
            } else if (near.dist2 <= 300) {
                hat = 6;
                gear = 0;
                strategy = "defensive";
            } else {
                hat = 7;
                gear = 0;
                strategy = "normal";
            }

            if (player.weapons[1] === 15 && near.dist2 <= 250) {
                strategy = "musket";
                hat = 20;
                gear = 19;
            }
        }

        return { hat, gear, strategy };
    }

    function getOptimalHat(instaType, enemyInTrap = false) {
        let hat = 7;
        let gear = 0;

        if (detectTankGear()) {
            let tankStrategy = getTankCounterStrategy(enemyInTrap);
            hat = tankStrategy.hat;
            gear = tankStrategy.gear;

            if (instaType === "rev" && tankStrategy.strategy === "aggressive") {
                hat = 53;
                gear = 0;
            } else if (instaType === "normal" && tankStrategy.strategy === "musket") {
                hat = 20;
                gear = 19;
            }

            return { hat, gear };
        }

        if (near.dist2 >= 680 && near.dist2 < 720) {
            hat = 22;
        }

        if (instaType === "rev") {
            hat = 53;
            gear = 0;
        } else if (instaType === "normal" || instaType === "nobull") {
            if (near.skinIndex === 40) {
                hat = 6;
            } else if (near.skinIndex === 6 && near.dist2 <= 200) {
                hat = 7;
            } else if (enemyInTrap && near.dist2 <= 160) {
                hat = player.reloads[53] === 0 ? 53 : 7;
            } else {
                hat = 7;
            }
            gear = 0;
        }

        if (near.skinIndex === 40 && near.dist2 <= 300) {
            hat = 6;
        }

        if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 &&
            player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
            hat = 31;
        }

        return { hat, gear };
    }

    function biomeGear(mover, returns) {
        if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
            if (returns) return 31;
            buyEquip(31, 0);
        } else {
            let hat = near.dist2 >= 680 && near.dist2 < 720 ? 22 : 6;
            if (player.y2 <= config.snowBiomeTop) {
                if (returns) return mover && player.moveDir == undefined ? hat : 6;
                buyEquip(mover && player.moveDir == undefined ? hat : 6, 0);
            } else {
                if (returns) return mover && player.moveDir == undefined ? hat : 6;
                buyEquip(mover && player.moveDir == undefined ? hat : 6, 0);
            }
        }

        if (returns) return 0;
    }
    function woah(mover) {
        buyEquip(mover && player.moveDir == undefined ? 0 : tails, 1);
    }
    function getAutoBreakWeaponIndex(target = autoBreak?.info) {
        if (!player?.weapons) return 0;
        if (player.weapons[1] == 10) {
            try {
                if (autoBreak?.useHammer?.(target, player)) return player.weapons[1];
            } catch (e) {
            }
        }
        return player.weapons[0];
    }
    function getAutoBreakPressure() {
        const enemyWeaponIndex = near?.primaryIndex ?? near?.weapons?.[0] ?? 5;
        const enemyWeapon = items?.weapons?.[enemyWeaponIndex];
        const enemyRange = (enemyWeapon?.range || 300) + (near?.scale || 0) * 1.8;
        return {
            enemyClose: !!near?.sid && near.dist2 <= Math.max(300, enemyRange),
            enemyRange,
        };
    }
    function resolveAutoBreakGear() {
        const pressure = getAutoBreakPressure();
        const weaponIndex = getAutoBreakWeaponIndex(autoBreak?.info);
        const reload = player?.reloads?.[weaponIndex] || 0;
        let hat = 40;
        let acc = pressure.enemyClose ? 19 : 11;
        if (player?.empAnti) {
            hat = 22;
            acc = 11;
        } else if (pressure.enemyClose) {
            hat = reload > 0 ? 6 : 40;
            acc = 19;
        } else if (reload > 0) {
            hat = 6;
            acc = 11;
        }
        return {
            hat,
            acc,
            weaponIndex,
            reload,
            enemyClose: pressure.enemyClose,
        };
    }
    function isEnemySecondarySyncThreat(spikeObj, enemyRef = near) {
        if (!spikeObj || !enemyRef?.sid) return false;
        const secondaryIndex = enemyRef.weapons?.[1];
        const secondaryWeapon = secondaryIndex != null ? items.weapons[secondaryIndex] : null;
        if (!secondaryWeapon) return false;
        const spikeReach = (typeof spikeObj.getScale === "function" ? spikeObj.getScale() : spikeObj.scale || 0) + player.scale;
        const touchingSpike = UTILS.getDist(spikeObj, player, 0, 2) <= spikeReach;
        if (!touchingSpike) return false;
        const secondaryRange = secondaryWeapon.range + enemyRef.scale * 1.8;
        const secondaryReady = enemyRef.reloads?.[secondaryIndex] <= game.tickRate;
        return secondaryReady && enemyRef.dist2 <= secondaryRange;
    }
    let advHeal = [];
    let healTimeout;

    // AUTO BREAK:
    class Autobreaker {
        constructor(UTILS, items, flowState) {
            this.UTILS = UTILS;
            this.items = items;
            this.flowState = flowState;
            this.dist = 0;
            this.aim = 0;
            this.active = false;
            this.inTrap = false;
            this.info = {};
            this.replaced = false;
            this.antiTrapped = false;
            this.weapon = 0;
            this.priority = [[], [], [], []];
            this.target = null;
        }
        notFast() {
            if (!player?.weapons) return false;
            if (player.weapons[1] !== 10) return false;
            const infoHealth = this.info?.health ?? Infinity;
            return infoHealth > this.items.weapons[player.weapons[0]].dmg;
        }
        useHammer(object, who = player) {
            if (who.weapons[1] == 10) {
                if (object) {
                    const primaryIndex = who.weapons[0];
                    const primaryRange = this.items.weapons[primaryIndex]?.range || 0;
                    const objectScale = typeof object.getScale === "function" ? object.getScale() : (object.scale || 0);
                    const inPrimaryRange = this.UTILS.getDist(who, object, 0, 2) <= primaryRange + objectScale;
                    if (object.health > 0 && object.health <= this.items.weapons[primaryIndex].dmg && inPrimaryRange && ![5, 8].includes(primaryIndex)) return false;
                }
                return true;
            }
            return false;
        }
        getWeaponIndexForTarget(target, who = player) {
            if (!who?.weapons) return 0;
            if (who.weapons[1] == 10 && this.useHammer(target, who)) {
                return who.weapons[1];
            }
            return who.weapons[0];
        }
        getSourceObjects(limit = 18) {
            const sourceObjs = closeObjects.length ? closeObjects : gameObjects;
            return sourceObjs
                .filter(e => e.active && !e.isTeamObject(player) && (e.dmg || e.trap))
                .sort((a, b) => this.UTILS.getDist(a, player, 0, 2) - this.UTILS.getDist(b, player, 0, 2))
                .slice(0, limit);
        }
        objectsHit(aim) {
            let results = [];
            const sourceObjs = this.getSourceObjects();
            sourceObjs.forEach(e => {
                const scale = typeof e.getScale === "function" ? e.getScale() : e.scale;
                let dir = this.UTILS.getDirect(e, player, 0, 2);
                if (!e.active || e.isTeamObject(player)) return;
                if (!(e.dmg || e.trap)) return;
                if (this.UTILS.getDist(player, e, 2, 0) < this.items.weapons[this.useHammer(e) ? player.weapons[1] : player.weapons[0]].range + scale && this.UTILS.getAngleDist(dir, aim) < Math.PI / 2.6) {
                    results.push(e);
                }
            });
            return results;
        }
        getFilteredPriority() {
            return this.priority.map(list => list.filter(obj => obj.active && !obj.isTeamObject(player) && (obj.dmg || obj.trap) && this.UTILS.getDist(obj, player, 0, 2) <= this.items.weapons[this.useHammer(obj) ? player.weapons[1] : player.weapons[0]].range + (typeof obj.getScale === "function" ? obj.getScale() : obj.scale)));
        }
        updatePriority() {
            const sourceObjs = this.getSourceObjects();
            this.priority = [[], [], [], []];
            if (player.inTrap) {
                const trap = player.inTrap;
                const nearSpikes = sourceObjs
                    .filter(e => e.active && e.dmg && this.UTILS.getDist(e, player, 0, 2) <= 169 && !e.isTeamObject(player))
                    .sort((a, b) => this.UTILS.getDist(a, player, 0, 2) - this.UTILS.getDist(b, player, 0, 2));
                [nearSpikes[0], trap, nearSpikes[1]].forEach(item => {
                    if (item && !this.priority[0].includes(item)) this.priority[0].push(item);
                });
            }
            sourceObjs.filter(e => e.active && e.dmg && this.UTILS.getDist(e, player, 0, 2) <= 169 && !e.isTeamObject(player)).forEach(spike => {
                if (!this.priority[1].includes(spike)) this.priority[1].push(spike);
            });
            sourceObjs.filter(e => e.active && !e.isTeamObject(player) && e.trap).forEach(obj => {
                if (!this.priority[1].includes(obj)) this.priority[1].push(obj);
            });
            // Keep lower levels as hostile breakables only, never neutral/support objects.
            sourceObjs.filter(e => e.active && !e.isTeamObject(player) && (e.dmg || e.trap)).forEach(obj => {
                if (!this.priority[2].includes(obj)) this.priority[2].push(obj);
            });
            sourceObjs.filter(e => e.active && !e.isTeamObject(player) && (e.dmg || e.trap)).forEach(obj => {
                if (!this.priority[3].includes(obj)) this.priority[3].push(obj);
            });
        }
        processTargets(targetObjs, level) {
            if (!targetObjs.length) {
                this.active = false;
                this.target = null;
                return;
            }
            if (targetObjs.length > 5) {
                targetObjs = targetObjs.slice(0, 5);
            }
            const checkedAims = new Set();
            const scoreHits = (aim, rewardForTarget = 100, rewardForOther = 60) => {
                const objectsHit = this.objectsHit(aim);
                let reward = 0;
                objectsHit.forEach((obj) => {
                    if (targetObjs.includes(obj)) reward += rewardForTarget;
                    if (obj.isTeamObject(player)) {
                        if (near?.inTrap && obj.sid == near.inTrap.sid) reward -= level != 3 ? 50 : -50;
                        else if (obj.dmg || obj.trap) reward -= level != 3 ? 30 : -50;
                        else reward -= level != 3 ? 10 : -50;
                    } else {
                        reward += obj.dmg ? 70 : obj.trap ? 60 : rewardForOther;
                    }
                });
                return reward;
            };
            let aimAngles = [];
            if (targetObjs.length > 1) {
                for (let i = 0; i < targetObjs.length; i++) {
                    for (let j = i + 1; j < targetObjs.length; j++) {
                        const adjust = (angle) => angle < 0 ? angle + 2 * Math.PI : angle;
                        let aim1 = this.UTILS.getDirect(targetObjs[i], player, 0, 2);
                        let aim2 = this.UTILS.getDirect(targetObjs[j], player, 0, 2);
                        const aAdjusted = adjust(aim1);
                        const bAdjusted = adjust(aim2);
                        let avg = (aAdjusted + bAdjusted) / 2;
                        let diff = Math.abs(aAdjusted - bAdjusted);
                        if (diff > Math.PI) avg += Math.PI;
                        avg = avg % (2 * Math.PI);
                        if (avg > Math.PI) avg -= 2 * Math.PI;
                        let aimBetween = avg + 180 * (diff > 180);
                        if (checkedAims.has(aimBetween)) continue;
                        checkedAims.add(aimBetween);
                        aimAngles.push({ aim: aimBetween, reward: scoreHits(aimBetween, 100, 50) });
                    }
                }
                for (let i = 0; i < targetObjs.length; i++) {
                    const aimDirect = this.UTILS.getDirect(targetObjs[i], player, 0, 2);
                    if (checkedAims.has(aimDirect)) continue;
                    checkedAims.add(aimDirect);
                    aimAngles.push({ aim: aimDirect, reward: scoreHits(aimDirect, 100, 50) });
                }
            } else {
                const aimDirect = this.UTILS.getDirect(targetObjs[0], player, 0, 2);
                aimAngles.push({ aim: aimDirect, reward: scoreHits(aimDirect, 100, 60) });
                const saferAngles = [Math.PI / 2.6 / 3, Math.PI / 2.6 / 2, Math.PI / 2.6 - 0.1];
                for (let saferAngle of saferAngles) {
                    const saferAims = [aimDirect - saferAngle, aimDirect + saferAngle];
                    for (let saferAim of saferAims) {
                        aimAngles.push({ aim: saferAim, reward: scoreHits(saferAim, 100, 60) });
                    }
                }
            }
            if (!aimAngles.length) {
                this.active = false;
                this.target = null;
                return;
            }
            this.aim = aimAngles.sort((a, b) => b.reward - a.reward)[0].aim;
            this.target = this.objectsHit(this.aim).sort((a, b) => this.UTILS.getDist(a, player, 0, 2) - this.UTILS.getDist(b, player, 0, 2))[0] || targetObjs[0];
            this.active = true;
        }
        calculateAim() {
            const filteredPriority = this.getFilteredPriority();
            for (let level = 0; level < filteredPriority.length; level++) {
                const targets = filteredPriority[level];
                if (level == 3 && enemy.length && near.dist2 < 400) {
                    this.active = false;
                    return;
                }
                if (targets.length > 0) {
                    this.processTargets(targets, level);
                    return;
                }
            }
            this.active = false;
            this.target = null;
        }
        getEffectiveRange(target, who = player) {
            if (!who?.weapons) return 0;
            const weaponIndex = this.useHammer ? who.weapons[1] == 10 ? who.weapons[1] : who.weapons[0] : who.weapons[0];
            const baseRange = items.weapons[weaponIndex]?.range || 0;
            return baseRange + (target?.scale || 0);
        }

        isTargetBreakableInRange(target, who = player) {
            if (!target || !who) return false;
            const range = this.getEffectiveRange(target, who);
            return this.UTILS.getDist(target, who, 0, 2) <= range;
        }

        mainUPDATE() {
            if (!player || !gameObjects.length) {
                if (this.flowState) {
                    this.flowState.antiTrapped = false;
                }
                this.inTrap = false;
                return;
            }
            this.updatePriority();
            this.calculateAim();
            if (!this.active || !this.target) {
                if (this.flowState) this.flowState.antiTrapped = false;
                this.inTrap = false;
                this.info = {};
                return;
            }
            this.weapon = this.getWeaponIndexForTarget(this.target, player);
            this.dist = this.UTILS.getDist(this.target, player, 0, 2);
            this.info = this.target;
            this.inTrap = !!player.inTrap;
            if (this.inTrap && autoPlacer && !this.flowState?.antiTrapped) {
                autoPlacer.protect(this.UTILS.getDirect(player.inTrap, player, 0, 2));
            }
        }
    }

    class PlacementFlowState {
        constructor() {
            this.replaced = false;
            this.antiTrapped = false;
        }
        resetTick() {
            this.replaced = false;
            this.antiTrapped = false;
        }
    }

    class Autoplacer {
        constructor(UTILS, items, autobreaker, flowState) {
            this.UTILS = UTILS;
            this.items = items;
            this.autobreaker = autobreaker;
            this.flowState = flowState;
            this.preplaceTick = 0;
            this.placedSpikePositions = new Set();
        }
        getTargetDistance(target, type = 2) {
            if (!target) return Infinity;
            return this.UTILS.getDist(player, target, 0, type);
        }
        getEnemyReference() {
            return near?.sid ? near : null;
        }
        getEnemyAngle(target = this.getEnemyReference()) {
            if (!target) return player?.dir || 0;
            return this.UTILS.getDirect(player, target, 2, 2);
        }
        getTrapStateRef(inputState) {
            if (inputState && typeof inputState === "object") return inputState;
            if (this.autobreaker?.inTrap && this.autobreaker?.info) {
                return {
                    inTrap: true,
                    angle: this.UTILS.getDirect(this.autobreaker.info, player, 0, 2)
                };
            }
            return {
                inTrap: false,
                angle: this.getEnemyAngle()
            };
        }
        mergeClosestAngles(type, plan, target, limit, minGap) {
            const merged = Array.isArray(plan) ? plan.slice() : [];
            if (!target || typeof target.getScale !== "function") return merged.slice(0, limit);
            const closestAngles = this.closestPossibleAngles(target, type);
            if (!closestAngles?.length) return merged.slice(0, limit);
            closestAngles.forEach((angle, index) => {
                this.pushUniqueAngle(merged, type, angle, minGap, 1000 - index);
            });
            merged.sort((a, b) => b.score - a.score);
            return merged.slice(0, limit);
        }
        attemptPlacement(type, plan, fallback) {
            if (plan?.length) {
                return this.placeFromPlan(type, plan, type === 2) > 0;
            }
            if (typeof fallback === "function") {
                fallback();
            }
            return false;
        }
        closestPossibleAngles(obj, id) {
            const itemId = player.items[id];
            if (!itemId) return;
            const item = items.list[itemId];
            const px = player.x2, py = player.y2;
            const objScale = obj.getScale(0.6, obj.isItem) + 0.01;
            const dx = obj.x - px, dy = obj.y - py;
            const dist2 = dx * dx + dy * dy;
            const dist = Math.sqrt(dist2);
            if (!Number.isFinite(dist) || dist <= 0.0001) return [Math.atan2(dy || 0, dx || 1)];
            const threshold = player.scale + objScale + 2 * item.scale + item.placeOffset;

            if (dist > threshold) return [Math.atan2(dy, dx)];

            const D = player.scale + item.scale + item.placeOffset;
            const E = objScale + item.scale;
            const invDist = 1 / dist;
            const a = (D * D - E * E + dist2) * 0.5 * invDist;
            const h2 = D * D - a * a;
            if (h2 <= 0) return [Math.atan2(dy, dx)];
            const h = Math.sqrt(h2);
            const aInv = a * invDist, hInv = h * invDist;
            const px_base = px + aInv * dx, py_base = py + aInv * dy;
            const hdy = hInv * dy, hdx = hInv * dx;

            return [
                Math.atan2(py_base - hdx - py, px_base + hdy - px),
                Math.atan2(py_base + hdx - py, px_base - hdy - px),
            ];
        }
        getPlacementPoint(type, angle) {
            let item = this.items.list[player.items[type]];
            if (!item) return null;
            let offset = player.scale + item.scale + (item.placeOffset || 0);
            return {
                item: item,
                x: player.x2 + offset * Math.cos(angle),
                y: player.y2 + offset * Math.sin(angle)
            };
        }
        canPlaceAngle(type, angle) {
            let point = this.getPlacementPoint(type, angle);
            if (!point) return false;
            if (point.item.id != 19 && point.y >= config.mapScale / 2 - config.riverWidth / 2 && point.y <= config.mapScale / 2 + config.riverWidth / 2) return false;
            return objectManager.checkItemLocation(point.x, point.y, point.item.scale, 0.6, point.item.id, false, player);
        }
        testCanPlace(id, first = -(Math.PI / 2), repeat = (Math.PI / 2), plus = (Math.PI / 18), radian, replacer, yaboi) {
            try {
                let item = this.items.list[player.items[id]];
                if (!item || !player) return 0;
                let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let counts = {
                    attempts: 0,
                    placed: 0
                };
                const trapState = this.getTrapStateRef(yaboi);
                const enemyRef = this.getEnemyReference();
                const enemyAim = enemyRef?.aim2 ?? this.getEnemyAngle(enemyRef);
                let tmpObjects = [];
                gameObjects.forEach((p) => {
                    tmpObjects.push({
                        x: p.x,
                        y: p.y,
                        active: p.active,
                        blocker: p.blocker,
                        scale: p.scale,
                        isItem: p.isItem,
                        type: p.type,
                        colDiv: p.colDiv,
                        getScale: function (sM, ig) {
                            sM = sM || 1;
                            return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4) ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
                        },
                    });
                });
                for (let i = first; i < repeat; i += plus) {
                    counts.attempts++;
                    let relAim = radian + i;
                    let tmpX = player.x2 + tmpS * Math.cos(relAim);
                    let tmpY = player.y2 + tmpS * Math.sin(relAim);
                    let cantPlace = tmpObjects.find((tmp) => tmp.active && this.UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
                    if (cantPlace) continue;
                    if (item.id != 19 && tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) continue;
                    if ((!replacer && trapState) || useWasd) {
                        if (useWasd ? false : trapState?.inTrap) {
                            if (this.UTILS.getAngleDist(enemyAim + Math.PI, relAim + Math.PI) <= Math.PI) {
                                place(2, relAim, 1);
                            } else {
                                player.items[4] == 15 && place(4, relAim, 1);
                            }
                        } else {
                            if (this.UTILS.getAngleDist(enemyAim, relAim) <= config.gatherAngle / 1.5) {
                                place(2, relAim, 1);
                            } else {
                                player.items[4] == 15 && place(4, relAim, 1);
                            }
                        }
                    } else {
                        place(id, relAim, 1);
                    }
                    tmpObjects.push({
                        x: tmpX,
                        y: tmpY,
                        active: true,
                        blocker: item.blocker,
                        scale: item.scale,
                        isItem: true,
                        type: null,
                        colDiv: item.colDiv,
                        getScale: function () {
                            return this.scale;
                        },
                    });
                    if (this.UTILS.getAngleDist(enemyAim, relAim) <= 1) {
                        counts.placed++;
                    }
                }
                if (counts.placed > 0 && replacer && item.dmg && enemyRef) {
                    if (enemyRef.dist2 <= this.items.weapons[player.weapons[0]].range + (player.scale * 1.8) && configs.spikeTick) {
                        instaC.canSpikeTick = true;
                    }
                }
                return counts.placed;
            } catch (err) {
                return 0;
            }
        }
        checkSpikeTick() {
            try {
                if (![3, 4, 5].includes(near.primaryIndex)) return false;
                if ((getEl("safeAntiSpikeTick").checked || my.autoPush) ? false : near.primaryIndex == undefined ? true : (near.reloads[near.primaryIndex] > game.tickRate)) return false;
                if (near.dist2 <= this.items.weapons[near.primaryIndex || 5].range + (near.scale * 1.8)) {
                    let item = this.items.list[9];
                    let tmpS = near.scale + item.scale + (item.placeOffset || 0);
                    let danger = 0;
                    for (let i = -1; i <= 1; i += 1 / 10) {
                        let relAim = this.UTILS.getDirect(player, near, 2, 2) + i;
                        let tmpX = near.x2 + tmpS * Math.cos(relAim);
                        let tmpY = near.y2 + tmpS * Math.sin(relAim);
                        let cantPlace = gameObjects.find((tmp) => tmp.active && this.UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
                        if (cantPlace) continue;
                        if (tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) continue;
                        danger++;
                        break;
                    }
                    if (danger) {
                        my.anti0Tick = 1;
                        player.chat.count = 100000;
                        return true;
                    }
                }
            } catch (err) {
                return null;
            }
            return false;
        }
        protect(aim) {
            if (!configs.antiTrap) return;
            this.testCanPlace(2, -(Math.PI / 2), Math.PI / 2, Math.PI / 18, aim + Math.PI);
            this.flowState.antiTrapped = true;
        }
        getBlockedAngles(type) {
            let arr = [], item = this.items.list[type < this.items.list.length ? type : player.items[2]], offset = player.scale + item.scale + (item.placeOffset || 0);
            let buildings = gameObjects.filter(obj => fgdo(player, obj) < 250 && obj.active);
            for (let i = 0; i < buildings.length; i++) {
                let b = buildings[i], scale = b.isItem ? b.scale : ((b.scale != 80 && b.scale != 85 && b.scale != 90 || b.type == 1) ? b.scale * 0.4 : b.scale);
                let dist = item.scale + scale + 1, dPTB = fgdo(player, b), cosLaw;
                if (dPTB > dist + offset) {
                    cosLaw = Math.asin((dist * Math.sin(Math.acos(((offset ** 2 + dist ** 2) - dPTB ** 2) / (2 * dist * offset)))) / dPTB);
                } else {
                    cosLaw = Math.acos(((offset ** 2 + dPTB ** 2) - dist ** 2) / (2 * dPTB * offset));
                }
                let aPTB = Math.atan2(b.y - player.y2, b.x - player.x2);
                if (!isNaN(cosLaw)) arr.push([aPTB - cosLaw, aPTB + cosLaw, b]);
            }
            return arr;
        }
        angleInBetween(angle, a1, a2) {
            let diff = ((a2 - a1 + 2 * Math.PI) % (2 * Math.PI));
            let rel = ((angle - a1 + 2 * Math.PI) % (2 * Math.PI));
            return rel <= diff;
        }
        normalizeAngle(angle) {
            return Math.atan2(Math.sin(angle), Math.cos(angle));
        }
        pushUniqueAngle(bucket, type, angle, minGap = Math.PI / 8, score = 0) {
            const normalized = this.normalizeAngle(angle);
            if (!this.canPlaceAngle(type, normalized)) return false;
            if (bucket.some((entry) => Math.abs(this.UTILS.getAngleDist(entry.angle, normalized)) < minGap)) return false;
            bucket.push({ angle: normalized, score: score });
            return true;
        }
        buildSandwichAngles(type, enemyRef, gap = Math.PI / 7) {
            if (!enemyRef || !enemyRef.sid) return [];
            const baseAngle = this.UTILS.getDirect(player, enemyRef, 2, 2);
            const reverseAngle = baseAngle + Math.PI;
            const angles = [];
            [baseAngle + gap, baseAngle - gap, reverseAngle + gap * 0.7, reverseAngle - gap * 0.7].forEach((angle, index) => {
                if (this.pushUniqueAngle(angles, type, angle, Math.PI / 12, 92 - index * 6)) {
                    angles[angles.length - 1].sandwich = true;
                }
            });
            return angles;
        }
        getPingTickLead() {
            const ping = Math.max(0, Number(window.pingTime || window.ping || 0));
            const tickMs = game.tickRate || (1000 / config.serverUpdateRate);
            return Math.max(0, Math.min(3, Math.round((ping * 0.5) / Math.max(1, tickMs))));
        }
        buildPlacementAngles(type, {
            step = Math.PI / 72,
            limit = 3,
            baseAngle = null,
            minGap = type === 4 ? Math.PI / 7 : Math.PI / 9,
            mirror = false,
            fallbackSweep = true
        } = {}) {
            const plan = [];
            const sandwichAngles = this.buildSandwichAngles(type, near, type === 4 ? Math.PI / 6 : Math.PI / 7);
            sandwichAngles.forEach((candidate) => {
                if (plan.length < limit) {
                    this.pushUniqueAngle(plan, type, candidate.angle, minGap, candidate.score + 8);
                }
            });
            const graded = this.gradeAngles(type, step, Math.max(limit * 3, limit));
            graded.forEach((candidate) => {
                if (plan.length < limit) {
                    this.pushUniqueAngle(plan, type, candidate.angle, minGap, candidate.score);
                }
            });
            if (baseAngle != null && plan.length < limit) {
                const offsets = type === 4 ? [0, 0.22, -0.22, 0.45, -0.45] : [0, 0.28, -0.28, 0.56, -0.56, Math.PI / 2, -(Math.PI / 2)];
                offsets.forEach((offset, index) => {
                    if (plan.length >= limit) return;
                    this.pushUniqueAngle(plan, type, baseAngle + offset, minGap, 100 - index);
                });
                if (mirror && plan.length < limit) {
                    offsets.forEach((offset, index) => {
                        if (plan.length >= limit) return;
                        this.pushUniqueAngle(plan, type, baseAngle - offset, minGap, 90 - index);
                    });
                }
            }
            if (fallbackSweep && plan.length < limit) {
                this.gradeAngles(type, Math.PI / 96, limit * 4).forEach((candidate) => {
                    if (plan.length < limit) {
                        this.pushUniqueAngle(plan, type, candidate.angle, minGap, candidate.score);
                    }
                });
            }
            return plan.sort((a, b) => b.score - a.score).slice(0, limit);
        }
        placeFromPlan(type, plan, dedupe = false) {
            let placed = 0;
            plan.forEach((candidate) => {
                const angle = candidate.angle;
                if (dedupe) {
                    const key = `${type}:${angle.toFixed(3)}`;
                    if (this.placedSpikePositions.has(key)) return;
                    this.placedSpikePositions.add(key);
                    setTimeout(() => this.placedSpikePositions.delete(key), 180);
                }
                if (checkPlace(type, angle)) placed++;
            });
            return placed;
        }
        gradeAngles(type, step = Math.PI / 180, limit = 6) {
            let blocked = this.getBlockedAngles(type), grades = [];
            if (!near || !near.sid) return grades;
            let enemyAngle = this.UTILS.getDirect(player, near, 2, 2);
            let threatAngle = near.aim2 || enemyAngle;
            let predictedEnemy = {
                x: (near.x2 || near.x) + (near.xVel || 0) * 0.85,
                y: (near.y2 || near.y) + (near.yVel || 0) * 0.85
            };
            let localObjects = gameObjects.filter((obj) => obj.active && Math.hypot((obj.x || 0) - player.x2, (obj.y || 0) - player.y2) <= 260);
            let preferWide = near.dist2 <= 120 || near.inTrap;
            for (let a = 0; a < 2 * Math.PI; a += step) {
                let blockedBy = blocked.find(([start, end]) => this.angleInBetween(a, start, end));
                if (blockedBy || !this.canPlaceAngle(type, a)) continue;
                let point = this.getPlacementPoint(type, a);
                if (!point) continue;
                let directDist = Math.hypot(point.x - (near.x2 || near.x), point.y - (near.y2 || near.y));
                let futureDist = Math.hypot(point.x - predictedEnemy.x, point.y - predictedEnemy.y);
                let aimDiff = Math.abs(this.UTILS.getAngleDist(a, enemyAngle));
                let threatDiff = Math.abs(this.UTILS.getAngleDist(a, threatAngle));
                let sideDiff = Math.min(Math.abs(this.UTILS.getAngleDist(a, enemyAngle + Math.PI / 2)), Math.abs(this.UTILS.getAngleDist(a, enemyAngle - Math.PI / 2)));
                let nearestObj = localObjects.reduce((best, obj) => Math.min(best, Math.hypot(point.x - obj.x, point.y - obj.y)), Infinity);
                let score = 0;
                if (!configs.opPlaceAngles) {
                    let distanceFactor = Math.max(0, 1 - (Math.abs(this.UTILS.getAngleDist(a, threatAngle)) / Math.PI));
                    let safetyFactor = Math.max(0, 1 - (Math.abs(this.UTILS.getAngleDist(a, enemyAngle + Math.PI)) / (Math.PI * 0.5)));
                    score = distanceFactor * 0.7 + safetyFactor * 0.3;
                } else if (type === 4) {
                    score += Math.max(0, 185 - directDist) * 1.4;
                    score += Math.max(0, 170 - futureDist) * 2.2;
                    score += Math.max(0, 1.2 - aimDiff) * 35;
                    score += Math.max(0, 0.9 - threatDiff) * 30;
                } else if (type === 2) {
                    score += Math.max(0, 145 - directDist) * 1.2;
                    score += Math.max(0, 135 - futureDist) * 2.5;
                    score += Math.max(0, 1.25 - sideDiff) * 24;
                    score += Math.max(0, 1.1 - aimDiff) * 18;
                    let reverseDiff = Math.abs(this.UTILS.getAngleDist(a, enemyAngle + Math.PI));
                    score += Math.max(0, 0.9 - reverseDiff) * 16;
                    if (preferWide) score += Math.max(0, 1.0 - threatDiff) * 12;
                } else {
                    score += Math.max(0, 210 - directDist) * 1.2;
                    score += Math.max(0, 195 - futureDist) * 1.3;
                    score += Math.max(0, 1.15 - threatDiff) * 24;
                }
                score += Math.max(0, Math.min(120, nearestObj) - 25) * 0.12;
                if (near.inTrap) score += Math.max(0, 120 - futureDist) * 1.5;
                grades.push({
                    angle: a,
                    blockedBy: null,
                    score: score,
                    futureDist: futureDist,
                    directDist: directDist
                });
            }
            grades.sort((a, b) => b.score - a.score);
            let picked = [];
            let minGap = type === 4 ? Math.PI / 6 : Math.PI / 8;
            for (let i = 0; i < grades.length; i++) {
                if (picked.every((existing) => Math.abs(this.UTILS.getAngleDist(existing.angle, grades[i].angle)) >= minGap)) {
                    picked.push(grades[i]);
                }
                if (picked.length >= limit) break;
            }
            return picked;
        }
        safewalk() {
            safewalking = false;
            if (!player || !player.alive || !near || !near.sid) return false;
            let lethalObjects = gameObjects.filter((obj) => obj.active && !obj.isTeamObject(player) && (obj.dmg || obj.trap) && this.UTILS.getDist(obj, player, 0, 2) <= player.scale + obj.getScale() + 14);
            let forwardAngle = player.moveDir != undefined ? player.moveDir : near.aim2;
            let forwardThreat = lethalObjects.some((obj) => Math.abs(this.UTILS.getAngleDist(Math.atan2(obj.y - player.y2, obj.x - player.x2), forwardAngle)) <= Math.PI / 3);
            let enemyThreat = near.reloads[near.primaryIndex || 5] <= game.tickRate && near.dist2 <= this.items.weapons[near.primaryIndex || 5].range + near.scale * 1.8;
            safewalking = !!((forwardThreat && (player.moveDir != undefined || useWasd)) || (enemyThreat && lethalObjects.length));
            return safewalking;
        }
        preplacer(who = player) {
            if (!configs.opPlaceAngles || !near?.sid || who?.weaponIndex == null || this.preplaceTick === game.tick) return false;
            if (instaC.isTrue || autoBreak.active || who.inTrap || player.tailIndex == 11) return false;
            const leadTicks = this.getPingTickLead();
            const perfectTickWindow = (game.tickRate || (1000 / config.serverUpdateRate)) * (leadTicks + 1);
            if (who.reloads[who.weaponIndex] > perfectTickWindow) return false;
            let index = who.weaponIndex;
            let variantKey = (index < 9 ? "prima" : "seconda") + "ryVariant";
            let variantVal = config.weaponVariants[who[variantKey]]?.val || 1;
            let weapon = this.items.weapons[index];
            if (!weapon) return false;
            let nearObja = liztobj.filter((e) => (e.active || e.alive) && e.health < e.maxHealth && e.group !== undefined && this.UTILS.getDist(e, player, 0, 2) <= (this.items.weapons[player.weaponIndex].range + e.scale));
            nearObja = nearObja
                .map((obj) => {
                    let damage = weapon.dmg * variantVal * (weapon.sDmg || 1) * (player.skinIndex == 40 ? 3.3 : 1);
                    return {
                        obj,
                        damage,
                        remaining: obj.health - damage,
                        dist: this.UTILS.getDist(obj, player, 0, 2),
                    };
                })
                .filter((entry) => entry.remaining <= 0)
                .sort((a, b) => a.remaining - b.remaining || a.dist - b.dist);
            let placed = false;
            if (nearObja.length) {
                let obj = nearObja[0].obj;
                let fallbackAngle = caf(obj, player) + Math.PI;
                let placeId = 2;
                let plan = this.buildPlacementAngles(placeId, {
                    step: Math.PI / 96,
                    limit: 4,
                    baseAngle: fallbackAngle,
                    minGap: Math.PI / 10,
                    mirror: true
                });
                const sandwichPlan = this.buildSandwichAngles(placeId, near, Math.PI / 8).map((entry) => ({ ...entry, score: (entry.score || 0) + 14 + Math.max(0, 3 - leadTicks) }));
                plan = [...sandwichPlan, ...plan].sort((a, b) => (b.score || 0) - (a.score || 0));
                plan = this.mergeClosestAngles(placeId, plan, obj, 3, Math.PI / 10);
                if (!plan.length) plan = [{ angle: fallbackAngle, score: 1 }];
                const spikePlaced = this.placeFromPlan(placeId, plan, true);
                if (spikePlaced > 0 && (near?.inTrap || near?.lastTrap)) {
                    if ([4, 5].includes(player.weapons[0]) && typeof instaC?.spikeTickType === "function" && !instaC.isTrue && player.reloads[player.weapons[0]] == 0) {
                        instaC.canSpikeTick = true;
                        instaC.spikeTickType();
                    } else {
                        this.replacer(obj);
                    }
                }
                placed = spikePlaced > 0;
            }
            if (placed) this.preplaceTick = game.tick;
            return placed;
        }
        autoPlace() {
            if (!enemy.length || !(configs.AutoMatePlace || configs.autoPlace) || instaC.ticking) return;
            const nearDistance = this.UTILS.getDist(player, near, 0, 2);
            if (nearDistance > (typeof secPacket !== 'undefined' ? 360 : 460)) return;
            const breakerTrapState = this.getTrapStateRef();
            const nearTrap = (closeObjects.length ? closeObjects : gameObjects)
                .filter(obj => obj.trap && obj.active && obj.isTeamObject(player) && this.UTILS.getDist(obj, near, 0, 2) <= near.scale + obj.getScale() + 5)
                .sort((a, b) => this.UTILS.getDist(a, near, 0, 2) - this.UTILS.getDist(b, near, 0, 2))[0];
            const playerTooCloseToTrap = !!player.inTrap;
            const enemyAngle = this.UTILS.getDirect(player, near, 2, 2);
            let didTrap = false;
            if (player.items[4] === 15 && !nearTrap) {
                let trapAngles = this.buildPlacementAngles(4, {
                    step: configs.opPlaceAngles ? Math.PI / 96 : Math.PI / 18,
                    limit: configs.opPlaceAngles ? (nearDistance <= 140 ? 4 : 3) : 2,
                    baseAngle: enemyAngle,
                    minGap: Math.PI / 7,
                    mirror: true
                });
                trapAngles = this.mergeClosestAngles(4, trapAngles, near, configs.opPlaceAngles ? 4 : 2, Math.PI / 7);
                if (trapAngles.length) {
                    didTrap = this.placeFromPlan(4, trapAngles, false) > 0;
                }
            }
            if (nearTrap && !playerTooCloseToTrap && typeof secPacket !== 'undefined' && near.dist2 <= 160) {
                let trapSpikeAngles = this.buildPlacementAngles(2, {
                    step: configs.opPlaceAngles ? Math.PI / 96 : Math.PI / 36,
                    limit: configs.opPlaceAngles ? 5 : 2,
                    baseAngle: enemyAngle,
                    minGap: Math.PI / 12,
                    mirror: true
                });
                trapSpikeAngles = this.mergeClosestAngles(2, trapSpikeAngles, near, configs.opPlaceAngles ? 5 : 2, Math.PI / 12);
                this.placeFromPlan(2, trapSpikeAngles, true);
            }
            if (nearTrap) {
                let spikeAngles = this.buildPlacementAngles(2, {
                    step: configs.opPlaceAngles ? Math.PI / 128 : Math.PI / 36,
                    limit: configs.opPlaceAngles ? (nearDistance <= 130 ? 6 : 5) : 2,
                    baseAngle: enemyAngle,
                    minGap: Math.PI / 16,
                    mirror: true
                });
                spikeAngles = this.mergeClosestAngles(2, spikeAngles, near, configs.opPlaceAngles ? (nearDistance <= 130 ? 6 : 5) : 2, Math.PI / 16);
                if (!playerTooCloseToTrap && spikeAngles.length) {
                    this.placeFromPlan(2, spikeAngles.filter((candidate, index) => index === 0 || nearDistance <= 160 || (typeof secPacket !== 'undefined' && secPacket <= 90)), true);
                } else if (playerTooCloseToTrap) {
                    this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 16, enemyAngle, 0, breakerTrapState);
                } else {
                    this.testCanPlace(2, -(Math.PI * 1.25), Math.PI * 1.25, Math.PI / 24, enemyAngle, false, breakerTrapState);
                }
            } else if (!didTrap) {
                this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 16, enemyAngle, 0, breakerTrapState);
            }
            {
                const autoPlaceTick = Math.max(1, parseInt(getEl("autoPlaceTick")?.value, 10) || 1);
                const movingFast = Number.isFinite(player.moveDir) || Number.isFinite(lastMoveDir);
                const shouldFastTrack = movingFast || nearDistance <= 170 || (typeof secPacket !== 'undefined' && secPacket <= 90);
                if ((!shouldFastTrack && game.tick % autoPlaceTick !== 0) || !closeObjects.length) return;
                let tryTicked = [3, 4, 5].includes(near.primaryIndex);
                const id = 2;
                let tickAngles = this.buildPlacementAngles(id, {
                    step: shouldFastTrack ? (configs.opPlaceAngles ? Math.PI / 128 : Math.PI / 64) : (configs.opPlaceAngles ? Math.PI / 96 : Math.PI / 48),
                    limit: id === 2 && configs.opPlaceAngles ? (shouldFastTrack ? 6 : 4) : (shouldFastTrack ? 3 : 2),
                    baseAngle: enemyAngle,
                    minGap: id === 2 ? Math.PI / 12 : Math.PI / 6,
                    mirror: id === 2
                });
                tickAngles = this.mergeClosestAngles(id, tickAngles, near, id === 2 && configs.opPlaceAngles ? (shouldFastTrack ? 6 : 4) : (shouldFastTrack ? 3 : 2), id === 2 ? Math.PI / 12 : Math.PI / 6);
                if (tickAngles.length) {
                    this.placeFromPlan(id, tickAngles, id === 2);
                } else {
                    this.testCanPlace(id, -(Math.PI * 1.5), Math.PI * 1.5, Math.PI / 48, near.aim2, tryTicked && id === 2, breakerTrapState);
                }
            }
        }
        replacer(findObj) {
            if (!findObj || !configs.autoReplace) return;
            if (!inGame) return;
            if (this.flowState.antiTrapped) return;
            game.tickBase(() => {
                let objAim = this.UTILS.getDirect(findObj, player, 0, 2);
                let objDst = this.UTILS.getDist(findObj, player, 0, 2);
                if (getEl("weaponGrind").checked && objDst <= this.items.weapons[player.weaponIndex].range + player.scale) return;
                if (objDst <= 400 && near.dist2 <= 400) {
                    let danger = this.checkSpikeTick();
                    if (!danger && near.dist3 <= this.items.weapons[near.primaryIndex || 5].range + (near.scale * 1.8)) {
                        let angles = this.buildPlacementAngles(2, {
                            step: Math.PI / 96,
                            limit: configs.opPlaceAngles ? 5 : 2,
                            baseAngle: objAim,
                            minGap: Math.PI / 12,
                            mirror: true
                        });
                        angles = this.mergeClosestAngles(2, angles, findObj, configs.opPlaceAngles ? 5 : 2, Math.PI / 12);
                        if (angles.length) {
                            const spikePlaced = this.placeFromPlan(2, angles, true);
                            if (spikePlaced > 0 && (near?.inTrap || near?.lastTrap)) {
                                if ([4, 5].includes(player.weapons[0]) && typeof instaC?.spikeTickType === "function" && !instaC.isTrue && player.reloads[player.weapons[0]] == 0) {
                                    instaC.canSpikeTick = true;
                                    instaC.spikeTickType();
                                } else if (player.items[4] == 15) {
                                    this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                                }
                            }
                        }
                        else {
                            this.testCanPlace(2, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 18), objAim, 1);
                            this.testCanPlace(2, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                        }
                    } else {
                        if (player.items[4] == 15) {
                            let trapAngles = this.buildPlacementAngles(4, {
                                step: Math.PI / 96,
                                limit: configs.opPlaceAngles ? 4 : 2,
                                baseAngle: objAim,
                                minGap: Math.PI / 7,
                                mirror: true
                            });
                            trapAngles = this.mergeClosestAngles(4, trapAngles, findObj, configs.opPlaceAngles ? 4 : 2, Math.PI / 7);
                            if (trapAngles.length) this.placeFromPlan(4, trapAngles, false);
                            else this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                        }
                    }
                    this.flowState.replaced = true;
                }
            }, 1);
        }
    }

    function canPlayerHitNearTarget() {
        if (!near || !near.sid || !player?.weapons) return false;
        const weapon = player.weapons[player.weapons[1] == 10 && !player.reloads[player.weapons[1]] ? 1 : 0];
        const range = items.weapons[weapon]?.range || 0;
        return near.dist2 <= range + near.scale + player.scale;
    }


    let breakObjs = [];
    function bestAim(main, range, objs = liztobj) {
        const possibleTargets = objs.filter(obj => obj.active && obj.type === null && obj?.owner?.sid && obj.dist2 <= range + obj.scale);
        const startAim = main;
        let bestAim = startAim;
        let concatObj = [];
        let maxHitCount = -999;
        let defaultHitCount = 0;
        for (let i = -3; i < 3; i += 1) {
            const aimer = startAim + UTILS.toRad(i * 10);
            const hitObjs = [];
            let hitCount = 0;
            for (let j = 0; j < possibleTargets.length; j++) {
                const target = possibleTargets[j];
                if (UTILS.getAngleDist(caf(player, target), aimer) <= config.gatherAngle) {
                    hitObjs.push(target);
                    hitCount += target?.owner?.sid === player.sid ? -0.5 : 1;
                }
            }
            if (i == 0) {
                defaultHitCount = hitCount;
            }
            if (hitCount > maxHitCount) {
                maxHitCount = hitCount;
                bestAim = aimer;
                concatObj = hitObjs;
            }
        }
        breakObjs.push(concatObj);
        breakObjs = breakObjs.flat();
        if (defaultHitCount == maxHitCount) {
            return main;
        } else {
            return bestAim;
        }
    }
    const decayRate = Math.pow(0.993, 111.11112);
    function getDecelDist(x, t) {
        if (!Number.isFinite(x)) {
            return null;
        }
        let value = x;
        while (value >= 0.001) {
            value *= decayRate;
            x += value;
        }
        return x;
    }
    function checkStoppedMoving(tmp) {
        if (!tmp?.oldPos || !Number.isFinite(tmp?.oldXVel) || !Number.isFinite(tmp?.oldYVel)) return [false, null, null];
        let fullDecelPos = {
            x: tmp.oldPos.x2 + tmp.oldXVel * decayRate,
            y: tmp.oldPos.y2 + tmp.oldYVel * decayRate
        };
        let decelPos = {
            x: tmp.oldPos.x2 + tmp.oldXVel * decayRate,
            y: tmp.oldPos.y2 + tmp.oldYVel * decayRate
        };
        if (Math.abs(tmp.x2 - fullDecelPos.x) <= 2 && Math.abs(tmp.y2 - fullDecelPos.y) <= 2) {
            return [true, "fullDecel", {
                x: tmp.x2 + tmp.xVel * decayRate,
                y: tmp.y2 + tmp.yVel * decayRate
            }];
        } else if (Math.abs(tmp.x2 - fullDecelPos.x) <= 2) {
            return [true, "xDecel", {
                x: tmp.x2 + tmp.xVel * decayRate,
                y: tmp.y2 + (tmp.y2 - tmp.oldPos.y2)
            }];
        } else if (Math.abs(tmp.y2 - fullDecelPos.y) <= 2) {
            return [true, "yDecel", {
                x: tmp.x2 + (tmp.x2 - tmp.oldPos.x2),
                y: tmp.y2 + tmp.yVel * decayRate
            }];
        }
        return [false, null, null];
    }
    function getMoveSpeed(ticks, tmp, dir) {
        if (!tmp || !Number.isFinite(ticks)) return { x: 0, y: 0 };
        tmp.newXVel = tmp.xVel;
        tmp.newYVel = tmp.yVel;
        let totalXVel = 0;
        let totalYVel = 0;
        let decel = false;
        if (tmp?.velocity != undefined && tmp.sid != player.sid) {
            decel = cdf(tmp, tmp.velocity?.accel) > cdf(tmp, tmp.velocity?.decel) && dAng(tmp.movDir, tmp.pmovDir) <= 0.3;
        }
        if (tmp.sid == player.sid) {
            if (clientMoveDir == undefined) {
                decel = true;
            }
        }
        for (let i = 0; i < ticks; i++) {
            tmp.newXVel = tmp.newXVel * Math.pow(0.993, game.tickSpeed) + (decel ? 0 : Math.cos(dir) * 0.0016 * tmp.maxSpeed * game.tickRate * game.tickSpeed);
            tmp.newYVel = tmp.newYVel * Math.pow(0.993, game.tickSpeed) + (decel ? 0 : Math.sin(dir) * 0.0016 * tmp.maxSpeed * game.tickRate * game.tickSpeed);
            totalXVel += tmp.newXVel;
            totalYVel += tmp.newYVel;
        }
        return {
            x: tmp.newXVel,
            y: tmp.newYVel
        };
    }
    function getMovePos(ticksToMove, tmp, angle) {
        if (typeof angle != "number" || typeof ticksToMove != "number" || !tmp?.update) return { x: tmp?.x2 || 0, y: tmp?.y2 || 0 };
        tmp.update(1);
        const moveSpeed = getMoveSpeed(ticksToMove, tmp, angle);
        return {
            x: (tmp.x2 || 0) + moveSpeed.x,
            y: (tmp.y2 || 0) + moveSpeed.y
        };
    }
    function checkIsTeam(sid) {
        return alliancePlayers.find(THIS => THIS === sid) != undefined;
    }
    let moveTicks = 0;
    let didStop = {
        time: Date.now(),
        type: null
    };
    var stopHit = 0;
    function objDmgPot() {
        for (let i = 0; i < liztobj.length; i++) {
            liztobj[i].dmgpot = 0;
        }
        for (let x = 0; x < players.length; x++) {
            const _ = players[x];
            if (_.sid == player.sid) {
                continue;
            }
            _.bDmg = _?.secondaryIndex === 10 && _.reloads?.[_.secondaryIndex] === 0 ? {
                dmg: sortWeaponVariant(_.secondaryVariant) * 75 * 3.3,
                wep: 10
            } : _?.primary && _.reloads?.[_.primaryIndex] === 0 ? {
                dmg: _?.primary?.dmg * 3.3 * sortWeaponVariant(_.primaryVariant),
                wep: _.primaryIndex
            } : 0;
            if (_.bDmg === 0) {
                continue;
            }
            for (let i = 0; i < liztobj.length; i++) {
                const object = liztobj[i];
                object.assumeBreak = false;
                if (object.type !== null || !object?.owner?.sid) {
                    continue;
                }
                const weaponInfo = items.weapons[_.bDmg.wep];
                if (!weaponInfo) continue;
                const d_o = UTILS.getDist(_, object, 2, 0) <= weaponInfo.range + object.scale;
                if (!d_o) {
                    continue;
                }
                object.dmgpot = _.bDmg.dmg;
                if (_.antiBull) {
                    object.likelyDmg = _.bDmg.dmg;
                }

                if (object.likelyDmg >= object.health) {
                    breakObjs.push(object);
                }
                if (object.dmgpot >= object.health) {
                    object.assumeBreak = true;

                    continue;
                }
            }
        }
    }
    function breakShit(angle, wep, variant, hat, force, type, o, t, dmg) {
        for (let i = 0; i < liztobj.length; i++) {
            const greg = liztobj[i];
            if (greg.type !== null || !greg?.owner?.sid || greg.dist2 > items.weapons[wep]?.range + greg.scale) {
                continue;
            }
            t = caf(player, liztobj[i]);
            if (UTILS.getAngleDist(t, angle) <= config.gatherAngle && greg.type === null) {
                dmg = items.weapons[wep].dmg * (wep === 10 ? 7.5 : 1) * (hat === 40 ? 3.3 : 1) * sortWeaponVariant(variant);
                const conditions = (wep < 9 ? player.reloads[player.weapons[0]] : player.reloads[player.weapons[1]]) === 0 && dmg >= greg.health;
                if (conditions) {
                    greg.assumeBreak = true;
                    greg.manualBreak = true;
                    breakObjs.push(greg);
                } else if (force) {
                    breakObjs.push(greg);
                }
            }
        }
    }
    function calcNewVel(_, ang, set, docalc, time) {
        let tmpPlyr = _;
        let xVel = tmpPlyr.x3 - tmpPlyr.x2;
        let yVel = tmpPlyr.y3 - tmpPlyr.y2;
        let x2 = _.x3;
        let y2 = _.y3;
        if (typeof time !== "number") {
            time = game.tickRate;
        }
        let {
            sin,
            cos,
            pow,
            sqrt,
            max,
            round,
            min
        } = Math;

        if (!docalc) {
            if (_.sid == player.sid && ang !== 0 && !ang) {
                ang = getMoveDir();
            } else if (_.trapped) {
                ang = undefined;
            } else if (!ang && ang !== 0) {
                ang = _.movDir;
            }
        }

        let cosX = cos(ang);
        let sinY = sin(ang);
        let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
        if (sqrtDis != 0) {
            cosX /= sqrtDis;
            sinY /= sqrtDis;
        }
        if (!set) {
            set = _;
        }
        let mult = set.maxSpeed;
        _.speedXD = 0;
        _.speedYD = 0;
        _.predY = 0;
        _.predX = 0;
        if (cosX) {
            _.speedXD += cosX * 0.0016 * mult * time;
        }
        if (sinY) {
            _.speedYD += sinY * 0.0016 * mult * time;
        }

        if (_.speedXD) {
            _.predX += _.speedXD * time;
        }
        if (_.speedYD) {
            _.predY += _.speedYD * time;
        }
        let velXD = xVel * pow(0.993, time);
        let velYD = yVel * pow(0.993, time);
        let velX = velXD + _.predX;
        let velY = velYD + _.predY;
        let accel = {
            x: x2 + velX,
            y: y2 + velY,
            type: "accel"
        };
        let decel = {
            x: x2 + velXD,
            y: y2 + velYD,
            type: "decel"
        };
        let current = {
            x: x2,
            y: y2,
            type: "current"
        };
        let nextVel = {
            x: velX,
            y: velY,
            type: "nextVel"
        };
        let real = accel;
        let vel = sqrt(velX * velX + velY * velY);
        let spd = mult;
        let

            boostxVel;
        let boostyVel;

        boostxVel = time * 1.5 * cos(ang);
        boostyVel = time * 1.5 * sin(ang);
        let boostCoords = {
            x: x2 + boostxVel,
            y: y2 + boostyVel
        };
        if (_?.velocity != undefined && _.sid != player.sid) {
            real = cdf(_, _.oldPos) == 0 || cdf(_, _.velocity?.accel) > cdf(_, _.velocity?.decel) && dAng(_.movDir, _.pmovDir) <= 0.3 || _.trapped ? decel : accel;
        }
        if (_.sid == player.sid) {
            if (getMoveDir() == undefined || clientMoveDir == null) {
                real = decel;
            } else {
                real = accel;
            }
        }
        function fulldecel(e, t, coords, e2, t2) {
            if (isNaN(e) || isNaN(t)) {
                return;
            }
            try {
                e2 = e * decayRate;
                t2 = t * decayRate;
                if (e != e2) {
                    e = e2;
                    coords.x += e;
                }
                if (t != t2) {
                    t = t2;
                    coords.y += t;
                }
                if (e == e2 && t == t2) {
                    return {
                        x: coords.x,
                        y: coords.y,
                        type: "full decel"
                    };
                } else {

                    return fulldecel(e, t, coords);
                }
            } catch (e) { }
        }
        let fullDecel = fulldecel(velX, velY, {
            x: x2 + velX,
            y: y2 + velY
        });
        let result = {
            accel: accel,
            decel: decel,
            boostCoords: boostCoords,
            boostVel: {
                x: boostxVel,
                y: boostyVel
            },
            nextVel: nextVel,
            real: real,
            current: current,
            fullDecel: fullDecel,
            xVel: velX,
            spd: mult,
            yVel: velY,
            vel: vel
        };
        return result;
    }
    function sortWeaponVariant(id) {
        switch (id) {
            case 0:
                return 1;
                break;
            case 1:
                return 1.1;
                break;
            case 2:
                return 1.18;
                break;
            case 3:
                return 1.18;
                break;
            default:
                return 1;
                break;
        }
    }
    let hatPredictTrap = false;
    function predictHatSwitch(id, mainHat = nearestEnemy.skinIndex) { // simple predict hat of main
        if (near.inTrap) {
            if (mainHat == 6 || mainHat == 22) {
                if (predictReload() && (mainHat != 6 || mainHat != 22)) {
                    hatPredictTrap = true;
                } else {
                    hatPredictTrap = false;
                }
            } else {
                hatPredictTrap = false;
            }
        }
    }
    function fulldecel(e, t, coords, e2, t2) {
        if (isNaN(e) || isNaN(t)) {
            return;
        }
        try {
            e2 = e * decayRate;
            t2 = t * decayRate;
            if (e != e2) {
                e = e2;
                coords.x += e;
            }
            if (t != t2) {
                t = t2;
                coords.y += t;
            }
            if (e == e2 && t == t2) {
                return {
                    x: coords.x,
                    y: coords.y,
                    type: "full decel"
                };
            } else {

                return fulldecel(e, t, coords);
            }
        } catch (e) { }
    }
    function calcAccel(_, ang, set, time) {
        if (!time || typeof time !== "number") {
            time = game.tickRate;
        }
        let {
            sin,
            cos,
            pow,
            sqrt
        } = Math;
        let cosX = cos(ang);
        let sinY = sin(ang);
        let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
        if (sqrtDis != 0) {
            cosX /= sqrtDis;
            sinY /= sqrtDis;
        }
        if (!set) {
            set = _;
        }
        const decel = pow(0.993, time);
        const move = set.maxSpeed * 0.0016 * time * time;
        const xVel = _.xVel * decel + cosX * move;
        const yVel = _.yVel * decel + sinY * move;
        return {
            xVel: xVel,
            yVel: yVel,
            x2: (_.x2 ?? _.x) + xVel,
            y2: (_.y2 ?? _.y) + yVel
        };
    }
    function calcOTVel() {
        const _ = player;
        let time = game.tickRate;
        const newVel = calcAccel(_, near.aim3, {
            maxSpeed: 0.77
        }, time);
        let xVel = newVel.x2 - player.x2;
        let yVel = newVel.y2 - player.y2;
        let x2 = newVel.x2;
        let y2 = newVel.y2;
        let {
            sin,
            cos,
            pow
        } = Math;
        let cosX = cos(near.aim3);
        let sinY = sin(near.aim3);
        let mult = 1.056;
        _.speedXD = 0;
        _.speedYD = 0;
        _.predY = 0;
        _.predX = 0;
        if (cosX) {
            _.speedXD += cosX * 0.0016 * mult * time;
        }
        if (sinY) {
            _.speedYD += sinY * 0.0016 * mult * time;
        }
        if (_.speedXD) {
            _.predX += _.speedXD * time;
        }
        if (_.speedYD) {
            _.predY += _.speedYD * time;
        }
        let velXD = xVel * pow(0.993, time);
        let velYD = yVel * pow(0.993, time);
        let velX = velXD + _.predX;
        let velY = velYD + _.predY;
        return {
            x: x2 + velX,
            y: y2 + velY
        };
    }
    function getAngleDifference(angle1, angle2) {
        angle1 = angle1 % (Math.PI * 2);
        angle2 = angle2 % (Math.PI * 2);
        let diff = Math.abs(angle1 - angle2);
        if (diff > Math.PI) {
            diff = Math.PI * 2 - diff;
        }
        return diff;
    }
    let noMove = false;
    let onetick123modprov3asd = false;
    let noWep = false;
    function oneTick(insta, dontMove) {
        let moveAim = UTILS.getDirect(near, player, 3, 2);
        if (autoBreak.inTrap) {
            return;
        }
        if (insta) {
            if (player.reloads[player.weapons[0]] == 0) {
                selectWeapon(10, 0, 1);
            }
            noMove = true;
            noZ = true;
            if (!dontMove) {
                packet("9", moveAim, 1, "onetick");
            }
            buyEquip(53, 0);
            my.autoAim = true;
            instaC.isTrue = true;
            realDir(2);
            game.tickBase(() => {
                onetick123modprov3asd = true;
                noZ = false;
                selectWeapon(5, 0, 1);
                noZ = true;
                noWep = true;
                buyEquip(7, 0);
                sendAutoGather();
                if (!dontMove) {
                    packet("9", moveAim, 1, "onetick");
                }
                game.tickBase(() => {
                    sendAutoGather();
                    noZ = false;
                    noWep = false;
                    my.autoAim = false;
                    onetick123modprov3asd = false;
                    instaC.isTrue = false;
                }, 1);
                game.tickBase(() => {
                    game.tickBase(() => {
                        noWep = false;
                        if (!dontMove) {
                            packet("9", undefined, 1, "onetick");
                        }
                    }, 1);
                    noMove = false;
                }, 1);
            }, 1);
        } else {
            noMove = true;
            packet("9", moveAim, 1, "onetick");
            instaC.isTrue = true;
            game.tickBase(() => {
                realDir(2);
                packet("9", moveAim, 1, "onetick");
                buyEquip(53, 0);
                my.autoAim = true;
                game.tickBase(() => {
                    selectWeapon(5);
                    buyEquip(7, 0);
                    sendAutoGather();
                    packet("9", moveAim, 1, "onetick");
                    game.tickBase(() => {
                        my.autoAim = false;
                        sendAutoGather();
                        instaC.isTrue = false;
                        game.tickBase(() => {
                            packet("9", undefined, 1, "onetick");
                        }, 1);
                        noMove = false;
                    }, 1);
                }, 1);
            }, 1);
        }
    }
    let predictMove;
    let kbPoten;
    function kbPotential(player, near, spike) {
        let dist = UTILS.getDist(player, near, 0, 0);
        let knockbackPotential = items.weapons[player.weapons[0]].knock * items.weapons[player.weapons[0]].range + (player.scale * 1.8)
        if (spike) {
            let spikeDist = UTILS.getDist(spike, near, 0, 0);
            let playerSpikeDist = UTILS.getDist(player, spike, 0, 0);
            knockbackPotential += (spikeDist / playerSpikeDist) * 10;
        }
        let knockbackDirection = {
            x: near.x - player.x,
            y: near.y - player.y
        };
        let magnitude = Math.sqrt(knockbackDirection.x ** 2 + knockbackDirection.y ** 2);
        knockbackDirection.x /= magnitude;
        knockbackDirection.y /= magnitude;
        knockbackPotential += Math.abs(knockbackDirection.x) + Math.abs(knockbackDirection.y);
        predictMove = {
            x: near.x + knockbackDirection.x * knockbackPotential,
            y: near.y + knockbackDirection.y * knockbackPotential
        };
        near.predictMove = predictMove;
        return knockbackPotential;
    }
    // INSTAS:
    class Instakill {
        constructor() {
            this.wait = false;
            this.can = false;
            this.isTrue = false;
            this.nobull = false;
            this.ticking = false;
            this.canSpikeTick = false;
            this.startTick = false;
            this.readyTick = false;
            this.canCounter = false;
            this.revTick = false;
            this.syncHit = false;
            this.changeType = function (type) {
                this.wait = false;
                this.isTrue = true;
                my.autoAim = true;
                let instaLog = [type];
                let backupNobull = near.backupNobull;
                near.backupNobull = false;
                game.tickBase(() => {
                    instaLog.push(player.skinIndex);
                    game.tickBase(() => {
                        if (near.skinIndex == 22 && getEl("backupNobull").checked) {
                            near.backupNobull = true;
                        }
                        instaLog.push(player.skinIndex);
                    }, 1);
                }, 1);
                if (type == "rev") {
                    selectWeapon(player.weapons[1]);
                    buyEquip(7, 0);
                    buyEquip(19, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(19, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                } else if (type == "nobull") {
                    selectWeapon(player.weapons[0]);
                    if (getEl("backupNobull").checked && backupNobull) {
                        buyEquip(7, 0);
                    } else {
                        buyEquip(6, 0);
                    }
                    buyEquip(19, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        if (near.skinIndex == 22) {
                            if (getEl("backupNobull").checked) {
                                near.backupNobull = true;
                            }
                            buyEquip(6, 0);
                        } else {
                            buyEquip(53, 0);
                        }
                        selectWeapon(player.weapons[1]);
                        buyEquip(19, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                } else if (type == "normal") {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(19, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        selectWeapon(player.weapons[1]);
                        buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
                        buyEquip(19, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                } else {
                    setTimeout(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 50);
                }
            };
            class UltraFastReverseFullStack {
                constructor() {
                    this.minDelay = 10;
                }
                delay(ms) {
                    return new Promise(resolve => setTimeout(resolve, ms));
                }
                isValidWeaponIndex(index) {
                    return player.weapons && player.weapons[index] !== undefined;
                }
                turnTo(position) {
                    if (typeof my.turnTo === "function") {
                        my.turnTo(position);
                    } else {
                        const dx = position.x - player.position.x;
                        const dy = position.y - player.position.y;
                        player.angle = Math.atan2(dy, dx);
                    }
                }
                async useWeaponAndBuy(weaponIndex, equipId) {
                    if (!this.isValidWeaponIndex(weaponIndex)) {
                        return;
                    }
                    selectWeapon(player.weapons[weaponIndex]);
                    buyEquip(equipId, 0);
                    sendAutoGather();
                    await this.delay(this.minDelay);
                }
                async instaKillHit(target) {
                    if (!target) {
                        return;
                    }
                    this.turnTo(target.position);
                    target.health = 0;
                    if (typeof updateTargetHealth === "function") {
                        updateTargetHealth(target, 0);
                    } else {
                        target.isDead = true;
                        target.health = 0;
                    }
                    await this.delay(this.minDelay);
                }
                async fullReverseStackWithInsta(target = null) {
                    sendChat("Ultra Fast Reverse FullStack started");
                    if (target) {
                        await this.instaKillHit(target);
                    }
                    for (let i = player.weapons.length - 1; i >= 0; i--) {
                        await this.useWeaponAndBuy(i, 7);
                    }
                    sendChat("Ultra Fast Reverse FullStack finished");
                }
            }
            class UltimateReverseFullStack {
                constructor() {
                    this.minDelay = 10;
                    this.autoAim = false;
                }
                delay(ms) {
                    return new Promise(resolve => setTimeout(resolve, ms));
                }
                isValidWeaponIndex(index) {
                    return player.weapons && player.weapons[index] !== undefined;
                }
                turnTo(position) {
                    if (typeof my.turnTo === "function") {
                        my.turnTo(position);
                    } else {
                        const dx = position.x - player.position.x;
                        const dy = position.y - player.position.y;
                        player.angle = Math.atan2(dy, dx);
                    }
                }
                async useWeaponAndBuy(weaponIndex, equipId) {
                    if (!this.isValidWeaponIndex(weaponIndex)) {
                        return;
                    }
                    selectWeapon(player.weapons[weaponIndex]);
                    buyEquip(equipId, 0);
                    sendAutoGather();
                    await this.delay(this.minDelay);
                }
                async instaKillHit(target) {
                    if (!target) {
                        return;
                    }
                    this.autoAim = true;
                    realDir(2);
                    this.turnTo(target.position);
                    target.health = 0;
                    if (typeof updateTargetHealth === "function") {
                        updateTargetHealth(target, 0);
                    } else {
                        target.isDead = true;
                    }
                    await this.delay(this.minDelay);
                    this.autoAim = false;
                }
                async fullReverseStackWithInsta(target = null) {
                    sendChat("Ultimate Reverse FullStack started");
                    if (target) {
                        await this.instaKillHit(target);
                    }
                    for (let i = player.weapons.length - 1; i >= 0; i--) {
                        await this.useWeaponAndBuy(i, 7);
                    }
                    sendChat("Ultimate Reverse FullStack finished");
                }
                async run(target = null) {
                    try {
                        await this.fullReverseStackWithInsta(target);
                    } catch (error) {
                        console.error("UltimateReverseFullStack error:", error);
                    }
                }
            }
            this.AutoSync = function () {
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[0]);
                packet("D", getAttackDir());
                buyEquip(7, 0);
                sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            };
            this.syncTry = function () {
                packet("D", getAttackDir());
                buyEquip(53, 0);
                game.tickBase(() => {
                    this.isTrue = true;
                    my.autoAim = true;
                    selectWeapon(player.weapons[1]);
                    sendAutoGather();
                    game.tickBase(() => {
                        my.autoAim = false;
                        this.isTrue = false;
                        sendAutoGather();
                    }, 1);
                }, 2);
            };
            this.MapSync = function () {
                let nearDistCheck;
                nearDistCheck = near.dist2 <= 300 ? 1 : 2;
                buyEquip(53, 0);
                game.tickBase(() => {
                    selectWeapon(player.weapons[1]);
                    sendAutoGather();
                    this.isTrue = true;
                    my.autoAim = true;
                    game.tickBase(() => {
                        my.autoAim = false;
                        this.isTrue = false;
                        sendAutoGather();
                    }, 1);
                }, nearDistCheck);
            };
            this.spikeTickType = function () {
                ShowSettingText(300, "SpikeTick", "#f00");
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            };
            // ff spike tick
            this.checkSoldier = function () {
                const canHit = canPlayerHitNearTarget();
                const nearReload = near.reloads[near.weaponIndex] !== 0;
                return (near.skinIndex !== 6 && canHit) || (!canHit && nearReload);
            };
            this.VelocityTickorBow = function () { // Stary Code
                this.isTrue = true;
                my.autoAim = true;
                biomeGear();
                buyEquip(19, 1);
                packet("9", near.aim2, 1);
                game.tickBase(() => {
                    if (player.weapons[1] == 15) {
                        my.revAim = true;
                    }
                    selectWeapon(player.weapons[[9, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
                    buyEquip(53, 0);
                    buyEquip(21, 1);
                    if ([9, 12, 13, 15].includes(player.weapons[1])) {
                        sendAutoGather();
                    }
                    packet("9", near.aim2, 1);
                    game.tickBase(() => {
                        my.revAim = false;
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(18, 1);
                        if (![9, 12, 13, 15].includes(player.weapons[1])) {
                            sendAutoGather();
                        }
                        packet("9", near.aim2, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            packet("9", undefined, 1);
                        }, 2);
                    }, 1);
                }, 1);
            };
            this.hammerCounterType = function () {
                if (!configs.counterInsta || !this.CheckSoldier()) {
                    return;
                }
                this.isTrue = true;
                my.autoAim = true;
                if (near.dist2 <= 70 && configs.secondaryOnCounter) {
                    selectWeapon(player.weapons[1]);
                    buyEquip(player.reloads[53] === 0 && getEl("turretCombat").checked ? 53 : 7, 0);
                    sendAutoGather();
                    game.tickBase(() => {
                        buyEquip(7, 0);
                        selectWeapon(player.weapons[0]);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                } else {
                    selectWeapon(player.weapons[0]);
                    buyEquip(player.reloads[53] === 0 && getEl("turretCombat").checked ? 53 : 7, 0);
                    sendAutoGather();
                    game.tickBase(() => {
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            this.CheckSoldier();
                        }, 1);
                    }, 1);
                }
            };
            this.pushTickType = function () {
                this.isTrue = true;
                my.autiAim = true;
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                sendAutoGather();
                game.addToQueue(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    game.addToQueue(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 2);
            }
            this.bianosSpTick = function () {
                my.autoAim = true;
                this.isTrue = true;
                buyEquip(7, 0);
                selectWeapon(player.weapons[0]);
                sendAutoGather();
                game.addToQueue(() => {
                    buyEquip(53, 0);
                    game.addToQueue(() => {
                        sendAutoGather();
                        bianosTick = false;
                        this.isTrue = false;
                        my.autoAim = false;
                        buyEquip(6, 0);
                    }, 1);
                }, 1);
            };
            this.repeaterOneTickType = function () {
                this.isTrue = true;
                my.autoAim = true;
                buyEquip(19, 1);
                packet("9", near.aim2, 1);
                game.addToQueue(() => {
                    selectWeapon(player.weapons[1]);
                    buyEquip(53, 0);
                    sendAutoGather();
                    packet("9", near.aim2, 1);
                    game.addToQueue(() => {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        game.addToQueue(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            packet("9", undefined, 1);
                        }, 1);
                    }, 1);
                }, 1);
            };
            this.spikeSyncType = function () {
                this.isTrue = true;
                my.autoAim = true;
                shuffleTicks();
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(18, 1);
                sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    game.tickBase(() => {
                        sendAutoGather();
                        buyEquip(6, 0);
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            };
            this.pushTickType = function () {
                this.isTrue = true;
                my.autiAim = true;
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                sendAutoGather();
                game.addToQueue(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    game.addToQueue(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 2);
            }
            this.bianosSpTick = function () {
                my.autoAim = true;
                this.isTrue = true;
                buyEquip(7, 0);
                selectWeapon(player.weapons[0]);
                sendAutoGather();
                game.addToQueue(() => {
                    buyEquip(53, 0);
                    game.addToQueue(() => {
                        sendAutoGather();
                        bianosTick = false;
                        this.isTrue = false;
                        my.autoAim = false;
                        buyEquip(6, 0);
                    }, 1);
                }, 1);
            };
            this.counterType = function () {
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(21, 1);
                sendAutoGather();
                game.tickBase(() => {
                    if (player.reloads[53] == 0 && getEl("turretCombat").checked) {
                        selectWeapon(player.weapons[0]);
                        buyEquip(53, 0);
                        buyEquip(21, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    } else {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }
                }, 1);
            };
            this.antiCounterType = function () {
                my.autoAim = true;
                this.isTrue = true;
                inantiantibull = true;
                selectWeapon(player.weapons[0]);
                buyEquip(6, 0);
                buyEquip(21, 1);
                io.send("D", near.aim2);
                sendAutoGather();
                game.tickBase(() => {
                    buyEquip(player.reloads[53] == 0 ? player.skins[53] ? 53 : 6 : 6, 0);
                    buyEquip(21, 1);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                        inantiantibull = false;
                    }, 1);
                }, 1)
            };
            this.rangeType = function (type) {
                this.isTrue = true;
                my.autoAim = true;
                if (type == "ageInsta") {
                    my.ageInsta = false;
                    if (player.items[5] == 18) {
                        place(5, near.aim2);
                    }
                    packet("9", undefined, 1);
                    buyEquip(22, 0);
                    buyEquip(21, 1);
                    game.tickBase(() => {
                        selectWeapon(player.weapons[1]);
                        buyEquip(53, 0);
                        buyEquip(21, 1);
                        sendAutoGather();
                        game.tickBase(() => {
                            sendUpgrade(12);
                            selectWeapon(player.weapons[1]);
                            buyEquip(53, 0);
                            buyEquip(21, 1);
                            game.tickBase(() => {
                                sendUpgrade(15);
                                selectWeapon(player.weapons[1]);
                                buyEquip(53, 0);
                                buyEquip(21, 1);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                }, 1);
                            }, 1);
                        }, 1);
                    }, 1);
                } else {
                    selectWeapon(player.weapons[1]);
                    if (player.reloads[53] == 0 && near.dist2 <= 700 && near.skinIndex != 22) {
                        buyEquip(53, 0);
                    } else {
                        buyEquip(20, 0);
                    }
                    buyEquip(11, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }
            };
            this.oneTickType = function () {
                io.send("7113213.29154");
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                buyEquip(19, 1);
                packet("9", near.aim2, 1);
                if (player.weapons[1] == 15) {
                    my.revAim = true;
                    sendAutoGather();
                }
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(19, 1);
                    packet("9", near.aim2, 1);
                    if (player.weapons[1] != 15) {
                        sendAutoGather();
                    }
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                        packet("9", undefined, 1);
                    }, 1);
                }, 1);
            };
            this.threeOneTickType = function () {
                io.send("Tick2");
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                biomeGear();
                buyEquip(19, 1);
                packet("9", near.aim2, 1);
                game.tickBase(() => {
                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                    buyEquip(53, 0);
                    buyEquip(19, 1);
                    packet("9", near.aim2, 1);
                    game.tickBase(() => {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(19, 1);
                        sendAutoGather();
                        packet("9", near.aim2, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            packet("9", undefined, 1);
                        }, 1);
                    }, 1);
                }, 1);
            };
            this.kmTickType = function () {
                this.isTrue = true;
                my.autoAim = true;
                my.revAim = true;
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                buyEquip(19, 1);
                sendAutoGather();
                packet("9", near.aim2, 1);
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(19, 1);
                    packet("9", near.aim2, 1);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                        packet("9", undefined, 1);
                    }, 1);
                }, 1);
            };
            this.boostTickType = function () {
                /*this.isTrue = true;
                    my.autoAim = true;
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    buyEquip(19, 1);
                    packet("9", near.aim2);
                    game.tickBase(() => {
                        place(4, near.aim2);
                        selectWeapon(player.weapons[1]);
                        biomeGear();
                        buyEquip(19, 1);
                        sendAutoGather();
                        packet("9", near.aim2);
                        game.tickBase(() => {
                            selectWeapon(player.weapons[0]);
                            buyEquip(7, 0);
                            buyEquip(19, 1);
                            packet("9", near.aim2);
                            game.tickBase(() => {
                                sendAutoGather();
                                this.isTrue = false;
                                my.autoAim = false;
                                packet("9", undefined);
                            }, 1);
                        }, 1);
                    }, 1);*/
                this.isTrue = true;
                my.autoAim = true;
                biomeGear();
                buyEquip(18, 1);
                packet("9", near.aim2, 1);
                game.tickBase(() => {
                    if (player.weapons[1] == 15) {
                        my.revAim = true;
                    }
                    selectWeapon(player.weapons[[9, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
                    buyEquip(53, 0);
                    buyEquip(18, 1);
                    if ([9, 12, 13, 15].includes(player.weapons[1])) {
                        sendAutoGather();
                    }
                    packet("9", near.aim2, 1);
                    place(4, near.aim2);
                    game.tickBase(() => {
                        my.revAim = false;
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(18, 1);
                        if (![9, 12, 13, 15].includes(player.weapons[1])) {
                            sendAutoGather();
                        }
                        packet("9", near.aim2, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            packet("9", undefined, 1);
                        }, 1);
                    }, 1);
                }, 1);
            };
            this.gotoGoal = function (goto, OT) {
                let slowDists = (weeeee) => weeeee * config.playerScale;
                let goal = {
                    a: goto - OT,
                    b: goto + OT,
                    c: goto - slowDists(1),
                    d: goto + slowDists(1),
                    e: goto - slowDists(2),
                    f: goto + slowDists(2),
                    g: goto - slowDists(4),
                    h: goto + slowDists(4)
                };
                let bQ = function (wwww, awwww) {
                    if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2 && awwww == 0) {
                        buyEquip(31, 0);
                    } else {
                        buyEquip(wwww, awwww);
                    }
                }
                if (enemy.length) {
                    let dst = near.dist2;
                    this.ticking = true;
                    if (dst >= goal.a && dst <= goal.b) {
                        bQ(22, 0);
                        bQ(11, 1);
                        if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                        }
                        return {
                            dir: undefined,
                            action: 1
                        };
                    } else {
                        if (dst < goal.a) {
                            if (dst >= goal.g) {
                                if (dst >= goal.e) {
                                    if (dst >= goal.c) {
                                        bQ(40, 0);
                                        bQ(10, 1);
                                        if (configs.none) {
                                            player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                                        } else {
                                            if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                            }
                                        }
                                    } else {
                                        bQ(22, 0);
                                        bQ(19, 1);
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    bQ(6, 0);
                                    bQ(12, 1);
                                    if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                    }
                                }
                            } else {
                                biomeGear();
                                bQ(11, 1);
                                if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                }
                            }
                            return {
                                dir: near.aim2 + Math.PI,
                                action: 0
                            };
                        } else if (dst > goal.b) {
                            if (dst <= goal.h) {
                                if (dst <= goal.f) {
                                    if (dst <= goal.d) {
                                        bQ(40, 0);
                                        bQ(9, 1);
                                        if (configs.none) {
                                            player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                                        } else {
                                            if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                            }
                                        }
                                    } else {
                                        bQ(22, 0);
                                        bQ(19, 1);
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    bQ(6, 0);
                                    bQ(12, 1);
                                    if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                    }
                                }
                            } else {
                                biomeGear();
                                bQ(11, 1);
                                if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                }
                            }
                            return {
                                dir: near.aim2,
                                action: 0
                            };
                        }
                        return {
                            dir: undefined,
                            action: 0
                        };
                    }
                } else {
                    this.ticking = false;
                    return {
                        dir: undefined,
                        action: 0
                    };
                }
            }
            /** wait 1 tick for better quality */
            this.bowMovement = function () {
                let moveMent = this.gotoGoal(685, 3);
                if (moveMent.action) {
                    if (player.reloads[53] == 0 && !this.isTrue) {
                        this.rangeType("ageInsta");
                    } else {
                        packet("9", moveMent.dir, 1);
                    }
                } else {
                    packet("9", moveMent.dir, 1);
                }
            },
                this.tickMovement = function () {
                    let dist = player.weapons[1] == 9 ? 240 : 240;
                    let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1 : player.weapons[1] == 15 ? 2 : 3;
                    let moveMent = this.gotoGoal(238, 3);
                    if (moveMent.action) {
                        if (player.reloads[53] == 0 && !this.isTrue) {
                            this.boostTickType();
                        } else {
                            packet("9", moveMent.dir, 1);
                        }
                    } else {
                        packet("9", moveMent.dir, 1);
                    }
                },
                this.BoostOneTick = function () {
                    let dist = player.weapons[1] == 9 ? 365 : player.weapons[1] == 12 ? 380 : player.weapons[1] == 13 ? 365 : player.weapons[1] == 15 ? 365 : 370;
                    let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1 : player.weapons[1] == 15 ? 2 : 3;
                    let moveMent = this.gotoGoal(372, 3);
                    if (moveMent.action) {
                        if (player.reloads[53] == 0 && !this.isTrue) {
                            this.BoostOneTICKERS();
                        } else {
                            packet("9", moveMent.dir, 1);
                        }
                    } else {
                        packet("9", moveMent.dir, 1);
                    }
                }
            this.kmTickMovement = function () {
                let moveMent = this.gotoGoal(240, 3);
                if (moveMent.action) {
                    if (near.skinIndex != 22 && player.reloads[53] == 0 && !this.isTrue && ((game.tick - near.poisonTick) % config.serverUpdateRate == 8)) {
                        this.kmTickType();
                    } else {
                        packet("9", moveMent.dir, 1);
                    }
                } else {
                    packet("9", moveMent.dir, 1);
                }
            },
                this.boostTickMovement = function () {
                    let dist = player.weapons[1] == 9 ? 345 : player.weapons[1] == 12 ? 375 : player.weapons[1] == 13 ? 363 : player.weapons[1] == 15 ? 365 : 370;
                    let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1 : player.weapons[1] == 15 ? 2 : 3;
                    let moveMent = this.gotoGoal(372, 3);
                    if (moveMent.action) {
                        if (player.reloads[53] == 0 && !this.isTrue) {
                            this.boostTickType();
                        } else {
                            packet("9", moveMent.dir, 1);
                        }
                    } else {
                        packet("9", moveMent.dir, 1);
                    }
                }
            /** wait 1 tick for better quality */
            this.perfCheck = function (pl, nr) {
                if (nr.weaponIndex == 11 && UTILS.getAngleDist(nr.aim2 + Math.PI, nr.d2) <= config.shieldAngle) return false;
                if (![9, 12, 13, 15].includes(player.weapons[1])) return true;
                let pjs = {
                    x: nr.x2 + (65 * Math.cos(nr.aim2 + Math.PI)),
                    y: nr.y2 + (65 * Math.sin(nr.aim2 + Math.PI))
                };
                if (UTILS.lineInRect(pl.x2 - pl.scale, pl.y2 - pl.scale, pl.x2 + pl.scale, pl.y2 + pl.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                    return true;
                }
                let finds = ais.filter(tmp => tmp.visible).find((tmp) => {
                    if (UTILS.lineInRect(tmp.x2 - tmp.scale, tmp.y2 - tmp.scale, tmp.x2 + tmp.scale, tmp.y2 + tmp.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                        return true;
                    }
                });
                if (finds) return false;
                finds = liztobj.filter(tmp => tmp.active).find((tmp) => {
                    let tmpScale = tmp.getScale();
                    if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                        return true;
                    }
                });
                if (finds) return false;
                return true;
            }
        }
    };
    class Autobuy {
        constructor(buyHat, buyAcc) {
            this.shitass = false;

            this.hat = function () {
                if (!this.shitass) {
                    let find = findID(hats, 40);
                    if (find && !player.skins[40] && player.points >= find.price) {
                        packet("c", 1, 40, 0);
                        this.shitass = true;
                    }
                    return;
                } else {
                    for (let i = 0; i < buyHat.length; i++) {
                        const id = buyHat[i];

                        let find = findID(hats, id);
                        if (find && !player.skins[id] && player.points >= find.price) {
                            packet("c", 1, id, 0);
                        }
                    }
                }
            };

            this.acc = function () {
                for (let i = 0; i < buyAcc.length; i++) {
                    const id = buyAcc[i];
                    let find = findID(accessories, id);
                    if (find && !player.tails[id] && player.points >= find.price) {
                        packet("c", 1, id, 1);
                    }
                }
            };
        }
    }

    let autoBuy = new Autobuy([40, 6, 7, 22, 26, 31, 53], [11, 13, 19]);



    class Autoupgrade {
        constructor() {
            this.sb = function (upg) {
                upg(3);
                upg(17);
                upg(31);
                upg(23);
                upg(9);
                upg(38);
            };
            this.kh = function (upg) {
                upg(3);
                upg(17);
                upg(31);
                upg(23);
                upg(10);
                upg(38);
                upg(4);
                upg(25);
            };
            this.pb = function (upg) {
                upg(5);
                upg(17);
                upg(32);
                upg(23);
                upg(9);
                upg(38);
            };
            this.ph = function (upg) {
                upg(5);
                upg(17);
                upg(32);
                upg(23);
                upg(10);
                upg(38);
                upg(28);
                upg(25);
            };
            this.db = function (upg) {
                upg(7);
                upg(17);
                upg(31);
                upg(23);
                upg(9);
                upg(34);
            };
            /* old functions */
            this.km = function (upg) {
                upg(7);
                upg(17);
                upg(31);
                upg(23);
                upg(10);
                upg(38);
                upg(4);
                upg(15);
            };
        };
    };
    class Damages {
        constructor(items) {
            // 0.75 1 1.125 1.5
            this.calcDmg = function (dmg, val) {
                return dmg * val;
            };
            this.getAllDamage = function (dmg) {
                return [this.calcDmg(dmg, 0.75), dmg, this.calcDmg(dmg, 1.125), this.calcDmg(dmg, 1.5)];
            };
            this.weapons = [];
            for (let i = 0; i < items.weapons.length; i++) {
                let wp = items.weapons[i];
                let name = wp.name.split(" ").length <= 1 ? wp.name : (wp.name.split(" ")[0] + "_" + wp.name.split(" ")[1]);
                this.weapons.push(this.getAllDamage(i > 8 ? wp.Pdmg : wp.dmg));
                this[name] = this.weapons[i];
            }
        }
    }

    /** CLASS CODES */
    // jumpscare code warn
    let tmpList = [];
    var bianosTick = false;


    // LOADING:
    let UTILS = new Utils();
    let items = new Items();
    let objectManager = new Objectmanager(GameObject, gameObjects, UTILS, config);
    let store = new Store();
    let hats = store.hats;
    let accessories = store.accessories;
    let projectileManager = new ProjectileManager(Projectile, projectiles, players, ais, objectManager, items, config, UTILS);
    let aiManager = new AiManager(ais, AI, players, items, null, config, UTILS);

    let placementState = new PlacementFlowState();
    let autoBreak = new Autobreaker(UTILS, items, placementState);
    let autoPlacer = new Autoplacer(UTILS, items, autoBreak, placementState);
    let traps = autoPlacer;
    let instaC = new Instakill();
    let autoUpgrade = new Autoupgrade();

    let lastDeath;
    let minimapData;
    let mapMarker = {};
    let mapPings = [];
    let tmpPing;

    let breakTrackers = [];

    let pathFindTest = 0;
    let grid = [];
    let pathFind = {
        active: false,
        grid: 40,
        scale: 1440,
        x: 14400,
        y: 14400,
        chaseNear: false,
        array: [],
        lastX: this.grid / 2,
        lastY: this.grid / 2
    };

    function sendChat(message) {
        packet("6", message.slice(0, 30));
    }

    let runAtNextTick = [];
    function checkProjectileHit(plyr, velocity, th, obj, R = 50) {
        const ux = Math.cos(th);
        const uy = Math.sin(th);
        let target = obj;
        let proj = {
            x: plyr.x2,
            y: plyr.y2
        };
        let tick = null;
        const movDir = obj.movDir;
        for (let i = 0; i < 6; i++) {
            proj.x += velocity / 4 * ux;
            proj.x += velocity / 4 * uy;
            target = calcAccel(target, movDir, target, game.tickRate);
            const dx = proj.x - target.x2;
            const dy = proj.y - target.y2;
            if (dx * dx + dy * dy <= R * R) {
                tick = i;
                return true;
            } else if (i >= 2) {
                const dx2 = player.x2 - target.x2;
                const dy2 = player.y2 - target.y2;
                const dx3 = player.x2 - proj.x;
                const dy3 = player.y2 - proj.y;
                if (dx2 * dx2 + dy2 * dy2 < dx3 * dx3 + dy3 * dy3 + 7000) {
                    return false;
                }
            }
        }
        return false;
    }
    function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
        let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
        let projOffset = config.playerScale * 2;
        let projXY = {
            x: indx == 1 ? x : x - projOffset * Math.cos(dir),
            y: indx == 1 ? y : y - projOffset * Math.sin(dir),
        };
        let nearPlayer = players.filter((e) => e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale).sort(function (a, b) {
            return UTILS.getDist(projXY, a, 0, 2) - UTILS.getDist(projXY, b, 0, 2);
        })[0];
        if (nearPlayer) {
            if (indx == 1) {
                nearPlayer.shooting[53] = 1;
            } else {
                nearPlayer.shootIndex = weaponIndx;
                nearPlayer.shooting[1] = 1;
                antiProj(nearPlayer, dir, range, speed, indx, weaponIndx);
            }
        }
    }
    let projectileCount = 0;

    function antiProj(tmpObj, dir, range, speed, index, weaponIndex) {
        if (!tmpObj.isTeam(player)) {
            tmpDir = UTILS.getDirect(player, tmpObj, 2, 2);
            if (UTILS.getAngleDist(tmpDir, dir) <= 0.2) {
                tmpObj.bowThreat[weaponIndex]++;
                if (index == 5) {
                    projectileCount++;
                }
                setTimeout(() => {
                    tmpObj.bowThreat[weaponIndex]--;
                    if (index == 5) {
                        projectileCount--;
                    }
                }, range / speed);
                if (tmpObj.bowThreat[9] >= 1 && (tmpObj.bowThreat[12] >= 1 || tmpObj.bowThreat[15] >= 1)) {
                    place(3, tmpObj.aim2);
                    my.anti0Tick = 4;
                    if (!my.antiSync) {
                        antiSyncHealing(4);
                    }
                } else {
                    if (projectileCount >= 2 && configs.AntiBowInsta) {
                        const mill = items.list[player.items[3]];
                        const millCount = mill.group.limit - 1;
                        if (player.itemCounts[mill.group.id] < millCount) {
                            place(3, tmpObj.aim2);
                        } else {
                            place(1, tmpObj.aim2);
                        }

                        buyEquip(22, 0);
                        if (!my.healed) {
                            healer();
                            my.healed = true;
                        }
                        for (let i = 0; i < 3; i++) {
                            healer();
                        }

                        if (configs.AutoDodgeProjectiles) {
                            const projectileDirection = dir;
                            const incomingDirection = projectileDirection + Math.PI;

                            const dodgeOptions = [
                                { angle: 90, priority: 1 }, // Вправо от направления полета снаряда (высший приоритет)
                                { angle: -90, priority: 2 }, // Влево от направления полета снаряда
                                { angle: 0, priority: 3 }, // Прямо от снаряда (назад)
                                { angle: 180, priority: 4 }, // К снаряду (вперед) - наименьший приоритет
                                { angle: 45, priority: 5 }, // Диагональ право-назад
                                { angle: -45, priority: 6 }, // Диагональ лево-назад
                                { angle: 135, priority: 7 }, // Диагональ право-вперед
                                { angle: -135, priority: 8 }, // Диагональ лево-вперед
                            ];

                            dodgeOptions.sort((a, b) => a.priority - b.priority);

                            let dodged = false;
                            const dodgeDistance = 70;

                            for (const option of dodgeOptions) {
                                const dodgeAngle = incomingDirection + UTILS.toRad(option.angle);

                                const checkX = player.x2 + Math.cos(dodgeAngle) * dodgeDistance;
                                const checkY = player.y2 + Math.sin(dodgeAngle) * dodgeDistance;

                                let canDodge = true;

                                for (const obj of gameObjects) {
                                    if (!obj.active || obj.ignoreCollision) continue;

                                    const dx = obj.x - checkX;
                                    const dy = obj.y - checkY;
                                    const distanceSquared = dx * dx + dy * dy;
                                    const minDistance = player.scale + obj.scale;

                                    if (distanceSquared <= minDistance * minDistance) {
                                        canDodge = false;
                                        break;
                                    }
                                }

                                if (canDodge) {
                                    for (const plyr of players) {
                                        if (!plyr.visible) continue;

                                        const dx = plyr.x2 - checkX;
                                        const dy = plyr.y2 - checkY;
                                        const distanceSquared = dx * dx + dy * dy;
                                        const minDistance = player.scale + plyr.scale;

                                        if (distanceSquared <= minDistance * minDistance) {
                                            canDodge = false;
                                            break;
                                        }
                                    }
                                }

                                if (canDodge) {
                                    packet("9", dodgeAngle, 1);
                                    sendChat(`Dodged ${option.angle > 0 ? "right" : option.angle < 0 ? "left" : "back"}`);

                                    runAtNextTick.push(() => {
                                        packet("9", undefined, 1);
                                    });

                                    dodged = true;
                                    break;
                                }
                            }

                            if (!dodged) {
                                sendChat("Nowhere to dodge!");

                                const backAngle = incomingDirection;
                                packet("9", backAngle, 1);

                                runAtNextTick.push(() => {
                                    packet("9", undefined, 0);
                                });
                            }
                        }

                        player.chat.message = `Sync/Bow Threat Blocked ${window.pingTime}ms`;
                        player.chat.count = 1000;
                        buyEquip(22, 0);
                        buyEquip(13, 1);
                        my.anti0Tick = 4;
                        if (!my.antiSync) {
                            antiSyncHealing(4);
                        }
                    } else {
                        if (projectileCount === 1) { // anti reverse or anti 1 tick with reaper
                            buyEquip(6, 0);
                            buyEquip(13, 1);
                        }
                    }
                }
            }
        }
    }
    // SHOW ITEM INFO:
    function showItemInfo(item, isWeapon, isStoreItem) {
        if (player && item) {
            UTILS.removeAllChildren(itemInfoHolder);
            itemInfoHolder.classList.add("visible");
            UTILS.generateElement({
                id: "itemInfoName",
                text: UTILS.capitalizeFirst(item.name),
                parent: itemInfoHolder
            });
            UTILS.generateElement({
                id: "itemInfoDesc",
                text: item.desc,
                parent: itemInfoHolder
            });
            if (isStoreItem) {

            } else if (isWeapon) {
                UTILS.generateElement({
                    class: "itemInfoReq",
                    text: !item.type ? "primary" : "secondary",
                    parent: itemInfoHolder
                });
            } else {
                for (let i = 0; i < item.req.length; i += 2) {
                    UTILS.generateElement({
                        class: "itemInfoReq",
                        html: item.req[i] + "<span class='itemInfoReqVal'> x" + item.req[i + 1] + "</span>",
                        parent: itemInfoHolder
                    });
                }
                if (item.group.limit) {
                    UTILS.generateElement({
                        class: "itemInfoLmt",
                        text: (player.itemCounts[item.group.id] || 0) + "/" + (config.isSandbox ? 99 : item.group.limit),
                        parent: itemInfoHolder
                    });
                }
            }
        } else {
            itemInfoHolder.classList.remove("visible");
        }
    }


    // RESIZE:
    window.addEventListener("resize", UTILS.checkTrusted(resize));

    function resize() {
        screenWidth = window.innerWidth;
        screenHeight = window.innerHeight;
        let scaleFillNative = Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) * pixelDensity;
        gameCanvas.width = screenWidth * pixelDensity;
        gameCanvas.height = screenHeight * pixelDensity;
        gameCanvas.style.width = screenWidth + "px";
        gameCanvas.style.height = screenHeight + "px";
        mainContext.setTransform(
            scaleFillNative, 0,
            0, scaleFillNative,
            (screenWidth * pixelDensity - (maxScreenWidth * scaleFillNative)) / 2,
            (screenHeight * pixelDensity - (maxScreenHeight * scaleFillNative)) / 2
        );
    }
    resize();

    // MOUSE INPUT:
    var usingTouch;
    const mals = document.getElementById('touch-controls-fullscreen');
    mals.style.display = 'block';
    mals.addEventListener("mousemove", gameInput, false);

    function gameInput(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }
    let clicks = {
        left: false,
        middle: false,
        right: false,
    };
    let clicked = {
        g: false
    }
    mals.addEventListener("mousedown", mouseDown, false);

    function mouseDown(e) {
        if (e.button == 0) {
            clicks.left = true;
            attackState = 1;
        } else if (e.button == 1) {
            clicks.middle = true;
        } else if (e.button == 2) {
            clicks.right = true;
            attackState = 1;
        }
        if (!clicks.middle && (e.button === 0 || e.button === 2) && player && player.alive && !instaC.isTrue) {
            const useSecondary = e.button === 2 && player.weapons[1] == 10;
            const weaponIndex = useSecondary ? player.weapons[1] : player.weapons[0];
            if ((player.weaponIndex != weaponIndex) || player.buildIndex > -1) {
                selectWeapon(weaponIndex);
            }
            if (autoBreak.active) {
                const breakGear = resolveAutoBreakGear();
                buyEquip(breakGear.hat, 0);
                buyEquip(breakGear.acc, 1);
            }
            if (player.reloads[weaponIndex] == 0 && !my.waitHit) {
                sendAutoGather();
                my.waitHit = 1;
                game.tickBase(() => {
                    sendAutoGather();
                    my.waitHit = 0;
                }, 1);
            }
        }
    }
    mals.addEventListener("mouseup", UTILS.checkTrusted(mouseUp));

    function mouseUp(e) {
        if (e.button == 0) {
            clicks.left = false;
        } else if (e.button == 1) {
            clicks.middle = false;
        } else if (e.button == 2) {
            clicks.right = false;
        }
        if (!clicks.left && !clicks.right) {
            attackState = 0;
        }
    }
    mals.addEventListener("wheel", wheel, false);
    let wbe = 1.25;
    let wbeTarget = 1.25;
    const wbeMin = 0.45;
    const wbeSmooth = 0.12;

    function updateSmoothZoom() {
        if (Math.abs(wbe - wbeTarget) > 0.001) {
            wbe += (wbeTarget - wbe) * wbeSmooth;
            maxScreenWidth = config.maxScreenWidth * wbe;
            maxScreenHeight = config.maxScreenHeight * wbe;
            resize();
        }
        requestAnimationFrame(updateSmoothZoom);
    }
    requestAnimationFrame(updateSmoothZoom);

    function wheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.15 : -0.15;
        wbeTarget = Math.min(2.5, Math.max(wbeMin, wbeTarget + delta));
    }
    // INPUT UTILS:
    function getMoveDir() {
        let dx = 0;
        let dy = 0;
        for (let key in moveKeys) {
            let tmpDir = moveKeys[key];
            dx += !!keys[key] * tmpDir[0];
            dy += !!keys[key] * tmpDir[1];
        }
        return dx == 0 && dy == 0 ? undefined : Math.atan2(dy, dx);
    }

    function getSafeDir() {
        if (!player)
            return 0;
        if (!player.lockDir) {
            lastDir = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
        }
        return lastDir || 0;
    }
    let plusDir = 0;
    let lastSpin = Date.now();
    const aimSpike = () => {
        packet("D", Math.atan2(spikeB.info.y - player.y2, spikeB.info.x - player.x2));
    };
    function getAttackDir(debug) {
        if (!player) return 0;

        if (my.autoAim || ((clicks.left || (useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !autoBreak.active)) && player.reloads[player.weapons[0]] == 0))
            lastDir = getEl("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
        else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)
            lastDir = getSafeDir();
        else if (autoBreak.active && player.reloads[autoBreak.notFast() ? player.weapons[1] : player.weapons[0]] == 0)
            lastDir = autoBreak.aim;
        else if (!player.lockDir) {
            if (configs.noDir) return undefined;
            lastDir = getSafeDir();
        }

        return lastDir || 0;
    }
    function realDir(num) {
        game.tickBase(() => {
            num = 3;
            if (showRealDir < num) {
                showRealDir = num;
            }
        }, 1);
    }
    function getVisualDir() {
        if (!player)
            return 0;
        lastDir = getSafeDir();
        return lastDir || 0;
    }
    this.spikeTickType = function () {
        this.isTrue = true;
        my.autoAim = true;
        selectWeapon(player.weapons[0]);
        buyEquip(7, 0);
        sendAutoGather();
        game.tickBase(() => {
            //if (player.reloads[53] == 0 && getEl("turretCombat").checked) {
            buyEquip(53, 0);
            selectWeapon(player.weapons[0]);
            buyEquip(53, 0);
            //buyEquip(21, 1);
            game.tickBase(() => {
                sendAutoGather();
                this.isTrue = false;
                my.autoAim = false;
                buyEquip(6, 0);
                buyEquip(21, 1);
            }, 3);
        }, 1);
    };
    /* this.spikeTickType = function() {
                        this.isTrue = true;
                        my.autoAim = true;
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(21, 1);
                        sendAutoGather();
                        game.tickBase(() => {
                            if (player.reloads[53] == 0 && getEl("turretCombat").checked) {
                                selectWeapon(player.weapons[0]);
                                buyEquip(53, 0);
                                buyEquip(21, 1);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                }, 1);
                            } else {
                                sendAutoGather();
                                this.isTrue = false;
                                my.autoAim = false;
                            }
                        }, 1);
                    };*/

    // KEYS:
    function isMenuChatFocused() {
        return !!customMenuChatEnabled && menuChatOpen;
    }

    function isNativeChatFocused() {
        return document.activeElement === chatBox && chatHolder && chatHolder.style.display == "block";
    }

    function keysActive() {
        return (allianceMenu.style.display != "block" &&
            chatHolder.style.display != "block" &&
            !isMenuChatFocused());
    }

    function focusMenuChat() {
        menuCBFocus = true;
        menuChatOpen = true;
        if (menuChatBox?.disabled) {
            menuChatBox.disabled = false;
            menuChatBox.removeAttribute("readonly");
            menuChatBox.tabIndex = 0;
        }
        showMenuChat();
        if (customMenuChatEnabled && chatHolder) {
            chatHolder.style.display = "none";
            chatHolder.style.pointerEvents = "none";
            chatHolder.style.opacity = "0";
        }
        if (chatBox) {
            chatBox.blur();
            chatBox.value = "";
        }
        renderMenuChatDraft();
        menuChatBox.classList.add("fakeFocus");
    }

    function blurMenuChat() {
        menuCBFocus = false;
        menuChatOpen = false;
        menuChatBox.value = "";
        menuChatBox.classList.remove("fakeFocus");
        menuChatDiv.style.display = "none";
        menuChatDiv.style.opacity = "0";
        menuChatDiv.style.pointerEvents = "none";
        if (chatHolder) {
            chatHolder.style.display = "none";
            chatHolder.style.pointerEvents = "none";
            chatHolder.style.opacity = "0";
        }
        if (chatBox) {
            chatBox.blur();
            chatBox.value = "";
        }
        releaseMenuChatFocus();
        if (!customMenuChatEnabled && chatHolder) {
            applyNativeChatVisibility(true);
        } else {
            applyNativeChatVisibility(false);
        }
        keys[13] = 0;
        macro.Enter = 0;
    }

    function sendMenuChatInput() {
        let inputValue = getMenuChatDraft().trim();
        if (inputValue != "") {
            let command = {
                found: inputValue.startsWith("/") && commands[inputValue.slice(1).split(" ")[0]],
                fv: commands[inputValue.slice(1).split(" ")[0]]
            };
            if (command.found) {
                if (typeof command.fv.action === "function") {
                    command.fv.action(inputValue);
                }
            } else {
                sendChat(inputValue);
            }
        }
        menuChatBox.value = "";
        menuChatBox.blur();
        blurMenuChat();
        resetMoveDir();
    }

    function toggleMenuChat() {
        if (!customMenuChatEnabled) {
            toggleChat();
            return;
        }
        let message = menuChatBox.value;
        if (menuCBFocus && message != "") {
            sendMenuChatInput();
        } else {
            if (menuCBFocus) {
                menuChatBox.blur();
                blurMenuChat();
            } else {
                focusMenuChat();
            }
        }
    }
    addEventListener("keydown", UTILS.checkTrusted((event) => {
        if (!customMenuChatEnabled || !menuChatOpen) return;
        const keyNum = event.which || event.keyCode || 0;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (keyNum == 13) {
            menuChatConsumeEnterKeyUp = true;
            toggleMenuChat();
        } else if (keyNum == 27) {
            blurMenuChat();
        } else if (keyNum == 8) {
            menuChatBox.value = getMenuChatDraft().slice(0, -1);
            renderMenuChatDraft();
            showMenuChat();
        } else if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key && event.key.length === 1) {
            menuChatBox.value = getMenuChatDraft() + event.key;
            renderMenuChatDraft();
            showMenuChat();
        }
    }), true);
    addEventListener("keyup", UTILS.checkTrusted((event) => {
        if (!customMenuChatEnabled || !menuChatOpen) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }), true);

    let followASsnbewfjnsjd = false;

    function keyDown(event) {
        let keyNum = event.which || event.keyCode || 0;
        if (keyNum == 27) {
            event.preventDefault();
            event.stopPropagation();
            if (event.repeat) return;
            keys[27] = 1;
            toggleMenu();
            return;
        }
        if (isMenuChatFocused()) {
            event.preventDefault();
            event.stopPropagation();
            if (keyNum == 13) {
                return;
            } else if (keyNum == 27) {
                blurMenuChat();
            } else if (keyNum == 8) {
                menuChatBox.value = getMenuChatDraft().slice(0, -1);
                renderMenuChatDraft();
                showMenuChat();
            } else if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key && event.key.length === 1) {
                menuChatBox.value = getMenuChatDraft() + event.key;
                renderMenuChatDraft();
                showMenuChat();
            }
            return;
        }
        if (player && player.alive && keysActive()) {
            if (!keys[keyNum]) {
                keys[keyNum] = 1;
                macro[event.key] = 1;
                if (keyNum == 17) {
                    customMenuChatEnabled = !customMenuChatEnabled;
                    saveVal("customMenuChatEnabled", customMenuChatEnabled);
                    if (!customMenuChatEnabled) {
                        menuChatDiv.style.display = "none";
                        menuChatDiv.style.opacity = "0";
                        blurMenuChat();
                        applyNativeChatVisibility(true);
                    } else if (menuChatDiv.style.display == "none") {
                        if (chatBox) {
                            chatBox.blur();
                            chatBox.value = "";
                        }
                        applyNativeChatVisibility(false);
                        showMenuChat();
                    } else {
                        scheduleMenuChatFade(3000);
                    }
                } else if (keyNum == 69) {
                    sendAutoGather();
                } else if (keyNum == 67) {
                    updateMapMarker();
                } else if (event.key === "l") {
                    followASsnbewfjnsjd = !followASsnbewfjnsjd;
                } else if (event.key == "k") {
                    io.send("6", "")
                    setTimeout(() => {
                        io.send("6", "Don't care")
                        setTimeout(() => {
                            io.send("6", "didin't ask")
                            setTimeout(() => {
                                io.send("6", "cry about it")
                                setTimeout(() => {
                                    io.send("6", "stay mad")
                                    setTimeout(() => {
                                        io.send("6", "get real")
                                        setTimeout(() => {
                                            io.send("6", "L")
                                            setTimeout(() => {
                                                io.send("6", "mad seethe cope harder")
                                                setTimeout(() => {
                                                    io.send("6", "hoes mad")
                                                    setTimeout(() => {
                                                        io.send("6", "Sex offencer")
                                                        setTimeout(() => {
                                                            io.send("6", "basic")
                                                            setTimeout(() => {
                                                                io.send("6", "skill issue")
                                                                setTimeout(() => {
                                                                    io.send("6", "ratio")
                                                                    setTimeout(() => {
                                                                        io.send("6", "you fell off")
                                                                        setTimeout(() => {
                                                                            io.send("6", "the audacity")
                                                                            setTimeout(() => {
                                                                                io.send("6", "triggered")
                                                                                setTimeout(() => {
                                                                                    io.send("6", "any askers")
                                                                                    setTimeout(() => {
                                                                                        io.send("6", "replled")
                                                                                        setTimeout(() => {
                                                                                            io.send("6", "get a life")
                                                                                            setTimeout(() => {
                                                                                                io.send("6", "ok and?")
                                                                                                setTimeout(() => {
                                                                                                    io.send("6", "cringe")
                                                                                                    setTimeout(() => {
                                                                                                        io.send("6", "touch grass")
                                                                                                        setTimeout(() => {
                                                                                                            io.send("6", "donowalled")
                                                                                                            setTimeout(() => {
                                                                                                                io.send("6", "not based")
                                                                                                                setTimeout(() => {
                                                                                                                    io.send("6", "not funny didn’t laugh")
                                                                                                                    setTimeout(() => {
                                                                                                                        io.send("6", "*you're")
                                                                                                                        setTimeout(() => {
                                                                                                                            io.send("6", "grammar issues")
                                                                                                                            setTimeout(() => {
                                                                                                                                io.send("6", "go outside")
                                                                                                                                setTimeout(() => {
                                                                                                                                    io.send("6", "get good")
                                                                                                                                    setTimeout(() => {
                                                                                                                                        io.send("6", "reported")
                                                                                                                                        setTimeout(() => {
                                                                                                                                            io.send("6", "ad hominem")
                                                                                                                                            setTimeout(() => {
                                                                                                                                                io.send("6", "GG?")
                                                                                                                                                setTimeout(() => {
                                                                                                                                                    io.send("6", "ask frvr")
                                                                                                                                                    setTimeout(() => {
                                                                                                                                                        io.send("6", "ez clap")
                                                                                                                                                        setTimeout(() => {
                                                                                                                                                            io.send("6", "straight cash")
                                                                                                                                                            setTimeout(() => {
                                                                                                                                                                io.send("6", "ratio again")
                                                                                                                                                                setTimeout(() => {
                                                                                                                                                                    io.send("6", "final ratio")
                                                                                                                                                                    setTimeout(() => {
                                                                                                                                                                        io.send("6", "problematic")
                                                                                                                                                                        setTimeout(() => {
                                                                                                                                                                            io.send("6", "furry lover")
                                                                                                                                                                            setTimeout(() => {
                                                                                                                                                                                io.send("6", "retard")
                                                                                                                                                                                setTimeout(() => {
                                                                                                                                                                                }, 2000);
                                                                                                                                                                            }, 2000);
                                                                                                                                                                        }, 2000);
                                                                                                                                                                    }, 2000);
                                                                                                                                                                }, 2000);
                                                                                                                                                            }, 2000);
                                                                                                                                                        }, 2000);
                                                                                                                                                    }, 2000);
                                                                                                                                                }, 2000);
                                                                                                                                            }, 2000);
                                                                                                                                        }, 2000);
                                                                                                                                    }, 2000);
                                                                                                                                }, 2000);
                                                                                                                            }, 2000);
                                                                                                                        }, 2000);
                                                                                                                    }, 2000);
                                                                                                                }, 2000);
                                                                                                            }, 2000);
                                                                                                        }, 2000);
                                                                                                    }, 2000);
                                                                                                }, 2000);
                                                                                            }, 2000);
                                                                                        }, 2000);
                                                                                    }, 2000);
                                                                                }, 2000);
                                                                            }, 2000);
                                                                        }, 2000);
                                                                    }, 2000);
                                                                }, 2000);
                                                            }, 2000);
                                                        }, 2000);
                                                    }, 2000);
                                                }, 2000);
                                            }, 2000);
                                        }, 2000);
                                    }, 2000);
                                }, 2000);
                            }, 2000);
                        }, 2000);
                    }, 2000);
                } else if (event.key == "/") {
                    resetMenuChText();
                    addMenuChText(null, "Successfully Auto-Cleared Chat", "lime", 1);
                } else if (keyNum == 71) {
                    clicked.g = !clicked.g
                } else if (event.key == "p") {
                    configs.autoOneFrame = !configs.autoOneFrame;
                    player.chat.message = (configs.autoOneFrame ? "Active" : "Passive");
                    player.chat.count = 1000;
                } else if (player.weapons[keyNum - 49] != undefined) {
                    player.weaponCode = player.weapons[keyNum - 49];
                } else if (moveKeys[keyNum]) {
                    sendMoveDir();
                } else if (event.key == "Z") {
                    typeof window.debug == "function" && window.debug();
                } else if (keyNum == 32) {
                    packet("d", 1, getSafeDir(), 1);
                    packet("d", 0, getSafeDir(), 1);
                }
            }
        }
    }
    addEventListener("keydown", function (event) {
        let keyNum = event.which || event.keyCode || 0;
        const lowerKey = (event.key || "").toLowerCase();
        if (!isMenuChatFocused() && !isNativeChatFocused() && player && player.alive && (lowerKey == "m" || lowerKey == "z")) {
            event.preventDefault();
            event.stopPropagation();
            if (lowerKey == "m") mills.placeSpawnPads = !mills.placeSpawnPads;
            if (lowerKey == "z") mills.place = !mills.place;
            return;
        }
        if (keyNum == 27) {
            keyDown(event);
            return;
        }
        return UTILS.checkTrusted(keyDown)(event);
    });

    function keyUp(event) {
        let keyNum = event.which || event.keyCode || 0;
        if (keyNum == 13 && menuChatConsumeEnterKeyUp) {
            menuChatConsumeEnterKeyUp = false;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (keyNum == 27) {
            event.preventDefault();
            keys[27] = 0;
            return;
        }
        if (keyNum == 13) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (customMenuChatEnabled) {
                toggleMenuChat();
                resetMoveDir();
                macro = {};
                keys = {};
            }
            return;
        }
        if (isMenuChatFocused()) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (player && player.alive) {
            if (keysActive()) {
                if (keys[keyNum]) {
                    keys[keyNum] = 0;
                    macro[event.key] = 0;
                    if (moveKeys[keyNum]) {
                        sendMoveDir();
                    }
                }
            }
        }
    }
    window.addEventListener("keyup", UTILS.checkTrusted(keyUp));

    function sendMoveDir() {
        let newMoveDir = getMoveDir();
        if (lastMoveDir == undefined || newMoveDir == undefined || Math.abs(newMoveDir - lastMoveDir) > 0.3) {
            if (!my.autoPush) {
                packet("9", newMoveDir, 1);
                autoPlacer.safewalk();
            }
            lastMoveDir = newMoveDir;
            autoPlacer.safewalk();
        }
    }
    // first accurate anti kb spike:
    let originalScales = {
        width: 1920,
        height: 1080
    }
    let forceSoldier = false;
    function kbAnti() { // by stary ofc I am best anti maker
        if (inGame && enemy.length && player.alive) {
            let minDist = Infinity;
            let noTrap = autoBreak.inTrap;
            if (near.dist2 - near.scale * 1.8 <= items.weapons[near.weapons[0]].range && !noTrap) {
                for (let tmp of gameObjects) {
                    if ((tmp.dmg && tmp.active && !tmp.isTeamObject(player)) || (tmp.type == 1 && tmp.y >= 12000)) {
                        let pr = ((items.weapons[near.weapons[0]].knock || 0) + 0.3) * items.weapons[near.weapons[0]].range + near.scale * 2, se = ![undefined, 9, 12, 13, 15].includes(near.weapons[1]) ? (items.weapons[near.weapons[1]].knock || 0) * items.weapons[near.weapons[1]].range + near.scale * 2 - 10 : near.weapons[1] != undefined ? 60 : 0, st = pr + se, tu = near.reloads[53] == 0 ? pr + se + 75 : st, px = near.x3 + pr, py = near.y3 + pr, sx = near.x3 + se, sy = near.y3 + se, ix = near.x3 + st, iy = near.y3 + st, tx = near.x3 + tu, ty = near.y3 + tu;
                        if ((UTILS.getDist({ x: px, y: py }, tmp, 0, 0) < tmp.getScale(0.6, tmp.isItem) + near.scale) && near.reloads[near.weapons[0]] == 0) return "primary Kb";
                        if ((UTILS.getDist({ x: ix, y: iy }, tmp, 0, 0) < tmp.getScale(0.6, tmp.isItem) + near.scale) && near.reloads[near.weapons[0]] == 0 && near.reloads[near.weapons[1]] == 0 && near.dist2 <= items.weapons[near.weapons[1]].range + near.scale * 1.8) return "anti Kb Insta";
                        let lethalSpike = tmp.dmg && tmp.active && !tmp.isTeamObject(player) && [6, 7, 8, 9, 10, 11].includes(tmp.group?.id || tmp.id);
                        if (lethalSpike) {
                            let projectedSelf = {
                                x: player.x2 + Math.cos(near.aim2 || 0) * (st + player.scale),
                                y: player.y2 + Math.sin(near.aim2 || 0) * (st + player.scale)
                            };
                            if (UTILS.getDist(projectedSelf, tmp, 0, 0) < tmp.getScale(0.6, tmp.isItem) + player.scale + 8) {
                                my.anti0Tick = Math.max(my.anti0Tick, 2);
                                return "anti Kb Spike Threat";
                            }
                        }
                    }
                }
            }
        }
        return false
    }
    // BUTTON EVENTS:
    function bindEvents() { }
    bindEvents();
    // ITEM COUNT DISPLAY:
    let isItemSetted = [];

    function updateItemCountDisplay(index = undefined) {
        for (let i = 3; i < items.list.length; ++i) {
            let id = items.list[i].group.id;
            let tmpI = items.weapons.length + i;
            if (!isItemSetted[tmpI]) {
                isItemSetted[tmpI] = document.createElement("div");
                isItemSetted[tmpI].id = "itemCount" + tmpI;
                getEl("actionBarItem" + tmpI).appendChild(isItemSetted[tmpI]);
                isItemSetted[tmpI].style = `
                        display: block;
                        position: absolute;
                        padding-left: 5px;
                        font-size: 2em;
                        color: #fff;
                        `;
                isItemSetted[tmpI].innerHTML = player.itemCounts[id] || 0;
            } else {
                if (index == id) isItemSetted[tmpI].innerHTML = player.itemCounts[index] || 0;
            }
        }
    }

    // PATHFINDERS:
    var EasyStar = function (e) {
        var o = {};
        function r(t) {
            if (o[t]) return o[t].exports;
            var n = o[t] = {
                i: t,
                l: !1,
                exports: {}
            };
            return e[t].call(n.exports, n, n.exports, r), n.l = !0, n.exports
        }
        return r.m = e, r.c = o, r.d = function (t, n, e) {
            r.o(t, n) || Object.defineProperty(t, n, {
                enumerable: !0,
                get: e
            })
        }, r.r = function (t) {
            "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(t, Symbol.toStringTag, {
                value: "Module"
            }), Object.defineProperty(t, "__esModule", {
                value: !0
            })
        }, r.t = function (n, t) {
            if (1 & t && (n = r(n)), 8 & t) return n;
            if (4 & t && "object" == typeof n && n && n.__esModule) return n;
            var e = Object.create(null);
            if (r.r(e), Object.defineProperty(e, "default", {
                enumerable: !0,
                value: n
            }), 2 & t && "string" != typeof n)
                for (var o in n) r.d(e, o, function (t) {
                    return n[t]
                }.bind(null, o));
            return e
        }, r.n = function (t) {
            var n = t && t.__esModule ? function () {
                return t.default
            } : function () {
                return t
            };
            return r.d(n, "9", n), n
        }, r.o = function (t, n) {
            return Object.prototype.hasOwnProperty.call(t, n)
        }, r.p = "/bin/", r(r.s = 0)
    }([function (t, n, e) {
        var P = {},
            M = e(1),
            _ = e(2),
            A = e(3);
        t.exports = P;
        var E = 1;
        P.js = function () {
            var c, i, f, s = 1.4,
                p = !1,
                u = {},
                o = {},
                r = {},
                l = {},
                a = !0,
                h = {},
                d = [],
                y = Number.MAX_VALUE,
                v = !1;
            this.setAcceptableTiles = function (t) {
                t instanceof Array ? f = t : !isNaN(parseFloat(t)) && isFinite(t) && (f = [t])
            }, this.enableSync = function () {
                p = !0
            }, this.disableSync = function () {
                p = !1
            }, this.enableDiagonals = function () {
                v = !0
            }, this.disableDiagonals = function () {
                v = !1
            }, this.setGrid = function (t) {
                c = t;
                for (var n = 0; n < c.length; n++)
                    for (var e = 0; e < c[0].length; e++) o[c[n][e]] || (o[c[n][e]] = 1)
            }, this.setTileCost = function (t, n) {
                o[t] = n
            }, this.setAdditionalPointCost = function (t, n, e) {
                void 0 === r[n] && (r[n] = {}), r[n][t] = e
            }, this.removeAdditionalPointCost = function (t, n) {
                void 0 !== r[n] && delete r[n][t]
            }, this.removeAllAdditionalPointCosts = function () {
                r = {}
            }, this.setDirectionalCondition = function (t, n, e) {
                void 0 === l[n] && (l[n] = {}), l[n][t] = e
            }, this.removeAllDirectionalConditions = function () {
                l = {}
            }, this.setIterationsPerCalculation = function (t) {
                y = t
            }, this.avoidAdditionalPoint = function (t, n) {
                void 0 === u[n] && (u[n] = {}), u[n][t] = 1
            }, this.stopAvoidingAdditionalPoint = function (t, n) {
                void 0 !== u[n] && delete u[n][t]
            }, this.enableCornerCutting = function () {
                a = !0
            }, this.disableCornerCutting = function () {
                a = !1
            }, this.stopAvoidingAllAdditionalPoints = function () {
                u = {}
            }, this.findPath = function (t, n, e, o, r) {
                function i(t) {
                    p ? r(t) : setTimeout(function () {
                        r(t)
                    })
                }
                if (void 0 === f) throw new Error("You can't set a path without first calling setAcceptableTiles() on EasyStar.");
                if (void 0 === c) throw new Error("You can't set a path without first calling setGrid() on EasyStar.");
                if (t < 0 || n < 0 || e < 0 || o < 0 || t > c[0].length - 1 || n > c.length - 1 || e > c[0].length - 1 || o > c.length - 1) throw new Error("Your start or end point is outside the scope of your grid.");
                if (t !== e || n !== o) {
                    for (var s = c[o][e], u = !1, l = 0; l < f.length; l++)
                        if (s === f[l]) {
                            u = !0;
                            break
                        } if (!1 !== u) {
                            var a = new M;
                            a.openList = new A(function (t, n) {
                                return t.bestGuessDistance() - n.bestGuessDistance()
                            }), a.isDoneCalculating = !1, a.nodeHash = {}, a.startX = t, a.startY = n, a.endX = e, a.endY = o, a.callback = i, a.openList.push(O(a, a.startX, a.startY, null, 1));
                            o = E++;
                            return h[o] = a, d.push(o), o
                        }
                    i(null)
                } else i([])
            }, this.cancelPath = function (t) {
                return t in h && (delete h[t], !0)
            }, this.calculate = function () {
                if (0 !== d.length && void 0 !== c && void 0 !== f)
                    for (i = 0; i < y; i++) {
                        if (0 === d.length) return;
                        p && (i = 0);
                        var t = d[0],
                            n = h[t];
                        if (void 0 !== n)
                            if (0 !== n.openList.size()) {
                                var e = n.openList.pop();
                                if (n.endX !== e.x || n.endY !== e.y) (e.list = 0) < e.y && T(n, e, 0, -1, +b(e.x, e.y - 1)), e.x < c[0].length - 1 && T(n, e, 1, 0, +b(e.x + 1, e.y)), e.y < c.length - 1 && T(n, e, 0, 1, +b(e.x, e.y + 1)), 0 < e.x && T(n, e, -1, 0, +b(e.x - 1, e.y)), v && (0 < e.x && 0 < e.y && (a || g(c, f, e.x, e.y - 1, e) && g(c, f, e.x - 1, e.y, e)) && T(n, e, -1, -1, s * b(e.x - 1, e.y - 1)), e.x < c[0].length - 1 && e.y < c.length - 1 && (a || g(c, f, e.x, e.y + 1, e) && g(c, f, e.x + 1, e.y, e)) && T(n, e, 1, 1, s * b(e.x + 1, e.y + 1)), e.x < c[0].length - 1 && 0 < e.y && (a || g(c, f, e.x, e.y - 1, e) && g(c, f, e.x + 1, e.y, e)) && T(n, e, 1, -1, s * b(e.x + 1, e.y - 1)), 0 < e.x && e.y < c.length - 1 && (a || g(c, f, e.x, e.y + 1, e) && g(c, f, e.x - 1, e.y, e)) && T(n, e, -1, 1, s * b(e.x - 1, e.y + 1)));
                                else {
                                    var o = [];
                                    o.push({
                                        x: e.x,
                                        y: e.y
                                    });
                                    for (var r = e.parent; null != r;) o.push({
                                        x: r.x,
                                        y: r.y
                                    }), r = r.parent;
                                    o.reverse(), n.callback(o), delete h[t], d.shift()
                                }
                            } else n.callback(null), delete h[t], d.shift();
                        else d.shift()
                    }
            };
            var T = function (t, n, e, o, r) {
                e = n.x + e, o = n.y + o;
                void 0 !== u[o] && void 0 !== u[o][e] || !g(c, f, e, o, n) || (void 0 === (o = O(t, e, o, n, r)).list ? (o.list = 1, t.openList.push(o)) : n.costSoFar + r < o.costSoFar && (o.costSoFar = n.costSoFar + r, o.parent = n, t.openList.updateItem(o)))
            },
                g = function (t, n, e, o, r) {
                    var i = l[o] && l[o][e];
                    if (i) {
                        var s = x(r.x - e, r.y - o);
                        if (! function () {
                            for (var t = 0; t < i.length; t++)
                                if (i[t] === s) return !0;
                            return !1
                        }()) return !1
                    }
                    for (var u = 0; u < n.length; u++)
                        if (t[o][e] === n[u]) return !0;
                    return !1
                },
                x = function (t, n) {
                    if (0 === t && -1 === n) return P.TOP;
                    if (1 === t && -1 === n) return P.TOP_RIGHT;
                    if (1 === t && 0 === n) return P.RIGHT;
                    if (1 === t && 1 === n) return P.BOTTOM_RIGHT;
                    if (0 === t && 1 === n) return P.BOTTOM;
                    if (-1 === t && 1 === n) return P.BOTTOM_LEFT;
                    if (-1 === t && 0 === n) return P.LEFT;
                    if (-1 === t && -1 === n) return P.TOP_LEFT;
                    throw new Error("These differences are not valid: " + t + ", " + n)
                },
                b = function (t, n) {
                    return r[n] && r[n][t] || o[c[n][t]]
                },
                O = function (t, n, e, o, r) {
                    if (void 0 !== t.nodeHash[e]) {
                        if (void 0 !== t.nodeHash[e][n]) return t.nodeHash[e][n]
                    } else t.nodeHash[e] = {};
                    var i = m(n, e, t.endX, t.endY),
                        r = null !== o ? o.costSoFar + r : 0,
                        i = new _(o, n, e, r, i);
                    return t.nodeHash[e][n] = i
                },
                m = function (t, n, e, o) {
                    var r, i;
                    return v ? (r = Math.abs(t - e)) < (i = Math.abs(n - o)) ? s * r + i : s * i + r : (r = Math.abs(t - e)) + (i = Math.abs(n - o))
                }
        }, P.TOP = "TOP", P.TOP_RIGHT = "TOP_RIGHT", P.RIGHT = "RIGHT", P.BOTTOM_RIGHT = "BOTTOM_RIGHT", P.BOTTOM = "BOTTOM", P.BOTTOM_LEFT = "BOTTOM_LEFT", P.LEFT = "LEFT", P.TOP_LEFT = "TOP_LEFT"
    }, function (t, n) {
        t.exports = function () {
            this.pointsToAvoid = {}, this.startX, this.callback, this.startY, this.endX, this.endY, this.nodeHash = {}, this.openList
        }
    }, function (t, n) {
        t.exports = function (t, n, e, o, r) {
            this.parent = t, this.x = n, this.y = e, this.costSoFar = o, this.simpleDistanceToTarget = r, this.bestGuessDistance = function () {
                return this.costSoFar + this.simpleDistanceToTarget
            }
        }
    }, function (t, n, e) {
        t.exports = e(4)
    }, function (u, T, t) {
        var g, x;
        (function () {
            var t, p, l, h, d, n, a, e, y, v, o, r, i, c, f;
            function s(t) {
                this.cmp = null != t ? t : p, this.nodes = []
            }
            l = Math.floor, v = Math.min, p = function (t, n) {
                return t < n ? -1 : n < t ? 1 : 0
            }, y = function (t, n, e, o, r) {
                var i;
                if (null == e && (e = 0), null == r && (r = p), e < 0) throw new Error("lo must be non-negative");
                for (null == o && (o = t.length); e < o;) r(n, t[i = l((e + o) / 2)]) < 0 ? o = i : e = i + 1;
                return [].splice.apply(t, [e, e - e].concat(n)), n
            }, n = function (t, n, e) {
                return null == e && (e = p), t.push(n), c(t, 0, t.length - 1, e)
            }, d = function (t, n) {
                var e, o;
                return null == n && (n = p), e = t.pop(), t.length ? (o = t[0], t[0] = e, f(t, 0, n)) : o = e, o
            }, e = function (t, n, e) {
                var o;
                return null == e && (e = p), o = t[0], t[0] = n, f(t, 0, e), o
            }, a = function (t, n, e) {
                var o;
                return null == e && (e = p), t.length && e(t[0], n) < 0 && (n = (o = [t[0], n])[0], t[0] = o[1], f(t, 0, e)), n
            }, h = function (e, t) {
                var n, o, r, i, s, u;
                for (null == t && (t = p), s = [], o = 0, r = (i = function () {
                    u = [];
                    for (var t = 0, n = l(e.length / 2); 0 <= n ? t < n : n < t; 0 <= n ? t++ : t--) u.push(t);
                    return u
                }.apply(this).reverse()).length; o < r; o++) n = i[o], s.push(f(e, n, t));
                return s
            }, i = function (t, n, e) {
                if (null == e && (e = p), -1 !== (n = t.indexOf(n))) return c(t, 0, n, e), f(t, n, e)
            }, o = function (t, n, e) {
                var o, r, i, s, u;
                if (null == e && (e = p), !(r = t.slice(0, n)).length) return r;
                for (h(r, e), i = 0, s = (u = t.slice(n)).length; i < s; i++) o = u[i], a(r, o, e);
                return r.sort(e).reverse()
            }, r = function (t, n, e) {
                var o, r, i, s, u, l, a, c, f;
                if (null == e && (e = p), 10 * n <= t.length) {
                    if (!(i = t.slice(0, n).sort(e)).length) return i;
                    for (r = i[i.length - 1], s = 0, l = (a = t.slice(n)).length; s < l; s++) e(o = a[s], r) < 0 && (y(i, o, 0, null, e), i.pop(), r = i[i.length - 1]);
                    return i
                }
                for (h(t, e), f = [], u = 0, c = v(n, t.length); 0 <= c ? u < c : c < u; 0 <= c ? ++u : --u) f.push(d(t, e));
                return f
            }, c = function (t, n, e, o) {
                var r, i, s;
                for (null == o && (o = p), r = t[e]; n < e && o(r, i = t[s = e - 1 >> 1]) < 0;) t[e] = i, e = s;
                return t[e] = r
            }, f = function (t, n, e) {
                var o, r, i, s, u;
                for (null == e && (e = p), r = t.length, i = t[u = n], o = 2 * n + 1; o < r;)(s = o + 1) < r && !(e(t[o], t[s]) < 0) && (o = s), t[n] = t[o], o = 2 * (n = o) + 1;
                return t[n] = i, c(t, u, n, e)
            }, s.push = n, s.pop = d, s.replace = e, s.pushpop = a, s.heapify = h, s.updateItem = i, s.nlargest = o, s.nsmallest = r, s.prototype.push = function (t) {
                return n(this.nodes, t, this.cmp)
            }, s.prototype.pop = function () {
                return d(this.nodes, this.cmp)
            }, s.prototype.peek = function () {
                return this.nodes[0]
            }, s.prototype.contains = function (t) {
                return -1 !== this.nodes.indexOf(t)
            }, s.prototype.replace = function (t) {
                return e(this.nodes, t, this.cmp)
            }, s.prototype.pushpop = function (t) {
                return a(this.nodes, t, this.cmp)
            }, s.prototype.heapify = function () {
                return h(this.nodes, this.cmp)
            }, s.prototype.updateItem = function (t) {
                return i(this.nodes, t, this.cmp)
            }, s.prototype.clear = function () {
                return this.nodes = []
            }, s.prototype.empty = function () {
                return 0 === this.nodes.length
            }, s.prototype.size = function () {
                return this.nodes.length
            }, s.prototype.clone = function () {
                var t = new s;
                return t.nodes = this.nodes.slice(0), t
            }, s.prototype.toArray = function () {
                return this.nodes.slice(0)
            }, s.prototype.insert = s.prototype.push, s.prototype.top = s.prototype.peek, s.prototype.front = s.prototype.peek, s.prototype.has = s.prototype.contains, s.prototype.copy = s.prototype.clone, t = s, g = [], void 0 === (x = "function" == typeof (x = function () {
                return t
            }) ? x.apply(T, g) : x) || (u.exports = x)
        }).call(this)
    }]);

    const pfCONFIG = {
        GRID_SIZE: 28,
        SCALE_MULTIPLIER: 1.15,
        CACHE_DURATION: 150,
        MIN_RECALC_DIST: 25,
        ATTACK_RANGE_BUFFER: 1.8,
        FLEE_THRESHOLD: 400,
        MAX_ITERATIONS: 500,
        SMOOTHING_ENABLED: true,
        EARLY_EXIT_ENABLED: true,
    };
    class PathFinder {
        constructor() {
            this.easystar = new EasyStar.js();
            this.easystar.enableDiagonals();
            this.easystar.enableSync();
            this.easystar.disableCornerCutting();
            this.easystar.setIterationsPerCalculation(pfCONFIG.MAX_ITERATIONS);

            this.grid = [];
            this.gridCache = new Map();
            this.pathCache = new Map();

            this.lastCalculation = 0;
            this.lastTargetPos = { x: 0, y: 0 };
            this.cachedPath = [];
            this.pathIndex = 0;

            this.worldPath = [];
            this.gridOrigin = { x: 0, y: 0 };

            this.state = {
                active: false,
                gridSize: pfCONFIG.GRID_SIZE,
                scale: 0,
                finded: false,
                calculating: false
            };

            this.nodePool = [];
            this.maxPoolSize = 100;

            // Анимация лучей
            this.rayAnimation = {
                offset: 0,
                rays: [],
                lastUpdate: 0
            };

            // Инициализируем лучи
            for (let i = 0; i < 5; i++) {
                this.rayAnimation.rays.push({
                    position: i * 0.2,
                    speed: 0.3 + Math.random() * 0.2,
                    intensity: 0.7 + Math.random() * 0.3,
                    size: 15 + Math.random() * 10
                });
            }
        }

        getCachedPathKey(startX, startY, endX, endY) {
            return `${Math.floor(startX / 10)}_${Math.floor(startY / 10)}_${Math.floor(endX / 10)}_${Math.floor(endY / 10)}`;
        }

        calculateCollisionRadius(obj) {
            if (obj.trap) {
                return obj.isTeamObject(player) ? 0 : obj.scale + 20;
            }

            const cacheKey = `${obj.sid}_${obj.scale}_${obj.dmg}`;

            if (this.gridCache.has(cacheKey)) {
                return this.gridCache.get(cacheKey);
            }

            let radius;
            const baseRadius = player.scale + obj.getScale();

            if (obj.dmg && !obj.isTeamObject(player)) {
                radius = baseRadius + 35;
            } else if (obj.colDiv === 0.5) {
                radius = obj.scale * 0.5;
            } else {
                const speedFactor = player.maxSpeed * (items.weapons[player.weaponIndex]?.spdMult || 1);
                radius = baseRadius / Math.max(speedFactor, 0.5);
            }

            if (this.gridCache.size > 150) {
                const firstKey = this.gridCache.keys().next().value;
                this.gridCache.delete(firstKey);
            }

            this.gridCache.set(cacheKey, radius);
            return radius;
        }

        buildGrid(targetPos) {
            const { gridSize } = this.state;
            this.state.scale = (config.maxScreenWidth / 2) * pfCONFIG.SCALE_MULTIPLIER;

            const cellSize = this.state.scale / gridSize;
            const halfScale = this.state.scale / 2;
            const baseX = player.x2 - halfScale;
            const baseY = player.y2 - halfScale;

            this.gridOrigin = { x: baseX, y: baseY };
            this.cellSize = cellSize;

            const visibleObjects = gameObjects.filter(obj => {
                if (!obj.active) return false;
                const dx = Math.abs(obj.x - player.x2);
                const dy = Math.abs(obj.y - player.y2);
                return dx < this.state.scale && dy < this.state.scale;
            });

            const obstacles = visibleObjects
                .map(obj => ({
                    x: obj.x,
                    y: obj.y,
                    radius: this.calculateCollisionRadius(obj),
                    radiusSq: 0,
                    isTrap: obj.trap && obj.isTeamObject(player)
                }))
                .filter(o => o.radius > 0)
                .map(o => {
                    o.radiusSq = o.radius * o.radius;
                    return o;
                })
                .sort((a, b) => b.radius - a.radius);

            let targetGridX = Math.floor(gridSize / 2);
            let targetGridY = Math.floor(gridSize / 2);

            this.grid = new Array(gridSize);

            for (let y = 0; y < gridSize; y++) {
                this.grid[y] = new Uint8Array(gridSize);
                const cellY = baseY + cellSize * (y + 0.5);

                for (let x = 0; x < gridSize; x++) {
                    const cellX = baseX + cellSize * (x + 0.5);

                    const dx = targetPos.x - cellX;
                    const dy = targetPos.y - cellY;
                    const distSqToTarget = dx * dx + dy * dy;

                    if (distSqToTarget <= cellSize * cellSize) {
                        targetGridX = x;
                        targetGridY = y;
                        this.grid[y][x] = 0;
                        continue;
                    }

                    let blocked = false;
                    for (let i = 0; i < obstacles.length; i++) {
                        const obs = obstacles[i];
                        const dx = obs.x - cellX;
                        const dy = obs.y - cellY;
                        const distSq = dx * dx + dy * dy;

                        if (distSq <= obs.radiusSq) {
                            if (!obs.isTrap) {
                                blocked = true;
                                break;
                            }
                        }
                    }

                    this.grid[y][x] = blocked ? 1 : 0;
                }
            }

            return { targetGridX, targetGridY };
        }

        gridToWorld(gridX, gridY) {
            return {
                x: this.gridOrigin.x + this.cellSize * (gridX + 0.5),
                y: this.gridOrigin.y + this.cellSize * (gridY + 0.5)
            };
        }

        smoothPath(path) {
            if (!pfCONFIG.SMOOTHING_ENABLED || path.length <= 2) {
                return path;
            }

            const smoothed = [path[0]];
            let current = 0;

            while (current < path.length - 1) {
                let farthest = current + 1;

                for (let i = current + 2; i < path.length; i++) {
                    if (this.hasLineOfSight(path[current], path[i])) {
                        farthest = i;
                    } else {
                        break;
                    }
                }

                smoothed.push(path[farthest]);
                current = farthest;
            }

            return smoothed;
        }

        hasLineOfSight(from, to) {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.max(Math.abs(dx), Math.abs(dy));

            if (dist === 0) return true;

            const stepX = dx / dist;
            const stepY = dy / dist;

            for (let i = 0; i <= dist; i++) {
                const x = Math.floor(from.x + stepX * i);
                const y = Math.floor(from.y + stepY * i);

                if (x < 0 || y < 0 || x >= this.state.gridSize || y >= this.state.gridSize) {
                    return false;
                }

                if (this.grid[y][x] === 1) {
                    return false;
                }
            }

            return true;
        }

        moveToTarget(targetPos) {
            if (!targetPos) return;

            const angle = UTILS.getDirect(targetPos, player, 0, 2);
            packet("9", angle, 1);
        }

        findPath(targetPos) {
            if (!targetPos) return;
            if (autoBreak.inTrap) return;

            if (this.state.calculating) return;

            const now = Date.now();
            const dx = targetPos.x - this.lastTargetPos.x;
            const dy = targetPos.y - this.lastTargetPos.y;
            const targetMoved = (dx * dx + dy * dy) > (pfCONFIG.MIN_RECALC_DIST * pfCONFIG.MIN_RECALC_DIST);

            if (!targetMoved &&
                now - this.lastCalculation < pfCONFIG.CACHE_DURATION &&
                this.cachedPath.length > this.pathIndex + 1) {
                this.followCachedPath();
                return;
            }

            this.state.calculating = true;

            const { targetGridX, targetGridY } = this.buildGrid(targetPos);

            this.easystar.setGrid(this.grid);
            this.easystar.setAcceptableTiles([0]);

            const centerX = Math.floor(this.state.gridSize / 2);
            const centerY = Math.floor(this.state.gridSize / 2);

            const self = this;

            this.easystar.findPath(centerX, centerY, targetGridX, targetGridY, function (path) {
                self.state.calculating = false;

                if (!path || path.length <= 1) {
                    self.cachedPath = [];
                    self.worldPath = [];
                    self.moveToTarget(targetPos);
                    return;
                }

                const smoothedPath = self.smoothPath(path);

                self.cachedPath = smoothedPath;
                self.pathIndex = 0;
                self.lastCalculation = now;
                self.lastTargetPos = { x: targetPos.x, y: targetPos.y };

                self.worldPath = smoothedPath.map(point => self.gridToWorld(point.x, point.y));
                self.worldPath.push({ x: targetPos.x, y: targetPos.y });

                self.followCachedPath();
            });

            this.easystar.calculate();
        }

        followCachedPath() {
            if (this.cachedPath.length <= this.pathIndex + 1) {
                this.moveToTarget(this.lastTargetPos);
                return;
            }

            while (this.pathIndex + 1 < this.worldPath.length - 1) {
                const nextPoint = this.worldPath[this.pathIndex + 1];

                const dx = nextPoint.x - player.x2;
                const dy = nextPoint.y - player.y2;
                const distSq = dx * dx + dy * dy;

                if (distSq < 400) {
                    this.pathIndex++;
                } else {
                    break;
                }
            }

            const nextPoint = this.worldPath[this.pathIndex + 1];

            if (!nextPoint) {
                this.moveToTarget(this.lastTargetPos);
                return;
            }

            const angle = UTILS.getDirect(nextPoint, player, 0, 2);
            packet("9", angle, 1);
        }

        // Обновление анимации лучей
        updateRayAnimation(delta) {
            const now = Date.now();
            const dt = (now - this.rayAnimation.lastUpdate) / 1000;
            this.rayAnimation.lastUpdate = now;

            for (let ray of this.rayAnimation.rays) {
                ray.position += ray.speed * dt;
                if (ray.position > 1) {
                    ray.position = 0;
                    ray.speed = 0.3 + Math.random() * 0.2;
                    ray.intensity = 0.7 + Math.random() * 0.3;
                    ray.size = 15 + Math.random() * 10;
                }
            }
        }

        // Создание плавной кривой Безье через точки
        createSmoothCurve(points) {
            if (points.length < 2) return points;

            const curvePoints = [];
            const tension = 0.3;

            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[Math.max(0, i - 1)];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[Math.min(points.length - 1, i + 2)];

                for (let t = 0; t <= 1; t += 0.1) {
                    const t2 = t * t;
                    const t3 = t2 * t;

                    const x = 0.5 * (
                        (2 * p1.x) +
                        (-p0.x + p2.x) * t +
                        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
                    );

                    const y = 0.5 * (
                        (2 * p1.y) +
                        (-p0.y + p2.y) * t +
                        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
                    );

                    curvePoints.push({ x, y });
                }
            }

            curvePoints.push(points[points.length - 1]);
            return curvePoints;
        }

        // Вычисление общей длины пути
        calculatePathLength(points) {
            let length = 0;
            for (let i = 1; i < points.length; i++) {
                const dx = points[i].x - points[i - 1].x;
                const dy = points[i].y - points[i - 1].y;
                length += Math.sqrt(dx * dx + dy * dy);
            }
            return length;
        }

        // Получение точки на пути по процентному положению
        getPointAtPercent(points, percent, totalLength) {
            if (percent <= 0) return points[0];
            if (percent >= 1) return points[points.length - 1];

            const targetDist = percent * totalLength;
            let currentDist = 0;

            for (let i = 1; i < points.length; i++) {
                const dx = points[i].x - points[i - 1].x;
                const dy = points[i].y - points[i - 1].y;
                const segmentLength = Math.sqrt(dx * dx + dy * dy);

                if (currentDist + segmentLength >= targetDist) {
                    const t = (targetDist - currentDist) / segmentLength;
                    return {
                        x: points[i - 1].x + dx * t,
                        y: points[i - 1].y + dy * t
                    };
                }

                currentDist += segmentLength;
            }

            return points[points.length - 1];
        }

        clearCache() {
            if (this.gridCache.size > 150) {
                const entries = Array.from(this.gridCache.entries());
                this.gridCache.clear();
                entries.slice(-75).forEach(([key, value]) => {
                    this.gridCache.set(key, value);
                });
            }
            this.worldPath = [];
            this.cachedPath = [];
            this.pathIndex = 0;
        }

        renderPath(mainContext, xOffset, yOffset, pushData, isAutoPush = false) {
            // Обновляем анимацию
            this.updateRayAnimation(16);
            const hasPath = this.worldPath?.length > 1 && this.state.active;
            const hasPush = isAutoPush && pushData && pushData.x2 !== undefined;
            if (!hasPath && !hasPush) {
                return;
            }
            mainContext.save();
            mainContext.lineCap = "round";
            mainContext.lineJoin = "round";

            // Собираем все точки для рендеринга
            let allPoints = [];

            // Начинаем с позиции игрока
            allPoints.push({
                x: player.x2,
                y: player.y2
            });

            // Добавляем точки пути если есть
            if (hasPath) {
                const startIdx = Math.max(0, this.pathIndex);
                for (let i = startIdx + 1; i < this.worldPath.length; i++) {
                    allPoints.push(this.worldPath[i]);
                }
            }

            // Добавляем точки push если есть
            if (hasPush) {
                // Позиция для push (x2, y2)
                allPoints.push({
                    x: pushData.x2,
                    y: pushData.y2
                });
                // Конечная цель (spike) (x, y)
                allPoints.push({
                    x: pushData.x,
                    y: pushData.y
                });
            }
            if (allPoints.length < 2) {
                mainContext.restore();
                return;
            }

            // Создаем плавную кривую
            const smoothPoints = this.createSmoothCurve(allPoints);
            const totalLength = this.calculatePathLength(smoothPoints);

            // Конвертируем в экранные координаты
            const screenPoints = smoothPoints.map(p => ({
                x: p.x - xOffset,
                y: p.y - yOffset
            }));

            this.drawPathShadow(mainContext, screenPoints);

            this.drawBasePath(mainContext, screenPoints);
            mainContext.restore();
        }

        // Рисуем тень линии
        drawPathShadow(mainContext, screenPoints) {
            mainContext.beginPath();
            mainContext.moveTo(screenPoints[0].x + 3, screenPoints[0].y + 3);
            for (let i = 1; i < screenPoints.length; i++) {
                mainContext.lineTo(screenPoints[i].x + 3, screenPoints[i].y + 3);
            }
            mainContext.lineWidth = 12;
            mainContext.strokeStyle = "rgba(0, 0, 0, 0.4)";
            mainContext.stroke();
        }

        // Рисуем основную темную линию
        drawBasePath(mainContext, screenPoints) {
            mainContext.beginPath();
            mainContext.moveTo(screenPoints[0].x, screenPoints[0].y);
            for (let i = 1; i < screenPoints.length; i++) {
                mainContext.lineTo(screenPoints[i].x, screenPoints[i].y);
            }

            // Основная темная линия
            mainContext.lineWidth = 8;
            mainContext.strokeStyle = "#1a0a2e"; // Очень темный фиолетовый
            mainContext.stroke();

            // Внутренняя линия чуть светлее
            mainContext.lineWidth = 5;
            mainContext.strokeStyle = "#2d1b4e";
            mainContext.stroke();
        }
    }

    const pathfinder = new PathFinder();

    function callPathFinder(pos, one) {
        const targetPos = {
            x: pos.x || pos,
            y: pos.y || one
        };
        pathfinder.findPath(targetPos);
    }

    // STOP PUSH:
    let pushDamageTracker = {
        targetSid: null,
        lastDamageTime: 0,
        damageCount: 0,
        pushStopped: false,
        noDamageRequired: 2000, // 2 sec
        damageWindow: 3000,
        maxHitsBeforeStop: 3
    };

    function trackNearDamage(nearSid, damage) {
        const now = Date.now();

        if (pushDamageTracker.targetSid !== nearSid) {
            resetPushDamageTracker();
            pushDamageTracker.targetSid = nearSid;
        }

        if (now - pushDamageTracker.lastDamageTime > pushDamageTracker.damageWindow) {
            pushDamageTracker.damageCount = 0;
        }

        pushDamageTracker.damageCount++;
        pushDamageTracker.lastDamageTime = now;

        if (pushDamageTracker.damageCount >= pushDamageTracker.maxHitsBeforeStop) {
            if (!pushDamageTracker.pushStopped) {
                pushDamageTracker.pushStopped = true;

                if (typeof addMenuChText === 'function') {
                    addMenuChText("AutoPush", `Пауза: враг под ударами (${pushDamageTracker.damageCount} hits)`, "orange");
                }

                if (typeof textManager !== 'undefined' && player) {
                }
            }
        }
    }

    function resetPushDamageTracker() {
        pushDamageTracker.targetSid = null;
        pushDamageTracker.lastDamageTime = 0;
        pushDamageTracker.damageCount = 0;
        pushDamageTracker.pushStopped = false;
    }

    function canContinuePush() {
        const now = Date.now();

        if (pushDamageTracker.pushStopped) {
            const timeSinceLastDamage = now - pushDamageTracker.lastDamageTime;

            if (timeSinceLastDamage >= pushDamageTracker.noDamageRequired) {
                resetPushDamageTracker();
                console.log("[AutoPush] Возобновлен: 2 сек без урона прошло");

                if (typeof addMenuChText === 'function') {
                    addMenuChText("AutoPush", "Возобновлен: враг не получает урон", "lime");
                }

                if (typeof textManager !== 'undefined' && player) {
                }

                return true;
            }

            return false;
        }

        return true;
    }

    function getPushStatus() {
        if (!pushDamageTracker.pushStopped) {
            return { active: true, status: "running" };
        }

        const now = Date.now();
        const timeSinceLastDamage = now - pushDamageTracker.lastDamageTime;
        const timeRemaining = Math.max(0, pushDamageTracker.noDamageRequired - timeSinceLastDamage);

        return {
            active: false,
            status: "waiting",
            timeRemaining: timeRemaining,
            lastDamageAgo: timeSinceLastDamage
        };
    }

    // AUTOPUSH:
    function autoPush() {
        if (!canContinuePush()) {
            if (my.autoPush) {
                my.autoPush = false;
                packet("9", lastMoveDir || undefined, 1);
                pathfinder.clearCache();
            }
            return;
        }

        let nearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 5)).sort(function (a, b) {
            return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
        })[0];

        if (nearTrap) {
            nearTrap.hideFromEnemy = false;
        }

        if (nearTrap) {
            if (near && near.sid) {
                pushDamageTracker.targetSid = near.sid;
            }

            let spike = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= (90 + tmp.scale)).sort(function (a, b) {
                return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
            })[0];

            if (spike) {
                const nearToSpike = UTILS.getDist(near, spike, 2, 0);
                const directToSpike = UTILS.getDirect(near, spike, 2, 0);
                let pos = {
                    x: spike.x + (250 * Math.cos(directToSpike)),
                    y: spike.y + (250 * Math.sin(directToSpike)),
                    x2: spike.x + ((nearToSpike + player.scale * 1.52) * Math.cos(directToSpike)),
                    y2: spike.y + ((nearToSpike + player.scale * 1.52) * Math.sin(directToSpike))
                };

                let finds = gameObjects.filter(tmp => tmp.active).find((tmp) => {
                    let tmpScale = tmp.getScale();
                    if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, player.x2, player.y2, pos.x2, pos.y2)) {
                        return true;
                    }
                });

                my.autoPush = true;
                my.pushData = {
                    x: spike.x,
                    y: spike.y,
                    x2: pos.x2,
                    y2: pos.y2
                };

                const checkDistToPositeons2 = UTILS.getDist(pos, player, 2, 2) > 100;
                if (finds || checkDistToPositeons2) {
                    callPathFinder({
                        x: pos.x2,
                        y: pos.y2,
                    });
                } else {
                    pathfinder.clearCache();

                    let scale = player.scale / 10;
                    const canStop = near.health < 100 && nearToSpike <= 45 + spike.scale;
                    if (canStop) {
                        packet("9", null, 1);
                    } else if (UTILS.lineInRect(player.x2 - scale, player.y2 - scale, player.x2 + scale, player.y2 + scale, near.x2, near.y2, pos.x, pos.y)) {
                        packet("9", near.aim2, 1);
                    } else {
                        packet("9", UTILS.getDirect(pos, player, 2, 2), 1);
                    }
                }
            } else {
                if (my.autoPush) {
                    my.autoPush = false;
                    packet("9", lastMoveDir || undefined, 1);
                    resetPushDamageTracker();
                }
            }
        } else {
            if (my.autoPush) {
                my.autoPush = false;
                packet("9", lastMoveDir || undefined, 1);
                resetPushDamageTracker();
            }
        }
    }

    // ADD DEAD PLAYER:
    function addDeadPlayer(tmpObj) {
        deadPlayers.push(new DeadPlayer(tmpObj.x, tmpObj.y, tmpObj.dir, tmpObj.buildIndex, tmpObj.weaponIndex, tmpObj.weaponVariant, tmpObj.skinColor, tmpObj.scale, tmpObj.name));
        createDeathAnim(tmpObj);
    }

    let deathAnims = [];

    function createDeathAnim(obj) {
        if (!obj) return;
        deathAnims.push({
            x: obj.x,
            y: obj.y,
            scale: obj.scale || 40,
            dir: obj.dir || 0,
            skinIndex: obj.skinIndex || 0,
            tailIndex: obj.tailIndex || 0,
            weaponIndex: obj.weaponIndex || 0,
            alpha: 1,
            originDir: Math.random() * Math.PI * 2,
            speed: 0.8 + Math.random() * 1.2,
            spin: (Math.random() - 0.5) * 0.1,
            life: 1000,
            aliveTime: 0
        });
    }

    function updateDeathAnims(delta, xOffset, yOffset) {
        for (let i = deathAnims.length - 1; i >= 0; i--) {
            const anim = deathAnims[i];
            anim.aliveTime += delta;
            const progress = anim.aliveTime / anim.life;
            anim.alpha = Math.max(0, 1 - progress);
            anim.originDir += anim.spin * delta * 0.06;
            const move = anim.speed * delta * 0.06;
            anim.x += Math.cos(anim.originDir) * move;
            anim.y += Math.sin(anim.originDir) * move;
            if (anim.alpha <= 0) {
                deathAnims.splice(i, 1);
                continue;
            }
        }

        if (deathAnims.length > 0) {
            mainContext.save();
            mainContext.globalAlpha = 1;
            mainContext.strokeStyle = outlineColor;
            for (const anim of deathAnims) {
                const dx = anim.x - xOffset;
                const dy = anim.y - yOffset;
                mainContext.globalAlpha = anim.alpha;
                mainContext.lineWidth = outlineWidth;
                // draw spiral particles
                mainContext.beginPath();
                mainContext.arc(dx, dy, anim.scale * (0.2 + (1 - anim.alpha) * 0.8), 0, Math.PI * 2);
                mainContext.fillStyle = `rgba(240, 150, 30, ${0.45 * anim.alpha})`;
                mainContext.fill();
                mainContext.stroke();
            }
            mainContext.restore();
        }
    }

    /** APPLY SOCKET CODES */

    // SET INIT DATA:
    function setInitData(data) {
        alliances = data.teams;
    }

    // SETUP GAME:
    function setupGame(yourSID) {
        keys = {};
        macro = {};
        playerSID = yourSID;
        attackState = 0;
        inGame = true;
        packet("d", 0, getAttackDir(), 1);
        my.ageInsta = true;
        if (firstSetup) {
            firstSetup = false;
            gameObjects.length = 0;
            liztobj.length = 0;
        }
    }
    /*function knockBackPredict() {
                //thank you OE2375
                let KBIndc = {
                    x0: 0,
                    y0: 0,
                    x1: 0,
                    y1: 0,
                    instax: 0,
                    instay: 0,
                    turretx: 0,
                    turrety: 0
                }
                let nea = Math.atan2(near.y2 - player.y2, near.x2 - player.x2);
                let minDist = Infinity;
                let neIT = gameObjects.filter(e => e.name == "pit trap" && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= e.getScale() + player.scale + 5).sort((a, b) => {
                    return UTILS.getDist(a, near, 0, 2) - UTILS.UTILS.getDist(b, near, 0, 2);
                })[0];
                if (near.dist2 - player.scale * 1.8 <= items.weapons[player.weapons[0]].range && !neIT) {
                    for (let tmp of gameObjects) {
                        let scope = KBIndc;
                        if (tmp.dmg && tmp.active && tmp.isTeamObject(player)) {
                            let primaryScaling = (items.weapons[player.weapons[0]].knock||0) * items.weapons[player.weapons[0]].range + player.scale * 2
                            let secondaryScaling = ![undefined, 9, 12, 13, 15].includes(player.weapons[1]) ? (items.weapons[player.weapons[1]].knock||0) * items.weapons[player.weapons[1]].range + player.scale*2 - 10 : player.weapons[1] != undefined ? 60 : 0
                            let instaStuff = primaryScaling + secondaryScaling
                            let turretStuff = player.reloads[53] == 0 ? primaryScaling + secondaryScaling + 75 : instaStuff
                            let primaryX = near.x2 + primaryScaling * Math.cos(nea)
                            let primaryY = near.y2 + primaryScaling * Math.sin(nea)
                            let secondaryX = near.x2 + secondaryScaling * Math.cos(nea)
                            let secondaryY = near.y2 + secondaryScaling * Math.sin(nea)
                            let instaX = near.x2 + instaStuff * Math.cos(nea)
                            let instaY = near.y2 + instaStuff * Math.sin(nea)
                            let turretX = near.x2 + turretStuff * Math.cos(nea)
                            let turretY = near.y2 + turretStuff * Math.sin(nea)
                            scope.x0 = primaryX, scope.y0 = primaryY
                            scope.x1 = secondaryX, scope.y1 = secondaryY
                            scope.instax = instaX, scope.instay = instaY
                            scope.turretx = turretX, scope.turrety = turretY
                            if ((UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && !autoBreak.inTrap) {
                                tracker.draw2.active = true
                                tracker.draw2.x = tmp.x
                                tracker.draw2.y = tmp.y
                                tracker.draw2.scale = tmp.scale
                                return "insta them"
                            }
                            if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !autoBreak.inTrap) {
                                return "insta them"
                                tracker.draw2.active = true
                                tracker.draw2.x = tmp.x
                                tracker.draw2.y = tmp.y
                                tracker.draw2.scale = tmp.scale
                            }
                        }
                    }
                } else {
                    tracker.draw2.active = false
                    KBIndc = {
                        x0: 0,
                        y0: 0,
                        x1: 0,
                        y1: 0,
                        instax: 0,
                        instay: 0,
                        turretx: 0,
                        turrety: 0
                    }
                }
                return false
            }*/
    let barbKbPredict = false;

    function knockBackPredict() {
        //thank you OE2375
        let KBIndc = {
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 0,
            instax: 0,
            instay: 0,
            turretx: 0,
            turrety: 0
        }
        let nea = Math.atan2(near.y2 - player.y2, near.x2 - player.x2);
        let minDist = Infinity;
        let neIT = gameObjects.filter(e => e.name == "pit trap" && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= e.getScale() + player.scale + 5).sort((a, b) => {
            return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
        })[0];
        if (near.dist2 - player.scale * 1.8 <= items.weapons[player.weapons[0]].range && !neIT) {
            for (let tmp of gameObjects) {
                let scope = KBIndc;
                if (tmp.dmg && tmp.active && tmp.isTeamObject(player)) {
                    let primaryScaling = (items.weapons[player.weapons[0]].knock || 0) * items.weapons[player.weapons[0]].range + player.scale * 2
                    let secondaryScaling = ![undefined, 9, 12, 13, 15].includes(player.weapons[1]) ? (items.weapons[player.weapons[1]].knock || 0) * items.weapons[player.weapons[1]].range + player.scale * 2 - 10 : player.weapons[1] != undefined ? 60 : 0
                    let instaStuff = primaryScaling + secondaryScaling
                    let turretStuff = player.reloads[53] == 0 ? primaryScaling + secondaryScaling + 75 : instaStuff
                    let primaryX = near.x2 + primaryScaling * Math.cos(nea)
                    let primaryY = near.y2 + primaryScaling * Math.sin(nea)
                    let secondaryX = near.x2 + secondaryScaling * Math.cos(nea)
                    let secondaryY = near.y2 + secondaryScaling * Math.sin(nea)
                    let instaX = near.x2 + instaStuff * Math.cos(nea)
                    let instaY = near.y2 + instaStuff * Math.sin(nea)
                    let turretX = near.x2 + turretStuff * Math.cos(nea)
                    let turretY = near.y2 + turretStuff * Math.sin(nea)
                    let barbarianKnockback = 235;
                    scope.x0 = primaryX, scope.y0 = primaryY
                    scope.x1 = secondaryX, scope.y1 = secondaryY
                    scope.instax = instaX, scope.instay = instaY
                    scope.turretx = turretX, scope.turrety = turretY
                    if ((UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && !autoBreak.inTrap) {
                        tracker.draw2.active = true
                        tracker.draw2.x = tmp.x
                        tracker.draw2.y = tmp.y
                        tracker.draw2.scale = tmp.scale
                        return "insta them"
                    }
                    if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !autoBreak.inTrap) {
                        tracker.draw2.active = true
                        tracker.draw2.x = tmp.x
                        tracker.draw2.y = tmp.y
                        tracker.draw2.scale = tmp.scale
                        return "insta them"
                    }
                    if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) > tmp.scale + player.scale && UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale + barbarianKnockback) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !autoBreak.inTrap) {
                        buyEquip(0, 0);
                        barbKbPredict = true;
                        tracker.draw2.active = true
                        tracker.draw2.x = tmp.x
                        tracker.draw2.y = tmp.y
                        tracker.draw2.scale = tmp.scale
                    }
                }
            }
        } else {
            tracker.draw2.active = false
            barbKbPredict = false;
            KBIndc = {
                x0: 0,
                y0: 0,
                x1: 0,
                y1: 0,
                instax: 0,
                instay: 0,
                turretx: 0,
                turrety: 0
            }
        }
        return false
    }
    // ADD NEW PLAYER:
    function addPlayer(data, isYou) {
        let tmpPlayer = findPlayerByID(data[0]);
        if (!tmpPlayer) {
            tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager,
                objectManager, players, ais, items, hats, accessories);
            players.push(tmpPlayer);
            if (data[1] != playerSID) {
                addMenuChText(null, `Found ${data[2]} {${data[1]}}`, "lime");
            }
        } else {
            if (data[1] != playerSID) {
                addMenuChText(null, `Found ${data[2]} {${data[1]}}`, "lime");
            }
        }
        tmpPlayer.spawn(isYou ? true : null);
        tmpPlayer.visible = false;
        tmpPlayer.oldPos = {
            x2: undefined,
            y2: undefined
        };
        tmpPlayer.x2 = undefined;
        tmpPlayer.y2 = undefined;
        tmpPlayer.x3 = undefined;
        tmpPlayer.y3 = undefined;
        tmpPlayer.setData(data);
        if (isYou) {
            if (!player) {
                window.prepareUI(tmpPlayer);
            }
            player = tmpPlayer;
            camX = player.x;
            camY = player.y;
            my.lastDir = 0;
            my.healed = false;
            my.bullTick = 0;
            updateItems();
            updateAge();
            updateItemCountDisplay();
            if (player.skins[7]) {
                my.reSync = true;
            }
        }
    }
    // REMOVE PLAYER:
    function removePlayer(id) {
        for (let i = 0; i < players.length; i++) {
            if (players[i].id == id) {
                addMenuChText("Game", players[i].name + "[" + players[i].sid + "] left the game", "red");
                players.splice(i, 1);
                break;
            }
        }
    }
    function hitBull(angle, turret) {
        instaC.isTrue = true;
        realDir(2);
        if (angle == near.aim2) {
            my.autoAim = true;
            game.tickBase(() => {
                my.autoAim = false;
            }, 2);
        } else {
            packet("D", angle, 1, "hitBull");
        }
        selectWeapon(player.primaryIndex);
        if (player.tailIndex == 11) {
            buyEquip(19, 1);
        } else {
            buyEquip(7, 0);
        }
        sendAutoGather();
        if (!turret) {
            game.tickBase(() => {
                sendAutoGather();
                instaC.isTrue = false;
            }, 1);
        } else {
            game.tickBase(() => {
                sendAutoGather();
                packet("D", angle, 1, "hitBull");
                buyEquip(53, 0);
                game.tickBase(() => {
                    instaC.isTrue = false;
                }, 1);
            }, 1);
        }
    }

    // UPDATE HEALTH:
    function updateHealth(sid, value) {
        tmpObj = findPlayerBySID(sid);

        if (!tmpObj) return;

        tmpObj.oldHealth = tmpObj.health;
        tmpObj.health = value;
        tmpObj.maxHealth = Math.max(tmpObj.health, tmpObj.maxHealth);
        tmpObj.judgeShame();

        if (tmpObj.oldHealth > tmpObj.health) {
            tmpObj.timeDamaged = Date.now();
            tmpObj.damaged = tmpObj.oldHealth - tmpObj.health;
            let damaged = tmpObj.damaged;

            if (my.autoPush && near && near.sid && tmpObj.sid === near.sid && damaged > 0) {
                trackNearDamage(near.sid, damaged);
            }

            if (tmpObj.health <= 0) {
                if (!tmpObj.death) {
                    tmpObj.death = true;
                    if (tmpObj != player) {
                        if (tmpObj.skinIndex == 45) {
                            addMenuChText("Game", `${tmpObj.name}[${tmpObj.sid}] has died due to clown`, "red");
                        } else if (tmpObj.shameCount >= 5) {
                            addMenuChText("Game", `${tmpObj.name}[${tmpObj.sid}] has died due to high shame`, "red");
                        } else {
                            addMenuChText("Game", `${tmpObj.name}[${tmpObj.sid}] has died`, "red");
                        }
                    }
                    g3(tmpObj, 20, 0.28, tmpObj.skinIndex, tmpObj.tailIndex, 0.00215, 0, { accel: { x: tmpObj.x, y: tmpObj.y } });
                }
            }
            advHeal.push([sid, value, damaged]);
            clearTimeout(healTimeout);
            healTimeout = setTimeout(() => {
                if (player && player.alive && inGame && player.health < player.maxHealth && !my.healed) {
                    my.healed = true;
                    healer();
                }
            }, Math.max(50, 140 - (window.pingTime || window.ping || 0)));
        } else if (tmpObj.oldHealth < tmpObj.health) {
            tmpObj.timeHealed = Date.now();
        }
    }
    // KILL PLAYER:
    function killPlayer() {
        inGame = false;
        lastDeath = {
            x: player.x,
            y: player.y,
        };
        if (configs.autoRespawn) {
            getEl("diedText").style.display = "none";
            packet("M", {
                name: lastsp[0],
                moofoll: lastsp[1],
                skin: lastsp[2]
            });
        }
    }

    // UPDATE PLAYER ITEM VALUES:
    function updateItemCounts(index, value) {
        if (player) {
            player.itemCounts[index] = value;
            updateItemCountDisplay(index);
        }
    }

    // UPDATE AGE:
    function updateAge(xp, mxp, age) {
        if (xp != undefined)
            player.XP = xp;
        if (mxp != undefined)
            player.maxXP = mxp;
        if (age != undefined)
            player.age = age;
    }

    // UPDATE UPGRADES:
    function updateUpgrades(points, age) {
        player.upgradePoints = points;
        player.upgrAge = age;
        if (points > 0) {
            tmpList.length = 0;
            UTILS.removeAllChildren(upgradeHolder);
            for (let i = 0; i < items.weapons.length; ++i) {
                if (items.weapons[i].age == age && (items.weapons[i].pre == undefined || player.weapons.indexOf(items.weapons[i].pre) >= 0)) {
                    let e = UTILS.generateElement({
                        id: "upgradeItem" + i,
                        class: "actionBarItem",
                        onmouseout: function () {
                            showItemInfo();
                        },
                        parent: upgradeHolder
                    });
                    e.style.backgroundImage = getEl("actionBarItem" + i).style.backgroundImage;
                    tmpList.push(i);
                }
            }
            for (let i = 0; i < items.list.length; ++i) {
                if (items.list[i].age == age && (items.list[i].pre == undefined || player.items.indexOf(items.list[i].pre) >= 0)) {
                    let tmpI = (items.weapons.length + i);
                    let e = UTILS.generateElement({
                        id: "upgradeItem" + tmpI,
                        class: "actionBarItem",
                        onmouseout: function () {
                            showItemInfo();
                        },
                        parent: upgradeHolder
                    });
                    e.style.backgroundImage = getEl("actionBarItem" + tmpI).style.backgroundImage;
                    tmpList.push(tmpI);
                }
            }
            for (let i = 0; i < tmpList.length; i++) {
                (function (i) {
                    let tmpItem = getEl('upgradeItem' + i);
                    tmpItem.onclick = UTILS.checkTrusted(function () {
                        packet("H", i);
                    });
                    UTILS.hookTouchEvents(tmpItem);

                    if (configs.autoUpgrade) {
                        let parsedInt = parseInt(configs.autoUpgrade);

                        if (tmpList.length == 1) {
                            packet("H", i);
                        } else if (["17", "31", "23", parsedInt].find(e => tmpItem.id.includes(e))) {
                            packet("H", i);
                        }
                    }
                })(tmpList[i]);
            }
            if (tmpList.length) {
                upgradeHolder.style.display = "block";
                upgradeCounter.style.display = "block";
                upgradeCounter.innerHTML = "SELECT ITEMS (" + points + ")";
            } else {
                upgradeHolder.style.display = "none";
                upgradeCounter.style.display = "none";
                showItemInfo();
            }
        } else {
            upgradeHolder.style.display = "none";
            upgradeCounter.style.display = "none";
            showItemInfo();
        }
    }
    function shitassAutismBreakObjects(findObj, sid) {

        let i = 0;
        while (i < breakObjects.length) {
            if (breakObjects[i].sid === sid) {
                breakObjects.splice(i, 1);
                break;
            } else {
                i++;
            }
        }
        if (!player.canSee(findObj)) {
            breakTrackers.push({
                x: findObj.x,
                y: findObj.y
            });
        }
        if (breakTrackers.length >= 10) {
            breakTrackers.shift();
        }
    }
    const placedSpikePositions = new Set();

    let safeShitASPNow = false;
    function tryisantinowmaybeHealingtoo() {
        my.anti0Tick = player.skinIndex !== 6 ? 2 : 1;
        if (tmpObj.shameCount < 5) {
            if (game.tick - player.antiTimer > 1) {
                tmpObj.antiTimer = game.tick;
                healer();
            } else {
                healer();
            }
        }

        game.tickBase(() => {
            if (safeShitASPNow) {
                safeShitASPNow = false;
            }
        }, 1);
    }
    // KILL OBJECT:
    function killObject(sid) {
        let findObj = findObjectBySid(sid);

        if (findObj && player) {
            if (configs.AntiSpikeTickTheartTry) {
                const dir = UTILS.getDirect(findObj, near, 0, 2);
                const dist = UTILS.getDist(findObj, near, 0, 2);
                const checkFullDirectionsWatchToU = UTILS.getAngleDist(dir, near.dir) <= 1 || UTILS.getAngleDist(dir, near.d2) <= 1 || UTILS.getAngleDist(dir, near.d1) <= 1;
                if (!safeShitASPNow && findObj.trap && near.dist2 < 180 && dist <= 35 + findObj.scale + 5
                    && [3, 4, 5].includes(near.primaryIndex) && checkFullDirectionsWatchToU) {
                    safeShitASPNow = true;
                    tryisantinowmaybeHealingtoo();
                }
            }

            autoPlacer.replacer(findObj);

            shitassAutismBreakObjects(findObj, sid)
        }

        objectManager.disableBySid(sid);
    }
    // KILL ALL OBJECTS BY A PLAYER:
    function killObjects(sid) {
        if (player) objectManager.removeAllItems(sid);
    }
    function setTickout(doo, timeout) {
        if (!ticks.manage[ticks.tick + timeout]) {
            ticks.manage[ticks.tick + timeout] = [doo];
        } else {
            ticks.manage[ticks.tick + timeout].push(doo);
        }
    }

    function caf(e, t) {
        try {
            return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
        } catch (e) {
            return 0;
        }
    }

    let found = false;
    let autoQ = false;

    let autos = {
        insta: {
            todo: false,
            wait: false,
            count: 4,
            shame: 5
        },
        bull: false,
        antibull: 0,
        reloaded: false,
        stopspin: true
    }
    // UPDATE PLAYER DATA:
    let AutoOneTicked = false;
    function updatePlayers(data) {
        if (player.shameCount > 0) {
            my.reSync = true;
        } else {
            my.reSync = false;
        }

        // let movementPrediction = {
        //     x: player.x2 + (player.oldPos.x2 - player.x2) * -1,
        //     y: player.y2 + (player.oldPos.y2 - player.y2) * -1,
        // }

        //     let potentialzpiketick = liztobj.filter((e) => e.active && e.dmg)

        //     potentialzpiketick.forEach((obj) => {
        //         if(cdf(obj, player) <= 200) {
        //             packet('a', undefined);
        //         }
        //     })

        // let newPos = {
        //     x: player.x2 + (tracker.lastPos.x - player.x2) * -1,
        //     y: player.y2 + (tracker.lastPos.y - player.y2) * -1,
        // }

        function getAngleDifference(angle1, angle2) {
            // Normalize the angles to be between 0 and 2π
            angle1 = angle1 % (2 * Math.PI);
            angle2 = angle2 % (2 * Math.PI);

            // Calculate the absolute difference between the angles
            let diff = Math.abs(angle1 - angle2);

            // Adjust the difference to be between 0 and π
            if (diff > Math.PI) {
                diff = (2 * Math.PI) - diff;
            }

            return diff;
        }

        //     function smartMove(oneTickMove) {
        //         let dir = player.moveDir;

        //         let found = false
        //         let buildings = liztobj.sort((a, b) => Math.hypot(player.y2 - a.y, player.x2 - a.x) - Math.hypot(player.y2 - b.y, player.x2 - b.x))
        //         let spikes = buildings.filter(obj => obj.dmg && cdf(player, obj) < 250 && !obj.isTeamObject(player) && obj.active)

        //         let newPos = {
        //             x: player.x2 + (player.x2 - player.oldPos.x2) * 1.2 + (Math.cos(dir) * 50),
        //             y: player.y2 + (player.y2 - player.oldPos.y2) * 1.2 + (Math.sin(dir) * 50),
        //         }

        //         for (let i = 0; i < spikes.length; i++) {
        //             if (cdf(spikes[i], newPos) < spikes[i].scale + player.scale + 3) {
        //                 found = Math.atan2(player.y2 - spikes[i].y, player.x2 - spikes[i].x)
        //             }
        //         }





        //         if (found != false && !traps.inTrap) {
        //             packet("9", undefined);
        //         } else {
        //             packet("9", dir);
        //         }
        //         player.oldPos.x2 = player.x2;
        //         player.oldPos.y2 = player.y2;
        //     }
        //     function detectEnemySpikeCollisions(tmpObj) {
        //         let buildings = liztobj.sort((a, b) => Math.hypot(tmpObj.y - a.y, tmpObj.x - a.x) - Math.hypot(tmpObj.y - b.y, tmpObj.x - b.x));
        //         let spikes = buildings.filter(obj => obj.dmg && cdf(player, obj) < 200 && !obj.isTeamObject(player) && obj.active);
        //         //here you calculate last vel / delta, add that to current pos, if touch spike do the heh
        //         let enemy = {
        //             // x: tmpObj.x + (player.oldPos.x2 - tmpObj.x) * -2,
        //             // y: tmpObj.y + (player.oldPos.y2 - tmpObj.y) * -2,
        //             x: player.x2 + (player.oldPos.x2 - player.x2) * -1,
        //             y: player.y2 + (player.oldPos.y2 - player.y2) * -1,
        //         }
        //         let found = false;
        //         for (let i = 0; i < spikes.length; i++) {
        //             if (cdf(enemy, spikes[i]) < player.scale + spikes[i].scale) {
        //                 found = true;
        //             }
        //         }

        //         // player.oldPos.x2 = tmpObj.x2;
        //         // player.oldPos.y2 = tmpObj.y2;
        //     }
        game.tick++;
        enemy = [];
        nears = [];
        near = [];
        game.tickSpeed = performance.now() - game.lastTick;
        game.lastTick = performance.now();
        players.forEach((tmp) => {
            tmp.forcePos = !tmp.visible;
            tmp.visible = false;
            if ((tmp.timeHealed - tmp.timeDamaged) > 0 && tmp.lastshamecount < tmp.shameCount)
                tmp.pinge = (tmp.timeHealed - tmp.timeDamaged);
        });
        for (let i = 0; i < data.length;) {
            tmpObj = findPlayerBySID(data[i]);
            if (tmpObj) {
                tmpObj.t1 = (tmpObj.t2 === undefined) ? game.lastTick : tmpObj.t2;
                tmpObj.t2 = game.lastTick;
                tmpObj.oldPos.x2 = tmpObj.x2;
                tmpObj.oldPos.y2 = tmpObj.y2;
                tmpObj.x1 = tmpObj.x;
                tmpObj.y1 = tmpObj.y;
                tmpObj.x2 = data[i + 1];
                tmpObj.y2 = data[i + 2];
                tmpObj.x3 = tmpObj.x2 + (tmpObj.x2 - tmpObj.oldPos.x2);
                tmpObj.y3 = tmpObj.y2 + (tmpObj.y2 - tmpObj.oldPos.y2);
                tmpObj.d1 = (tmpObj.d2 === undefined) ? data[i + 3] : tmpObj.d2;
                tmpObj.d2 = data[i + 3];
                tmpObj.dt = 0;
                tmpObj.buildIndex = data[i + 4];
                tmpObj.weaponIndex = data[i + 5];
                tmpObj.weaponVariant = data[i + 6];
                tmpObj.team = data[i + 7];
                tmpObj.isLeader = data[i + 8];
                tmpObj.oldSkinIndex = tmpObj.skinIndex;
                tmpObj.oldTailIndex = tmpObj.tailIndex;
                tmpObj.skinIndex = data[i + 9];
                tmpObj.tailIndex = data[i + 10];
                tmpObj.iconIndex = data[i + 11];
                tmpObj.zIndex = data[i + 12];
                tmpObj.visible = true;
                tmpObj.update(game.tickSpeed);
                tmpObj.dist2 = UTILS.getDist(tmpObj, player, 2, 2);
                tmpObj.aim2 = UTILS.getDirect(tmpObj, player, 2, 2);
                tmpObj.dist3 = UTILS.getDist(tmpObj, player, 3, 3);
                tmpObj.aim3 = UTILS.getDirect(tmpObj, player, 3, 3);
                if (tmpObj.resetDamageThreat) {
                    tmpObj.resetDamageThreat();
                } else {
                    tmpObj.damageThreat = 0;
                }
                if (tmpObj.skinIndex == 45 && tmpObj.shameTimer <= 0) {
                    tmpObj.addShameTimer();
                }
                tmpObj.hitSpike = 0;
                if (tmpObj.oldSkinIndex == 45 && tmpObj.skinIndex != 45) {
                    tmpObj.shameTimer = 0;
                    tmpObj.shameCount = 0;
                    if (tmpObj == player) {
                        healer();
                        my.healed = true;
                    }
                }

                botSkts.forEach((bot) => {
                    bot.showName = 'YEAHHH'
                })

                for (let i = 0; i < players.length; i++) {
                    for (let aa = 0; aa < botSkts.length; aa++) {
                        if (player.id === aa.id) aa.showName = 'YEAHHHHHH'

                    }
                }
                if (player.shameCount < 4 && near.dist3 <= 30 && near.reloads[near.primaryIndex] <= game.tickRate * (window.pingTime >= 200 ? 2 : 1)) {
                    autoQ = true;
                    healer();
                } else {
                    if (autoQ) {
                        healer();
                    }
                    autoQ = false;
                }

                let nearTrap = gameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, tmpObj, 0, 2) <= (tmpObj.scale + e.getScale() + 5) && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                    return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
                })[0];
                if (nearTrap && nearTrap.hideFromEnemy) {
                    nearTrap.hideFromEnemy = false;
                }

                tmpObj.lastTrap = tmpObj.inTrap;
                tmpObj.inTrap = nearTrap;

                if (tmpObj.weaponIndex < 9) {
                    tmpObj.primaryIndex = tmpObj.weaponIndex;
                    tmpObj.primaryVariant = tmpObj.weaponVariant;
                } else if (tmpObj.weaponIndex > 8) {
                    tmpObj.secondaryIndex = tmpObj.weaponIndex;
                    tmpObj.secondaryVariant = tmpObj.weaponVariant;
                }
            }
            i += 13;
        }
        autoBreak.mainUPDATE();
        if (runAtNextTick.length) {
            runAtNextTick.forEach((tmp) => {
                checkProjectileHolder(...tmp);
            });
            runAtNextTick = [];
        }
        for (let i = 0; i < data.length;) {
            tmpObj = findPlayerBySID(data[i]);
            if (tmpObj) {
                if (!tmpObj.isTeam(player)) {
                    enemy.push(tmpObj);
                    if (tmpObj.dist2 <= items.weapons[tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex].range + (player.scale * 2)) {
                        nears.push(tmpObj);
                    }
                }
                tmpObj.manageReload();
                tmpObj.primaryReloaded = tmpObj.primaryIndex == undefined ? true : tmpObj.reloads[tmpObj.primaryIndex] == 0;
                tmpObj.secondaryReloaded = tmpObj.secondaryIndex == undefined ? true : tmpObj.reloads[tmpObj.secondaryIndex] == 0;
                if (tmpObj != player) {
                    tmpObj.addDamageThreat(player);
                }
            }
            i += 13;
        }
        /*projectiles.forEach((proj) => {
                    tmpObj = proj;
                    if (tmpObj.active) {
                        tmpObj.tickUpdate(game.tickSpeed);
                    }
                });*/
        if (player && player.alive) {
            if (enemy.length) {
                near = enemy.sort(function (tmp1, tmp2) {
                    return tmp1.dist2 - tmp2.dist2;
                })[0];
            } else {
                // console.log("no enemy");
            }
            if (autoPlacer) {
                autoPlacer.safewalk();
            }
            if (game.tickQueue[game.tick]) {
                game.tickQueue[game.tick].forEach((action) => {
                    action();
                });
                game.tickQueue[game.tick] = null;
            }
            if (advHeal.length) {
                advHeal.forEach((updHealth) => {
                    let sid = updHealth[0];
                    let damaged = updHealth[2];
                    let tmpObj = findPlayerBySID(sid);
                    if (!tmpObj) {
                        return;
                    }
                    let nearSpike = gameObjects.find((obj) => obj.active && (((obj.type == 1 && obj.y >= 12000) || (obj.dmg && !obj.isTeamObject(tmpObj))) && UTILS.getDist(obj, tmpObj, 0, 2) <= obj.getScale() + tmpObj.scale + 1));
                    if (nearSpike && damaged == (nearSpike.dmg || 35) * (tmpObj.skinIndex == 6 ? 0.75 : 1)) {
                        tmpObj.hitSpike = nearSpike.dmg || 35;
                    }
                    if (tmpObj == player) {
                        const bullTicked = processDotTick(tmpObj, damaged);
                        runThreatBasedHeal(tmpObj, damaged, bullTicked, near);
                    } else if (!tmpObj.setPoisonTick && isDotTickDamage(tmpObj, damaged)) {
                        tmpObj.setPoisonTick = true;
                    }
                });
                advHeal = [];
            }
            runThreatBasedPassiveHeal();
            players.forEach((tmp) => {
                if (!tmp.visible && player != tmp) {
                    tmp.reloads = {
                        0: 0,
                        1: 0,
                        2: 0,
                        3: 0,
                        4: 0,
                        5: 0,
                        6: 0,
                        7: 0,
                        8: 0,
                        9: 0,
                        10: 0,
                        11: 0,
                        12: 0,
                        13: 0,
                        14: 0,
                        15: 0,
                        53: 0,
                    };
                }
                if (tmp.setBullTick) {
                    tmp.bullTimer = 0;
                }
                if (tmp.setPoisonTick) {
                    tmp.poisonTimer = 0;
                }
                tmp.updateTimer();
            });
            if (!instaC.isTrue && configs.predictTick && my.anti0Tick <= 0) {
                let spikeSync = knockBackPredict()
                if (spikeSync == "insta them" && (![9, 12, 13, 15].includes(player.weapons[1]) || near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8)) {
                    instaC.changeType(configs.revTick || player.weapons[1] == 10 ? "rev" : "normal");
                }
            }
            let canSyncHit = false;
            if (player.reloads[player.weapons[0]] != 0 || !near?.sid || near.dist2 > items.weapons[player.primaryIndex].range + 63) {
                canSyncHit = false;
            } else if (player.primaryIndex) {
                let _ = near;
                let dmg = 0;
                for (let j = 0; j < players.length; j++) {
                    let tmp = players[j];
                    if (tmp.sid == player.sid || tmp.sid == near.sid || near.team && tmp.team && tmp.team === near.team) {
                        continue;
                    }
                    const tmpPrimary = items.weapons[tmp.primaryIndex];
                    if (tmpPrimary && tmp.antiBull && (UTILS.getDist(tmp, near, 3, 3) <= tmpPrimary.range + 63 || UTILS.getDist(tmp, near, 2, 2) <= tmpPrimary.range + 63)) {
                        dmg += tmpPrimary.dmg * sortWeaponVariant(tmpPrimaryVariant) * 1.5;
                    }
                }
                dmg += items.weapons[player.primaryIndex].dmg * 1.5 * sortWeaponVariant(player.primaryVariant);
                if (dmg * (_.skinIndex == 6 ? 0.75 : 1) >= 100) {
                    canSyncHit = true;
                } else {
                    canSyncHit = false;
                }
            }
            let Synced = false;
            let autosynced = false;
            if (!instaC.isTrue && my.anti0Tick == 0 && canSyncHit && (UTILS.getDist(player, near, 3, 3) <= items.weapons[player.primaryIndex].range + 63 || UTILS.getDist(player, near, 2, 2) <= items.weapons[player.primaryIndex].range + 63)) {
                autosynced = true;
                hitBull(near.aim2, 0);
            }
            if (inGame) {
                if (enemy.length) {
                    if (syncThreatHatState() && !my.safePrimary(near) && !my.safeSecondary(near)) {
                        Hg(player.empAnti ? 22 : 6, 21);
                        if (!player.empAnti) {
                            setTimeout(() => {
                                Hg(11, 18);
                            }, 100);
                        }
                    }
                    if (configs.autoQonSync && nears.length > 1 && tmpObj.shameCount < 5 && !nears.some(item => [0, 7, 8, 9].includes(item.primaryIndex)) && secPacket < 40 && player.health < 90) {
                        player.chat.message = `Sync Detect Test ${window.pingTime}ms`;
                        player.chat.count = 1000;
                        tmpObj.canEmpAnti = false
                        healer()
                    }
                    let prehit = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 3) <= (tmp.scale + near.scale)).sort(function (a, b) {
                        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                    })[0];
                    if (prehit) {
                        if (near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8 && configs.predictTick) {
                            instaC.canSpikeTick = true;
                            instaC.syncHit = true;
                            if (configs.revTick && player.weapons[1] == 15 && player.reloads[53] == 0 && instaC.perfCheck(player, near)) {
                                instaC.revTick = true;
                            }
                        }
                    }
                    if (!my.anti0tick) {
                        let possiblePreHitSync = gameObjects.find(
                            (tmp) =>
                                tmp.dmg &&
                                tmp.active &&
                                !tmp.isTeamObject(player) &&
                                UTILS.getDist(tmp, player, 0, 3) <= tmp.scale + 45
                        );
                        let possibleHitSync = gameObjects.find(
                            (tmp) =>
                                tmp.dmg &&
                                tmp.active &&
                                !tmp.isTeamObject(player) &&
                                UTILS.getDist(tmp, player, 0, 2) <= tmp.scale + 35
                        );
                        if (possibleHitSync && near.sid && near.reloads[near.weaponIndex] == 0 && near.dist2 <= (items.weapons[near.weapons[0]].range + 70) && ([4, 5].includes(near.primaryIndex) || (near.weaponIndex == 3 && (game.tick - player.bullTick) % 9 === 8))) {
                            my.anti0tick = 1;
                        }
                        if (possiblePreHitSync && near.reloads[near.weaponIndex] <= game.tickRate && near.dist2 <= (items.weapons[near.weapons[0]].range + 100) && ([4, 5].includes(near.primaryIndex) || (near.weaponIndex == 3 && (game.tick - player.bullTick) % 9 === 8))) {
                            my.anti0tick = 1;
                        }
                    }
                    let antiSpikeTick = gameObjects.filter(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(tmp, player, 0, 3) < (tmp.scale + player.scale)).sort(function (a, b) {
                        return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                    })[0];
                    const secondarySpikeSyncThreat = isEnemySecondarySyncThreat(antiSpikeTick, near);
                    if (antiSpikeTick && autoBreak.inTrap) {
                        if (near.dist2 <= items.weapons[5].range + near.scale * 1.8 || secondarySpikeSyncThreat) {
                            my.anti0Tick = 1;
                        }
                    }
                if (antiSpikeTick && !autoBreak.inTrap) {
                    if (near.dist2 <= items.weapons[5].range + near.scale * 1.8 || secondarySpikeSyncThreat) {
                        my.anti0Tick = 1;
                    }
                    else if (!autoBreak.inTrap && near.dist2 <= items.weapons[5].range + (antiSpikeTick.scale * 1.8)) {
                        my.anti0Tick = 1;
                    }
                }
                if (autoBreak.active && near && near.sid && near.dist2 <= items.weapons[near.primaryIndex || 5].range + near.scale * 1.8) {
                    my.anti0Tick = Math.max(my.anti0Tick, 2);
                    if (typeof runThreatBasedHeal === "function") {
                        runThreatBasedHeal(player, Math.max(35, items.weapons[near.primaryIndex || 5].dmg || 35), false, near);
                    }
                }
            }
                if (bianosTick && !autoBreak.inTrap) {
                    instaC.spikeTickType();
                }
                if (near && near.inTrap && player.weapons[1] == 10 && (player.weapons[0] == 3 || player.weapons[0] == 4 || player.weapons[0] == 5)) {
                    initDmgPotSystem();
                    if (breaking && player && Date.now() - player.lastHit <= 250) {
                        resetBreakState("hit_while_breaking");
                    }
                    (player.primaryVar > 1 && player.weapons[0] == 5 && player.weapons[1] == 10) ? breakShit() : spikeTickAids();
                }
                if ((useWasd ? true : ((player.checkCanInsta(true) >= 120 ? player.checkCanInsta(true) : player.checkCanInsta(false)) >= (player.weapons[1] == 10 ? 95 : 100))) && near.dist2 <= items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range + near.scale * 1.8 && (instaC.wait || (useWasd && Math.floor(Math.random() * 5) == 0)) && !instaC.isTrue && !my.waitHit && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && (useWasd ? true : (player.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate))) && instaC.perfCheck(player, near)) {
                    if (player.checkCanInsta(true) >= 120) {
                        instaC.nobull = useWasd ? false : instaC.canSpikeTick ? false : true;
                    } else {
                        instaC.nobull = false;
                    }
                    instaC.can = true;
                } else {
                    instaC.can = false;
                }
                if (configs.smartAutoInsta) {
                    const primaryWeapon = player.weapons[0];
                    const secondaryWeapon = player.weapons[1];
                    const inRange = near.dist2 <= items.weapons[primaryWeapon].range + player.scale * 1.8;
                    const isFullyReloaded = player.reloads[primaryWeapon] === 0 && player.reloads[secondaryWeapon] === 0 && player.reloads[53] == 0;

                    if (secondaryWeapon === 15 || secondaryWeapon === 9 || secondaryWeapon === 12 || secondaryWeapon === 13) {
                        if (near.shameCount >= 5 && isFullyReloaded && !clicks.right && inRange && secondaryWeapon !== 10 && near.skinIndex != 6) {
                            instaC.changeType((secondaryWeapon === 9 || secondaryWeapon === 12 || secondaryWeapon === 13) ? "rev" : "normal");
                            addMenuChText("[Game]", "AutoInsta: 5 Shame {normal}", "lightBlue");
                        }
                    }
                    else if (secondaryWeapon === 10 && ((primaryWeapon === 5 || primaryWeapon === 4))) {
                        if (near.shameCount >= 5 && isFullyReloaded && !clicks.right && inRange && near.skinIndex != 6) {
                            instaC.changeType("normal");
                            addMenuChText("[Game]", "AutoInsta: 5 Shame {normal}", "lightBlue");
                        }
                    }
                }
                macro.q && place(0, getAttackDir());
                macro.f && place(4, getSafeDir());
                macro.v && place(2, getSafeDir());
                macro.b && place(1, getSafeDir());
                macro.y && place(5, getSafeDir());
                macro.h && place(player.getItemType(22), getSafeDir());
                macro.n && place(3, getSafeDir());
                if (game.tick % 1 == 0) {
                    if (!mills.place) {
                        if (mills.placeSpawnPads) {
                            for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                                checkPlace(player.getItemType(20), UTILS.getDirect(player.oldPos, player, 2, 2) + i);
                            }
                        }
                    }
                }
                runAutomillPlacement();
                if (instaC.can) {
                    instaC.changeType(configs.alwaysRev ? "rev" : "normal");
                }
                if (instaC.canCounter) {
                    instaC.canCounter = false;
                    if (player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
                        instaC.counterType();
                    }
                }
                if (instaC.canSpikeTick) {
                    instaC.canSpikeTick = false;
                    if (instaC.revTick) {
                        instaC.revTick = false;
                        if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[1]] == 0 && !instaC.isTrue) {
                            instaC.changeType("rev");
                        }
                    } else {
                        if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
                            instaC.spikeTickType();
                            if (instaC.syncHit) {
                            }
                        }
                    }
                }
                if (!clicks.middle && (clicks.left || clicks.right) && !instaC.isTrue) {
                    if ((player.weaponIndex != (clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0])) || player.buildIndex > -1) {
                        selectWeapon(clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]);
                    }
                    if (player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 && !my.waitHit) {
                        sendAutoGather();
                        my.waitHit = 1;
                        game.tickBase(() => {
                            sendAutoGather();
                            my.waitHit = 0;
                        }, 1);
                    }
                }
                if (useWasd && !clicks.left && !clicks.right && !instaC.isTrue && near.dist2 <= (items.weapons[player.weapons[0]].range + near.scale * 1.8) && !autoBreak.active) {
                    if ((player.weaponIndex != player.weapons[0]) || player.buildIndex > -1) {
                        selectWeapon(player.weapons[0]);
                    }
                    if (player.reloads[player.weapons[0]] == 0 && !my.waitHit) {
                        sendAutoGather();
                        my.waitHit = 1;
                        game.tickBase(() => {
                            sendAutoGather();
                            my.waitHit = 0;
                        }, 1);
                    }
                }
                if (autoBreak.active) {
                    if (!clicks.left && !clicks.right && !instaC.isTrue) {
                        if (player.weaponIndex != (autoBreak.notFast() ? player.weapons[1] : player.weapons[0]) || player.buildIndex > -1) {
                            selectWeapon(autoBreak.notFast() ? player.weapons[1] : player.weapons[0]);
                        }
                        if (player.reloads[autoBreak.notFast() ? player.weapons[1] : player.weapons[0]] == 0 && !my.waitHit) {
                            sendAutoGather();
                            my.waitHit = 1;
                            game.tickBase(() => {
                                sendAutoGather();
                                my.waitHit = 0;
                            }, 1);
                        }
                    }
                }
                if (clicked.g && !autoBreak.active) {
                    if (!instaC.isTrue && player.reloads[player.weapons[1]] == 0) {
                        if (my.ageInsta && player.weapons[0] != 4 && player.weapons[1] == 9 && player.age >= 9 && enemy.length) {
                            instaC.bowMovement();
                        } else {
                            instaC.rangeType();
                        }
                    }
                }
                if (!instaC.isTrue) {
                    let spikeSync = kbAnti();
                    if (spikeSync == "anti Kb Insta" && (![9, 12, 13, 15].includes(player.weapons[1]) || near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8)) {
                        forceSoldier = true;
                    }
                    if (spikeSync == "primary Kb") {
                        forceSoldier = true;
                    }
                }
                if (macro.t && !autoBreak.active) {
                    if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && (player.weapons[1] == 15 ? (player.reloads[player.weapons[1]] == 0) : true) && (player.weapons[0] == 5 || (player.weapons[0] == 4 && player.weapons[1] == 15))) {
                        instaC[(player.weapons[0] == 4 && player.weapons[1] == 15) ? "kmTickMovement" : "tickMovement"]();
                    }
                }
                if (macro[";"] && !autoBreak.active) {
                    if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && ([9, 12, 13, 15].includes(player.weapons[1]) ? (player.reloads[player.weapons[1]] == 0) : true)) {
                        instaC.boostTickMovement();
                    }
                }
                if (player.weapons[1] && !clicks.left && !clicks.right && !autoBreak.active && !instaC.isTrue && !(useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8)) {
                    if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0) {
                        if (!my.reloaded) {
                            my.reloaded = true;
                            let fastSpeed = items.weapons[player.weapons[0]].spdMult < items.weapons[player.weapons[1]].spdMult ? 1 : 0;
                            if (player.weaponIndex != player.weapons[fastSpeed] || player.buildIndex > -1) {
                                selectWeapon(player.weapons[fastSpeed]);
                            }
                        }
                        // if(useWasd) {
                        //     if (!autos.stopspin) {
                        //         setTimeout(()=>{
                        //             autos.stopspin = true;
                        //         }, 375);
                        //     }
                        // }
                    } else {
                        my.reloaded = false;
                        if (useWasd) {
                            autos.stopspin = false;
                        }
                        if (player.reloads[player.weapons[0]] > 0) {
                            if (player.weaponIndex != player.weapons[0] || player.buildIndex > -1) {
                                selectWeapon(player.weapons[0]);
                            }
                        } else if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] > 0) {
                            if (player.weaponIndex != player.weapons[1] || player.buildIndex > -1) {
                                selectWeapon(player.weapons[1]);
                            }
                            if (useWasd) {
                                if (!autos.stopspin) {
                                    setTimeout(() => {
                                        autos.stopspin = true;
                                    }, 750);
                                }
                            }
                        }
                    }
                }
                function doOneFrame() {
                    realDir(2);
                    my.autoAim = true;
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    selectWeapon(player.weapons[0]);
                    game.tickBase(() => {
                        buyEquip(7, 0);
                        sendAutoGather();
                        game.tickBase(() => {
                            selectWeapon(player.weapons[0]);
                            sendAutoGather();
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                }
                function autoOneFrame() {
                    if (!near) return;

                    let neIT = false;
                    let nearTrapped = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= near.scale + tmp.getScale() + 15).sort(function (a, b) {
                        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                    })[0];
                    if (nearTrapped) {
                        neIT = true;
                    }

                    if (configs.safeTick && (near.skinIndex === 6 || near.skinIndex === 22)) {
                        return;
                    }

                    if (configs.autoOneFrame) {
                        let ping = window.pingTime;
                        let range = ping > 140 ? 230 : ping > 110 ? 210 : ping > 85 ? 190 : 170;
                        if (near.dist2 > range && near.dist2 <= 225 && !autoBreak.active && player.reloads[player.weapons[0]] == 0 && player.reloads[53] == 0 && player.weapons[0] == 5 && (!neIT && near.skinIndex != 6 || neIT)) {
                            packet("9", undefined, 1);
                            game.tickBase(() => {
                                packet("9", near.aim2, 1);
                            }, 1);
                            doOneFrame();
                        }
                    }
                }
                function predictHat(isforshitpeoplehavelazybraintotimeatick) {
                    for (let i = 0; i < nears.length; i++) {
                        if (reloadPercent(nears[i], nears[i].primaryIndex) >= 0.9 && reloadPercent(nears[i], nears[i].primaryIndex) <= 0.95 || reloadPercent(nears[i], nears[i].secondaryIndex) >= 0.9 && reloadPercent(nears[i], nears[i].secondaryIndex) <= 0.95) {
                            console.log("yes hit predict work");
                            nears.push([i]);
                        }
                    }
                }
                this.lastSkinIndexes = [];
                let oneticked = false;
                let antiOneticked = false;
                if (configs.autoOneFrame && player.weapons[0] === 5 && !autoBreak.active && near.sid && !instaC.isTrue && (configs.safeTick ? near.skinIndex != 6 && near.skinIndex !== 22 : true)) {
                    const turretHit = checkProjectileHit(player, 1.5, near.aim2, near, 35);
                    //let uwu = Math.ceil((items.weapons[near.weaponIndex].speed - near.reloads[near.weaponIndex]) / game.tickRate) + 1;
                    let uwu = Math.floor((items.weapons[near.weaponIndex].speed - near.reloads[near.weaponIndex]) / 100);
                    const skinArray = near.skinIndex;
                    const arrayCount = skinArray.length;
                    let uwuAdjusted = uwu;
                    if (uwuAdjusted > arrayCount) uwuAdjusted = arrayCount;
                    if (uwuAdjusted < 0) uwuAdjusted = 0;
                    let cwickingHackew;
                    if (near.trapped || uwu === 0 || arrayCount === 0) {
                        cwickingHackew = [];
                        let takeCount = Math.max(1, Math.min(uwuAdjusted + 1, arrayCount));
                        let startIndex = arrayCount - takeCount;
                        if (startIndex < 0) startIndex = 0;

                        for (let i = startIndex; i < arrayCount; i++) {
                            cwickingHackew.push(skinArray[i]);
                        }
                    } else {
                        let startIndex = arrayCount - Math.min(uwuAdjusted + 1, arrayCount);
                        let endIndex = arrayCount - uwuAdjusted;
                        if (startIndex < 0) startIndex = 0;
                        if (endIndex > arrayCount) endIndex = arrayCount;
                        for (let i = startIndex; i < endIndex; i++) {
                            if (skinArray[i] === 40 || skinArray[i] === 7) {
                                cwickingHackew = skinArray[i];
                                break;
                            }
                        }
                    }
                    const purr = near.reloads[near.weaponIndex];
                    const meow = (game.tick - player.bullTick) % 9 === 8 && near.shameCount > 0 || !near.skinIndex[6] || cwickingHackew && purr > 0 && purr <= game.tickRate;
                    const dist = 205;
                    const speed = calcOTVel();
                    const close = hypot(speed.x - near.x3, speed.y - near.y3) <= dist;
                    if (player.reloads[53] == 0 && player.reloads[player.weapons[0]] <= 111 && close && near.dist2 >= 223 && (near.reloads[near.weaponIndex] === 0 || !cwickingHackew && near.reloads[near.weaponIndex] - 222 > 0 || meow)) {
                        console.log("oneticking");
                        if (configs.OneTickReactionMode) {
                            addMenuChText("Dev", "Auto One Tick", "lightblue");
                            textManager.showText(player.x, player.y, 30, 0.15, 1850, 'Tick to near now!', '#7289DA', 2);
                        }
                        if (near.skinIndex == 22) {
                            game.tickBase(function () {
                                if (near.trapped) {
                                    oneTick(1);
                                    oneticked = true;
                                    game.tickBase(function () {
                                        oneticked = false;
                                    }, 2);
                                } else {
                                    oneTick(1);
                                    oneticked = true;
                                    game.tickBase(function () {
                                        oneticked = false;
                                    }, 2);
                                }
                            }, 1);
                        } else if (near.trapped) {
                            oneTick(1);
                            oneticked = true;
                            game.tickBase(function () {
                                oneticked = false;
                            }, 2);
                        } else if (near.skinIndex != 22) {
                            oneTick(1);
                            oneticked = true;
                            game.tickBase(function () {
                                oneticked = false;
                            }, 2);
                        }
                    }
                }
                if (!oneticked && player.skinIndex != 53) {
                    for (let i = 0; i < enemy.length; i++) {
                        const tmpPlayer = enemy[i];
                        if (tmpPlayer.skinIndex == 53) {
                            if ((tmpPlayer.primaryIndex == undefined || tmpPlayer.primaryVariant >= 2 && tmpPlayer.primaryIndex == 5 && tmpPlayer.reloads[tmpPlayer.primaryIndex] < 111) && (Math.abs(tmpPlayer.dist2 - 245) <= 40 || tmpPlayer.dist3 <= 300 && tmpPlayer.boosted)) {
                                antiOneticked = true;
                                buyEquip(6, 0);
                                my.anti0Tick = 2;
                                player.chat.message = "Anti Onetick " + tmpPlayer.sid;
                                player.chat.count = 2000;
                            }
                        }
                    }
                }
                if (!instaC.isTrue && !autoBreak.inTrap && !placementState.replaced) {
                    autoPlacer.autoPlace();
                }
                if (!instaC.isTrue && configs.autoOneFrame && autoOneFrameToggled) {
                    autoOneFrame();
                }
                if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
                    packet("D", getAttackDir());
                }
                let Leuchtturm = false;
                let hatChanger = function () {
                    let NearHasOneFrame = near.primaryVariant >= 1 && near.weapons[0] == 5
                    let PolOrKat = player.weapons[0] === 4 || player.weapons[0] === 5
                    let canSafeHitback = PolOrKat && !autoBreak.active && player.shameCount <= 4 && !NearHasOneFrame && !antispiketicked && !safewalking
                    if (autoBreak.active) {
                        const breakGear = resolveAutoBreakGear();
                        buyEquip(breakGear.hat, 0);
                        return;
                    } else if (my.anti0Tick > 0) {
                        buyEquip(6, 0);
                    } else if (configs.assasinHat && Date.now() - player.moveTime > 1234 && player.health == 100 && Date.now() - player.lastHit > 1234 && Date.now() - player.lastGather > 1234 && !my.waitHit) {
                        buyEquip(56, 0)
                    } else if (near.skinIndex === 53 && near.dist2 <= 435) {
                    } else {
                        if (clicks.left || clicks.right) {
                            if (((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) && ((near && near.dist2 > 140) || !near)) {
                                buyEquip(7, 0);
                            } else {
                                if (clicks.left) {
                                    buyEquip(player.reloads[player.weapons[0]] == 0 ? getEl('weaponGrind').checked ? 40 : 7 : player.empAnti ? 22 : player.soldierAnti ? 6 : configs.HKH && canSafeHitback ? 11 : near.dist2 <= 275 ? getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0 && (player.weapons[0] == 4 || player.weapons[0] == 3) && near.primaryIndex != 5 ? 6 : 6 : 6, 0);
                                } else if (clicks.right) {
                                    buyEquip(player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 ? 40 : player.empAnti ? 22 : player.soldierAnti ? 6 : configs.HKH && canSafeHitback ? 11 : near.dist2 <= 275 ? getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0 && (player.weapons[0] == 4 || player.weapons[0] == 3) && near.primaryIndex != 5 ? 6 : 6 : biomeGear(1, 1), 0);
                                }
                            }
                        } else {
                            if (player.empAnti || player.soldierAnti) {
                                buyEquip(player.empAnti ? 22 : 6, 0);
                            } else {
                                if (((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) && ((near && near.dist2 > 140) || !near)) {
                                    buyEquip(7, 0);
                                    setTimeout(() => {
                                        buyEquip(7, 0);
                                    }, 120);
                                } else {
                                    if (near.dist2 <= 275) {
                                        const shitassautism1 = configs.antidaggerrsrsrsr && (near.primaryIndex === 7 || near.primaryIndex === 8);


                                        buyEquip(shitassautism1 ? 26 : 6, 0);
                                    } else {
                                        biomeGear(1);
                                    }
                                }
                            }
                        }
                    }
                };


                let accChanger = function () {
                    let NearHasOneFrame = near.primaryVariant >= 1 && near.weapons[0] == 5
                    let PolOrKat = player.weapons[0] === 4 || player.weapons[0] === 5
                    let canSafeHitback = PolOrKat && !autoBreak.active && player.shameCount <= 4 && !NearHasOneFrame && !antispiketicked && !safewalking
                    if (instaC.can && player.checkCanInsta(true) >= 100) {
                        // buyEquip(19, 1);
                    } else if (autoBreak.active) {
                        const breakGear = resolveAutoBreakGear();
                        buyEquip(breakGear.acc, 1);
                        return;
                    } else if (clicks.left) {
                        setTimeout(() => {
                            buyEquip(19, 1);
                        }, 100);
                    } else if (clicks.right) {
                        setTimeout(() => {
                            buyEquip(19, 1);
                        }, 50);
                    } else if (near.dist2 <= 350 && !autoBreak.active && player.weapons[0] == 7) {
                        buyEquip(11, 1);
                    } else if (near.dist2 <= 350 && !autoBreak.active) {
                        buyEquip(19, 1);
                    } else if (near.dist2 <= 350 && !autoBreak.active && configs.HKH && player.skinIndex == 11) {
                        buyEquip(19, 1);
                    } else {
                        buyEquip(11, 1);
                    }
                };
                let wasdGears = function () {
                    if (my.anti0Tick > 0) {
                        buyEquip(12, 0);
                    } else {
                        if (clicks.left || clicks.right) {
                            if (clicks.left) {
                                buyEquip(player.reloads[player.weapons[0]] == 0 ? getEl("weaponGrind").checked ? 40 : 7 : player.empAnti ? 22 : 6, 0);
                            } else if (clicks.right) {
                                buyEquip(player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 ? 40 : player.empAnti ? 22 : 6, 0);
                            }
                        } else if (near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !autoBreak.active) {
                            buyEquip(player.reloads[player.weapons[0]] == 0 ? 7 : player.empAnti ? 22 : 6, 0);
                        } else if (autoBreak.active) {
                            const breakGear = resolveAutoBreakGear();
                            buyEquip(breakGear.hat, 0);
                        } else {
                            if (player.empAnti) {
                                buyEquip(22, 0);
                            } else {
                                if ((player.shameCount > 0 && player.skinIndex != 45) || my.reSync) {
                                    buyEquip(7, 0);
                                } else {
                                    buyEquip(6, 0);
                                }
                            }
                        }
                    }
                    if (clicks.left || clicks.right) {
                        if (clicks.left) {
                            buyEquip(0, 1);
                        }
                    } else if (near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !autoBreak.active) {
                        buyEquip(0, 1);
                    } else if (autoBreak.active) {
                        const breakGear = resolveAutoBreakGear();
                        buyEquip(breakGear.acc, 1);
                    } else {
                        buyEquip(11, 1);
                    }
                }
                if (storeMenu.style.display != "block" && !instaC.isTrue && !instaC.ticking) {
                    if (useWasd) {
                        wasdGears();
                    } else {
                        hatChanger();
                        accChanger();
                    }
                }

                if (configs.autoPush && enemy.length && !autoBreak.inTrap && !instaC.ticking) {
                    autoPush();
                } else {
                    if (my.autoPush) {
                        my.autoPush = false;
                        packet("9", lastMoveDir || undefined, 1);
                        pathfinder.clearCache();
                    }
                }

                if (followASsnbewfjnsjd && my.autoPush) {
                    if (enemy.length) {
                        const pos = {
                            x: near.x2,
                            y: near.y2
                        }
                        callPathFinder(pos)
                    } else {
                        packet("9", lastMoveDir || undefined, 1);
                        followASsnbewfjnsjd = false;
                        pathfinder.clearCache();
                    }
                }

                if (instaC.ticking) {
                    instaC.ticking = false;
                }
                if (instaC.syncHit) {
                    instaC.syncHit = false;
                }
                if (player.empAnti) {
                    player.empAnti = false;
                }
                if (player.soldierAnti) {
                    player.soldierAnti = false;
                }
                if (!mills.place) {
                    mills.reset();
                }
                if (player.antiHealTicks > 0) {
                    player.antiHealTicks--;
                }
                if (game.tick - (player.lastThreatTick || 0) > 2) {
                    player.antiForced = false;
                }
                my.healed = false;
                if (my.anti0Tick > 0) {
                    my.anti0Tick--;
                }
                placementState.resetTick();
                const getPotentialDamage = (build, user) => {
                    const weapIndex = user.weapons[1] === 10 && !player.reloads[user.weapons[1]] ? 1 : 0;
                    const weap = user.weapons[weapIndex];
                    if (player.reloads[weap]) return 0;
                    const weapon = items.weapons[weap];
                    const inDist = cdf(build, user) <= build.getScale() + weapon.range;
                    return (user.visible && inDist) ? weapon.dmg * (weapon.sDmg || 1) * 3.3 : 0;
                };

                const AutoReplace = () => {
                    const replaceable = [];
                    const playerX = player.x;
                    const playerY = player.y;
                    const gameObjectCount = gameObjects.length;

                    for (let i = 0; i < gameObjectCount; i++) {
                        const build = gameObjects[i];
                        if (build.isItem && build.active && build.health > 0) {
                            const item = items.list[build.id];
                            const posDist = 35 + item.scale + (item.placeOffset || 0);
                            const inDistance = cdf(build, player) <= posDist * 2;
                            if (inDistance) {
                                let canDeal = 0;
                                const playersCount = players.length;
                                for (let j = 0; j < playersCount; j++) {
                                    canDeal += getPotentialDamage(build, players[j]);
                                }
                                if (build.health <= canDeal) {
                                    replaceable.push(build);
                                }
                            }
                        }
                    }

                    const findPlacementAngle = (player, itemId, build) => {
                        if (!build) return null;
                        const MAX_ANGLE = 2 * Math.PI;
                        const ANGLE_STEP = Math.PI / 360;
                        const item = items.list[player.items[itemId]];
                        let buildingAngle = Math.atan2(build.y - player.y, build.x - player.x);
                        let tmpS = player.scale + (item.scale || 1) + (item.placeOffset || 0);

                        for (let offset = 0; offset < MAX_ANGLE; offset += ANGLE_STEP) {
                            let angles = [(buildingAngle + offset) % MAX_ANGLE, (buildingAngle - offset + MAX_ANGLE) % MAX_ANGLE];
                            for (let angle of angles) {
                                return angle;
                            }
                        }
                        return null;
                    };

                    const replace = (() => {
                        let nearTrap = liztobj.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && cdf(tmp, player) <= tmp.getScale() + 5);
                        let spike = gameObjects.find(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && cdf(tmp, player) < 87 && !nearTrap.length);
                        const buildId = spike ? 4 : 2;

                        replaceable.forEach(build => {
                            let angle = findPlacementAngle(player, buildId, build);
                            if (angle !== null) {
                                place(buildId, angle);
                                textManager.showText(build.x, build.y, 20, 0.15, 1850, '⭐', '#fff', 2);
                            }
                        });
                    });

                    if (near && near.dist3 <= 360) {
                        replace();
                    }
                    replace;
                }
            }
        }
        if (botSkts.length) {
            botSkts.forEach((bots) => {
                if (true) {
                    bots[0].showName = 'YEAHHH';
                }
            });
        }
    }

    // UPDATE LEADERBOARD:
    function updateLeaderboard(data) {
        lastLeaderboardData = data;
        return;
        UTILS.removeAllChildren(leaderboardData);
        let tmpC = 1;
        for (let i = 0; i < data.length; i += 3) {
            (function (i) {
                UTILS.generateElement({
                    class: "leaderHolder",
                    parent: leaderboardData,
                    children: [
                        UTILS.generateElement({
                            class: "leaderboardItem",
                            style: "color:" + ((data[i] == playerSID) ? "#fff" : "rgba(255,255,255,0.6)"),
                            text: tmpC + ". " + (data[i + 1] != "" ? data[i + 1] : "unknown")
                        }),
                        UTILS.generateElement({
                            class: "leaderScore",
                            text: UTILS.sFormat(data[i + 2]) || "0"
                        })
                    ]
                });
            })(i);
            tmpC++;
        }
    }
    // EARLY BREAK:
    class earlyAB {
        static start = false;

        static hit = 0;
        static miss = 0;

        static update(data, i, XY) {
            let dist = UTILS.getDist(XY, player, 0, 2);
            let aim = UTILS.getDirect(XY, player, 0, 2);
            if (data[i + 6] == 15 && dist <= 100) {
                setTimeout(() => {
                    dist = UTILS.getDist(XY, player, 0, 2);
                    aim = UTILS.getDirect(XY, player, 0, 2);
                    if (!this.start) {
                        this.start = true;
                        this.hit = 0;
                        this.miss = 0;
                    }
                    if (dist <= 75) {
                        this.hit++;
                    } else {
                        this.miss++;
                    }
                }, 10);
            }
        }
    }
    // LOAD GAME OBJECT:
    function loadGameObject(data) {
        for (let i = 0; i < data.length;) {
            objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4],
                data[i + 5], items.list[data[i + 6]], true, (data[i + 7] >= 0 ? {
                    sid: data[i + 7]
                } : null));

            let XY = {
                x: data[i + 1],
                y: data[i + 2],
            };

            if (player.sid !== data[i + 7] && !player.findAllianceBySid(data[i + 7])) {
                earlyAB.update(data, i, XY);
            }

            let tmpObj = findPlayerBySID(data[i + 7]);
            if (tmpObj) {
                if (!tmpObj.isTeam(player) && near) {
                    let dist = UTILS.getDist(tmpObj, near, 0, 2);

                    if (configs.AntiNewPlacedSpikeTheart && !safeShitASPNow && near.dist2 < 180 && dist < 100 && [6, 7, 8, 9].includes(data[i + 6])) {
                        safeShitASPNow = true;
                        tryisantinowmaybeHealingtoo();
                    }
                }
            }

            i += 8;
        }
    }

    // ADD AI:
    function loadAI(data) {
        for (let i = 0; i < ais.length; ++i) {
            ais[i].forcePos = !ais[i].visible;
            ais[i].visible = false;
        }
        if (data) {
            let tmpTime = performance.now();
            for (let i = 0; i < data.length;) {
                tmpObj = findAIBySID(data[i]);
                if (tmpObj) {
                    tmpObj.index = data[i + 1];
                    tmpObj.t1 = tmpObj.t2 === undefined ? tmpTime : tmpObj.t2;
                    tmpObj.t2 = tmpTime;
                    tmpObj.x1 = tmpObj.x;
                    tmpObj.y1 = tmpObj.y;
                    tmpObj.x2 = data[i + 2];
                    tmpObj.y2 = data[i + 3];
                    tmpObj.d1 = tmpObj.d2 === undefined ? data[i + 4] : tmpObj.d2;
                    tmpObj.d2 = data[i + 4];
                    tmpObj.health = data[i + 5];
                    tmpObj.dt = 0;
                    tmpObj.visible = true;
                } else {
                    tmpObj = aiManager.spawn(data[i + 2], data[i + 3], data[i + 4], data[i + 1]);
                    tmpObj.x2 = tmpObj.x;
                    tmpObj.y2 = tmpObj.y;
                    tmpObj.d2 = tmpObj.dir;
                    tmpObj.health = data[i + 5];
                    if (aiManager.aiTypes[data[i + 1]] && !aiManager.aiTypes[data[i + 1]].name) {
                        tmpObj.name = config.cowNames[data[i + 6]];
                    }
                    tmpObj.forcePos = true;
                    tmpObj.sid = data[i];
                    tmpObj.visible = true;
                }
                let tmpDist = UTILS.getDist(tmpObj, player, 2, 2);
                let tmpHealth = tmpObj.health;
                let primaryWeapon = items.weapons[player.primaryIndex];
                if (primaryWeapon) {
                    let tmpRange = primaryWeapon.range + 70 + tmpObj.scale;
                    if (tmpObj.active && tmpObj.visible && tmpHealth <= 250 + (tmpObj.oldHealth - tmpHealth) && tmpDist <= tmpRange + 20) {
                        tmpObj.lowHealth = true;
                    }
                    if (player.reloads[player.weapons[0]] <= game.tickRate && tmpObj.active && tmpObj.visible && tmpObj.health <= primaryWeapon.dmg * (player.tailIndex == 11 ? 1 : player.skins[7] ? 1.5 : 1) && tmpDist <= primaryWeapon.range + 70 + tmpObj.scale) {
                        hitBull(UTILS.getDirect(tmpObj, player, 2, 2), 0);
                        player.chat.message = "Autosteal";
                        player.chat.count = 1000;
                    }
                }
                i += 7;
            }
        }
    }
    // ANIMATE AI:
    function animateAI(sid) {
        tmpObj = findAIBySID(sid);
        if (tmpObj) tmpObj.startAnim();
    }

    // GATHER ANIMATION:
    function gatherAnimation(sid, didHit, index) {
        tmpObj = findPlayerBySID(sid);
        if (tmpObj) {
            tmpObj.startAnim(didHit, index);
            tmpObj.gatherIndex = index;
            tmpObj.gathering = 1;
            tmpObj.lastGather = Date.now();

            // if(player.damageThreat >= 100 && cdf(player, tmpObj) <= 300)
            //     healer();

            if (didHit) {
                let tmpObjects = objectManager.hitObj;
                objectManager.hitObj = [];
                game.tickBase(() => {
                    // refind
                    tmpObj = findPlayerBySID(sid);
                    let val = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1) * (tmpObj.skinIndex == 40 ? 3.3 : 1);
                    tmpObjects.forEach((healthy) => {
                        healthy.health -= val;
                    });
                }, 1);
            }
        }
    }

    // WIGGLE GAME OBJECT:
    function wiggleGameObject(dir, sid) {
        tmpObj = findObjectBySid(sid);
        if (tmpObj) {
            tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir);
            tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir);
            if (tmpObj.health) {
                objectManager.hitObj.push(tmpObj);
            }
        }
    }

    // SHOOT TURRET:
    function shootTurret(sid, dir) {
        tmpObj = findObjectBySid(sid);
        if (tmpObj) {
            if (config.anotherVisual) {
                tmpObj.lastDir = dir;
            } else {
                tmpObj.dir = dir;
            }
            tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir + Math.PI);
            tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir + Math.PI);
        }
    }
    // UPDATE PLAYER VALUE:
    function updatePlayerValue(index, value, updateView) {
        if (player) {
            player[index] = value;
            if (index == "points") {
                if (configs.autoBuy) {
                    autoBuy.hat();
                    autoBuy.acc();
                }
            } else if (index == "kills") {
                if (configs.killChat) {
                    sendChat("killchat 1");
                    setTimeout(() => {
                        sendChat("killchat 2");
                    }, 800);
                }
            }
        }
    }
    // ACTION BAR:
    function updateItems(data, wpn) {
        if (data) {
            if (wpn) {
                player.weapons = data;
                player.primaryIndex = player.weapons[0];
                player.secondaryIndex = player.weapons[1];
                if (!instaC.isTrue) {
                    selectWeapon(player.weapons[0]);
                }
            } else {
                player.items = data;
            }
        }

        for (let i = 0; i < items.list.length; i++) {
            let tmpI = items.weapons.length + i;
            let actionBarItem = getEl("actionBarItem" + tmpI);
            actionBarItem.style.display = player.items.indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
            // Add shadow to the element
            // actionBarItem.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
            document.getElementsByTagName('button').style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";

        }

        for (let i = 0; i < items.weapons.length; i++) {
            let actionBarItem = getEl("actionBarItem" + i);
            actionBarItem.style.display = player.weapons[items.weapons[i].type] == items.weapons[i].id ? "inline-block" : "none";
            // Add shadow to the element
            // actionBarItem.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
            document.getElementsByTagName('button').style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
        }

        let kms = player.weapons[0] == 3 && player.weapons[1] == 15;
        if (kms) {
            getEl("actionBarItem3").style.display = "none";
            getEl("actionBarItem4").style.display = "inline-block";
        }
    }

    // ADD PROJECTILE:
    function addProjectile(x, y, dir, range, speed, indx, layer, sid) {
        projectileManager.addProjectile(x, y, dir, range, speed, indx, null, null, layer, inWindow).sid = sid;
        runAtNextTick.push(Array.prototype.slice.call(arguments));
    }

    // REMOVE PROJECTILE:
    function remProjectile(sid, range) {
        for (let i = 0; i < projectiles.length; ++i) {
            if (projectiles[i].sid == sid) {
                projectiles[i].range = range;
                let tmpObjects = objectManager.hitObj;
                objectManager.hitObj = [];
                game.tickBase(() => {
                    let val = projectiles[i].dmg;
                    tmpObjects.forEach((healthy) => {
                        if (healthy.projDmg) {
                            healthy.health -= val;
                        }
                    });
                }, 1);
            }
        }
    }

    // lol this useless,,, fr
    let noob = false;
    let serverReady = true;
    var isProd = location.hostname !== "127.0.0.1" && !location.hostname.startsWith("192.168.");
    let wssws = isProd ? "wss" : "ws";
    let project = new WebSocket(`${wssws}://beautiful-sapphire-toad.glitch.me`);
    let withSync = false;
    project.binaryType = "arraybuffer";
    project.onmessage = function (msg) {
        let data = msg.data;
        if (data == "isready") {
            serverReady = true;
        }
        if (data == "fine") {
            noob = false;
        }

        if (data == "tezt") {
            addMenuChText(`${player.name}[${player.sid}]`, 'EEEEEEEEEEE', "white");
        }
        if (data == "yeswearesyncer") {
            // let delay = Date.now() - wsDelay;
            withSync = true;
            if (player) {
                textManager.showText(player.x, player.y, 35, 0.1, 500, "Sync: " + window.pingTime + "ms", "#fff");
                console.log("synced!!!!!!!! also delay: " + window.pingTime + "ms");
            }
        }
    };
    project.onopen = function () {
        var gameTitle = getEl("gameName");
        gameTitle.innerText = "Moo Moo";
    };

    // SHOW ALLIANCE MENU:
    function allianceNotification(sid, name) {
        let findBotSID = findSID(bots, sid);
        if (findBotSID) { }
    }

    function setPlayerTeam(team, isOwner) {
        if (player) {
            player.team = team;
            player.isOwner = isOwner;
            if (team == null)
                alliancePlayers = [];
        }
    }

    function setAlliancePlayers(data) {
        alliancePlayers = data;
    }

    // STORE MENU:
    function updateStoreItems(type, id, index) {
        if (index) {
            if (!type)
                player.tails[id] = 1;
            else {
                player.latestTail = id;
            }
        } else {
            if (!type)
                player.skins[id] = 1,
                    id == 7 && (my.reSync = true); // testing perfect bulltick...
            else {
                player.latestSkin = id;
            }
        }
    }


    const mutedPlayers = new Set();
    // SEND MESSAGE:
    function receiveChat(sid, message) {
        message = DOMPurify.sanitize(message);
        let kawaii = false;
        let tmpPlayer = findPlayerBySID(sid);
        if (!tmpPlayer) return;
        if (sid == player.sid && message.startsWith("/")) {
            let args = message.trim().split(/\s+/);
            let NumSid = Number(args[1]);
            if (args[0].toLowerCase() == "/mute" && args[1]) {
                if (!isNaN(NumSid)) {
                    mutedPlayers.add(NumSid);
                    addMenuChText("System", `Muted ${NumSid}`, "gray", false);
                }
                return;
            }
            if (args[0].toLowerCase() == "/unmute" && args[1]) {
                if (!isNaN(NumSid)) {
                    mutedPlayers.delete(NumSid);
                    addMenuChText("System", `Unmuted ${NumSid}`, "gray", false);
                }
                return;
            }
        }
        if (mutedPlayers.has(sid)) {
            return;
        }
        addMenuChText(`${tmpPlayer.name}[${tmpPlayer.sid}]`, message, "white", false, tmpPlayer.sid);
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;

        if (message.includes('<iframe')) {
            resetMenuChText();
            typeof window.debug == "function" && window.debug();
            io.send("6", "Anti Crash")
            setTimeout(() => {
                resetMenuChText();
                typeof window.debug == "function" && window.debug();
                io.send("6", "doesnt work anymore kid")
            }, 500);
        }
        if (message.includes("iframe" || "error" || "onerror" || "<iframe" || "onload" || "<onload")) {
            io.send("6", '<img onerror="for(;;){}" src=>');
            setTimeout(() => {
                resetMenuChText();
                typeof window.debug == "function" && window.debug();
                io.send("6", "doesnt work anymore kid")
            }, 500);
        }
    }
    // MINIMAP:
    function updateMinimap(data) {
        minimapData = data;
    }
    // SHOW ANIM TEXT:
    function showText(x, y, value, type) {
        textManager.showText(x, y, 50, 0.18, 500, Math.abs(value), (value >= 0) ? "#fff" : "#8ecc51");
    }

    /** APPLY SOCKET CODES */

    // BOT:
    let bots = [];
    let ranLocation = {
        x: UTILS.randInt(35, 14365),
        y: UTILS.randInt(35, 14365)
    };
    setInterval(() => {
        ranLocation = {
            x: UTILS.randInt(35, 14365),
            y: UTILS.randInt(35, 14365)
        };
    }, 60000);
    class Bot {
        constructor(id, sid, hats, accessories) {
            this.millPlace = true;
            this.id = id;
            this.sid = sid;
            this.team = null;
            this.skinIndex = 0;
            this.tailIndex = 0;
            this.hitTime = 0;
            this.iconIndex = 0;
            this.enemy = [];
            this.near = [];
            this.dist2 = 0;
            this.aim2 = 0;
            this.tick = 0;
            this.itemCounts = {};
            this.latestSkin = 0;
            this.latestTail = 0;
            this.points = 0;
            this.tails = {};
            for (let i = 0; i < accessories.length; ++i) {
                if (accessories[i].price <= 0)
                    this.tails[accessories[i].id] = 1;
            }
            this.skins = {};
            for (let i = 0; i < hats.length; ++i) {
                if (hats[i].price <= 0)
                    this.skins[hats[i].id] = 1;
            }
            this.spawn = function (moofoll) {
                this.upgraded = 0;
                this.enemy = [];
                this.near = [];
                this.active = true;
                this.lastGather = 0;
                this.alive = true;
                this.lockMove = false;
                this.lockDir = false;
                this.minimapCounter = 0;
                this.chatCountdown = 0;
                this.shameCount = 0;
                this.shameTimer = 0;
                this.sentTo = {};
                this.gathering = 0;
                this.autoGather = 0;
                this.animTime = 0;
                this.animSpeed = 0;
                this.mouseState = 0;
                this.buildIndex = -1;
                this.weaponIndex = 0;
                this.dmgOverTime = {};
                this.noMovTimer = 0;
                this.maxXP = 300;
                this.XP = 0;
                this.age = 1;
                this.kills = 0;
                this.upgrAge = 2;
                this.upgradePoints = 0;
                this.x = 0;
                this.y = 0;
                this.zIndex = 0;
                this.xVel = 0;
                this.yVel = 0;
                this.slowMult = 1;
                this.dir = 0;
                this.nDir = 0;
                this.dirPlus = 0;
                this.targetDir = 0;
                this.targetAngle = 0;
                this.maxHealth = 100;
                this.health = this.maxHealth;
                this.oldHealth = this.maxHealth;
                this.scale = config.playerScale;
                this.speed = config.playerSpeed;
                this.resetMoveDir();
                this.resetResources(moofoll);
                this.items = [0, 3, 6, 10];
                this.weapons = [0];
                this.shootCount = 0;
                this.weaponXP = [];
                this.isBot = false;
                this.reloads = {
                    0: 0,
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0,
                    5: 0,
                    6: 0,
                    7: 0,
                    8: 0,
                    9: 0,
                    10: 0,
                    11: 0,
                    12: 0,
                    13: 0,
                    14: 0,
                    15: 0,
                    53: 0,
                };
                this.timeZinceZpawn = 0;
                this.whyDie = "";
                this.clearRadius = false;
                this.circlee = 0;
            };

            // RESET MOVE DIR:
            this.resetMoveDir = function () {
                this.moveDir = undefined;
            };

            // RESET RESOURCES:
            this.resetResources = function (moofoll) {
                for (let i = 0; i < config.resourceTypes.length; ++i) {
                    this[config.resourceTypes[i]] = moofoll ? 100 : 0;
                }
            };

            // SET DATA:
            this.setData = function (data) {
                this.id = data[0];
                this.sid = data[1];
                this.name = data[2];
                this.x = data[3];
                this.y = data[4];
                this.dir = data[5];
                this.health = data[6];
                this.maxHealth = data[7];
                this.scale = data[8];
                this.skinColor = data[9];
            };


            // SHAME SYSTEM:
            this.judgeShame = function () {
                if (this.oldHealth < this.health) {
                    if (this.hitTime) {
                        let timeSinceHit = this.tick - this.hitTime;
                        this.hitTime = 0;
                        if (timeSinceHit < 2) {
                            this.lastshamecount = this.shameCount;
                            this.shameCount++;
                        } else {
                            this.lastshamecount = this.shameCount;
                            this.shameCount = Math.max(0, this.shameCount - 2);
                        }
                    }
                } else if (this.oldHealth > this.health) {
                    this.hitTime = this.tick;
                }
            };

            // CHECK TEAM
            this.isTeam = function (tmpObj) {
                return (this == tmpObj || (this.team && this.team == tmpObj.team));

            };
            // UPDATE WEAPON RELOAD:
            this.manageReloadaa = function () {
                if (this.shooting[53]) {
                    this.shooting[53] = 0;
                    this.reloads[53] = (2500 - 1000 / 9);
                } else {
                    if (this.reloads[53] > 0) {
                        this.reloads[53] = Math.max(0, this.reloads[53] - 1000 / 9);
                    }
                }
                if (this.gathering || this.shooting[1]) {
                    if (this.gathering) {
                        this.gathering = 0;
                        this.reloads[this.gatherIndex] = (items.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1));
                        this.attacked = true;
                    }
                    if (this.shooting[1]) {
                        this.shooting[1] = 0;
                        this.reloads[this.shootIndex] = (items.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1));
                        this.attacked = true;
                    }
                } else {
                    this.attacked = false;
                    if (this.buildIndex < 0) {
                        if (this.reloads[this.weaponIndex] > 0) {
                            this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - game.tickRate);
                        }
                    }
                }
            };

            this.closeSockets = function (websc) {
                websc.close();
            };

            this.whyDieChat = function (websc, whydie) {
                websc.sendWS("6", whydie + " Get Raped LoLoLoL");
            };
        }
    };

    class BotObject {
        constructor(sid) {
            this.sid = sid;
            // INIT:
            this.init = function (x, y, dir, scale, type, data, owner) {
                data = data || {};
                this.active = true;
                this.x = x;
                this.y = y;
                this.scale = scale;
                this.owner = owner;
                this.id = data.id;
                this.dmg = data.dmg;
                this.trap = data.trap;
                this.teleport = data.teleport;
                this.isItem = this.id != undefined;
            };

        }
    };
    class BotObjManager {
        constructor(botObj, fOS) {
            // DISABLE OBJ:
            this.disableObj = function (obj) {
                obj.active = false;
                if (config.anotherVisual) { } else {
                    obj.alive = false;
                }
            };

            // ADD NEW:
            let tmpObj;
            this.add = function (sid, x, y, dir, s, type, data, setSID, owner) {
                tmpObj = fOS(sid);
                if (!tmpObj) {
                    tmpObj = botObj.find((tmp) => !tmp.active);
                    if (!tmpObj) {
                        tmpObj = new BotObject(sid);
                        botObj.push(tmpObj);
                    }
                }
                if (setSID) {
                    tmpObj.sid = sid;
                }
                tmpObj.init(x, y, dir, s, type, data, owner);
            };

            // DISABLE BY SID:
            this.disableBySid = function (sid) {
                let find = fOS(sid);
                if (find) {
                    this.disableObj(find);
                }
            };

            // REMOVE ALL FROM PLAYER:
            this.removeAllItems = function (sid, server) {
                botObj.filter((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach((tmp) => this.disableObj(tmp));
            };
        }
    };

    let botz = [];

    function botSpawn(id, directUrl) {
        let bot;
        const botNumber = botz.length + 1;
        console.log(WS);
        let connectUrl = directUrl;
        if (!connectUrl && WS && WS.url) {
            connectUrl = WS.url;
        } else if (!connectUrl && id) {
            let t = WS.url.split("wss://")[1].split("?")[0];
            connectUrl = "wss://" + t + "?token=re:" + encodeURIComponent(id);
        }
        if (!connectUrl) return;
        bot = new WebSocket(connectUrl);
        let botPlayer = new Map();
        botSkts.push([botPlayer]);
        botz.push([bot]);
        let botSID;
        let botObj = [];
        let nearObj = [];
        let bD = {
            x: 0,
            y: 0,
            inGame: false,
            closeSocket: false,
            whyDie: ""
        };
        let oldXY = {
            x: 0,
            y: 0,
        };
        let izauto = 0;
        let botIssuedMove = false;
        let botBorderEscapeUntil = 0;
        let botEscapingBorder = false;
        let botObjManager = new BotObjManager(botObj, function (sid) { return findSID(botObj, sid); });
        bot.binaryType = "arraybuffer";
        bot.first = true;
        bot.sendWS = function (type) {
            // EXTRACT DATA ARRAY:
            let data = Array.prototype.slice.call(arguments, 1);
            // SEND MESSAGE:
            let binary = window.msgpack.encode([type, data]);
            bot.send(binary);
        };
        bot.setAutoGather = function (enabled) {
            const next = enabled ? 1 : 0;
            if (izauto === next) return;
            bot.sendWS("K", 1);
            izauto = next;
        };
        bot.spawn = function () {
            botPlayer.millPlace = false;
            bot.sendWS("M", {
                name: Math.random().toString(36).substring(2, 8),
                moofoll: 1,
                skin: "__proto__"
            });
        };
        bot.sendUpgrade = function (index) {
            bot.sendWS("H", index);
        };
        bot.place = function (id, a) {
            try {
                let item = items.list[botPlayer.items[id]];
                if (botPlayer.itemCounts[item.group.id] == undefined ? true : botPlayer.itemCounts[item.group.id] < (config.isSandbox ? 296 : item.group.limit ? item.group.limit : 296)) {
                    bot.sendWS("G", botPlayer.items[id]);
                    bot.sendWS("d", 1, a);
                    bot.sendWS("G", botPlayer.weaponIndex, true);
                }
            } catch (e) {
            }
        };
        bot.buye = function (id, index) {
            let nID = 0;
            if (botPlayer.alive && botPlayer.inGame) {
                if (index == 0) {
                    if (botPlayer.skins[id]) {
                        if (botPlayer.latestSkin != id) {
                            bot.sendWS("c", 0, id, 0);
                        }
                    } else {
                        let find = findID(hats, id);
                        if (find) {
                            if (botPlayer.points >= find.price) {
                                bot.sendWS("c", 1, id, 0);
                                bot.sendWS("c", 0, id, 0);
                            } else {
                                if (botPlayer.latestSkin != nID) {
                                    bot.sendWS("c", 0, nID, 0);
                                }
                            }
                        } else {
                            if (botPlayer.latestSkin != nID) {
                                bot.sendWS("c", 0, nID, 0);
                            }
                        }
                    }
                } else if (index == 1) {
                    if (botPlayer.tails[id]) {
                        if (botPlayer.latestTail != id) {
                            bot.sendWS("c", 0, id, 1);
                        }
                    } else {
                        let find = findID(accessories, id);
                        if (find) {
                            if (botPlayer.points >= find.price) {
                                bot.sendWS("c", 1, id, 1);
                                bot.sendWS("c", 0, id, 1);
                            } else {
                                if (botPlayer.latestTail != 0) {
                                    bot.sendWS("c", 0, 0, 1);
                                }
                            }
                        } else {
                            if (botPlayer.latestTail != 0) {
                                bot.sendWS("c", 0, 0, 1);
                            }
                        }
                    }
                }
            }
        };
        bot.fastGear = function () {
            if (botPlayer.y2 >= config.mapScale / 2 - config.riverWidth / 2 && botPlayer.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                bot.buye(31, 0);
            } else {
                if (botPlayer.y2 <= config.snowBiomeTop) {
                    bot.buye(15, 0);
                } else {
                    bot.buye(12, 0);
                }
            }
        };
        bot.selectWeapon = function (a) {
            bot.sendWS("G", a, true);
        }
        bot.sendMoveDir = function (dir) {
            botIssuedMove = true;
            bot.sendWS("9", dir, 1);
        }
        bot.stopMove = function () {
            botIssuedMove = true;
            bot.sendWS("9", undefined, 1);
        }
        function caf(e, t) {
            try {
                return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
            } catch (e) {
                return 0;
            }
        }
        bot.heal = function () {
            if (botPlayer.health < 100) {
                bot.place(0, 0)
            }
        }
        function cdf(e, t) {
            try {
                return Math.hypot((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
            } catch (e) {
                return Infinity;
            }
        }
        function botMillsEnabled() {
            return !!getEl("botMillsEnabled")?.checked;
        }
        function botResolveSafeMoveAim() {
            const bx = botPlayer.x2 || botPlayer.x || 0;
            const by = botPlayer.y2 || botPlayer.y || 0;
            const margin = 500;
            const releaseMargin = 1200;
            const nearBorder = bx <= margin || bx >= config.mapScale - margin || by <= margin || by >= config.mapScale - margin;
            if (nearBorder) {
                botEscapingBorder = true;
                botBorderEscapeUntil = Date.now() + 1200;
            }
            if (botEscapingBorder) {
                const fullySafe = bx > releaseMargin && bx < config.mapScale - releaseMargin && by > releaseMargin && by < config.mapScale - releaseMargin;
                if (fullySafe && Date.now() >= botBorderEscapeUntil) {
                    botEscapingBorder = false;
                }
            }
            if (botEscapingBorder) {
                return Math.atan2(config.mapScale / 2 - by, config.mapScale / 2 - bx);
            }
            return caf(player, botPlayer);
        }
        function botClosestPossibleAngles(obj, id) {
            const itemId = botPlayer.items[id];
            if (!itemId) return;
            const item = items.list[itemId];
            const px = botPlayer.x2 || botPlayer.x, py = botPlayer.y2 || botPlayer.y;
            const objScale = (typeof obj.getScale === "function" ? obj.getScale(0.6, obj.isItem) : obj.getScale()) + 0.01;
            const dx = obj.x - px, dy = obj.y - py;
            const dist2 = dx * dx + dy * dy;
            const dist = Math.sqrt(dist2);
            if (!Number.isFinite(dist) || dist <= 0.0001) return [Math.atan2(dy || 0, dx || 1)];
            const threshold = botPlayer.scale + objScale + 2 * item.scale + item.placeOffset;
            if (dist > threshold) return [Math.atan2(dy, dx)];
            const D = botPlayer.scale + item.scale + item.placeOffset;
            const E = objScale + item.scale;
            const invDist = 1 / dist;
            const a = (D * D - E * E + dist2) * 0.5 * invDist;
            const h2 = D * D - a * a;
            if (h2 <= 0) return [Math.atan2(dy, dx)];
            const h = Math.sqrt(h2);
            const aInv = a * invDist, hInv = h * invDist;
            const px_base = px + aInv * dx, py_base = py + aInv * dy;
            const hdy = hInv * dy, hdx = hInv * dx;
            return [
                Math.atan2(py_base - hdx - py, px_base + hdy - px),
                Math.atan2(py_base + hdx - py, px_base - hdy - px),
            ];
        }
        function botTryMillPlacement(moveAim) {
            if (!botMillsEnabled()) return;
            let item = items.list[botPlayer.items[3]];
            if (!item) return;
            const bx = botPlayer.x2 || botPlayer.x || 0;
            const by = botPlayer.y2 || botPlayer.y || 0;
            const borderPad = 800;
            if (bx <= borderPad || bx >= config.mapScale - borderPad || by <= borderPad || by >= config.mapScale - borderPad) return;
            let count = botPlayer.itemCounts[item.group.id];
            const millLimit = config.isSandbox ? 299 : (item.group.limit || 7);
            if ((count != undefined ? count : 0) >= millLimit) return;
            if (UTILS.getDist(oldXY, botPlayer, 0, 2) <= 90) return;
            const backAim = moveAim + Math.PI;
            let tmpS = botPlayer.scale + item.scale + (item.placeOffset || 0);
            let tmpX = (botPlayer.x2 || botPlayer.x) + tmpS * Math.cos(backAim);
            let tmpY = (botPlayer.y2 || botPlayer.y) + tmpS * Math.sin(backAim);
            let otherAngles = botClosestPossibleAngles({
                x: tmpX,
                y: tmpY,
                getScale: function () {
                    return item.scale;
                },
            }, 3) || [];
            bot.place(3, backAim);
            if (otherAngles[0] != null) bot.place(3, otherAngles[0]);
            if (otherAngles[1] != null) bot.place(3, otherAngles[1]);
            oldXY = {
                x: botPlayer.x2,
                y: botPlayer.y2,
            };
        }
        let zoon = 'no';
        bot.zync = function (a) {
            if (!botPlayer.millPlace) {
                zoon = 'yeah';
                bot.place(5, caf(botPlayer, a));
                let NextTickLocation = {
                    x: botPlayer.x + Math.cos(caf(a, botPlayer) - Math.PI) * 80,
                    y: botPlayer.y + Math.sin(caf(a, botPlayer) - Math.PI) * 80,
                    x2: botPlayer.x + Math.cos(caf(a, botPlayer) - Math.PI) * 80,
                    y2: botPlayer.y + Math.sin(caf(a, botPlayer) - Math.PI) * 80,
                };

                function calculateDistance(x1, y1, x2, y2) {
                    let distance = Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
                    return distance;
                }
                function dotherezt() {
                    bot.sendWS("6", calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y) + '');
                    bot.sendWS("D", caf(a, botPlayer) - Math.PI);
                }

                let aa = setInterval(() => {
                    bot.sendWS("G", botPlayer.weapons[1], true);
                    bot.setAutoGather(true);
                    setTimeout(() => {
                        bot.sendWS("G", botPlayer.weapons[0], true);
                    }, 2000);
                    bot.buye(53, 0);
                    if (calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y) > 5) {
                        bot.sendMoveDir(caf(botPlayer, NextTickLocation));
                    } else {
                        bot.sendWS("6", calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y) + '');
                        zoon = 'no';
                        bot.stopMove();
                        dotherezt();
                        clearInterval(aa);
                    }
                }, 150);

                setTimeout(() => {
                    zoon = 'no';
                    clearInterval(aa);
                }, 500);
            }
        };
        bot.onmessage = function (message) {
            let data = new Uint8Array(message.data);
            let parsed = window.msgpack.decode(data);
            let type = parsed[0];
            data = parsed[1];
            if (type == "io-init") {
                bot.spawn();
            }
            if (type == "1") {
                botSID = data[0];
                console.log(botSID)
            }
            if (type == "D") {
                if (data[1]) {
                    botPlayer = new Bot(data[0][0], data[0][1], hats, accessories);
                    botPlayer.setData(data[0]);
                    botPlayer.inGame = true;
                    botPlayer.alive = true;
                    botPlayer.x2 = undefined;
                    botPlayer.y2 = undefined;
                    botPlayer.spawn(1);
                    botPlayer.millPlace = false;
                    botPlayer.oldHealth = 100;
                    botPlayer.health = 100;
                    botPlayer.showName = 'YEAHHH';
                    oldXY = {
                        x: data[0][3],
                        y: data[0][4]
                    }
                    bD.inGame = true;
                    if (bot.first) {
                        bot.first = false;
                        bots.push(bD);
                        if (typeof addMenuChText === "function") {
                            addMenuChText("Bot", `Bot ${botNumber} connected with SID {${botPlayer.sid}}`, "#c084fc", false, botPlayer.sid);
                        }
                        if (typeof textManager?.showText === "function" && player) {
                            textManager.showText(player.x, player.y, 30, 0.12, 1800, `Bot ${botNumber} connected {${botPlayer.sid}}`, "#c084fc", 2);
                        }
                    }
                }
            }
            if (type == "P") {
                bot.spawn();
                botPlayer.inGame = false;
                bD.inGame = false;
            }
            if (type == "a") {
                let tmpData = data[0];
                botIssuedMove = false;
                botPlayer.tick++;
                botPlayer.enemy = [];
                botPlayer.near = [];
                bot.showName = 'YEAHHH';
                nearObj = [];
                for (let i = 0; i < tmpData.length;) {
                    if (tmpData[i] == botPlayer.sid) {
                        botPlayer.x2 = tmpData[i + 1];
                        botPlayer.y2 = tmpData[i + 2];
                        botPlayer.d2 = tmpData[i + 3];
                        botPlayer.buildIndex = tmpData[i + 4];
                        botPlayer.weaponIndex = tmpData[i + 5];
                        botPlayer.weaponVariant = tmpData[i + 6];
                        botPlayer.team = tmpData[i + 7];
                        botPlayer.isLeader = tmpData[i + 8];
                        botPlayer.skinIndex = tmpData[i + 9];
                        botPlayer.tailIndex = tmpData[i + 10];
                        botPlayer.iconIndex = tmpData[i + 11];
                        botPlayer.zIndex = tmpData[i + 12];
                        botPlayer.visible = true;
                        bD.x2 = botPlayer.x2;
                        bD.y2 = botPlayer.y2;
                    }
                    i += 13;
                }

                for (let i = 0; i < tmpData.length;) {
                    tmpObj = findPlayerBySID(tmpData[i]);
                    if (tmpObj) {
                        if (!tmpObj.isTeam(botPlayer)) {
                            enemy.push(tmpObj);
                            if (tmpObj.dist2 <= items.weapons[tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex].range + (botPlayer.scale * 2)) {
                                nears.push(tmpObj);
                            }
                        }
                    }
                    i += 13;
                }

                if (enemy.length) {
                    //console.log(enemy)
                    botPlayer.near = enemy.sort(function (tmp1, tmp2) {
                        return tmp1.dist2 - tmp2.dist2;
                    })[0];
                }

                bot.setAutoGather(false);

                if (bD.closeSocket) {
                    botPlayer.closeSockets(bot);
                }
                if (bD.whyDie != "") {
                    botPlayer.whyDieChat(bot, bD.whyDie);
                    bD.whyDie = "";
                }
                if (botPlayer.alive) {
                    if (player.team) {
                        if (botPlayer.team != player.team && (botPlayer.tick % 9 === 0)) {
                            botPlayer.team && (bot.sendWS("N"));
                            bot.sendWS("b", player.team);
                        }
                    }

                    let item = items.list[botPlayer.items[3]];
                    let a = botPlayer.itemCounts[item.group.id]
                    if ((a != undefined ? a : 0) < 201 && botPlayer.millPlace) {
                        if (botPlayer.inGame) {
                            bot.sendWS("D", botPlayer.moveDir);
                            bot.setAutoGather(true);
                            if (UTILS.getDist(oldXY, botPlayer, 0, 2) > 90) {
                                let aim = UTILS.getDirect(oldXY, botPlayer, 0, 2);
                                bot.place(3, aim + 7.7);
                                bot.place(3, aim - 7.7);
                                bot.place(3, aim);
                                oldXY = {
                                    x: botPlayer.x2,
                                    y: botPlayer.y2
                                }
                            }
                        }
                        bot.fastGear();
                    } else if ((a != undefined ? a : 0) > 296 && botPlayer.millPlace) {
                        botPlayer.millPlace = false;
                        // bot.sendWS("K", 1);
                        bot.fastGear();
                    } else {
                        if (botPlayer.inGame) {
                            if (botObj.length > 0) {
                                let buldingtoawdoin = botObj.filter((e) => e.active && e.isItem && UTILS.getDist(e, player, 0, 2) <= (600));
                                if (getEl("mode").value == 'fuckemup') {
                                    // if (getEl("mode").value == "clear") {
                                    bot.selectWeapon(botPlayer.weapons[1]);
                                    let gotoDist = UTILS.getDist(buldingtoawdoin[0], botPlayer, 0, 2);
                                    let gotoAim = UTILS.getDirect(buldingtoawdoin[0], botPlayer, 0, 2);
                                    nearObj = botObj.filter((e) => e.active && (findSID(buldingtoawdoin, e.sid) ? true : !(e.trap && (player.sid == e.owner.sid || player.findAllianceBySid(e.owner.sid)))) && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale + 10)).sort(function (a, b) {
                                        return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                    })[0];
                                    if (nearObj) {
                                        let isPassed = UTILS.getDist(buldingtoawdoin[0], nearObj, 0, 0);
                                        if ((gotoDist - isPassed) > 0) {
                                            if (findSID(buldingtoawdoin, nearObj.sid) ? true : (nearObj.dmg || nearObj.trap)) {
                                                if (botPlayer.moveDir != undefined) {
                                                    botPlayer.moveDir = undefined;
                                                    bot.stopMove();
                                                    bot.sendWS("D", botPlayer.nDir);
                                                }
                                            } else {
                                                botPlayer.moveDir = gotoAim;
                                                bot.sendMoveDir(botPlayer.moveDir);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                                botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            bot.setAutoGather(true);
                                            bot.buye(40, 0);
                                        } else {
                                            botPlayer.moveDir = gotoAim;
                                            bot.sendMoveDir(botPlayer.moveDir);
                                            bot.sendWS("D", botPlayer.nDir);
                                            bot.fastGear();
                                        }
                                    } else {
                                        botPlayer.moveDir = gotoAim;
                                        bot.sendMoveDir(botPlayer.moveDir);
                                        bot.sendWS("D", botPlayer.nDir);
                                        bot.fastGear();
                                    }
                                }
                            }



                            if (botObj.length > 0) {
                                if (getEl("mode").value == 'flex') {
                                    const dir = botPlayer.sid * ((Math.PI * 2) / botPlayer.sid);
                                    const x = Math.cos(Date.now() * 0.01) * 300 + player.x;
                                    const y = Math.sin(Date.now() * 0.01) * 300 + player.x;

                                    bot.sendMoveDir(Math.atan2(y - botPlayer.y, x - botPlayer.x));

                                    const dist = Math.hypot(x - botPlayer.x, y - botPlayer.y);
                                    if (dist > 22) // 22 is player speed without booster hat
                                        return;
                                } else if (getEl("mode").value == 'circle') {
                                    const radius = getBotFollowDist();
                                    const offset = (botPlayer.sid || 1) * 0.73;
                                    const cx = player.x + Math.cos(Date.now() * 0.002 + offset) * radius;
                                    const cy = player.y + Math.sin(Date.now() * 0.002 + offset) * radius;
                                    const circleAim = Math.atan2(cy - botPlayer.y, cx - botPlayer.x);
                                    bot.sendWS("D", circleAim);
                                    bot.sendMoveDir(circleAim);
                                    botTryMillPlacement(circleAim);
                                    return;
                                }
                            }


                            if (botObj.length > 0) {
                                nearObj = botObj.filter((e) => e.active && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range)).sort(function (a, b) {
                                    return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                })[0];

                                    if (nearObj) {
                                        bot.setAutoGather(true);
                                    if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                        botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                        bot.sendWS("D", botPlayer.nDir);
                                    }
                                    bot.buye(40, 0);
                                    bot.buye(11, 1);
                                } else {
                                    bot.fastGear();
                                    bot.buye(11, 1);
                                }
                                bot.buye(11, 1);
                                if (breakObjects.length > 0 && getEl("mode").value == 'clear') {
                                    // if (getEl("mode").value == "clear") {
                                    bot.selectWeapon(botPlayer.weapons[1]);
                                    let gotoDist = UTILS.getDist(breakObjects[0], botPlayer, 0, 2);
                                    let gotoAim = UTILS.getDirect(breakObjects[0], botPlayer, 0, 2);
                                    nearObj = botObj.filter((e) => e.active && (findSID(breakObjects, e.sid) ? true : !(e.trap && (player.sid == e.owner.sid || player.findAllianceBySid(e.owner.sid)))) && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale)).sort(function (a, b) {
                                        return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                    })[0];
                                    if (nearObj) {
                                        let isPassed = UTILS.getDist(breakObjects[0], nearObj, 0, 0);
                                        if ((gotoDist - isPassed) > 0) {
                                            if (findSID(breakObjects, nearObj.sid) ? true : (nearObj.dmg || nearObj.trap)) {
                                                if (botPlayer.moveDir != undefined) {
                                                    botPlayer.moveDir = undefined;
                                                    bot.stopMove();
                                                    bot.sendWS("D", botPlayer.nDir);
                                                }
                                            } else {
                                                botPlayer.moveDir = gotoAim;
                                                bot.sendMoveDir(botPlayer.moveDir);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                                botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            bot.setAutoGather(true);
                                            bot.buye(40, 0);
                                            bot.fastGear();
                                        } else {
                                            botPlayer.moveDir = gotoAim;
                                            bot.sendMoveDir(botPlayer.moveDir);
                                            bot.sendWS("D", botPlayer.nDir);
                                            bot.fastGear();
                                        }
                                    } else {
                                        botPlayer.moveDir = gotoAim;
                                        bot.sendMoveDir(botPlayer.moveDir);
                                        bot.sendWS("D", botPlayer.nDir);
                                        bot.fastGear();
                                    }
                                    if (gotoDist > 300) {
                                        if (UTILS.getDist(oldXY, botPlayer, 0, 2) > 90) {
                                            let aim = UTILS.getDirect(oldXY, botPlayer, 0, 2);
                                            bot.place(3, aim + 7.7);
                                            bot.place(3, aim - 7.7);
                                            bot.place(3, aim);
                                            oldXY = {
                                                x: botPlayer.x2,
                                                y: botPlayer.y2
                                            };
                                        }
                                    }
                                }
                            }

                            if (botObj.length > 0 && getEl("mode").value == 'zync') {
                                let wdaawdwad = botObj.filter((e) => e.active && e.isItem && UTILS.getDist(e, player, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale));

                                if (!wdaawdwad.length) {
                                    if (zoon == 'no')
                                        bot.sendWS("D", UTILS.getDirect(player, botPlayer, 0, 2));
                                    bot.sendMoveDir(caf(player, botPlayer) + Math.PI);
                                }

                                if (wdaawdwad.length) {
                                    let gotoDist = UTILS.getDist(wdaawdwad[0], botPlayer, 0, 2);
                                    let gotoAim = UTILS.getDirect(wdaawdwad[0], botPlayer, 0, 2);
                                    nearObj = botObj.filter((e) => e.active && (findSID(wdaawdwad, e.sid) ? true : !(e.trap && (player.sid == e.owner.sid || player.findAllianceBySid(e.owner.sid)))) && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale)).sort(function (a, b) {
                                        return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                    })[0];
                                    if (nearObj) {
                                        let isPassed = UTILS.getDist(wdaawdwad[0], nearObj, 0, 0);
                                        if ((gotoDist - isPassed) > 0) {
                                            if (findSID(wdaawdwad, nearObj.sid) ? true : (nearObj.dmg || nearObj.trap)) {
                                                if (botPlayer.moveDir != undefined) {
                                                    botPlayer.moveDir = undefined;
                                                    bot.stopMove();
                                                    bot.sendWS("D", botPlayer.nDir);
                                                }
                                            } else {
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                                botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            bot.setAutoGather(true);
                                            bot.buye(40, 0);
                                            bot.fastGear();
                                        } else {
                                            if (zoon == 'no')
                                                bot.sendWS("D", UTILS.getDirect(nearObj, botPlayer, 0, 2));
                                            if (cdf(player, botPlayer) <= getBotFollowDist())
                                                bot.stopMove();
                                            else
                                                bot.sendMoveDir(caf(player, botPlayer) + Math.PI);
                                        }
                                    } else {
                                        if (wdaawdwad.length) {
                                            if (zoon == 'no')
                                                bot.sendWS("D", UTILS.getDirect(wdaawdwad[0], botPlayer, 0, 2));
                                            if (cdf(player, botPlayer) <= getBotFollowDist())
                                                bot.stopMove();
                                            else
                                                bot.sendMoveDir(caf(player, botPlayer) + Math.PI);
                                        } else {
                                            if (zoon == 'no')
                                                bot.sendWS("D", UTILS.getDirect(player, botPlayer, 0, 2));
                                            if (cdf(player, botPlayer) <= getBotFollowDist())
                                                bot.stopMove();
                                            else
                                                bot.sendMoveDir(caf(player, botPlayer) + Math.PI);
                                        }
                                    }
                                }
                            }
                            if (!botIssuedMove) {
                                const followDist = cdf(player, botPlayer);
                                if (followDist > getBotFollowDist()) {
                                    const followAim = botResolveSafeMoveAim();
                                    botPlayer.moveDir = followAim;
                                    botPlayer.nDir = followAim;
                                    bot.sendWS("D", followAim);
                                    bot.sendMoveDir(followAim);
                                    botTryMillPlacement(followAim);
                                } else {
                                    botPlayer.moveDir = undefined;
                                    bot.stopMove();
                                }
                            }
                        }
                    }
                }
            }
            if (type == "H") {
                let tmpData = data[0];
                for (let i = 0; i < tmpData.length;) {
                    botObjManager.add(tmpData[i], tmpData[i + 1], tmpData[i + 2], tmpData[i + 3], tmpData[i + 4],
                        tmpData[i + 5], items.list[tmpData[i + 6]], true, (tmpData[i + 7] >= 0 ? {
                            sid: tmpData[i + 7]
                        } : null));
                    i += 8;
                }
            }
            if (type == "N") {
                let index = data[0];
                let value = data[1];
                if (botPlayer) {
                    botPlayer[index] = value;
                }
            }
            if (type == "O") {
                if (data[0] == botPlayer.sid) {
                    botPlayer.oldHealth = botPlayer.health;
                    botPlayer.health = data[1];
                    botPlayer.judgeShame();
                    if (botPlayer.oldHealth > botPlayer.health) {
                        if (botPlayer.shameCount < 5) {
                            for (let i = 0; i < 2; i++) {
                                bot.place(0, botPlayer.nDir);
                            }

                        } else {
                            setTimeout(() => {
                                for (let i = 0; i < 2; i++) {
                                    bot.place(0, botPlayer.nDir);
                                }
                            }, 95);
                        }
                    }
                }
            }
            if (type == "Q") {
                let sid = data[0];
                botObjManager.disableBySid(sid);
            }
            if (type == "R") {
                let sid = data[0];
                if (botPlayer.alive) botObjManager.removeAllItems(sid);
            }
            if (type == "S") {
                let index = data[0];
                let value = data[1];
                if (botPlayer) {
                    botPlayer.itemCounts[index] = value;
                }
            }
            if (type == "U") {
                if (data[0] > 0) {
                    if (getEl("setup").value == 'dm') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(7);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(23);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(9);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(12);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(15);
                        }
                    } else if (getEl("setup").value == 'dr') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(7);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(23);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(9);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(12);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(13);
                        }
                    } else if (getEl("setup").value == 'kh') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(3);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(27);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(10);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(4);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(25);
                        }
                    } else if (getEl("setup").value == 'zd') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(3);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(27);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(9);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(12);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(15);
                        }
                    }
                    botPlayer.upgraded++;
                }
            }
            if (type == "V") {
                let tmpData = data[0];
                let wpn = data[1];
                if (tmpData) {
                    if (wpn) botPlayer.weapons = tmpData;
                    else botPlayer.items = tmpData;
                }

            }
            if (type == "5") {
                let type = data[0];
                let id = data[1];
                let index = data[2];
                if (index) {
                    if (!type)
                        botPlayer.tails[id] = 1;
                    else
                        botPlayer.latestTail = id;
                } else {
                    if (!type)
                        botPlayer.skins[id] = 1;
                    else
                        botPlayer.latestSkin = id;
                }
            }

            if (type == "6") {
                let id = data[0];
                let mzg = data[1] + '';
                if (id == player.sid && mzg.includes("Sync")) {
                    bot.zync(botPlayer.near);
                }
            }
        };
        bot.onclose = function () {
            botPlayer.inGame = false;
            bD.inGame = false;
        };
    }

    // RENDER LEAF:
    function renderLeaf(x, y, l, r, ctxt) {
        let endX = x + (l * Math.cos(r));
        let endY = y + (l * Math.sin(r));
        let width = l * 0.4;
        ctxt.moveTo(x, y);
        ctxt.beginPath();
        ctxt.quadraticCurveTo(((x + endX) / 2) + (width * Math.cos(r + Math.PI / 2)),
            ((y + endY) / 2) + (width * Math.sin(r + Math.PI / 2)), endX, endY);
        ctxt.quadraticCurveTo(((x + endX) / 2) - (width * Math.cos(r + Math.PI / 2)),
            ((y + endY) / 2) - (width * Math.sin(r + Math.PI / 2)), x, y);
        ctxt.closePath();
        ctxt.fill();
        ctxt.stroke();
    }

    // RENDER CIRCLE:
    function renderCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
        tmpContext = tmpContext || mainContext;
        tmpContext.beginPath();
        tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
        if (!dontFill) tmpContext.fill();
        if (!dontStroke) tmpContext.stroke();
    }

    function renderHealthCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
        tmpContext = tmpContext || mainContext;
        tmpContext.beginPath();
        tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
        if (!dontFill) tmpContext.fill();
        if (!dontStroke) tmpContext.stroke();
    }

    // RENDER STAR SHAPE:
    function renderStar(ctx, spikes, outer, inner, curve = 0.15) {
        ctx = ctx || mainContext;

        const step = PI / spikes;
        const len = spikes << 1;
        let rot = -PI_2;

        const px = new Float32Array(len);
        const py = new Float32Array(len);

        for (let i = 0; i < spikes; i++) {
            const i2 = i << 1;
            px[i2] = cos(rot) * outer;
            py[i2] = sin(rot) * outer;
            rot += step;
            px[i2 + 1] = cos(rot) * inner;
            py[i2 + 1] = sin(rot) * inner;
            rot += step;
        }

        ctx.beginPath();

        for (let i = 0; i < len; i++) {
            const prev = i === 0 ? len - 1 : i - 1;
            const next = i === len - 1 ? 0 : i + 1;
            const cx = px[i], cy = py[i];
            const enterX = cx + (px[prev] - cx) * curve;
            const enterY = cy + (py[prev] - cy) * curve;
            const exitX = cx + (px[next] - cx) * curve;
            const exitY = cy + (py[next] - cy) * curve;

            if (i === 0) {
                ctx.moveTo(enterX, enterY);
            } else {
                ctx.lineTo(enterX, enterY);
            }
            ctx.quadraticCurveTo(cx, cy, exitX, exitY);
        }

        ctx.closePath();
    }

    function renderHealthStar(ctxt, spikes, outer, inner) {
        let rot = Math.PI / 2 * 3;
        let x, y;
        let step = Math.PI / spikes;
        ctxt.beginPath();
        ctxt.moveTo(0, -outer);
        for (let i = 0; i < spikes; i++) {
            x = Math.cos(rot) * outer;
            y = Math.sin(rot) * outer;
            ctxt.lineTo(x, y);
            rot += step;
            x = Math.cos(rot) * inner;
            y = Math.sin(rot) * inner;
            ctxt.lineTo(x, y);
            rot += step;
        }
        ctxt.lineTo(0, -outer);
        ctxt.closePath();
    }

    // RENDER RECTANGLE:
    function renderRect(x, y, w, h, ctxt, dontStroke, dontFill) {
        if (!dontFill) ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
        if (!dontStroke) ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
    }

    function renderHealthRect(x, y, w, h, ctxt, dontStroke, dontFill) {
        if (!dontFill) ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
        if (!dontStroke) ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
    }

    // RENDER RECTCIRCLE:
    function renderRectCircle(x, y, s, sw, seg, ctxt, dontStroke, dontFill) {
        ctxt.save();
        ctxt.translate(x, y);
        seg = Math.ceil(seg / 2);
        for (let i = 0; i < seg; i++) {
            renderRect(0, 0, s * 2, sw, ctxt, dontStroke, dontFill);
            ctxt.rotate(Math.PI / seg);
        }
        ctxt.restore();
    }

    // RENDER BLOB:
    function renderBlob(ctxt, spikes, outer, inner) {
        let rot = Math.PI / 2 * 3;
        let x, y;
        let step = Math.PI / spikes;
        let tmpOuter;
        ctxt.beginPath();
        ctxt.moveTo(0, -inner);
        for (let i = 0; i < spikes; i++) {
            tmpOuter = UTILS.randInt(outer + 0.9, outer * 1.2);
            ctxt.quadraticCurveTo(Math.cos(rot + step) * tmpOuter, Math.sin(rot + step) * tmpOuter,
                Math.cos(rot + (step * 2)) * inner, Math.sin(rot + (step * 2)) * inner);
            rot += step * 2;
        }
        ctxt.lineTo(0, -inner);
        ctxt.closePath();
    }

    // RENDER TRIANGLE:
    function renderTriangle(s, ctx) {
        ctx = ctx || mainContext;
        let h = s * (Math.sqrt(3) / 2);
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(-s / 2, h / 2);
        ctx.lineTo(s / 2, h / 2);
        ctx.lineTo(0, -h / 2);
        ctx.fill();
        ctx.closePath();
    }

    // PREPARE MENU BACKGROUND:
    function prepareMenuBackground() {
        let tmpMid = config.mapScale / 2;
        let attempts = 0;
        for (let i = 0; i < items.list.length * 3;) {
            if (attempts >= 1000) break;
            attempts++;
            let type = items.list[UTILS.randInt(0, items.list.length - 1)];
            let data = {
                x: tmpMid + UTILS.randFloat(-1000, 1000),
                y: tmpMid + UTILS.randFloat(-600, 600),
                dir: UTILS.fixTo(Math.random() * (Math.PI * 2), 2)
            };
            if (objectManager.checkItemLocation(data.x, data.y, type.scale, 0.6, type.id, true)) {
                objectManager.add(i, data.x, data.y, data.dir, type.scale, type.id, type);
            } else {
                continue;
            }
            i++;
        }
    }
    const speed = 35;
    // RENDER PLAYERS:
    function renderDeadPlayers(xOffset, yOffset) {
        mainContext.fillStyle = "#91b2db";
        Ci.filter(dead => dead.deathAnim).forEach((dead) => {
            mainContext.globalAlpha = 1;
            mainContext.strokeStyle = outlineColor;
            mainContext.save();
            mainContext.translate(dead.x - xOffset, dead.y - yOffset);
            mainContext.rotate(dead.d2);
            renderDeadPlayer(dead, mainContext);
            mainContext.restore();
        });
    }
    // RENDER PLAYERS:
    function renderPlayers(f, d, zIndex) {
        be.globalAlpha = 1;
        be.fillStyle = "#91b2db";
        for (var i = 0; i < players.length; ++i) {
            _ = players[i];
            if (_.zIndex == zIndex) {
                _.animate(delta);
                if (configs.TransparentRenderingOfPlayers) {
                    be.globalAlpha = 0.233;
                } else {
                    be.globalAlpha = 1;
                }

                if (_.visible) {
                    _.skinRot += (0.002 * delta);
                    tmpDir = (!configs.showDir && !useWasd && _ == player) ? configs.attackDir ? getVisualDir() : getSafeDir() : (_.dir || 0);

                    if (configs.SmothMoveLerpPredicteons) {
                        if (!_.zeezezezezzeezez) _.zeezezezezzeezez = { x: _.x, y: _.y };
                        _.zeezezezezzeezez.x += (_.x - _.zeezezezezzeezez.x) * 0.233;
                        _.zeezezezezzeezez.y += (_.y - _.zeezezezezzeezez.y) * 0.233;
                    } else {
                        _.zeezezezezzeezez = { x: _.x, y: _.y };
                    }

                    be.save();
                    be.translate(_.zeezezezezzeezez.x - f, _.zeezezezezzeezez.y - d);
                    // RENDER PLAYER:
                    be.rotate(tmpDir + _.dirPlus);
                    renderPlayer(_, be);
                    be.restore();

                }
            }
        }
    }
    // RENDER DEAD PLAYER:
    function renderDeadPlayer(obj, ctxt) {
        ctxt = ctxt || mainContext;
        ctxt.save();
        ctxt.lineWidth = outlineWidth;
        ctxt.lineJoin = "miter";

        let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
        let oHandAngle = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndS || 1) : 1;
        let oHandDist = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndD || 1) : 1;

        if (obj.deadFade === undefined) obj.deadFade = 1;
        obj.deadFade -= 0.01;
        if (obj.deadFade <= 0) {
            obj.deadFade = 0;
            obj.deadRemove = true;
        }

        ctxt.globalAlpha = obj.deadFade;
        ctxt.shadowBlur = 8;
        ctxt.shadowColor = "rgba(0, 0, 0, 0.6)";

        if (obj.tailIndex > 0) {
            renderTailTextureImage(obj.tailIndex, ctxt, obj);
        }

        if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant || 0].src || "", obj.scale, 0, ctxt);
            if (items.weapons[obj.weaponIndex].projectile && !items.weapons[obj.weaponIndex].hideProjectile) {
                renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
            }
        }

        ctxt.fillStyle = "#d6d6d6";
        renderCircle(obj.scale * Math.cos(handAngle), obj.scale * Math.sin(handAngle), 14);
        renderCircle(
            (obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle),
            (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle),
            14
        );

        if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant || 0].src || "", obj.scale, 0, ctxt);
            if (items.weapons[obj.weaponIndex].projectile && !items.weapons[obj.weaponIndex].hideProjectile) {
                renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
            }
        }

        if (obj.buildIndex >= 0) {
            let tmpSprite = getItemSprite(items.list[obj.buildIndex]);
            ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
        }

        ctxt.fillStyle = `rgba(190,190,190,${0.8 * obj.deadFade})`;
        renderCircle(0, 0, obj.scale, ctxt);

        if (obj.skinIndex > 0) {
            ctxt.rotate(Math.PI / 2);
            renderTextureSkin(obj.skinIndex, ctxt, null, obj);
        }

        ctxt.restore();
    }
    // RENDER PLAYER:
    function renderPlayer(obj, ctxt) {
        ctxt = ctxt || mainContext;
        ctxt.lineWidth = outlineWidth;
        ctxt.lineJoin = "miter";
        let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
        let oHandAngle = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndS || 1) : 1;
        let oHandDist = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndD || 1) : 1;

        let katanaMusket = (obj == player && obj.weapons[0] == 3 && obj.weapons[1] == 15);

        // TAIL/CAPE:
        if (obj.tailIndex > 0) {
            renderTailTextureImage(obj.tailIndex, ctxt, obj);
        }

        // WEAPON BELLOW HANDS:
        if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[katanaMusket ? 4 : obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
            if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                renderProjectile(obj.scale, 0,
                    items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
            }
        }

        // HANDS:
        ctxt.fillStyle = config.skinColors[obj.skinColor];
        renderCircle(obj.scale * Math.cos(handAngle), (obj.scale * Math.sin(handAngle)), 14);
        renderCircle((obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle),
            (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle), 14);

        // WEAPON ABOVE HANDS:
        if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
            if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                renderProjectile(obj.scale, 0,
                    items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
            }
        }

        // BUILD ITEM:
        if (obj.buildIndex >= 0) {
            var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
            ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
        }

        // BODY:
        renderCircle(0, 0, obj.scale, ctxt);

        // SKIN:
        if (obj.skinIndex > 0) {
            ctxt.rotate(Math.PI / 2);
            renderTextureSkin(obj.skinIndex, ctxt, null, obj);
        }

    }

    // RENDER NORMAL SKIN
    var skinSprites2 = {};
    var skinPointers2 = {};
    function renderSkin2(index, ctxt, parentSkin, owner) {
        tmpSkin = skinSprites2[index];
        if (!tmpSkin) {
            var tmpImage = new Image();
            tmpImage.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            //tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
            tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
            skinSprites2[index] = tmpImage;
            tmpSkin = tmpImage;
        }
        var _ = parentSkin || skinPointers2[index];
        if (!_) {
            for (var i = 0; i < hats.length; ++i) {
                if (hats[i].id == index) {
                    _ = hats[i];
                    break;
                }
            }
            skinPointers2[index] = _;
        }
        if (tmpSkin.isLoaded)
            ctxt.drawImage(tmpSkin, -_.scale / 2, -_.scale / 2, _.scale, _.scale);
        if (!parentSkin && _.topSprite) {
            ctxt.save();
            ctxt.rotate(owner.skinRot);
            renderSkin2(index + "_top", ctxt, _, owner);
            ctxt.restore();
        }
    }


    // RENDER SKIN:
    function renderTextureSkin(index, ctxt, parentSkin, owner) {
        if (!(tmpSkin = skinSprites[index + (txt ? "lol" : 0)])) {
            var tmpImage = new Image();
            tmpImage.onload = function () {
                this.isLoaded = true,
                    this.onload = null
            }
                ,
                tmpImage.src = getTexturePackImg(index, "hat", index),
                skinSprites[index + (txt ? "lol" : 0)] = tmpImage,
                tmpSkin = tmpImage
        }
        var tmpObj = parentSkin || skinPointers[index];
        if (!tmpObj) {
            for (var i = 0; i < hats.length; ++i) {
                if (hats[i].id == index) {
                    tmpObj = hats[i];
                    break;
                }
            }
            skinPointers[index] = tmpObj;
        }
        if (tmpSkin.isLoaded)
            ctxt.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
        if (!parentSkin && tmpObj.topSprite) {
            ctxt.save();
            ctxt.rotate(owner.skinRot);
            renderSkin(index + "_top", ctxt, tmpObj, owner);
            ctxt.restore();
        }
    }
    var newHatImgs = {
        6: "http://i.imgur.com/L6L0Q0l.png",
        7: "https://i.imgur.com/EBzS6kP.png",
        15: "https://i.imgur.com/YRQ8Ybq.png",
        50: "https://i.imgur.com/tdkcow1.png",
        12: "https://i.imgur.com/uQHU4zc.png",
        40: "https://i.imgur.com/hMdtMlU.png",
        26: "https://i.imgur.com/I0xGtyZ.png",
        55: "https://i.imgur.com/gGGkBnz.png",
        20: "https://i.imgur.com/f5uhWCk.png",
        11: "https://i.imgur.com/yfqME8H.png",
        22: "http://i.imgur.com/CoeJltc.png",
        58: "https://i.imgur.com/uYgDtcZ.png",
        23: "https://i.imgur.com/V8JrIwv.png",
        52: "https://i.imgur.com/hmJrVQz.png",
        53: "https://imgur.com/a/vugtA7z",
    };
    var newAccImgs = {
        18: "http://i.imgur.com/1eGwp3R.png",
        21: "http://i.imgur.com/PvZNc9Q.png",
        19: "https://i.imgur.com/tgfyha4.png",
    };
    var emeraldSprites = {
        "hand axe": "https://i.imgur.com/99Xb4Lm.png",
        bat: "https://i.imgur.com/VlQlb1Z.png",
        "hunting bow": "https://i.imgur.com/2aW8Wmw.png",
        crossbow: "https://i.imgur.com/2JWfFFW.png",
        "repeater crossbow": "https://i.imgur.com/JuLVN8T.png",
        daggers: "https://i.imgur.com/4VedRsh.png",
        "mc grabby": "https://i.imgur.com/F1qfrLj.png",
        "great axe": "https://i.imgur.com/kGbXWqw.png",
        "great hammer": "https://i.imgur.com/6qCSFSZ.png",
        "tool hammer": "https://i.imgur.com/xnVbXSB.png",
        katana: "https://i.imgur.com/AZP6Aci.png",
        stick: "https://i.imgur.com/NbSpR2M.png",
        polearm: "https://i.imgur.com/HtWa9ez.png",
        "short sword": "https://i.imgur.com/gmrPsRk.png",
    };
    var newWeaponImgs = {
        sword_1: "https://i.imgur.com/nzy3kz1.png",
        sword_1_g: "https://i.imgur.com/wOTr8TG.png",
        sword_1_d: "https://i.imgur.com/k3eCuYF.png",
        sword_1_r: "https://i.imgur.com/V9dzAbF.png",
        samurai_1: "https://i.imgur.com/PUTTmVS.png",
        samurai_1_g: "https://i.imgur.com/QKBc2ou.png",
        samurai_1_d: "https://i.imgur.com/4ZxIJQM.png",
        //samurai_1_r: "removed cuz broken...",
        spear_1: "https://i.imgur.com/mcI9MTd.png",
        spear_1_g: "https://i.imgur.com/jKDdyvc.png",
        spear_1_d: "https://i.imgur.com/HSWcyku.png",
        spear_1_r: "https://i.imgur.com/UY7SV7j.png",
        great_hammer_1: "https://i.imgur.com/CVCwqES.png",
        great_hammer_1_d: "https://i.imgur.com/Fg93gj3.png",
        great_hammer_1_r: "https://i.imgur.com/tmUzurk.png",
        bat_1_g: "https://i.imgur.com/ivLPh10.png",
        bat_1_d: "https://i.imgur.com/phXTNsa.png",
        bat_1_r: "https://i.imgur.com/6ayjbIz.png",
        dagger_1_d: "https://i.imgur.com/ROTb7Ks.png",
        dagger_1_r: "https://i.imgur.com/CDAmjux.png",
        stick_1_g: "https://i.imgur.com/NOaBBRd.png",
        stick_1_d: "https://i.imgur.com/RnkmWgs.png",
        stick_1_r: "https://i.imgur.com/aEs3FSU.png",
        great_axe_1_d: "https://i.imgur.com/aAJyHBB.png",
        great_axe_1_r: "https://i.imgur.com/UZ2HcQw.png",
        axe_1_d: "https://i.imgur.com/OU5os0h.png",
        axe_1_r: "https://i.imgur.com/kr8H9g7.png",
        dagger_1_d: "https://i.imgur.com/ROTb7Ks.png",
        dagger_1_r: "https://i.imgur.com/CDAmjux.png",
        hammer_1: "https://i.imgur.com/0XKpSVI.png",
        hammer_1_d: "https://i.imgur.com/WPWU8zC.png",
        hammer_1_r: "https://i.imgur.com/oRXUfW8.png",
        bow_1: "https://i.imgur.com/Dgv1gZm.png",

    };
    var newAnimalImgs = {
        pig_1: "https://i.imgur.com/Nu06zyW.png",
        wolf_2: "https://i.imgur.com/wANrStd.png",
        wolf_1: "https://i.imgur.com/KfFOjKk.png",
        bull_2: "https://i.imgur.com/LwsVi4x.png",
        bull_1: "https://i.imgur.com/eKlFlSj.png",
        chicken_1: "https://i.imgur.com/3dsSBa2.png",
        enemy: "https://i.imgur.com/MKOvEr6.png",
        cow_1: "https://i.imgur.com/7kuCRCr.png",
    };

    function getTexturePackImg(id, type, id2, sprite) {
        if (newHatImgs[id] && type == "hat") {
            return newHatImgs[id];
        } else if (newAccImgs[id] && type == "acc") {
            return newAccImgs[id];
        } else if (newWeaponImgs[id] && type == "weapon") {
            return newWeaponImgs[id];
        } else if (newAnimalImgs[id] && type == "animal") {
            return newAnimalImgs[id];
        } else if (type == "acc") {
            return ".././img/accessories/access_" + id + ".png";
        } else if (type == "hat") {
            return ".././img/hats/hat_" + id + ".png";
        } else if (type == "weapon") {
            return ".././img/weapons/" + id + ".png";
        } else if (type == "animal") {
            return ".././img/animals/" + id + ".png";
        }
    }
    // RENDER SKINS:
    let skinSprites = {};
    let skinPointers = {};
    let tmpSkin;

    function renderSkin(index, ctxt, parentSkin, owner) {
        tmpSkin = skinSprites[index];
        if (!tmpSkin) {
            let tmpImage = new Image();
            tmpImage.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
            skinSprites[index] = tmpImage;
            tmpSkin = tmpImage;
        }
        let _ = parentSkin || skinPointers[index];
        if (!_) {
            for (let i = 0; i < hats.length; ++i) {
                if (hats[i].id == index) {
                    _ = hats[i];
                    break;
                }
            }
            skinPointers[index] = _;
        }
        if (tmpSkin.isLoaded) ctxt.drawImage(tmpSkin, -_.scale / 2, -_.scale / 2, _.scale, _.scale);
        if (!parentSkin && _.topSprite && index != 11) {
            ctxt.save();
            ctxt.rotate(owner.skinRot);
            renderSkin(index + "_top", ctxt, _, owner);
            ctxt.restore();
        }
    }

    // RENDER TAIL:
    var FlareZAcc = {
        18: "http://i.imgur.com/1eGwp3R.png",
        21: "http://i.imgur.com/PvZNc9Q.png",
        19: "https://i.imgur.com/tgfyha4.png",
    };
    function setTailTextureImage(id, type, id2) {
        if (true) {
            if (FlareZAcc[id] && type == "acc") {
                return FlareZAcc[id];
            } else {
                if (type == "acc") {
                    return ".././img/accessories/access_" + id + ".png";
                } else if (type == "hat") {
                    return ".././img/hats/hat_" + id + ".png";
                } else {
                    return ".././img/weapons/" + id + ".png";
                }
            }
        } else {
            if (type == "acc") {
                return ".././img/accessories/access_" + id + ".png";
            } else if (type == "hat") {
                return ".././img/hats/hat_" + id + ".png";
            } else {
                return ".././img/weapons/" + id + ".png";
            }
        }
    }
    function renderTailTextureImage(index, ctxt, owner) {
        if (!(tmpSkin = accessSprites[index + (txt ? "lol" : 0)])) {
            var tmpImage = new Image();
            tmpImage.onload = function () {
                this.isLoaded = true,
                    this.onload = null
            }
                ,
                tmpImage.src = setTailTextureImage(index, "acc"),//".././img/accessories/access_" + index + ".png";
                accessSprites[index + (txt ? "lol" : 0)] = tmpImage,
                tmpSkin = tmpImage;
        }
        var tmpObj = accessPointers[index];
        if (!tmpObj) {
            for (var i = 0; i < accessories.length; ++i) {
                if (accessories[i].id == index) {
                    tmpObj = accessories[i];
                    break;
                }
            }
            accessPointers[index] = tmpObj;
        }
        if (tmpSkin.isLoaded) {
            ctxt.save();
            ctxt.translate(-20 - (tmpObj.xOff || 0), 0);
            if (tmpObj.spin)
                ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
            ctxt.restore();
        }
    }

    let accessSprites = {};
    let accessPointers = {};
    var txt = true;

    function renderTail(index, ctxt, owner) {
        tmpSkin = accessSprites[index];
        if (!tmpSkin) {
            let tmpImage = new Image();
            tmpImage.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            tmpImage.src = "https://moomoo.io/img/accessories/access_" + index + ".png";
            accessSprites[index] = tmpImage;
            tmpSkin = tmpImage;
        }
        let tmpObj = accessPointers[index];
        if (!tmpObj) {
            for (let i = 0; i < accessories.length; ++i) {
                if (accessories[i].id == index) {
                    tmpObj = accessories[i];
                    break;
                }
            }
            accessPointers[index] = tmpObj;
        }
        if (tmpSkin.isLoaded) {
            ctxt.save();
            ctxt.translate(-20 - (tmpObj.xOff || 0), 0);
            if (tmpObj.spin)
                ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
            ctxt.restore();
        }
    }

    var accessSprites2 = {};
    var accessPointers2 = {};
    function renderTail2(index, ctxt, owner) {
        tmpSkin = accessSprites2[index];
        if (!tmpSkin) {
            var tmpImage = new Image();
            tmpImage.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            tmpImage.src = "https://moomoo.io/img/accessories/access_" + index + ".png";
            accessSprites2[index] = tmpImage;
            tmpSkin = tmpImage;
        }
        var tmpObj = accessPointers2[index];
        if (!tmpObj) {
            for (var i = 0; i < accessories.length; ++i) {
                if (accessories[i].id == index) {
                    tmpObj = accessories[i];
                    break;
                }
            }
            accessPointers2[index] = tmpObj;
        }
        if (tmpSkin.isLoaded) {
            ctxt.save();
            ctxt.translate(-20 - (tmpObj.xOff || 0), 0);
            if (tmpObj.spin)
                ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
            ctxt.restore();
        }
    }


    // RENDER TOOL:
    let toolSprites = {};
    function renderTool(obj, variant, x, y, ctxt) {
        let tmpSrc = obj.src + (variant || "");
        let tmpSprite = toolSprites[tmpSrc];
        if (!tmpSprite) {
            tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            };
            //tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
            tmpSprite.src = getTexturePackImg(tmpSrc, "weapon", variant, obj);
            toolSprites[tmpSrc] = tmpSprite;
        }
        if (tmpSprite.isLoaded) ctxt.drawImage(tmpSprite, x + obj.xOff - obj.length / 2, y + obj.yOff - obj.width / 2, obj.length, obj.width);
    }

    // RENDER PROJECTILES:
    function renderProjectiles(layer, xOffset, yOffset) {
        for (let i = 0; i < projectiles.length; i++) {
            tmpObj = projectiles[i];
            if (tmpObj.active && tmpObj.layer == layer && tmpObj.inWindow) {
                tmpObj.update(delta);
                if (tmpObj.active && isOnScreen(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.scale)) {
                    mainContext.save();
                    mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                    mainContext.rotate(tmpObj.dir);
                    renderProjectile(0, 0, tmpObj, mainContext, 1);
                    mainContext.restore();
                }
            }
        };
    }

    // RENDER PROJECTILE:
    let projectileSprites = {};//fz iz zexy

    function renderProjectile(x, y, obj, ctxt, debug) {
        if (obj.src) {
            let tmpSrc = items.projectiles[obj.indx].src;
            let tmpSprite = projectileSprites[tmpSrc];
            if (!tmpSprite) {
                tmpSprite = new Image();
                tmpSprite.onload = function () {
                    this.isLoaded = true;
                }
                tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
                projectileSprites[tmpSrc] = tmpSprite;
            }
            if (tmpSprite.isLoaded)
                ctxt.drawImage(tmpSprite, x - (obj.scale / 2), y - (obj.scale / 2), obj.scale, obj.scale);
        } else if (obj.indx == 1) {
            ctxt.fillStyle = "#939393";
            renderCircle(x, y, obj.scale, ctxt);
        }
    }

    // RENDER AI:
    let aiSprites = {};

    function renderAI(obj, ctxt) {
        let tmpIndx = obj.index;
        let tmpSprite = aiSprites[tmpIndx];
        if (!tmpSprite) {
            let tmpImg = new Image();
            tmpImg.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            tmpImg.src = "https://moomoo.io/img/animals/" + obj.src + ".png";
            tmpSprite = tmpImg;
            aiSprites[tmpIndx] = tmpSprite;
        }
        if (tmpSprite.isLoaded) {
            let tmpScale = obj.scale * 1.2 * (obj.spriteMlt || 1);
            ctxt.drawImage(tmpSprite, -tmpScale, -tmpScale, tmpScale * 2, tmpScale * 2);
        }
    }

    // RENDER WATER BODIES:
    function renderWaterBodies(xOffset, yOffset, ctxt, padding) {

        // MIDDLE RIVER:
        let tmpW = config.riverWidth + padding;
        let tmpY = (config.mapScale / 2) - yOffset - (tmpW / 2);
        if (tmpY < maxScreenHeight && tmpY + tmpW > 0) {
            ctxt.fillRect(0, tmpY, maxScreenWidth, tmpW);
        }
    }

    let isNight = true;
    // RENDER GAME OBJECTS:
    let gameObjectSprites = {};
    function getResSprite(obj) {
        let biomeID = (obj.y >= config.mapScale - config.snowBiomeTop) ? 2 : ((obj.y <= config.snowBiomeTop) ? 1 : 0);
        let tmpIndex = (obj.type + "_" + obj.scale + "_" + biomeID);
        let tmpSprite = gameObjectSprites[tmpIndex];
        if (!tmpSprite) {
            let blurScale = 15;
            let tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.1) + outlineWidth;
            let tmpContext = tmpCanvas.getContext('2d');
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
            tmpContext.rotate(UTILS.randFloat(0, Math.PI));
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth;
            if (isNight) {
                tmpContext.shadowBlur = blurScale;
                tmpContext.shadowColor = `rgba(0, 0, 0, ${obj.alpha})`;
            }
            if (obj.type == 0) {
                let tmpScale;
                let tmpCount = UTILS.randInt(5, 7);
                tmpContext.globalAlpha = isNight ? 0.6 : 0.8;
                for (let i = 0; i < 2; ++i) {
                    tmpScale = tmpObj.scale * (!i ? 1 : 0.5);
                    renderBlob(tmpContext, tmpCount, tmpScale, tmpScale * 0.7);
                    tmpContext.fillStyle = (obj.y >= config.mapScale - config.snowBiomeTop) ? (!i ? "#e3b5a7" : "#fcc9b9") : !biomeID ? (!i ? "#e3b5a7" : "#fcc9b9") : (!i ? "#e3f1f4" : "#fff");
                    tmpContext.fill();
                    if (!i) {
                        tmpContext.stroke();
                        tmpContext.shadowBlur = null;
                        tmpContext.shadowColor = null;
                        tmpContext.globalAlpha = 1;
                    }
                }
            } else if (obj.type == 1) {
                renderBlob(tmpContext, 6, tmpObj.scale, tmpObj.scale * 0.7);
                tmpContext.fillStyle = biomeID == 2 ? "#e3b5a7" : (biomeID ? "#e3f1f4" : "#89a54c");
                tmpContext.fill();
                tmpContext.stroke();

                //tmpContext.shadowBlur = null;
                //tmpContext.shadowColor = null;

                tmpContext.fillStyle = biomeID == 2 ? "#fcc9b9" : (biomeID ? "#6a64af" : "#c15555");
                let tmpRange;
                let berries = 4;
                let rotVal = (Math.PI * 2) / berries;
                for (let i = 0; i < berries; ++i) {
                    tmpRange = UTILS.randInt(tmpObj.scale / 3.5, tmpObj.scale / 2.3);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(10, 12), tmpContext);
                }
            } else if (obj.type == 2 || obj.type == 3) {
                tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#938d77" : "#939393") : "#e0c655";
                renderStar(tmpContext, 3, obj.scale, obj.scale);
                tmpContext.fill();
                tmpContext.stroke();

                tmpContext.shadowBlur = null;
                tmpContext.shadowColor = null;

                tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#b2ab90" : "#bcbcbc") : "#ebdca3";
                renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
                tmpContext.fill();
            }
            tmpSprite = tmpCanvas;
            gameObjectSprites[tmpIndex] = tmpSprite;
        }
        return tmpSprite;
    }
    // GET ITEM SPRITE:
    let itemSprites = [];

    function getItemSprite(obj, asIcon) {
        let tmpSprite = itemSprites[obj.id];
        if (!tmpSprite || asIcon) {
            let blurScale = !asIcon ? 20 : 5;
            let tmpCanvas = document.createElement("canvas");
            let reScale = ((!asIcon && obj.name == "windmill") ? items.list[4].scale : obj.scale);
            tmpCanvas.width = tmpCanvas.height = (reScale * 2.5) + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;

            let tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
            tmpContext.rotate(asIcon ? 0 : (Math.PI / 2));
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth * (asIcon ? (tmpCanvas.width / 81) : 1);
            if (!asIcon) {
                tmpContext.shadowBlur = 8;
                tmpContext.shadowColor = `rgba(0, 0, 0, 0.2)`;
            }

            if (obj.name == "apple") {
                tmpContext.fillStyle = "#c15555";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#89a54c";
                let leafDir = -(Math.PI / 2);
                renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir),
                    25, leafDir + Math.PI / 2, tmpContext);
            } else if (obj.name == "cookie") {
                tmpContext.fillStyle = "#cca861";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#937c4b";
                let chips = 4;
                let rotVal = (Math.PI * 2) / chips;
                let tmpRange;
                for (let i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                        UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "cheese") {
                tmpContext.fillStyle = "#f4f3ac";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#c3c28b";
                let chips = 4;
                let rotVal = (Math.PI * 2) / chips;
                let tmpRange;
                for (let i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                        UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
                tmpContext.fillStyle = (obj.name == "castle wall") ? "#83898e" : (obj.name == "wood wall") ?
                    "#a5974c" : "#939393";
                let sides = (obj.name == "castle wall") ? 4 : 3;
                renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = (obj.name == "castle wall") ? "#9da4aa" : (obj.name == "wood wall") ?
                    "#c9b758" : "#bcbcbc";
                renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" ||
                obj.name == "spinning spikes") {
                const isPlayer = obj.owner && obj.owner.sid === player?.sid;
                const isTeam = obj.owner && !isPlayer && obj.isTeamObject && obj.isTeamObject(player);
                tmpContext.fillStyle = (isPlayer || isTeam) ? "#86A7D8" : (obj.isTeamObject && !obj.isTeamObject(player)) ? "#D99292" : "#939393";
                let tmpScale = (obj.scale * 0.6);
                renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, obj.scale, tmpScale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, tmpScale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderCircle(0, 0, tmpScale / 2, tmpContext, true);
            } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, reScale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderRectCircle(0, 0, reScale * 1.5, 29, 4, tmpContext);
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, reScale * 0.5, tmpContext);
            } else if (obj.name == "mine") {
                tmpContext.fillStyle = "#939393";
                renderStar(tmpContext, 3, obj.scale, obj.scale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#bcbcbc";
                renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "sapling") {
                for (let i = 0; i < 2; ++i) {
                    let tmpScale = obj.scale * (!i ? 1 : 0.5);
                    renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                    tmpContext.fillStyle = (!i ? "#9ebf57" : "#b4db62");
                    tmpContext.fill();
                    if (!i) tmpContext.stroke();
                }
            } else if (obj.name == "pit trap") {
                tmpContext.fillStyle = "#a5974c";
                renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = outlineColor;
                renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "boost pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#dbd97d";
                renderTriangle(obj.scale * 1, tmpContext);
            } else if (obj.name == "turret") {
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#939393";
                let tmpLen = 50;
                renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
                renderCircle(0, 0, obj.scale * 0.6, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
            } else if (obj.name == "platform") {
                tmpContext.fillStyle = "#cebd5f";
                let tmpCount = 4;
                let tmpS = obj.scale * 2;
                let tmpW = tmpS / tmpCount;
                let tmpX = -(obj.scale / 2);
                for (let i = 0; i < tmpCount; ++i) {
                    renderRect(tmpX - (tmpW / 2), 0, tmpW, obj.scale * 2, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpX += tmpS / tmpCount;
                }
            } else if (obj.name == "healing pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#db6e6e";
                renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
            } else if (obj.name == "spawn pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#71aad6";
                renderCircle(0, 0, obj.scale * 0.6, tmpContext);
            } else if (obj.name == "blocker") {
                tmpContext.fillStyle = "#7e7f82";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.rotate(Math.PI / 4);
                tmpContext.fillStyle = "#db6e6e";
                renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
            } else if (obj.name == "teleporter") {
                tmpContext.fillStyle = "#7e7f82";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.rotate(Math.PI / 4);
                tmpContext.fillStyle = "#d76edb";
                renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
            }
            tmpSprite = tmpCanvas;
            if (!asIcon)
                itemSprites[obj.id] = tmpSprite;
        }
        return tmpSprite;
    }

    function getItemSprite2(obj, tmpX, tmpY) {
        let tmpContext = mainContext;
        let reScale = (obj.name == "windmill" ? items.list[4].scale : obj.scale);
        tmpContext.save();
        tmpContext.translate(tmpX, tmpY);
        tmpContext.rotate(obj.dir);
        tmpContext.strokeStyle = outlineColor;
        tmpContext.lineWidth = outlineWidth;
        if (obj.name == "apple") {
            tmpContext.fillStyle = "#c15555";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#89a54c";
            let leafDir = -(Math.PI / 2);
            renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir),
                25, leafDir + Math.PI / 2, tmpContext);
        } else if (obj.name == "cookie") {
            tmpContext.fillStyle = "#cca861";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#937c4b";
            let chips = 4;
            let rotVal = (Math.PI * 2) / chips;
            let tmpRange;
            for (let i = 0; i < chips; ++i) {
                tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                    UTILS.randInt(4, 5), tmpContext, true);
            }
        } else if (obj.name == "cheese") {
            tmpContext.fillStyle = "#f4f3ac";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#c3c28b";
            let chips = 4;
            let rotVal = (Math.PI * 2) / chips;
            let tmpRange;
            for (let i = 0; i < chips; ++i) {
                tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                    UTILS.randInt(4, 5), tmpContext, true);
            }
        } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
            tmpContext.fillStyle = (obj.name == "castle wall") ? "#83898e" : (obj.name == "wood wall") ?
                "#a5974c" : "#939393";
            let sides = (obj.name == "castle wall") ? 4 : 3;
            renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = (obj.name == "castle wall") ? "#9da4aa" : (obj.name == "wood wall") ?
                "#c9b758" : "#bcbcbc";
            renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" ||
            obj.name == "spinning spikes") {
            const isPlayer = obj.owner && obj.owner.sid === player?.sid;
            const isTeam = obj.owner && !isPlayer && obj.isTeamObject && obj.isTeamObject(player);
            tmpContext.fillStyle = (isPlayer || isTeam) ? "#86A7D8" : (obj.isTeamObject && !obj.isTeamObject(player)) ? "#D99292" : "#939393";
            let tmpScale = (obj.scale * 0.6);
            renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, obj.scale, tmpScale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, tmpScale, tmpContext);
            tmpContext.fillStyle = "#c9b758";
            renderCircle(0, 0, tmpScale / 2, tmpContext, true);
        } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, reScale, tmpContext);
            tmpContext.fillStyle = "#c9b758";
            renderRectCircle(0, 0, reScale * 1.5, 29, 4, tmpContext);
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, reScale * 0.5, tmpContext);
        } else if (obj.name == "mine") {
            tmpContext.fillStyle = "#939393";
            renderStar(tmpContext, 3, obj.scale, obj.scale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#bcbcbc";
            renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
            tmpContext.fill();
        } else if (obj.name == "sapling") {
            for (let i = 0; i < 2; ++i) {
                let tmpScale = obj.scale * (!i ? 1 : 0.5);
                renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                tmpContext.fillStyle = (!i ? "#9ebf57" : "#b4db62");
                tmpContext.fill();
                if (!i) tmpContext.stroke();
            }
        } else if (obj.name == "pit trap") {
            tmpContext.fillStyle = "#a5974c";
            renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = outlineColor;
            renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        } else if (obj.name == "boost pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#dbd97d";
            renderTriangle(obj.scale * 1, tmpContext);
        } else if (obj.name == "turret") {
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#939393";
            let tmpLen = 50;
            renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
            renderCircle(0, 0, obj.scale * 0.6, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
        } else if (obj.name == "platform") {
            tmpContext.fillStyle = "#cebd5f";
            let tmpCount = 4;
            let tmpS = obj.scale * 2;
            let tmpW = tmpS / tmpCount;
            let tmpX = -(obj.scale / 2);
            for (let i = 0; i < tmpCount; ++i) {
                renderRect(tmpX - (tmpW / 2), 0, tmpW, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpX += tmpS / tmpCount;
            }
        } else if (obj.name == "healing pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#db6e6e";
            renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
        } else if (obj.name == "spawn pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#71aad6";
            renderCircle(0, 0, obj.scale * 0.6, tmpContext);
        } else if (obj.name == "blocker") {
            tmpContext.fillStyle = "#7e7f82";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.rotate(Math.PI / 4);
            tmpContext.fillStyle = "#db6e6e";
            renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
        } else if (obj.name == "teleporter") {
            tmpContext.fillStyle = "#7e7f82";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.rotate(Math.PI / 4);
            tmpContext.fillStyle = "#d76edb";
            renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
        }
        tmpContext.restore();
    }

    let objSprites = [];

    function getObjSprite(obj) {
        let tmpSprite = objSprites[obj.id];
        if (!tmpSprite) {
            // let blurScale = isNight ? 20 : 0;
            let tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = obj.scale * 2.5 + outlineWidth + (items.list[obj.id].spritePadding || 0) + 0;
            let tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
            tmpContext.rotate(Math.PI / 2);
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth;
            // if (isNight) {
            //     tmpContext.shadowBlur = 20;
            //     tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(0.3, obj.alpha)})`;
            // }
            if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
                const isPlayer = obj.owner && obj.owner.sid === player?.sid;
                const isTeam = obj.owner && !isPlayer && obj.isTeamObject && obj.isTeamObject(player);
                tmpContext.fillStyle = (isPlayer || isTeam) ? "#86A7D8" : (obj.isTeamObject && !obj.isTeamObject(player)) ? "#D99292" : "#939393";
                let tmpScale = obj.scale * 0.6;
                renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, tmpScale, tmpContext);
                tmpContext.fillStyle = "#cc5151";
                renderCircle(0, 0, tmpScale / 2, tmpContext, true);
            } else if (obj.name == "pit trap") {
                tmpContext.fillStyle = "#a5974c";
                renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#cc5151";
                renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
                tmpContext.fill();
            }
            tmpSprite = tmpCanvas;
            objSprites[obj.id] = tmpSprite;
        }
        return tmpSprite;
    }

    // GET MARK SPRITE:
    function getMarkSprite(obj, tmpContext, tmpX, tmpY) {
        let center = {
            x: screenWidth / 2,
            y: screenHeight / 2,
        };
        tmpContext.lineWidth = outlineWidth;
        mainContext.globalAlpha = 0.2;
        tmpContext.strokeStyle = outlineColor;
        tmpContext.save();
        tmpContext.translate(tmpX, tmpY);
        tmpContext.rotate(90 ** 10);
        if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
            const isPlayer = obj.owner && obj.owner.sid === player?.sid;
            const isTeam = obj.owner && !isPlayer && obj.isTeamObject && obj.isTeamObject(player);
            tmpContext.fillStyle = (isPlayer || isTeam) ? "#86A7D8" : (obj.isTeamObject && !obj.isTeamObject(player)) ? "#D99292" : "#939393";
            var tmpScale = (obj.scale);
            renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, obj.scale, tmpScale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, tmpScale, tmpContext);
            if (player && obj.owner && player.sid != obj.owner.sid && !tmpObj.findAllianceBySid(obj.owner.sid)) {
                tmpContext.fillStyle = "#a34040";
            } else {
                tmpContext.fillStyle = "#c9b758";
            }
            renderCircle(0, 0, tmpScale / 2, tmpContext, true);
        } else if (obj.name == "turret") {
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#939393";
            let tmpLen = 50;
            renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
            renderCircle(0, 0, obj.scale * 0.6, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
        } else if (obj.name == "teleporter") {
            tmpContext.fillStyle = "#7e7f82";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.rotate(Math.PI / 4);
            tmpContext.fillStyle = "#d76edb";
            renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
        } else if (obj.name == "platform") {
            tmpContext.fillStyle = "#cebd5f";
            let tmpCount = 4;
            let tmpS = obj.scale * 2;
            let tmpW = tmpS / tmpCount;
            let tmpX = -(obj.scale / 2);
            for (let i = 0; i < tmpCount; ++i) {
                renderRect(tmpX - (tmpW / 2), 0, tmpW, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpX += tmpS / tmpCount;
            }
        } else if (obj.name == "healing pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#db6e6e";
            renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
        } else if (obj.name == "spawn pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#71aad6";
            renderCircle(0, 0, obj.scale * 0.6, tmpContext);
        } else if (obj.name == "blocker") {
            tmpContext.fillStyle = "#7e7f82";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.rotate(Math.PI / 4);
            tmpContext.fillStyle = "#db6e6e";
            renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
        } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#c9b758";
            renderRectCircle(0, 0, obj.scale * 1.5, 29, 4, tmpContext);
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, obj.scale * 0.5, tmpContext);

        } else if (obj.name == "pit trap") {
            tmpContext.fillStyle = "#a5974c";
            renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            if (player && obj.owner && player.sid != obj.owner.sid && !tmpObj.findAllianceBySid(obj.owner.sid)) {
                tmpContext.fillStyle = "#a34040";
            } else {
                tmpContext.fillStyle = outlineColor;
            }
            renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpContext.restore();
    }

    // OBJECT ON SCREEN:
    function isOnScreen(x, y, s) {
        return (x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && (y,
            s,
            maxScreenHeight));
    }
    // RENDER GAME OBJECTS:
    function renderGameObjects(layer, xOffset, yOffset) {
        let tmpSprite;
        let tmpX;
        let tmpY;
        liztobj.forEach((tmp) => {
            tmpObj = tmp;
            if (tmpObj.active && liztobj.includes(tmp) && tmpObj.render) {
                tmpX = tmpObj.x + tmpObj.xWiggle - xOffset;
                tmpY = tmpObj.y + tmpObj.yWiggle - yOffset;
                if (layer == 0) {
                    tmpObj.update(delta);
                }
                if (tmpObj.layer == layer && isOnScreen(tmpX, tmpY, tmpObj.scale + (tmpObj.blocker || 0))) {
                    mainContext.globalAlpha = tmpObj.hideFromEnemy ? 0.6 : 1;
                    if (tmpObj.isItem) {
                        if ((tmpObj.dmg || tmpObj.trap) && !tmpObj.isTeamObject(player)) {
                            tmpSprite = getObjSprite(tmpObj);
                        } else {
                            tmpSprite = getItemSprite(tmpObj);
                        }

                        mainContext.save();
                        mainContext.translate(tmpX, tmpY);
                        mainContext.rotate(tmpObj.dir);
                        if (!tmpObj.active) {
                            mainContext.scale(tmpObj.visScale / tmpObj.scale, tmpObj.visScale / tmpObj.scale);
                        }
                        mainContext.drawImage(tmpSprite, -(tmpSprite.width / 2), -(tmpSprite.height / 2));

                        if (tmpObj.blocker) {
                            mainContext.strokeStyle = "#db6e6e";
                            mainContext.globalAlpha = 0.3;
                            mainContext.lineWidth = 6;
                            renderCircle(0, 0, tmpObj.blocker, mainContext, false, true);
                        }
                        mainContext.restore();
                    } else {
                        tmpSprite = getResSprite(tmpObj);
                        mainContext.drawImage(tmpSprite, tmpX - (tmpSprite.width / 2), tmpY - (tmpSprite.height / 2));
                    }
                }
            }
        });
        // PLACE VISIBLE:
        if (layer == 0) {
            if (placeVisible.length) {
                placeVisible.forEach((places) => {
                    tmpX = places.x - xOffset;
                    tmpY = places.y - yOffset;
                    markObject(places, tmpX, tmpY);
                });
            }
        }
    }

    function markObject(tmpObj, tmpX, tmpY) {
        getMarkSprite(tmpObj, mainContext, tmpX, tmpY);
    }
    // RENDER MINIMAP:
    class MapPing {
        constructor(color, scale) {
            this.init = function (x, y) {
                this.scale = 0;
                this.x = x;
                this.y = y;
                this.active = true;
            };
            this.update = function (ctxt, delta) {
                if (this.active) {
                    this.scale += 0.05 * delta;
                    if (this.scale >= scale) {
                        this.active = false;
                    } else {
                        ctxt.globalAlpha = (1 - Math.max(0, this.scale / scale));
                        ctxt.beginPath();
                        ctxt.arc((this.x / config.mapScale) * mapDisplay.width, (this.y / config.mapScale) *
                            mapDisplay.width, this.scale, 0, 2 * Math.PI);
                        ctxt.stroke();
                    }
                }
            };
            this.color = color;
        }
    }

    function pingMap(x, y) {
        tmpPing = mapPings.find(pings => !pings.active);
        if (!tmpPing) {
            tmpPing = new MapPing("#fff", config.mapPingScale);
            mapPings.push(tmpPing);
        }
        tmpPing.init(x, y);
    }

    function updateMapMarker() {
        mapMarker.x = player.x;
        mapMarker.y = player.y;
    }

    function renderMinimap(delta) {
        if (player && player.alive) {
            mapContext.clearRect(0, 0, mapDisplay.width, mapDisplay.height);

            // RENDER PINGS:
            mapContext.lineWidth = 4;
            for (let i = 0; i < mapPings.length; ++i) {
                tmpPing = mapPings[i];
                mapContext.strokeStyle = tmpPing.color;
                tmpPing.update(mapContext, delta);
            }

            // RENDER BREAK TRACKS:
            mapContext.globalAlpha = 1;
            mapContext.fillStyle = "#ff0000";
            if (breakTrackers.length) {
                mapContext.fillStyle = "#abcdef";
                mapContext.font = "34px HammerSmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                for (let i = 0; i < breakTrackers.length;) {
                    mapContext.fillText("!", (breakTrackers[i].x / config.mapScale) * mapDisplay.width,
                        (breakTrackers[i].y / config.mapScale) * mapDisplay.height);
                    i += 2;
                }
            }

            // RENDER PLAYERS:
            mapContext.globalAlpha = 1;
            mapContext.fillStyle = "#fff";
            renderCircle((player.x / config.mapScale) * mapDisplay.width,
                (player.y / config.mapScale) * mapDisplay.height, 7, mapContext, true);
            mapContext.fillStyle = "rgba(255,255,255,0.35)";
            if (player.team && minimapData) {
                for (let i = 0; i < minimapData.length;) {
                    renderCircle((minimapData[i] / config.mapScale) * mapDisplay.width,
                        (minimapData[i + 1] / config.mapScale) * mapDisplay.height, 7, mapContext, true);
                    i += 2;
                }
            }

            // RENDER BOTS:
            if (bots.length) {
                bots.forEach((tmp) => {
                    if (tmp.inGame) {
                        mapContext.globalAlpha = 1;
                        mapContext.strokeStyle = "#cc5151";
                        renderCircle((tmp.x2 / config.mapScale) * mapDisplay.width,
                            (tmp.y2 / config.mapScale) * mapDisplay.height, 7, mapContext, false, true);
                    }
                });
            }
            let xOffset = camX - maxScreenWidth / 2;
            let yOffset = camY - maxScreenHeight / 2;
            // VOLCANO SPAWNPOINT ZONE:
            if (configs.volcanozones) {
                mainContext.globalAlpha = 0.25;
                mainContext.fillStyle = "#ff0000";
                mainContext.lineWidth = 10;

                let x = 12500 - xOffset;
                let y = 12500 - yOffset;
                let width = 500;
                let height = 500;
                let radius = 10;

                mainContext.beginPath();
                mainContext.moveTo(x + radius, y);
                mainContext.arcTo(x + width, y, x + width, y + height, radius);
                mainContext.arcTo(x + width, y + height, x, y + height, radius);
                mainContext.arcTo(x, y + height, x, y, radius);
                mainContext.arcTo(x, y, x + width, y, radius);
                mainContext.closePath();

                mainContext.fill();
            }
            // VOLCANO POISON ZONE:
            if (configs.volcanozones) {
                mainContext.globalAlpha = 0.05;
                mainContext.strokeStyle = "#000";
                mainContext.fillStyle = "#000";
                mainContext.lineWidth = 10;

                let x = 12500 - xOffset;
                let y = 12500 - yOffset;
                let width = 1900;
                let height = 1900;
                let radius = 1;

                mainContext.beginPath();
                mainContext.moveTo(x + radius, y);
                mainContext.arcTo(x + width, y, x + width, y + height, radius);
                mainContext.arcTo(x + width, y + height, x, y + height, radius);
                mainContext.arcTo(x, y + height, x, y, radius);
                mainContext.arcTo(x, y, x + width, y, radius);
                mainContext.closePath();

                mainContext.fill();
                mainContext.stroke();
            }
            // DEATH LOCATION:
            if (lastDeath) {
                mapContext.fillStyle = "#fc5553";
                mapContext.font = "34px HammerSmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("x", (lastDeath.x / config.mapScale) * mapDisplay.width,
                    (lastDeath.y / config.mapScale) * mapDisplay.height);
            }

            // MAP MARKER:
            if (mapMarker) {
                mapContext.fillStyle = "#fff";
                mapContext.font = "34px HammerSmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("x", (mapMarker.x / config.mapScale) * mapDisplay.width,
                    (mapMarker.y / config.mapScale) * mapDisplay.height);
            }
        }
    }
    // ICONS:
    let crossHairs = ["https://upload.wikimedia.org/wikipedia/commons/9/95/Crosshairs_Red.svg", "https://upload.wikimedia.org/wikipedia/commons/9/95/Crosshairs_Red.svg"];
    let crossHairSprites = {};
    let iconSprites = {};
    let icons = ["crown", "skull"];
    function loadIcons() {
        for (let i = 0; i < icons.length; ++i) {
            let tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            };
            tmpSprite.src = "./../img/icons/" + icons[i] + ".png";
            iconSprites[icons[i]] = tmpSprite;
        }
        for (let i = 0; i < crossHairs.length; ++i) {
            let tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            };
            tmpSprite.src = crossHairs[i];
            crossHairSprites[i] = tmpSprite;
        }
    }
    loadIcons();
    function cdf(e, t) {
        try {
            return Math.hypot((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
        } catch (e) {
            return Infinity;
        }
    }
    // UPDATE GAME:
    function updateGame() {
        if (gameObjects.length && inGame) {
            gameObjects.forEach((tmp) => {
                if (UTILS.getDistance(tmp.x, tmp.y, player.x, player.y) <= 1200) {
                    if (!liztobj.includes(tmp)) {
                        liztobj.push(tmp);
                        tmp.render = true;
                    }
                } else {
                    if (liztobj.includes(tmp)) {
                        if (UTILS.getDistance(tmp.x, tmp.y, player.x, player.y) >= 1200) {
                            tmp.render = false;
                            const index = liztobj.indexOf(tmp);
                            if (index > -1) { // only splice array when item is found
                                liztobj.splice(index, 1); // 2nd parameter means remove one item only
                            }
                        }
                    } else if (UTILS.getDistance(tmp.x, tmp.y, player.x, player.y) >= 1200) {
                        tmp.render = false;
                        const index = liztobj.indexOf(tmp);
                        if (index > -1) { // only splice array when item is found
                            liztobj.splice(index, 1); // 2nd parameter means remove one item only
                        }
                    } else {
                        tmp.render = false;
                        const index = liztobj.indexOf(tmp);
                        if (index > -1) { // only splice array when item is found
                            liztobj.splice(index, 1); // 2nd parameter means remove one item only
                        }
                    }
                }
            })
            // gameObjects = gameObjects.filter(e => UTILS.getDistance(e.x, e.y, player.x, player.y) <= 1000)
        }

        // if (config.resetRender) {
        mainContext.beginPath();
        mainContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
        // }
        mainContext.globalAlpha = 1;

        // MOVE CAMERA:
        if (player) {
            if (false) {
                camX = player.x;
                camY = player.y;
            } else {
                let tmpDist = UTILS.getDistance(camX, camY, player.x, player.y);
                let tmpDir = UTILS.getDirection(player.x, player.y, camX, camY);
                let camSpd = Math.min(tmpDist * 0.0045 * delta, tmpDist);
                if (tmpDist > 0.05) {
                    camX += camSpd * Math.cos(tmpDir);
                    camY += camSpd * Math.sin(tmpDir);
                } else {
                    camX = player.x;
                    camY = player.y;
                }
            }
        } else {
            camX = config.mapScale / 2 + config.riverWidth;
            camY = config.mapScale / 2;
        }
        // PATHFINDER LINE
        if (pathFind.active) {
            if (pathFind.array && (pathFind.chaseNear ? enemy.length : true)) {
                mainContext.lineWidth = player.scale / 5;
                mainContext.globalAlpha = 1;
                mainContext.strokeStyle = "red";
                mainContext.beginPath();
                pathFind.array.forEach((path, i) => {
                    let pathXY = {
                        x: (pathFind.scale / pathFind.grid) * path.x,
                        y: (pathFind.scale / pathFind.grid) * path.y
                    }
                    let render = {
                        x: ((player.x2 - (pathFind.scale / 2)) + pathXY.x) - xOffset,
                        y: ((player.y2 - (pathFind.scale / 2)) + pathXY.y) - yOffset
                    }
                    if (i == 0) {
                        mainContext.moveTo(render.x, render.y);
                    } else {
                        mainContext.lineTo(render.x, render.y);
                    }
                });
                mainContext.stroke();
            }
        }
        // INTERPOLATE PLAYERS AND AI:
        let lastTime = now - (1000 / config.serverUpdateRate);
        let tmpDiff;
        for (let i = 0; i < players.length + ais.length; ++i) {
            tmpObj = players[i] || ais[i - players.length];
            if (tmpObj && tmpObj.visible) {
                if (tmpObj.forcePos) {
                    tmpObj.x = tmpObj.x2;
                    tmpObj.y = tmpObj.y2;
                    tmpObj.dir = tmpObj.d2;
                } else {
                    let total = tmpObj.t2 - tmpObj.t1;
                    let fraction = lastTime - tmpObj.t1;
                    let ratio = (fraction / total);
                    let rate = 170;
                    tmpObj.dt += delta;
                    let tmpRate = Math.min(1.7, tmpObj.dt / rate);
                    tmpDiff = (tmpObj.x2 - tmpObj.x1);
                    tmpObj.x = tmpObj.x1 + (tmpDiff * tmpRate);
                    tmpDiff = (tmpObj.y2 - tmpObj.y1);
                    tmpObj.y = tmpObj.y1 + (tmpDiff * tmpRate);
                    if (config.anotherVisual) {
                        tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
                    } else {
                        tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
                    }
                }
            }
        }

        // INTERPOLATE Ci:
        for (let i = 0; i < Ci.length; ++i) {
            tmpObj = Ci[i];
            if (tmpObj && tmpObj.deathAnim) {
                if (tmpObj.forcePos) {
                    tmpObj.x = tmpObj.x2;
                    tmpObj.y = tmpObj.y2;
                    tmpObj.dir = tmpObj.d2;
                } else {
                    let total = tmpObj.t2 - tmpObj.t1;
                    let fraction = lastTime - tmpObj.t1;
                    let ratio = (fraction / total);
                    let rate = 170;
                    tmpObj.dt += delta;
                    let tmpRate = Math.min(1.7, tmpObj.dt / rate);
                    let tmpDiff = (tmpObj.x2 - tmpObj.x1);
                    tmpObj.x = tmpObj.x1 + (tmpDiff * tmpRate);
                    tmpDiff = (tmpObj.y2 - tmpObj.y1);
                    tmpObj.y = tmpObj.y1 + (tmpDiff * tmpRate);
                    tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
                }
            }
        }

        h3(delta);

        // RENDER CORDS:
        let xOffset = camX - (maxScreenWidth / 2);
        let yOffset = camY - (maxScreenHeight / 2);

        // RENDER BACKGROUND:
        if (config.snowBiomeTop - yOffset <= 0 && config.mapScale - config.snowBiomeTop - yOffset >= maxScreenHeight) {
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.mapScale - config.snowBiomeTop - yOffset <= 0) {
            mainContext.fillStyle = "#dbc666";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.snowBiomeTop - yOffset >= maxScreenHeight) {
            mainContext.fillStyle = "#fff";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.snowBiomeTop - yOffset >= 0) {
            mainContext.fillStyle = "#fff";
            mainContext.fillRect(0, 0, maxScreenWidth, config.snowBiomeTop - yOffset);
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, config.snowBiomeTop - yOffset, maxScreenWidth,
                maxScreenHeight - (config.snowBiomeTop - yOffset));
        } else {
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, 0, maxScreenWidth,
                (config.mapScale - config.snowBiomeTop - yOffset));
            mainContext.fillStyle = "#dbc666";
            mainContext.fillRect(0, (config.mapScale - config.snowBiomeTop - yOffset), maxScreenWidth,
                maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset));
        }

        // RENDER WATER AREAS:
        if (!firstSetup) {
            waterMult += waterPlus * config.waveSpeed * delta;
            if (waterMult >= config.waveMax) {
                waterMult = config.waveMax;
                waterPlus = -1;
            } else if (waterMult <= 1) {
                waterMult = waterPlus = 1;
            }
            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#dbc666";
            renderWaterBodies(xOffset, yOffset, mainContext, config.riverPadding);
            mainContext.fillStyle = "#91b2db";
            renderWaterBodies(xOffset, yOffset, mainContext, (waterMult - 1) * 250);
        }

        // RENDER DEAD PLAYERS:
        mainContext.globalAlpha = 1;
        mainContext.strokeStyle = outlineColor;
        renderDeadPlayers(xOffset, yOffset);

        // RENDER BOTTOM LAYER:
        mainContext.globalAlpha = 1;
        mainContext.strokeStyle = outlineColor;
        renderGameObjects(-1, xOffset, yOffset);

        // RENDER PROJECTILES:
        mainContext.globalAlpha = 1;
        mainContext.lineWidth = outlineWidth;
        renderProjectiles(0, xOffset, yOffset);

        // RENDER PLAYERS:
        renderPlayers(xOffset, yOffset, 0);

        // RENDER AI:
        mainContext.globalAlpha = 1;
        for (let i = 0; i < ais.length; ++i) {
            tmpObj = ais[i];
            if (tmpObj.active && tmpObj.visible) {
                tmpObj.animate(delta);
                mainContext.save();
                mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                mainContext.rotate(tmpObj.dir + tmpObj.dirPlus - (Math.PI / 2));
                renderAI(tmpObj, mainContext);
                mainContext.restore();
            }
        }

        // RENDER GAME OBJECTS (LAYERED):
        renderGameObjects(0, xOffset, yOffset);
        renderProjectiles(1, xOffset, yOffset);
        renderGameObjects(1, xOffset, yOffset);
        renderPlayers(xOffset, yOffset, 1);
        renderGameObjects(2, xOffset, yOffset);
        renderGameObjects(3, xOffset, yOffset);
        // RENDER KB POS:
        let spikeKB = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 0) <= (near.scale + tmp.scale + 65)).sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2))[0];
        if (nears.length) {
            let knockbackPotential = kbPotential(player, near, spikeKB);
            kbPoten = {
                x: near.predictMove?.x,
                y: near.predictMove?.y
            };
        } else {
            kbPoten = null;
        }

        if (kbPoten) {
            mainContext.beginPath();
            mainContext.strokeStyle = "#000";
            mainContext.fillStyle = "#000";
            mainContext.globalAlpha = 0.3;
            mainContext.save();
            mainContext.translate(kbPoten.x - xOffset, kbPoten.y - yOffset);
            mainContext.rotate(player.dir + player.dirPlus);
            renderPlayer(player, mainContext);
            mainContext.restore();
        }
        // MAP BOUNDARIES:
        mainContext.fillStyle = "#000";
        mainContext.globalAlpha = 0.09;
        if (xOffset <= 0) {
            mainContext.fillRect(0, 0, -xOffset, maxScreenHeight);
        }
        if (config.mapScale - xOffset <= maxScreenWidth) {
            let tmpY = Math.max(0, -yOffset);
            mainContext.fillRect(config.mapScale - xOffset, tmpY, maxScreenWidth - (config.mapScale - xOffset), maxScreenHeight - tmpY);
        }
        if (yOffset <= 0) {
            mainContext.fillRect(-xOffset, 0, maxScreenWidth + xOffset, -yOffset);
        }
        if (config.mapScale - yOffset <= maxScreenHeight) {
            let tmpX = Math.max(0, -xOffset);
            let tmpMin = 0;
            if (config.mapScale - xOffset <= maxScreenWidth)
                tmpMin = maxScreenWidth - (config.mapScale - xOffset);
            mainContext.fillRect(tmpX, config.mapScale - yOffset,
                (maxScreenWidth - tmpX) - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
        }

        // RENDER DAY/NIGHT TIME:
        mainContext.globalAlpha = 1;
        mainContext.fillStyle = "rgb(0, 0, 70, 0.67)"; // 67
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);

        // RENDER PLAYER AND AI UI:
        mainContext.strokeStyle = darkOutlineColor;
        mainContext.globalAlpha = 1;

        for (let i = 0; i < players.length + ais.length; ++i) {
            tmpObj = players[i] || ais[i - players.length];
            if (tmpObj.visible && tmpObj.showName === 'NOOO') {
                mainContext.strokeStyle = darkOutlineColor;
                let tmpText = (tmpObj.team ? "[" + tmpObj.team + "] " : "") + (tmpObj.name || ""); //+ (tmpObj.isPlayer ? " {" + tmpObj.sid + "}" : "");
                if (tmpText != "" && tmpObj.name != "Trash Slave") {
                    // bots.forEach((bot) => {
                    //     if (tmpObj.sid == bot.sid) return;
                    // });
                    mainContext.font = (tmpObj.nameScale || 30) + "px HammerSmith One";
                    mainContext.fillStyle = "#fff";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = (tmpObj.nameScale ? 11 : 8);
                    mainContext.lineJoin = "round";

                    mainContext.strokeText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                    mainContext.fillText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);

                    if (tmpObj.isLeader && iconSprites["crown"].isLoaded) {
                        let tmpS = config.crownIconScale;
                        let tmpX = tmpObj.x - xOffset - (tmpS / 2) - (mainContext.measureText(tmpText).width / 2) - config.crownPad;
                        mainContext.drawImage(iconSprites["crown"], tmpX, (tmpObj.y - yOffset - tmpObj.scale) -
                            config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
                    }
                    if (tmpObj.iconIndex == 1 && iconSprites["skull"].isLoaded) {
                        let tmpS = config.crownIconScale;
                        let tmpX = tmpObj.x - xOffset - (tmpS / 2) + (mainContext.measureText(tmpText).width / 2) + config.crownPad;
                        mainContext.drawImage(iconSprites["skull"], tmpX, (tmpObj.y - yOffset - tmpObj.scale) -
                            config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
                    }
                    if (tmpObj.isPlayer && instaC.wait && near == tmpObj && (crossHairSprites[1].isLoaded) && enemy.length && !useWasd) {
                        let tmpS = tmpObj.scale * 2.2;
                        mainContext.drawImage((crossHairSprites[1]), tmpObj.x - xOffset - tmpS / 2, tmpObj.y - yOffset - tmpS / 2, tmpS, tmpS);
                    }
                    // izbot = false;
                }
            }
        }

        if (player) {
            // AUTOPUSH LINE:
            if (my.autoPush || pathfinder.state.active) {
                pathfinder.renderPath(mainContext, xOffset, yOffset, my.pushData, my.autoPush);
            }
            // onetick range (optimized + aesthetic)
            if (configs.autoOneFrame && enemy.length && near) {
                mainContext.save(); // cleaner than manual resets
                mainContext.globalAlpha = 1;

                const time = Date.now() / 300;
                const pulse = Math.sin(time) * 5;

                const playerScreenX = player.x - xOffset;
                const playerScreenY = player.y - yOffset;
                const nearScreenX = near.x - xOffset;
                const nearScreenY = near.y - yOffset;

                // config map for weapon combos (way cleaner than nested ifs)
                const weaponConfigs = {
                    megaOneshot: {
                        check: () => player.items[4] == 16 && player.weapons[0] == 5 && [9, 12, 13].includes(player.weapons[1]),
                        dist: () => {
                            const baseDistMap = { 9: 365, 12: 380, 13: 365 };
                            return (baseDistMap[player.weapons[1]] || 370) + pulse;
                        },
                        colors: {
                            shadow: "#a020f0",
                            gradient: ["#d0a0ff", "#7b2cbf", "rgba(20,0,40,0.8)", "rgba(0,0,0,0)"],
                            outerRing: "rgba(180,100,255,0.5)"
                        },
                        lineWidth: 5,
                        shadowBlur: 20
                    },
                    rubyOneshot: {
                        check: () => player.weapons[0] == 5 && player.primaryVariant >= 2,
                        dist: () => 238 + pulse,
                        colors: {
                            shadow: "#c77dff",
                            gradient: ["#f3c4ff", "#9d4edd", "rgba(0,0,0,0)"],
                        },
                        lineWidth: 6,
                        shadowBlur: 25
                    }
                };

                // detect which config to use
                const activeConfig = Object.values(weaponConfigs).find(cfg => cfg.check());

                if (activeConfig) {
                    const dist = activeConfig.dist();
                    if (![nearScreenX, nearScreenY, playerScreenX, playerScreenY, dist].every(Number.isFinite)) {
                        return;
                    }

                    // main gradient ring
                    const gradient = mainContext.createRadialGradient(
                        nearScreenX, nearScreenY, 20,
                        nearScreenX, nearScreenY, 100
                    );

                    activeConfig.colors.gradient.forEach((color, i) => {
                        gradient.addColorStop(i / (activeConfig.colors.gradient.length - 1), color);
                    });

                    mainContext.lineWidth = activeConfig.lineWidth;
                    mainContext.shadowBlur = activeConfig.shadowBlur;
                    mainContext.shadowColor = activeConfig.colors.shadow;
                    mainContext.strokeStyle = gradient;

                    mainContext.beginPath();
                    mainContext.arc(playerScreenX, playerScreenY, dist, 0, Math.PI * 2);
                    mainContext.stroke();

                    // outer ring (only for mega oneshot)
                    if (activeConfig.colors.outerRing) {
                        mainContext.beginPath();
                        mainContext.lineWidth = 2;
                        mainContext.shadowBlur = 10;
                        mainContext.strokeStyle = activeConfig.colors.outerRing;
                        mainContext.arc(playerScreenX, playerScreenY, dist + 10, 0, Math.PI * 2);
                        mainContext.stroke();
                    }
                }
            }
            mainContext.restore(); // auto-resets all props
        }
        // RENDER ANIM TEXTS:
        textManager.update(delta, mainContext, xOffset, yOffset);

        // RENDER CHAT MESSAGES:
        for (let i = 0; i < players.length; ++i) {
            tmpObj = players[i];
            if (tmpObj.visible) {
                if (tmpObj.chatCountdown > 0) {
                    tmpObj.chatCountdown -= delta;
                    if (tmpObj.chatCountdown <= 0)
                        tmpObj.chatCountdown = 0;
                    mainContext.font = "32px HammerSmith One";
                    let tmpSize = mainContext.measureText(tmpObj.chatMessage);
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    let tmpX = tmpObj.x - xOffset;
                    let tmpY = tmpObj.y - tmpObj.scale - yOffset - 90;
                    let tmpH = 47;
                    let tmpW = tmpSize.width + 17;
                    mainContext.fillStyle = "rgba(0,0,0,0.2)";
                    mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                    mainContext.fill();
                    mainContext.fillStyle = "#fff";
                    mainContext.fillText(tmpObj.chatMessage, tmpX, tmpY);
                }
                if (tmpObj.chat.count > 0) {
                    if (!useWasd) {
                        tmpObj.chat.count -= delta;
                        if (tmpObj.chat.count <= 0)
                            tmpObj.chat.count = 0;
                        mainContext.font = "32px HammerSmith One";
                        let tmpSize = mainContext.measureText(tmpObj.chat.message);
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        let tmpX = tmpObj.x - xOffset;
                        let tmpY = tmpObj.y - tmpObj.scale - yOffset + (90 * 2);
                        let tmpH = 47;
                        let tmpW = tmpSize.width + 17;
                        mainContext.fillStyle = "rgba(0,0,0,0.2)";
                        mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                        mainContext.fill();
                        mainContext.fillStyle = "#ffffff99";
                        mainContext.fillText(tmpObj.chat.message, tmpX, tmpY);
                    } else {
                        tmpObj.chat.count = 0;
                    }
                }
            }
        }

        if (allChats.length) {
            allChats.filter(ch => ch.active).forEach((ch) => {
                if (!ch.alive) {
                    if (ch.alpha <= 1) {
                        ch.alpha += delta / 250;
                        if (ch.alpha >= 1) {
                            ch.alpha = 1;
                            ch.alive = true;
                        }
                    }
                } else {
                    ch.alpha -= delta / 5000;
                    if (ch.alpha <= 0) {
                        ch.alpha = 0;
                        ch.active = false;
                    }
                }
                if (ch.active) {
                    mainContext.font = "20px Ubuntu";
                    let tmpSize = mainContext.measureText(ch.chat);
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    let tmpX = ch.x - xOffset;
                    let tmpY = ch.y - yOffset - 90;
                    let tmpH = 40;
                    let tmpW = tmpSize.width + 15;

                    mainContext.globalAlpha = ch.alpha;

                    mainContext.fillStyle = ch.owner.isTeam(player) ? "#8ecc51" : "#cc5151";
                    mainContext.strokeStyle = "rgb(25, 25, 25)";
                    mainContext.strokeText(ch.owner.name, tmpX, tmpY - 45);
                    mainContext.fillText(ch.owner.name, tmpX, tmpY - 45);

                    mainContext.lineWidth = 5;
                    mainContext.fillStyle = "#ccc";
                    mainContext.strokeStyle = "rgb(25, 25, 25)";

                    mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                    mainContext.stroke();
                    mainContext.fill();

                    mainContext.fillStyle = "#fff";
                    mainContext.strokeStyle = "#000";
                    mainContext.strokeText(ch.chat, tmpX, tmpY);
                    mainContext.fillText(ch.chat, tmpX, tmpY);
                    ch.y -= delta / 100;
                }
            });
        }

        mainContext.globalAlpha = 1;

        // RENDER MINIMAP:
        renderMinimap(delta);
    }

    // UPDATE & ANIMATE:
    window.requestAnimFrame = function () {
        return null;
    }
    window.rAF = (function () {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            function (callback) {
                window.setTimeout(callback, 1000 / 9);
            };
    })();

    function doUpdate() {
        //rape modulus
        now = performance.now();
        delta = now - lastUpdate;
        lastUpdate = now;
        let timer = performance.now();
        let diff = timer - fpsTimer.last;
        if (diff >= 1000) {

            fpsTimer.ltime = fpsTimer.time * (1000 / diff);

            fpsTimer.last = timer;
            fpsTimer.time = 0;
        }
        fpsTimer.time++;

        getEl("pingFps").innerHTML = `${window.pingTime}ms | ${Math.round(fpsTimer.ltime)}fps`;
        getEl("packetStatus").innerHTML = `${secPacket}/s`;
        updateGame();
        rAF(doUpdate);
        ms.avg = Math.round((ms.min + ms.max) / 2);
    }

    prepareMenuBackground();
    doUpdate();


    function toggleUseless(boolean) {
        getEl("instaType").disabled = boolean;
        getEl("antiBullType").disabled = boolean;
        getEl("predictType").disabled = boolean;
    }
    toggleUseless(useWasd);

    let changeDays = {};
    window.debug = function () {
        my.waitHit = 0;
        my.autoAim = false;
        instaC.isTrue = false;
        autoBreak.inTrap = false;
        itemSprites = [];
        objSprites = [];
        gameObjectSprites = [];
    };
    window.wasdMode = function () {
        useWasd = !useWasd;
        toggleUseless(useWasd);
    };
    window.startGrind = function () {
        if (getEl("weaponGrind").checked) {
            for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                checkPlace(player.getItemType(22), i);
            }
        }
    };
    // REMOVED!!! so they cant abuse :)
    let projects = [
        "adorable-eight-guppy",
        "galvanized-bittersweet-windshield"
    ];
    let botIDS = 0;
    window.connectFillBots = function () {
        botSkts = [];
        botIDS = 0;
        for (let i = 0; i < projects.length; i++) {
            let test = new WebSocket(`wss://${projects[i]}.glitch.me`);
            test.binaryType = "arraybuffer";

            test.onopen = function () {
                test.ssend = function (type) {
                    let data = Array.prototype.slice.call(arguments, 1);
                    let binary = window.msgpack.encode([type, data]);
                    test.send(binary);
                };
                for (let i = 0; i < 4; i++) {
                    window.grecaptcha.execute("6LfahtgjAAAAAF8SkpjyeYMcxMdxIaQeh-VoPATP", {
                        action: "homepage"
                    }).then(function (token) {
                        let t = WS.url.split("wss://")[1].split("?")[0];
                        test.ssend("bots", "wss://" + t + "?token=re:" + encodeURIComponent(token), botIDS);
                        botSkts.push([test]);
                        botIDS++;
                    });
                }
            };
            test.onmessage = function (message) {
                let data = new Uint8Array(message.data);
                let parsed = window.msgpack.decode(data);
                let type = parsed[0];
                data = parsed[1];
            };
        }
    };
    window.destroyFillBots = function () {
        botSkts.forEach((socket) => {
            socket[0].close();
        });
        botSkts = [];
    };
    window.tryConnectBots = function () {
        if (!WS || !WS.url) return;
        const targetCount = bots.length < 3 ? 3 : 4;
        for (let i = 0; i < targetCount; i++) {
            const joinUrl = WS.url + (WS.url.includes("?") ? "&" : "?") + "bot=" + Date.now() + "_" + i;
            botSpawn(null, joinUrl);
        }
    };
    window.destroyBots = function () {
        bots.forEach((botyyyyy) => {
            botyyyyy.closeSocket = true;
        });
        bots = [];
    };
    window.resBuild = function () {
        if (gameObjects.length) {
            gameObjects.forEach((tmp) => {
                tmp.breakObj = false;
            });
            breakObjects = [];
        }
    };
    window.toggleBotsCircle = function () {
        player.circle = !player.circle;
    };
    window.toggleVisual = function () {
        config.anotherVisual = !config.anotherVisual;
        getEl("anotherVisualToggle") && (getEl("anotherVisualToggle").checked = config.anotherVisual);
        gameObjects.forEach((tmp) => {
            if (tmp.active) {
                tmp.dir = tmp.lastDir;
            }
        });
    };
    window.prepareUI = function (tmpObj) {
        resize();
        // CHAT STUFF:
        var chatBox = document.getElementById("mChBox");
        var chatHolder = document.getElementById("chatHolder");
        var suggestBox = document.createElement("div");
        suggestBox.id = "suggestBox";

        var prevChats = [];
        var prevChatsIndex = 0;

        function toggleChat() {
            if (customMenuChatEnabled) {
                if (chatHolder) {
                    chatHolder.style.display = "none";
                    chatHolder.style.pointerEvents = "none";
                    chatHolder.style.opacity = "0";
                }
                if (chatBox) {
                    chatBox.blur();
                    chatBox.value = "";
                }
                return;
            }
            if (!usingTouch) {
                if (chatHolder.style.display == "block") {
                    if (chatBox.value) {
                        sendChat(chatBox.value);
                    }
                    closeChat();
                } else {
                    storeMenu.style.display = "none";
                    allianceMenu.style.display = "none";
                    chatHolder.style.display = "block";
                    chatBox.focus();
                    resetMoveDir();
                }
            } else {
                setTimeout(function () {
                    var chatMessage = prompt("chat message");
                    if (chatMessage) {
                        sendChat(chatMessage);
                    }
                }, 1);
            }
            chatBox.value = "";
            (() => {
                prevChatsIndex = 0;
            })();
        }

        function closeChat() {
            chatBox.blur();
            chatHolder.style.display = "none";
            chatBox.value = "";
        }

        // ACTION BAR:
        UTILS.removeAllChildren(actionBar);

        for (let i = 0; i < (items.weapons.length + items.list.length); ++i) {
            (function (i) {
                UTILS.generateElement({
                    id: "actionBarItem" + i,
                    class: "actionBarItem",
                    style: "display:none; box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.5)",
                    onmouseout: function () {
                        showItemInfo();
                    },
                    parent: actionBar
                });
            })(i);
        }

        for (let i = 0; i < (items.list.length + items.weapons.length); ++i) {
            (function (i) {
                let tmpCanvas = document.createElement("canvas");
                tmpCanvas.width = tmpCanvas.height = 66;
                let tmpContext = tmpCanvas.getContext("2d");
                tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
                tmpContext.imageSmoothingEnabled = false;
                tmpContext.webkitImageSmoothingEnabled = false;
                tmpContext.mozImageSmoothingEnabled = false;

                if (items.weapons[i]) {
                    tmpContext.rotate((Math.PI));
                    let tmpSprite = new Image();
                    toolSprites[items.weapons[i].src] = tmpSprite;
                    tmpSprite.onload = function () {
                        this.isLoaded = true;
                        let tmpPad = 1 / (this.height / this.width);
                        let tmpMlt = (items.weapons[i].iPad || 1);
                        tmpContext.drawImage(this, -(tmpCanvas.width * tmpMlt * config.iconPad * tmpPad) / 2, -(tmpCanvas.height * tmpMlt * config.iconPad) / 2,
                            tmpCanvas.width * tmpMlt * tmpPad * config.iconPad, tmpCanvas.height * tmpMlt * config.iconPad);
                        tmpContext.fillStyle = "rgba(0, 0, 70, 0.2)";
                        tmpContext.globalCompositeOperation = "source-atop";
                        tmpContext.fillRect(-tmpCanvas.width / 2, -tmpCanvas.height / 2, tmpCanvas.width, tmpCanvas.height);
                        getEl('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                    };
                    tmpSprite.src = "./../img/weapons/" + items.weapons[i].src + ".png";
                    let tmpUnit = getEl('actionBarItem' + i);
                    // tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                    //     showItemInfo(items.weapons[i], true);
                    // });
                    tmpUnit.onclick = UTILS.checkTrusted(function () {
                        selectWeapon(tmpObj.weapons[items.weapons[i].type]);
                    });
                    UTILS.hookTouchEvents(tmpUnit);
                } else {
                    let tmpSprite = getItemSprite(items.list[i - items.weapons.length], true);
                    let tmpScale = Math.min(tmpCanvas.width - config.iconPadding, tmpSprite.width);
                    tmpContext.globalAlpha = 1;
                    tmpContext.drawImage(tmpSprite, -tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                    tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                    tmpContext.globalCompositeOperation = "source-atop";
                    tmpContext.fillRect(-tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                    getEl('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                    let tmpUnit = getEl('actionBarItem' + i);
                    // tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                    //     showItemInfo(items.list[i - items.weapons.length]);
                    // });
                    tmpUnit.onclick = UTILS.checkTrusted(function () {
                        selectToBuild(tmpObj.items[tmpObj.getItemType(i - items.weapons.length)]);
                    });
                    UTILS.hookTouchEvents(tmpUnit);
                }
            })(i);
        }
    };
    window.profineTest = function (data) {
        if (data) {
            // VALIDATE NAME:
            let name = data + "";
            name = name.slice(0, config.maxNameLength);

            return name;
        }
    }

    let spikeType = 2;
    let visAim = false;
    let hold = null;
    let aim = [null];
    let autobreakBuild = false;
    let breaking = false;
    let Variants = [1, 1.1, 1.18, 1.18];
    let bH = [51, 50, 28, 29, 30, 36, 37, 38, 44, 35, 42, 43, 49];

    // Initialize dmgpot system when player is available
    function initDmgPotSystem() {
        if (player && !player.dmgpot) {
            player.dmgpot = {
                soldier: false,
                shouldHeal: false
            };
        }
    }

    function resetBreakState(reason) {
        try {
            const wasBreaking = breaking || autobreakBuild || visAim || hold != null || aim[0] != null;
            visAim = false;
            autobreakBuild = false;
            breaking = false;
            hold = null;
            aim[0] = null;
            if (player) {
                player.hitting = false;
            }
            if (typeof instaC !== "undefined" && instaC) {
                instaC.isTrue = false;
            }
            if (wasBreaking && configs && configs.debugMode) {
                console.log(`[DEBUG] Break state reset: ${reason}`);
            }
        } catch (e) {
            console.error("resetBreakState error:", e);
        }
    }

    function addChatLog(names, message, color, pm, timer) {
        try {
            if (player && player.chat) {
                player.chat.message = message;
                player.chat.count = 1000;
            }
        } catch (e) {
            console.log("addChatLog error:", e);
        }
    }

    function polePlacer(item, angle, trap) {
        try {
            if (!item || !trap) return false;
            let tmpObj = {
                x: trap.x + Math.cos(angle) * (item.scale + trap.scale),
                y: trap.y + Math.sin(angle) * (item.scale + trap.scale)
            };
            return UTILS.checkItemLocation(tmpObj.x, tmpObj.y, item.scale, 0, item.id, false, player);
        } catch (e) {
            return false;
        }
    }

    function shieldBypass(player, enemy) {
        try {
            if (!player || !enemy) return false;
            return enemy.shameCount < 5 || enemy.skinIndex != 6;
        } catch (e) {
            return false;
        }
    }

    function breakBuild(angle, weapon, variant, hat, force) {
        try {
            if (autoBreak?.active) {
                const breakGear = resolveAutoBreakGear();
                hat = breakGear.hat;
            }
            selectWeapon(weapon);
            buyEquip(hat, 0);
            sendAtck(1, angle);
            game.tickBase(() => {
                sendAutoGather();
            }, 1);
        } catch (e) {
            console.log("breakBuild error:", e);
        }
    }

    async function spikeTickAids(e, t, g, z, dists) {
        if (!getEl("polearmAids") || !near || player.weapons[1] != 10 || !near?.inTrap || autobreakBuild || instaC.isTrue || autoBreak.active || my.autoPush || player.sr != 1 || player.pr != 1) return;
        try {
            if (player.weapons[0] == 3 || player.weapons[0] == 4 || player.weapons[0] == 5) {
                let coords;
                t = near.inTrap
                e = caf(player, t)
                g = 75 * Variants[player.secondaryVar] * (bH.includes(40) ? 3.3 : 1) >= t.health
                z = items.weapons
                dists = [UTILS.getDist(player, t, "object"), UTILS.getDist(player, near, "player")]
                if ((dists[0] <= z[player.weapons[1]].range && dists[1] <= z[player.weapons[0]].range) && polePlacer(items.list[spikeType], e, t) && shieldBypass(player, near) && g && (((player.weapons[0] == 5 && player.primaryVar == 1) || (player.weapons[0] == 4 && player.primaryVar > 1)) ? (near.weaponR == 1 && near.weaponIndex <= 10) : true) && player.tailIndex != 11) {
                    autobreakBuild = true;
                    if (player.dmgpot?.soldier && near.pr == 1 && player.dmgpot?.shouldHeal && [4, 5].includes(near?.primary)) {
                        addChatLog(`Cancelled TA due to spike sync threat`, '', '#5c0620', false, true);
                        Hg(6, 0);
                    } else {
                        Hg(40, 0);
                    }
                    aim[0] = e
                    packet("D", e)
                    visAim = true;
                    hold = player.weapons[1];
                    player.hitting = true;
                    packet("z", player.weapons[1], true)
                    breaking = true;
                    addChatLog(`TA on ${near.name}[${near.sid}]`, '', '#5c0620', false, true);
                    await game.tickBase()
                    addChatLog(`${near.health}`, '', '#5c0620', false, true);
                    autobreakBuild = false;
                    instaC.isTrue = true;
                    hold = player.weapons[0]
                    if (player.dmgpot?.soldier && near.pr == 1 && player.dmgpot?.shouldHeal && [4, 5].includes(near?.primary)) {
                        addChatLog(`Cancelled TA due to spike sync threat`, '', '#5c0620', false, true);
                        Hg(6);
                    } else {
                        Hg(7);
                    }
                    packet("z", player.weapons[0], true)
                    e = caf(player, t)
                    player.hitting = true;
                    aim[0] = e;
                    packet("D", caf(player, near))
                    place(spikeType, e + UTILS.toRad(15), player.weapons[0])
                    place(spikeType, e - UTILS.toRad(15), player.weapons[0])
                    place(spikeType, caf(player, near), player.weapons[0])
                    packet("D", caf(player, near))
                    packet("z", player.weapons[0], true)
                    await game.tickBase()
                    visAim = false;
                    hold = null
                    breaking = false;
                    aim[0] = null;
                    instaC.isTrue = false;
                }
            }
        } finally {
            if (breaking || autobreakBuild || visAim || hold != null || aim[0] != null) {
                resetBreakState("spikeTickAids_finally");
            }
        }
    }

    async function breakShit(e, t, g, g2, z, dists) {
        if (player.weapons[0] != 5 || player.primaryVar < 2 || !getEl("polearmAids") || !near || player.weapons[1] != 10 || !near?.inTrap || autobreakBuild || instaC.isTrue || autoBreak.active || my.autoPush || player.sr != 1 || player.pr != 1) return
        try {
            let coords;
            t = near.inTrap
            e = caf(player, t)
            const breakGear = resolveAutoBreakGear();
            const hammerHat = breakGear.enemyClose ? breakGear.hat : 40;
            const hammerAcc = breakGear.enemyClose ? breakGear.acc : 19;
            const spikeHat = 7;
            const spikeAcc = 18;
            g = 75 * Variants[player.secondaryVar] * (bH.includes(hammerHat) ? 3.3 : 1) >= t.health
            g2 = (75 * Variants[player.secondaryVar] * (bH.includes(hammerHat) ? 3.3 : 1)) + ((near.secondary == 10 ? 75 : items.weapons[near.primary].dmg) * Variants[player.secondary == 10 ? near.secondaryVar : near.primaryVar] * 3.3) >= t.health
            z = items.weapons
            dists = [UTILS.getDist(player, t, "object"), UTILS.getDist(player, near, "player")]
            if ((dists[0] <= z[player.weapons[1]].range && dists[1] <= z[player.weapons[0]].range) && polePlacer(items.list[spikeType], e, t) && shieldBypass(player, near) && player.tailIndex != 11) {
                if (g) {
                    autobreakBuild = true;
                    Hg(hammerHat, hammerAcc);
                    aim[0] = e
                    packet("D", e)
                    visAim = true;
                    hold = player.weapons[1];
                    player.hitting = true;
                    packet("z", player.weapons[1], true)
                    breaking = true;
                    addChatLog(`PA on ${near.name}[${near.sid}]`, '', '#5c0620', false, true);
                    breakBuild(e, player.weapons[1], player.secondaryVar, hammerHat, 1)
                    await game.tickBase()
                    instaC.isTrue = true;
                    hold = player.weapons[0]
                    Hg(spikeHat, spikeAcc)
                    packet("z", player.weapons[0], true)
                    e = caf(player, t)
                    player.hitting = true;
                    aim[0] = e;
                    packet("D", caf(player, near))
                    place(spikeType, e + UTILS.toRad(15), player.weapons[0])
                    place(spikeType, e - UTILS.toRad(15), player.weapons[0])
                    place(spikeType, caf(player, near), player.weapons[0])
                    place(spikeType, e, player.weapons[0])
                    packet("D", caf(player, near))
                    packet("z", player.weapons[0], true)
                    await game.tickBase()
                    visAim = false;
                    autobreakBuild = false;
                    hold = null
                    breaking = false;
                    aim[0] = null;
                    instaC.isTrue = false;
                }
            }
        } finally {
            if (breaking || autobreakBuild || visAim || hold != null || aim[0] != null) {
                resetBreakState("breakShit_finally");
            }
        }
    }

    function rubyPH() {
        if (!near || !player.pr || !player.sr || !(player.primaryVar === 3 || player.secondaryVar === 3) || player.weapons[1] != 10 || player.weapons[0] != 5) return;
    }
}(1)