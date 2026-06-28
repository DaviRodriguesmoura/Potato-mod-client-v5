// ==UserScript==
// @name          Vape Client
// @description   💨
// @author        🍃
// @version       🚬
// @namespace     😤
// @icon          https://i.imgur.com/WfsO92A.png
// @require       https://update.greasyfork.org/scripts/423602/1005014/msgpack.js
// @require       https://update.greasyfork.org/scripts/480301/1322984/CowJS.js
// @match         *://*.moomoo.io/*
// @import        XMLHttpRequest
// @grant         none
// @downloadURL https://update.greasyfork.org/scripts/566494/Vape%20Client%20%F0%9F%8C%AB%20By%20Pashka.user.js
// @updateURL https://update.greasyfork.org/scripts/566494/Vape%20Client%20%F0%9F%8C%AB%20By%20Pashka.meta.js
// ==/UserScript==

(async function() {
	if (true) {

		var vape = true;
		let visibilityChange = function() {
			let state = document.visibilityState;
			if (state === "hidden") {
				let iframe = document.createElement('iframe');
				iframe.src = 'data:text/plain,';
				iframe.style.display = 'none';
				document.body.appendChild(iframe);
				setTimeout(function() {
					if (document.body.contains(iframe)) {
						document.body.removeChild(iframe);
					}
				}, 3000);
			} else {
				let iframes = document.querySelectorAll('iframe');
				setTimeout(() => {
					iframes.forEach((iframe) => {
						if (document.body.contains(iframe)) {
							document.body.removeChild(iframe);
						}
					});
				}, 120);
			}
		};
		document.addEventListener('visibilitychange', visibilityChange, false);
		(function() {
			const WorkerCode = `
self.onmessage = (msg) => {
    let bitmap = msg.data;
    let canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    let ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    ctx.clearRect(Math.floor(bitmap.width/2), Math.floor(bitmap.height/2), 1, 1);


    let endpoints = [];
    let data = ctx.getImageData(0,0,bitmap.width, bitmap.height).data;

    let map = new Map(canvas);


    for(let i = 0;i < data.length;i += 4){
        let l = i / 4;
        map.StatsGraph[l % bitmap.width][Math.floor(l / bitmap.width)].cost = data[i];
        if(data[i + 2]){
            endpoints.push({
                x: l % bitmap.width,
                y: Math.floor(l / bitmap.width),
            });
        }
    }
    bitmap.close();

    if(!endpoints.length){
        endpoints.push(map.getCentreNode());
    }

    let openSet = new BinHeap();
    openSet.setCompare = (a, b) => a.f > b.f;
    openSet.push(map.getCentreNode());

    let currentNode;


    while(openSet.length){
        currentNode = openSet.remove(0)
        if(endpoints.some((goal) => goal.x == currentNode.x && goal.y == currentNode.y)){
            break;
        }

        let neighbors = map.getNeighbor(currentNode.x, currentNode.y);
        for(let i = 0;i < neighbors.length;i++){
            let neighbor = neighbors[i];
            if(neighbor && neighbor.cost == 0){//may make it weighted later
                let tempG = currentNode.g + Map[i % 2 == 0 ? "DiagonalCost" : "TraversalCost"];
                if(tempG < neighbor.g){
                    neighbor.parent = currentNode;
                    neighbor.g = tempG;
                    neighbor.h = Math.min.apply(Math, endpoints.map((goal) => fastHypot(neighbor.x - goal.x, neighbor.y - goal.y)));
                    if(!neighbor.inset){
                        openSet.insert(neighbor);
                    }
                }
            }
        }
    }


    if(!endpoints.some((goal) => goal.x == currentNode.x && goal.y == currentNode.y)){
        currentNode = map.getLowest('h');
    }
    let output = [];
    while(currentNode.parent){
        let nextNode = currentNode.parent;
        let d = Math.round(Math.atan2(nextNode.y - currentNode.y, nextNode.x - currentNode.x) / Math.PI * 4);
        if(d < 0){d+=8};
        output.push(d);
        currentNode = nextNode;
    }
    output = new Uint8Array(output.reverse()).buffer;

    self.postMessage(output, [output]);
}

function fastHypot(a, b){
    const c = Math.SQRT2-1;
    a = Math.abs(a);
    b = Math.abs(b);
    if(a > b){
        let temp = a;
        a = b;
        b = temp;
    }
    return (c * a) + b
}

class Map{
    static TraversalCost = 1;
    static DiagonalCost = Math.sqrt(2) * 1;
    constructor(canvas){
        //init variables
        this.width = canvas.width;
        this.height = canvas.height;

        this.middleWidth = Math.floor(this.width / 2);
        this.middleHeight = Math.floor(this.height / 2);

        this.StatsGraph = new Array(canvas.width);
        for(let x = 0;x < this.width;x++){
            this.StatsGraph[x] = new Array(this.height);
            for(let y = 0;y < this.height; y++){
                this.StatsGraph[x][y] = new Node(x, y);
            }
        }
        this.getCentreNode().g = 0;
        this.getCentreNode().pending = false;
    }
    getLowest(type){
        let lowestNode = this.StatsGraph[0][0];
        for(let x = 0;x < this.width;x++){
            for(let y = 0;y < this.height; y++){
                if(lowestNode[type] > this.getNode(x, y)[type]){
                    lowestNode = this.getNode(x, y);
                }
            }
        }
        return lowestNode;
    }
    getNode(x, y){
        if(this.StatsGraph[x]){
            return this.StatsGraph[x][y];
        }
    }
    getCentreNode(){
        return this.StatsGraph[this.middleWidth][this.middleHeight];
    }
    getNeighbor(x, y){
        return [
            this.getNode(x - 1, y - 1),
            this.getNode(x + 0, y - 1),
            this.getNode(x + 1, y - 1),
            this.getNode(x + 1, y + 0),
            this.getNode(x + 1, y + 1),
            this.getNode(x + 0, y + 1),
            this.getNode(x - 1, y + 1),
            this.getNode(x - 1, y + 0),
        ]
    }
}

class Node{
    constructor(x, y){
        this.x = x;
        this.y = y;
        this.g = Number.POSITIVE_INFINITY;//distance to start
        this.h = Number.POSITIVE_INFINITY;//estimated distance to end
        this.parent;//where it came from
    }
    get f(){
        return this.h + this.g;
    }
}

class BinHeap extends Array {
    //private variable declaration
    #compare = (a, b) => a < b;
    //constuctor
    constructor(len = 0) {
        super(len);
    }
    set setCompare(func) {
        if (typeof func == "function") {
            this.#compare = func;
        } else {
            throw new Error("Needs a function for comparing")
        }
    }
    sort() {
        for (let i = Math.trunc(this.length / 2); i >= 0; i--) {
            this.siftDown(i)
        }
    }
    arraySort(compare) {
        super.sort(compare)
    }
    siftDown(index) {
        let left = index * 2 + 1;
        let right = index * 2 + 2;
        let max = index;
        if (left < this.length && this.#compare(this[max], this[left])){
            max = left;
        }
        if (right < this.length && this.#compare(this[max], this[right])){
            max = right;
        }
        if (max != index) {
            this.swap(index, max);
            this.siftDown(max);
        }
    }
    siftUp(index) {
        let parent = (index - (index % 2 || 2)) / 2;
        if (parent >= 0 && this.#compare(this[parent], this[index])) {
            this.swap(index, parent);
            this.siftUp(parent);
        }
    }
    insert(elem) {
        this.push(elem);
        this.siftUp(this.length - 1);
    }
    remove(index) {
        if (index < this.length) {
            this.swap(index, this.length - 1);
            let elem = super.pop();
            this.siftUp(index);
            this.siftDown(index);
            return elem;
        } else {
            throw new Error("Index Out Of Bounds")
        }
    }
    update(index, elem) {
        if (index < this.length) {
            this[index] = elem;
            this.siftUp(index);
            this.siftDown(index);
        } else {
            throw new Error("Index Out Of Bounds")
        }
    }
    swap(i1, i2) {
        let temp = this[i1];
        this[i1] = this[i2];
        this[i2] = temp;
    }
}
`;
			const version = "4.0";

			(function() {
				"use strict";

				function waitForInterval(selector, callback) {
					const checker = setInterval(() => {
						const node = document.querySelector(selector);
						if (!node?.style) {
							return;
						}
						callback();
						clearInterval(checker);
					});
					setTimeout(() => {
						clearInterval(checker);
					}, 30000);
					return checker;
				}
				waitForInterval("#gameUI", () => {
					createCustomHtmlAndCss();
				});
				waitForInterval("#mainMenu", createCustomMainMenu);
				waitForInterval("#enterGame", () => {
					const enterGameBtn = document.querySelector("#enterGame");
					enterGameBtn.addEventListener = new Proxy(enterGameBtn.addEventListener, {
						apply(target, _this, args) {
							_this = document.querySelector("#play_button");
							return target.apply(_this, args);
						}
					});
				});
				Object.defineProperty(HTMLElement.prototype, "onclick", {
					set(callback) {
						this.addEventListener("click", arguments[0]);
						if (!/enterGame/.test(this.id)) {
							return;
						}
						const playButton = document.querySelector("#play_button");
						playButton.addEventListener("click", arguments[0]);
					}
				});

				function createCustomMainMenu() {
					const mainMenu = document.querySelector("#mainMenu");
					const style = document.createElement("style");
					style.insertAdjacentHTML("beforeend", `
        .better-mm-holder {
            display: block;
            position: absolute;
            top: 0;
            z-index: 999999999;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, .75);
            overflow: hidden;
            pointer-events: all;
        }

        .better-mm-holder * {
            box-sizing: border-box;
        }

        .better-mm-holder ul, .better-mm-holder li {
            margin: 0;
            padding: 0;
            list-style: none;
            text-decoration: none;
        }

        .better-mm-wrapper {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            backdrop-filter: blur(15px);
            height: 100%;
        }

        .better-mm-header {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 105px;
            min-height: 105px;
            background: #101010;
            border-bottom: 4px solid #3d85c6;
        }

        .mod-title {
            background: #3d85c6;
            color: #7575757a;
            font-size: 50px;
            transform: skewX(10deg);
            padding: 5px 30px;
            border-radius: 50% 20% 35% / 70%;
            box-shadow: 0px 0px 3px 1px #020002;
            animation: blob-anim 20s infinite ease-in-out;
        }

        @keyframes blob-anim {
            0% {
                border-radius: 50% 20% 35% / 70%;
            }

            25% {
                border-radius: 50% 20% 35% / 30% 30% 20%;
            }

            50% {
                border-radius: 50% 20% 35% / 50% 50% 40%;
            }

            100% {
                border-radius: 50% 20% 35% / 70%;
            }
        }

.snowflake {
    position: absolute;
    width: 10px;
    height: 10px;
    background: #fff;
    border-radius: 50%;
    z-index: 9998;
    opacity: 0.8;
    animation: fall 5s linear infinite, sway 2s ease-in-out infinite;
}

@keyframes fall {
    0% {
        top: -10px;
        transform: translateX(0);
    }
    100% {
        top: 100vh;
        transform: translateX(calc(100vw * (random(-0.1, 0.1))));
    }
}

@keyframes sway {
    0% {
        transform: translateX(0);
    }
    25% {
        transform: translateX(-15px);
    }
    50% {
        transform: translateX(15px);
    }
    75% {
        transform: translateX(-15px);
    }
    100% {
        transform: translateX(0);
    }
}

body.ingame .snowflake {
    display: none;
}

        .better-mm-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            width: 100%;
            height: 100%;
            padding: 40px;
        }

        .bmm-container-box {
            display: flex;
            flex-direction: column;
            background: #101010;
            border: 4px solid #3d85c6;
            border-radius: 12px;
            padding: 5px;
            overflow-y: auto;
        }

        .bmm-container-box::-webkit-scrollbar {
            width: 8px;
        }

        .bmm-container-box::-webkit-scrollbar-track {
            width: 8px;
        }

        .bmm-container-box::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, .35);
            border-radius: 4px 30px 30px 4px;
        }

        .game-servers-box, .mod-changelog-box, .game-settings-box {
            min-height: 375px;
            max-height: 375px;
            width: 325px;
        }

        .items-list {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
            padding: 5px !important;
        }

        .items-list .item {
            display: flex;
            flex-direction: column;
            gap: 4px;
            background: #252525b8;
            width: 100%;
            min-height: max-content;
            border-radius: 6px;
            padding: 5px !important;
        }

        .items-list .item.light-background {
            background: #474747bd;
        }

        .changelog-item-header, .server-data-header {
            font-size: 16px;
            color: #d0d0d0;
        }

        .changelog-updates {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 0 4px;
        }

        .changelog-update-value {
            font-size: 14px;
            color: #a3a2a2;
        }

        .changelog-version-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding-left: 4px;
            border-left: 2px solid #a3a2a2;
        }

        .player-body-figure {
            stroke-width: 4;
            stroke: #3d3f42;
            transition: .3s fill;
        }

        .game-settings-box, .game-servers-box {
            overflow-y: hidden;
        }

        .game-servers-box .items-list {
            overflow-y: auto;
        }

        .game-servers-box .items-list::-webkit-scrollbar {
            width: 8px;
        }

        .game-servers-box .items-list::-webkit-scrollbar-track {
            width: 8px;
        }

        .game-servers-box .items-list::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, .35);
            border-radius: 20px;
        }

        .game-settings-box {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .player-settings {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            padding: 10px;
        }

        .player-preview-wrapper {
            min-width: 50px;
            min-height: 50px;
            border-radius: 12px;
            background: #252525b8;
            cursor: pointer;
        }

        .player-data-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .player-data-input {
            background: none;
            outline: 0;
            border: none;
            color: #d0d0d0;
            font-size: 14px;
            border-bottom: 2px solid #3d85c6;
            transition: .3s border-bottom;
        }

        .player-data-input:hover, .player-data-input:focus {
            border-bottom: 2px solid #0b5394;
        }

        .game-servers-update {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #a3a2a2;
            font-size: 16px;
            width: 100%;
            min-height: 30px;
            background: #252525b8;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 5px;
            transition: .3s color;
        }

        .game-servers-update:hover {
            color: #d0d0d0;
        }

        .server-data-wrapper {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .server-data-header, .server-data-ping {
            font-size: 13px;
            user-select: text;
            cursor: default;
        }

        .server-data-ping.red {
            color: #750d0d;
        }

        .server-data-ping.low-red {
            color: #852323;
        }

        .server-data-ping.yellow {
            color: #b3af0c;
        }

        .server-data-ping.green {
            color: #4bb30c;
        }

        .server-data-ping.low-green {
            color: #6c9f2b;
        }

        .server-data-actions {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .server-data-players {
            display: inline-block;
            user-select: none;
            color: #a3a2a2;
            width: 55px;
        }

        .server-open-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #d0d0d0;
            font-size: 12px;
            cursor: pointer;
            padding: 0 4px;
            background: #3d85c6;
            border-radius: 4px;
        }

        .server-joined-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #d0d0d0;
            font-size: 10px;
            cursor: pointer;
            padding: 0 4px;
            background: #2a5d8a;
            border-radius: 4px;
        }

        .loading-text, .disconnect-text {
            color: #d0d0d0;
            font-size: 35px;
        }

        .info-link {
            cursor: pointer;
            text-decoration: underline;
        }

        .link-logo {
            width: 25px;
            height: 25px;
        }

        .info-footer {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 8px;
            border-radius: 8px;
        }

        .info-footer-item {
            display: flex;
            align-items: center;
        }

        .game-settings {
            display: flex;
            flex-direction: column;
        }

        .player-settings-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .play-button, .game-setting-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            padding: 0 4px;
            width: 100%;
            height: 30px;
            color: #fff;
            background: #3d85c6;
            border-radius: 6px;
            letter-spacing: 4px;
            cursor: pointer;
            transition: .3s background, .3s color;
        }

        .play-button:hover {
            background: #0b5394;
            color: #eee;
        }

        .play-button:active, .game-setting-btn:active {
            transform: scale(.975);
        }

        .game-settings {
            display: grid;
            grid-template-columns: repeat(2, max-content);
            justify-items: center;
            justify-content: center;
            grid-gap: 5px;
            width: 100%;
            height: 100%;
        }

        .game-setting-btn {
            font-size: 14px;
            width: 140px;
            padding: 0 6px;
            letter-spacing: 0px;
            background: #3d85c6;
        }

        .game-setting-btn.enabled {
            background: #0b5394;
            color: #d0d0d0;
        }

        .select-skin-panel {
            position: absolute;
            padding: 4px;
            display: grid;
            grid-template-columns: repeat(5, max-content);
            gap: 4px;
            background: #252525b8;
            border: 4px solid #3d85c6;
            border-radius: 6px;
            z-index: 99999999999;
        }

        .skin-circle {
            cursor: pointer;
            width: 20px;
            height: 20px;
            border-radius: 6px;
            border: 3px solid #525252;
            transition: .3s border-radius;
        }

        .skin-circle:hover {
            border-radius: 50%;
        }

        .skin-circle.selected {
            border-radius: 50% !important;
        }

        .global-notification {
            position: absolute;
            top: 0;
            width: 100%;
            height: 100%;
            z-index: 9999999999999999999;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .global-notification-box {
            width: 400px;
            height: 400px;
            overflow: hidden;
        }
        `);
					document.head.appendChild(style);
					mainMenu.insertAdjacentHTML("beforeend", `
    <div class="better-mm-holder" id="menuCardHolder">
        <main class="better-mm-wrapper">
            <container class="better-mm-container" id="better_mm_loading">
                <span class="loading-text">Loading..</span>
            </container>

            <container class="better-mm-container hidden" id="better_mm_disconnect">
                <span class="disconnect-text">Disconnected..</span>
            </container>

            <container class="better-mm-container hidden" id="better_mm_container">
                <box class="bmm-container-box game-servers-box">
                    <div class="game-servers-update" id="game_servers_update">UPDATE</div>
                    <ul class="items-list" id="game_servers"></ul>
                </box>

                <box class="bmm-container-box game-settings-box">
                    <div class="player-settings-wrapper">
                        <div class="player-settings">
                            <div class="player-preview-wrapper" id="player_preview">
                                <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="eIZvJ0eqgt61" viewBox="0 0 100 100" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
                                    <ellipse class="player-body-figure" rx="10" ry="10" transform="translate(80 32.942071)" fill="#bf8f54"/>
                                    <ellipse class="player-body-figure" rx="10" ry="10" transform="translate(20 32.942071)" fill="#bf8f54"/>
                                    <ellipse class="player-body-figure" rx="30" ry="30" transform="translate(50 57)" fill="#bf8f54"/>
                                </svg>
                            </div>

                            <div class="player-data-wrapper">
                                <input class="player-data-input" id="nickname_input" placeholder="Enter nickname..." maxlength="13">
                                <input class="player-data-input" id="first_clan_input" placeholder="Enter clan name..." maxlength="7">
                            </div>
                        </div>

                        <div class="play-button" id="play_button">PLAY</div>
                    </div>

                    <footer class="info-footer">

                        <a class="info-footer-item info-link" href="https://pashka.me" target="_blank">
                            <img class="link-logo" src="https://i.e-z.host/7cq1eo6r.png">
                        </a>

                        <a class="info-footer-item info-link" href="https://t.me/pashkatate" target="_blank">
                            <img class="link-logo" src="https://i.e-z.host/3aubh9qt.png">
                        </a>
                    </footer>
                </box>

            </container>
        </main>
    </div>

    <div class="select-skin-panel hidden" id="select_skin_panel">
        <div class="skin-circle selected" activeSkin" style="background: #bf8f54;" skin_index="0"></div>
        <div class="skin-circle" style="background: #cbb091;" skin_index="1"></div>
        <div class="skin-circle" style="background: #896c4b;" skin_index="2"></div>
        <div class="skin-circle" style="background: #fadadc;" skin_index="3"></div>
        <div class="skin-circle" style="background: #ececec;" skin_index="4"></div>
        <div class="skin-circle" style="background: #c37373;" skin_index="5"></div>
        <div class="skin-circle" style="background: #4c4c4c;" skin_index="6"></div>
        <div class="skin-circle" style="background: #ecaff7;" skin_index="7"></div>
        <div class="skin-circle" style="background: #738cc3;" skin_index="8"></div>
        <div class="skin-circle" style="background: #8bc373;" skin_index="9"></div>
    </div>
    `);

					window.onload = () => {
						const checkbox = document.querySelector('#altcha_checkbox');
						if (checkbox) {
							checkbox.checked = true;
							const event = new Event('change');
							checkbox.dispatchEvent(event);
						}
					};

					const gameServersUpdateBtn = document.querySelector("#game_servers_update");
					const nicknameInput = document.querySelector("#nickname_input");
					const firstClanInput = document.querySelector("#first_clan_input");
					const playButton = document.querySelector("#play_button");
					const playerPreview = document.querySelector("#player_preview");
					const allSelectSkinElements = [...document.querySelectorAll(".skin-circle")];
					const setNodeVisibility = (selector, key) => {
						const node = document.querySelector(selector);
						if (!node) {
							return;
						}
						const state = JSON.parse(localStorage.getItem(key));
						if (!node.hiddenInterval) {
							node.hiddenInterval = setInterval(() => {
								node.hidden = false;
							});
						}
						if (state) {
							return node.classList.remove("hidden");
						}
						node.classList.add("hidden");
					};
					nicknameInput.value = localStorage.getItem("vape_name") || "";
					firstClanInput.value = localStorage.getItem("vape_clan") || "";
					nicknameInput.addEventListener("input", () => {
						localStorage.setItem("vape_name", nicknameInput.value);
					});
					firstClanInput.addEventListener("input", () => {
						localStorage.setItem("vape_clan", firstClanInput.value);
					});
					playButton.addEventListener("click", enterGame);
					gameServersUpdateBtn.addEventListener("click", updateGameServers);
					playerPreview.addEventListener("click", toggleSelectSkin);
					window.addEventListener("resize", () => {
						toggleSelectSkin(null, true);
					});
					allSelectSkinElements.forEach(selectSkinElement => {
						selectSkinElement.addEventListener("mousedown", selectSkin);
					});
					const checkGameLoading = setInterval(() => {
						const loadingText = document.querySelector("#loadingText");
						if (loadingText?.style.display !== "none") {
							return;
						}
						if (localStorage.moo_skin) {
							selectSkin({
								target: allSelectSkinElements[+localStorage.moo_skin]
							});
						}
						toggleLoadingMenu(false);
						clearInterval(checkGameLoading);
					});
					const checkGameDisconnect = setInterval(() => {
						const loadingText = document.querySelector("#loadingText");
						if (loadingText?.style.display === "none" || !/disconnect/.test(loadingText?.innerHTML)) {
							return;
						}
						toggleDisconnectMenu(true);
						clearInterval(checkGameLoading);
					});
					Cow.socket.onEvent("close", toggleDisconnectMenu.bind(null, true));
				}

				function selectSkin(event) {
					const allSelectSkinElements = [...document.querySelectorAll(".skin-circle")];
					allSelectSkinElements.forEach(selectSkinElement => {
						selectSkinElement.classList.remove("selected");
					});
					const skinIndex = parseInt(event.target.getAttribute("skin_index"));
					const playerBodyFigures = [...document.querySelectorAll(".player-body-figure")];
					playerBodyFigures.forEach(playerBodyFigure => {
						playerBodyFigure.style.fill = window.config.skinColors[skinIndex];
					});
					event.target.classList.add("selected");
					window.selectSkinColor(skinIndex);
					localStorage.setItem("moo_skin", skinIndex);
				}


				const createSnowflake = function() {
					const snowflake = document.createElement("div");
					snowflake.className = "snowflake";
					snowflake.style.position = "absolute";
					snowflake.style.width = "10px";
					snowflake.style.height = "10px";
					snowflake.style.background = "#fff";
					snowflake.style.borderRadius = "50%";
					snowflake.style.zIndex = "9998";
					snowflake.style.opacity = Math.random();
					snowflake.style.left = Math.random() * 100 + "vw";
					snowflake.style.animation = `fall ${Math.random() * 2 + 1}s linear infinite`;
					snowflake.addEventListener("animationiteration", function() {
						snowflake.style.left = Math.random() * 100 + "vw";
						snowflake.style.opacity = Math.random();
					});
					document.body.appendChild(snowflake);
				};

				const startSnowflakes = () => {
					for (let i = 0; i < 50; i++) {
						createSnowflake();
					}
				};

				const removeSnowflakes = () => {
					const snowflakes = document.querySelectorAll('.snowflake');
					snowflakes.forEach(snowflake => {
						snowflake.parentNode.removeChild(snowflake);
					});
				};

				const toggleMainMenuSnowflakes = (visibility) => {
					if (visibility) {
						startSnowflakes();
					} else {
						removeSnowflakes();
					}
				};

				function toggleSelectSkin(_, isResize, forceHide) {
					const playerPreview = document.querySelector("#player_preview");
					const selectSkinPanel = document.querySelector("#select_skin_panel");
					const boundings = playerPreview.getBoundingClientRect();
					const width = 162;
					const height = 72;
					if (forceHide) {
						return selectSkinPanel.classList.add("hidden");
					}
					if (!isResize) {
						selectSkinPanel.classList.toggle("hidden");
					}
					selectSkinPanel.style.left = `${boundings.x - width / 2 + boundings.width / 2}px`;
					selectSkinPanel.style.top = `${boundings.y - height - 5}px`;
				}

				function enterGame() {
					const enterGameBtn = document.querySelector("#enterGame");
					toggleSelectSkin(null, false, true);
					toggleLoadingMenu(false);
					setLoadingText("Connecting..");
					toggleMainMenuSnowflakes(false);
				}

				toggleMainMenuSnowflakes(true);

				function setLoadingText(text) {
					const bettermmLoading = document.querySelector("#better_mm_loading");
					const loadingText = bettermmLoading.querySelector(".loading-text");
					loadingText.innerHTML = text;
				}

				function toggleDisconnectMenu(visibility) {
					const bettermmDisconnect = document.querySelector("#better_mm_disconnect");
					if (visibility) {
						bettermmDisconnect.classList.remove("hidden");
						toggleLoadingMenu(false);
						toggleSelectSkin(null, false, true);
						return toggleBettermmContainer(false);
					}
					bettermmDisconnect.classList.add("hidden");
					toggleBettermmContainer(true);
					toggleLoadingMenu(false);
				}

				function toggleLoadingMenu(visibility) {
					const bettermmLoading = document.querySelector("#better_mm_loading");
					if (visibility) {
						bettermmLoading.classList.remove("hidden");
						toggleSelectSkin(null, false, true);
						return toggleBettermmContainer(false);
					}
					bettermmLoading.classList.add("hidden");
					toggleBettermmContainer(true);
				}

				function toggleBettermmContainer(visibility) {
					const bettermmContainer = document.querySelector("#better_mm_container");
					if (visibility) {
						return bettermmContainer.classList.remove("hidden");
					}
					bettermmContainer.classList.add("hidden");
				}

				function getGameServers() {
					const currentMode = location.host.replace(/\.moomoo\.io/, "");
					const getRequestUrl = () => {
						if (/(sandbox|dev)/.test(currentMode)) {
							return `https://api-${currentMode}.moomoo.io/servers?v=1.26`;
						}
						return "https://api.moomoo.io/servers";
					};
					return new Promise(resolve => {
						fetch(getRequestUrl()).then(res => res.text()).then(servers => resolve(JSON.parse(servers)));
					});
				}
				async function updateGameServers() {
					let servers = await getGameServers();
					const [currentServerRegion, currentServerName] = location.href.replace(/.+\=/, "").split(":");
					const gameServers = document.querySelector("#game_servers");
					const serversByRegions = {};
					gameServers.innerHTML = "";
					for (const server of servers) {
						if (!serversByRegions[server.region]) {
							serversByRegions[server.region] = [];
						}
						serversByRegions[server.region].push(server);
					}
					servers = Object.values(serversByRegions);
					for (let serversRegion of servers) {
						serversRegion = serversRegion.sort((a, b) => b.playerCount - a.playerCount);
						for (let i = 0; i < serversRegion.length; i++) {
							const server = serversRegion[i];
							const requestPingUrl = `https://${server.key}.${server.region}.moomoo.io/ping/`;
							const sentTime = Date.now();
							const currentMode = location.host.replace(/\.moomoo\.io/, "");
							const id = `${server.region}_${server.name}`;
							const isCurrentServer = server.region === currentServerRegion && server.name === currentServerName;
							gameServers.insertAdjacentHTML(isCurrentServer ? "afterbegin" : "beforeend", `
    <li class="item${isCurrentServer ? " light-background" : ""}">
        <div class="server-data-wrapper">
            <header class="server-data-header">
                <span class="server-data-players">
                    (${server.playerCount}/${server.playerCapacity})
                </span>${window.regionsName[server.region]} [${server.name}]
            </header>

            <div class="server-data-actions">
                <span class="server-data-ping" id="${id}_ping"></span>
                ${!isCurrentServer
                    ? `<div class="server-open-btn" id="${id}_open">JOIN</div>`
                    : `<div class="server-joined-btn" id="${id}_joined">ACTIVE</div>`}
            </div>
        </div>
    </li>
`);
							const serverOpenBtn = document.querySelector(`#${id}_open`);
							if (serverOpenBtn && window.location.hostname == "sandbox.moomoo.io") {
								serverOpenBtn.addEventListener("click", () => {
									window.open(`https://${currentMode !== "" ? currentMode + "." : ""}moomoo.io/?server=${server.region}:${server.name}`);
								});
							} else if (serverOpenBtn && window.location.hostname == "moomoo.io") {
								serverOpenBtn.addEventListener("click", () => {
									window.open(`https://${currentMode !== "" ? currentMode + "." : ""}/?server=${server.region}:${server.name}`);
								});
							}
							fetch(requestPingUrl).then(() => {
								const ping = Date.now() - sentTime;
								const serverDataPing = document.querySelector(`#${server.region}_${server.name}_ping`);
								if (ping >= 500) {
									serverDataPing.classList.add("red");
								} else if (ping >= 350 && ping < 500) {
									serverDataPing.classList.add("low-red");
								} else if (ping >= 200 && ping < 350) {
									serverDataPing.classList.add("yellow");
								} else if (ping >= 100 && ping < 200) {
									serverDataPing.classList.add("low-green");
								} else {
									serverDataPing.classList.add("green");
								}
								serverDataPing.innerHTML = ping;
							});
						}
					}
				}

				function createCustomHtmlAndCss() {
					const style = document.createElement("style");
					style.insertAdjacentHTML("beforeend", `
        .hidden {
            display: none !important;
        }

        .item-count {
            position: absolute;
            display: block;
            color: #fff;
            font-size: 16px;
            margin: 2px 5px;
        }

        .item-count.scale-anim {
            transform: scale(1);
            animation: item-count-scale-anim 1s;
        }

        @keyframes item-count-scale-anim {
            0% {
                transform: scale(1);
            }

            50% {
                transform: scale(1.1);
            }

            100% {
                transform: scale(1);
            }
        }

        .actionBarItem {
            text-align: end;
        }

        #actionBar {
            display: flex !important;
            justify-content: center;
            margin-bottom: 5px;
        }

        #menuContainer, #settingsButton, #partyButton, #linksContainer2, #joinPartyButton {
            display: none !important;
        }
        `);
					document.head.appendChild(style);
				}
				const maxScreenWidth = 1920;
				const maxScreenHeight = 1080;
				const {
					lineTo,
					moveTo
				} = CanvasRenderingContext2D.prototype;
				const gridAlpha = 0.06;
				const turnSpeeds = {
					9: 0.003,
					10: 0.0016,
					11: 0.0025,
					12: 0.005
				};

				window.fetch = new Proxy(fetch, {
					apply(target, _this, args) {
						if (!args[0]) {
							args[0] = 'default-url';
						}

						if (/\/ping/.test(args[0]) && !/\/vape/.test(args[0])) {
							return target.apply(_this, args);
						}
						if (/\/vape/.test(args[0])) {
							args[0] = args[0].replace(/\/vape/, "");
						}
						return target.apply(_this, args);
					}
				});

				console._error = console.error;
				console.error = function(error) {
					if (error === "Failed to load.") {
						setInterval(() => {
							setLoadingText("Failed Loading..");
							toggleBettermmContainer(false);
							toggleLoadingMenu(true);
						});
					}
					this._error(error);
				};
				window.regionsName = {
					miami: "Miami",
					siliconvalley: "Silicon Valley",
					london: "London",
					frankfurt: "Frankfurt",
					sydney: "Sydney",
					singapore: "Singapore"
				};
			})();

			(function() {
				const {
					round
				} = Math;
				document.addEventListener("keydown", function(event) {
					if (event.keyCode === 191) {
						const chatHolder = document.getElementById("gameUI");
						if (chatHolder) {
							const currentDisplay = chatHolder.style.display;
							chatHolder.style.display = currentDisplay === "none" ? "block" : "none";
						}
					}
				});

				// AUTO RELOAD
				setInterval(() => window.follmoo && window.follmoo(), 10);
				window.location.native_resolution = true;
				var autoreloadloop;
				var autoreloadenough = 0;
				autoreloadloop = setInterval(function() {
					if (autoreloadenough < 200) {
						if (document.getElementById("disconnect-text") == `Disconnected..<a href="javascript:window.location.href=window.location.href" class="ytLink">reload</a>`) {
							document.title = "Reloading..";
							clearInterval(autoreloadloop);
							setTimeout(function() {
								document.title = "Moo Moo";
							}, 1000);
							location.reload();
						}
						autoreloadenough++;
					} else if (autoreloadenough >= 300) {
						clearInterval(autoreloadloop);
						document.title = "Reloaded.";
						setTimeout(function() {
							document.title = "Moo Moo";
						}, 1000);
					}
				}, 50);
				let useHack = true;
				// let focused = false;
				let log = console.log;
				let testMode = window.location.hostname == "127.0.0.1";
				let circleScale = 1.5;
				let namechanger = false;
				let inantiantibull = false;
				let spin = {
					degree: 45,
					toggle: false,
					angle: 0
				};
				var HPBarColor = "black";
				var NameBarColor = "black";

				function getEl(id) {
					return document.getElementById(id);
				}
				var EasyStar = function(e) {
					var o = {};

					function r(t) {
						if (o[t]) {
							return o[t].exports;
						}
						var n = o[t] = {
							i: t,
							l: false,
							exports: {}
						};
						e[t].call(n.exports, n, n.exports, r);
						n.l = true;
						return n.exports;
					}
					r.m = e;
					r.c = o;
					r.d = function(t, n, e) {
						if (!r.o(t, n)) {
							Object.defineProperty(t, n, {
								enumerable: true,
								get: e
							});
						}
					};
					r.r = function(t) {
						if (typeof Symbol != "undefined" && Symbol.toStringTag) {
							Object.defineProperty(t, Symbol.toStringTag, {
								value: "Module"
							});
						}
						Object.defineProperty(t, "__esModule", {
							value: true
						});
					};
					r.t = function(n, t) {
						if (t & 1) {
							n = r(n);
						}
						if (t & 8) {
							return n;
						}
						if (t & 4 && typeof n == "object" && n && n.__esModule) {
							return n;
						}
						var e = Object.create(null);
						r.r(e);
						Object.defineProperty(e, "default", {
							enumerable: true,
							value: n
						});
						if (t & 2 && typeof n != "string") {
							for (var o in n) {
								r.d(e, o, function(t) {
									return n[t];
								}.bind(null, o));
							}
						}
						return e;
					};
					r.n = function(t) {
						var n = t && t.__esModule ? function() {
							return t.default;
						} : function() {
							return t;
						};
						r.d(n, "9", n);
						return n;
					};
					r.o = function(t, n) {
						return Object.prototype.hasOwnProperty.call(t, n);
					};
					r.p = "/bin/";
					return r(r.s = 0);
				}([function(t, n, e) {
					var P = {};
					var M = e(1);
					var _ = e(2);
					var A = e(3);
					t.exports = P;
					var E = 1;
					P.js = function() {
						var c;
						var i;
						var f;
						var s = 1.4;
						var p = false;
						var u = {};
						var o = {};
						var r = {};
						var l = {};
						var a = true;
						var h = {};
						var d = [];
						var y = Number.MAX_VALUE;
						var v = false;
						this.setAcceptableTiles = function(t) {
							if (t instanceof Array) {
								f = t;
							} else if (!isNaN(parseFloat(t)) && isFinite(t)) {
								f = [t];
							}
						};
						this.enableSync = function() {
							p = true;
						};
						this.disableSync = function() {
							p = false;
						};
						this.enableDiagonals = function() {
							v = true;
						};
						this.disableDiagonals = function() {
							v = false;
						};
						this.setGrid = function(t) {
							c = t;
							for (var n = 0; n < c.length; n++) {
								for (var e = 0; e < c[0].length; e++) {
									o[c[n][e]] ||= 1;
								}
							}
						};
						this.setTileCost = function(t, n) {
							o[t] = n;
						};
						this.setAdditionalPointCost = function(t, n, e) {
							if (r[n] === undefined) {
								r[n] = {};
							}
							r[n][t] = e;
						};
						this.removeAdditionalPointCost = function(t, n) {
							if (r[n] !== undefined) {
								delete r[n][t];
							}
						};
						this.removeAllAdditionalPointCosts = function() {
							r = {};
						};
						this.setDirectionalCondition = function(t, n, e) {
							if (l[n] === undefined) {
								l[n] = {};
							}
							l[n][t] = e;
						};
						this.removeAllDirectionalConditions = function() {
							l = {};
						};
						this.setIterationsPerCalculation = function(t) {
							y = t;
						};
						this.avoidAdditionalPoint = function(t, n) {
							if (u[n] === undefined) {
								u[n] = {};
							}
							u[n][t] = 1;
						};
						this.stopAvoidingAdditionalPoint = function(t, n) {
							if (u[n] !== undefined) {
								delete u[n][t];
							}
						};
						this.enableCornerCutting = function() {
							a = true;
						};
						this.disableCornerCutting = function() {
							a = false;
						};
						this.stopAvoidingAllAdditionalPoints = function() {
							u = {};
						};
						this.findPath = function(t, n, e, o, r) {
							function i(t) {
								if (p) {
									r(t);
								} else {
									setTimeout(function() {
										r(t);
									});
								}
							}
							if (f === undefined) {
								throw new Error("You can't set a path without first calling setAcceptableTiles() on EasyStar.");
							}
							if (c === undefined) {
								throw new Error("You can't set a path without first calling setGrid() on EasyStar.");
							}
							if (t < 0 || n < 0 || e < 0 || o < 0 || t > c[0].length - 1 || n > c.length - 1 || e > c[0].length - 1 || o > c.length - 1) {
								throw new Error("Your start or end point is outside the scope of your grid.");
							}
							if (t !== e || n !== o) {
								var s = c[o][e];
								var u = false;
								for (var l = 0; l < f.length; l++) {
									if (s === f[l]) {
										u = true;
										break;
									}
								}
								if (u !== false) {
									var a = new M();
									a.openList = new A(function(t, n) {
										return t.bestGuessDistance() - n.bestGuessDistance();
									});
									a.isDoneCalculating = false;
									a.nodeHash = {};
									a.startX = t;
									a.startY = n;
									a.endX = e;
									a.endY = o;
									a.callback = i;
									a.openList.push(O(a, a.startX, a.startY, null, 1));
									o = E++;
									h[o] = a;
									d.push(o);
									return o;
								}
								i(null);
							} else {
								i([]);
							}
						};
						this.cancelPath = function(t) {
							return t in h && (delete h[t], true);
						};
						this.calculate = function() {
							if (d.length !== 0 && c !== undefined && f !== undefined) {
								for (i = 0; i < y; i++) {
									if (d.length === 0) {
										return;
									}
									if (p) {
										i = 0;
									}
									var t = d[0];
									var n = h[t];
									if (n !== undefined) {
										if (n.openList.size() !== 0) {
											var e = n.openList.pop();
											if (n.endX !== e.x || n.endY !== e.y) {
												if ((e.list = 0) < e.y) {
													T(n, e, 0, -1, +b(e.x, e.y - 1));
												}
												if (e.x < c[0].length - 1) {
													T(n, e, 1, 0, +b(e.x + 1, e.y));
												}
												if (e.y < c.length - 1) {
													T(n, e, 0, 1, +b(e.x, e.y + 1));
												}
												if (e.x > 0) {
													T(n, e, -1, 0, +b(e.x - 1, e.y));
												}
												if (v) {
													if (e.x > 0 && e.y > 0 && (a || g(c, f, e.x, e.y - 1, e) && g(c, f, e.x - 1, e.y, e))) {
														T(n, e, -1, -1, s * b(e.x - 1, e.y - 1));
													}
													if (e.x < c[0].length - 1 && e.y < c.length - 1 && (a || g(c, f, e.x, e.y + 1, e) && g(c, f, e.x + 1, e.y, e))) {
														T(n, e, 1, 1, s * b(e.x + 1, e.y + 1));
													}
													if (e.x < c[0].length - 1 && e.y > 0 && (a || g(c, f, e.x, e.y - 1, e) && g(c, f, e.x + 1, e.y, e))) {
														T(n, e, 1, -1, s * b(e.x + 1, e.y - 1));
													}
													if (e.x > 0 && e.y < c.length - 1 && (a || g(c, f, e.x, e.y + 1, e) && g(c, f, e.x - 1, e.y, e))) {
														T(n, e, -1, 1, s * b(e.x - 1, e.y + 1));
													}
												}
											} else {
												var o = [];
												o.push({
													x: e.x,
													y: e.y
												});
												for (var r = e.parent; r != null;) {
													o.push({
														x: r.x,
														y: r.y
													});
													r = r.parent;
												}
												o.reverse();
												n.callback(o);
												delete h[t];
												d.shift();
											}
										} else {
											n.callback(null);
											delete h[t];
											d.shift();
										}
									} else {
										d.shift();
									}
								}
							}
						};

						function T(t, n, e, o, r) {
							e = n.x + e;
							o = n.y + o;
							if ((u[o] === undefined || u[o][e] === undefined) && !!g(c, f, e, o, n)) {
								if ((o = O(t, e, o, n, r)).list === undefined) {
									o.list = 1;
									t.openList.push(o);
								} else if (n.costSoFar + r < o.costSoFar) {
									o.costSoFar = n.costSoFar + r;
									o.parent = n;
									t.openList.updateItem(o);
								}
							}
						}

						function g(t, n, e, o, r) {
							var i = l[o] && l[o][e];
							if (i) {
								var s = x(r.x - e, r.y - o);
								if (! function() {
										for (var t = 0; t < i.length; t++) {
											if (i[t] === s) {
												return true;
											}
										}
										return false;
									}()) {
									return false;
								}
							}
							for (var u = 0; u < n.length; u++) {
								if (t[o][e] === n[u]) {
									return true;
								}
							}
							return false;
						}

						function x(t, n) {
							if (t === 0 && n === -1) {
								return P.TOP;
							}
							if (t === 1 && n === -1) {
								return P.TOP_RIGHT;
							}
							if (t === 1 && n === 0) {
								return P.RIGHT;
							}
							if (t === 1 && n === 1) {
								return P.BOTTOM_RIGHT;
							}
							if (t === 0 && n === 1) {
								return P.BOTTOM;
							}
							if (t === -1 && n === 1) {
								return P.BOTTOM_LEFT;
							}
							if (t === -1 && n === 0) {
								return P.LEFT;
							}
							if (t === -1 && n === -1) {
								return P.TOP_LEFT;
							}
							throw new Error("These differences are not valid: " + t + ", " + n);
						}

						function b(t, n) {
							return r[n] && r[n][t] || o[c[n][t]];
						}

						function O(t, n, e, o, r) {
							if (t.nodeHash[e] !== undefined) {
								if (t.nodeHash[e][n] !== undefined) {
									return t.nodeHash[e][n];
								}
							} else {
								t.nodeHash[e] = {};
							}
							var i = m(n, e, t.endX, t.endY);
							var r = o !== null ? o.costSoFar + r : 0;
							var i = new _(o, n, e, r, i);
							return t.nodeHash[e][n] = i;
						}

						function m(t, n, e, o) {
							var r;
							var i;
							if (v) {
								if ((r = Math.abs(t - e)) < (i = Math.abs(n - o))) {
									return s * r + i;
								} else {
									return s * i + r;
								}
							} else {
								return (r = Math.abs(t - e)) + (i = Math.abs(n - o));
							}
						}
					};
					P.TOP = "TOP";
					P.TOP_RIGHT = "TOP_RIGHT";
					P.RIGHT = "RIGHT";
					P.BOTTOM_RIGHT = "BOTTOM_RIGHT";
					P.BOTTOM = "BOTTOM";
					P.BOTTOM_LEFT = "BOTTOM_LEFT";
					P.LEFT = "LEFT";
					P.TOP_LEFT = "TOP_LEFT";
				}, function(t, n) {
					t.exports = function() {
						this.pointsToAvoid = {};
						this.startX;
						this.callback;
						this.startY;
						this.endX;
						this.endY;
						this.nodeHash = {};
						this.openList;
					};
				}, function(t, n) {
					t.exports = function(t, n, e, o, r) {
						this.parent = t;
						this.x = n;
						this.y = e;
						this.costSoFar = o;
						this.simpleDistanceToTarget = r;
						this.bestGuessDistance = function() {
							return this.costSoFar + this.simpleDistanceToTarget;
						};
					};
				}, function(t, n, e) {
					t.exports = e(4);
				}, function(u, T, t) {
					var g;
					var x;
					(function() {
						var t;
						var p;
						var l;
						var h;
						var d;
						var n;
						var a;
						var e;
						var y;
						var v;
						var o;
						var r;
						var i;
						var c;
						var f;

						function s(t) {
							this.cmp = t ?? p;
							this.nodes = [];
						}
						l = Math.floor;
						v = Math.min;
						p = function(t, n) {
							if (t < n) {
								return -1;
							} else if (n < t) {
								return 1;
							} else {
								return 0;
							}
						};
						y = function(t, n, e, o, r) {
							var i;
							if (e == null) {
								e = 0;
							}
							if (r == null) {
								r = p;
							}
							if (e < 0) {
								throw new Error("lo must be non-negative");
							}
							for (o == null && (o = t.length); e < o;) {
								if (r(n, t[i = l((e + o) / 2)]) < 0) {
									o = i;
								} else {
									e = i + 1;
								}
							}
							[].splice.apply(t, [e, e - e].concat(n));
							return n;
						};
						n = function(t, n, e) {
							if (e == null) {
								e = p;
							}
							t.push(n);
							return c(t, 0, t.length - 1, e);
						};
						d = function(t, n) {
							var e;
							var o;
							if (n == null) {
								n = p;
							}
							e = t.pop();
							if (t.length) {
								o = t[0];
								t[0] = e;
								f(t, 0, n);
							} else {
								o = e;
							}
							return o;
						};
						e = function(t, n, e) {
							var o;
							if (e == null) {
								e = p;
							}
							o = t[0];
							t[0] = n;
							f(t, 0, e);
							return o;
						};
						a = function(t, n, e) {
							var o;
							if (e == null) {
								e = p;
							}
							if (t.length && e(t[0], n) < 0) {
								n = (o = [t[0], n])[0];
								t[0] = o[1];
								f(t, 0, e);
							}
							return n;
						};
						h = function(e, t) {
							var n;
							var o;
							var r;
							var i;
							var s;
							var u;
							if (t == null) {
								t = p;
							}
							s = [];
							o = 0;
							r = (i = function() {
								u = [];
								for (var t = 0, n = l(e.length / 2); n >= 0 ? t < n : n < t; n >= 0 ? t++ : t--) {
									u.push(t);
								}
								return u;
							}.apply(this).reverse()).length;
							for (; o < r; o++) {
								n = i[o];
								s.push(f(e, n, t));
							}
							return s;
						};
						i = function(t, n, e) {
							if (e == null) {
								e = p;
							}
							if ((n = t.indexOf(n)) !== -1) {
								c(t, 0, n, e);
								return f(t, n, e);
							}
						};
						o = function(t, n, e) {
							var o;
							var r;
							var i;
							var s;
							var u;
							if (e == null) {
								e = p;
							}
							if (!(r = t.slice(0, n)).length) {
								return r;
							}
							h(r, e);
							i = 0;
							s = (u = t.slice(n)).length;
							for (; i < s; i++) {
								o = u[i];
								a(r, o, e);
							}
							return r.sort(e).reverse();
						};
						r = function(t, n, e) {
							var o;
							var r;
							var i;
							var s;
							var u;
							var l;
							var a;
							var c;
							var f;
							if (e == null) {
								e = p;
							}
							if (n * 10 <= t.length) {
								if (!(i = t.slice(0, n).sort(e)).length) {
									return i;
								}
								r = i[i.length - 1];
								s = 0;
								l = (a = t.slice(n)).length;
								for (; s < l; s++) {
									if (e(o = a[s], r) < 0) {
										y(i, o, 0, null, e);
										i.pop();
										r = i[i.length - 1];
									}
								}
								return i;
							}
							h(t, e);
							f = [];
							u = 0;
							c = v(n, t.length);
							for (; c >= 0 ? u < c : c < u; c >= 0 ? ++u : --u) {
								f.push(d(t, e));
							}
							return f;
						};
						c = function(t, n, e, o) {
							var r;
							var i;
							var s;
							if (o == null) {
								o = p;
							}
							r = t[e];
							while (n < e && o(r, i = t[s = e - 1 >> 1]) < 0) {
								t[e] = i;
								e = s;
							}
							return t[e] = r;
						};
						f = function(t, n, e) {
							var o;
							var r;
							var i;
							var s;
							var u;
							if (e == null) {
								e = p;
							}
							r = t.length;
							i = t[u = n];
							o = n * 2 + 1;
							while (o < r) {
								if ((s = o + 1) < r && e(t[o], t[s]) >= 0) {
									o = s;
								}
								t[n] = t[o];
								o = (n = o) * 2 + 1;
							}
							t[n] = i;
							return c(t, u, n, e);
						};
						s.push = n;
						s.pop = d;
						s.replace = e;
						s.pushpop = a;
						s.heapify = h;
						s.updateItem = i;
						s.nlargest = o;
						s.nsmallest = r;
						s.prototype.push = function(t) {
							return n(this.nodes, t, this.cmp);
						};
						s.prototype.pop = function() {
							return d(this.nodes, this.cmp);
						};
						s.prototype.peek = function() {
							return this.nodes[0];
						};
						s.prototype.contains = function(t) {
							return this.nodes.indexOf(t) !== -1;
						};
						s.prototype.replace = function(t) {
							return e(this.nodes, t, this.cmp);
						};
						s.prototype.pushpop = function(t) {
							return a(this.nodes, t, this.cmp);
						};
						s.prototype.heapify = function() {
							return h(this.nodes, this.cmp);
						};
						s.prototype.updateItem = function(t) {
							return i(this.nodes, t, this.cmp);
						};
						s.prototype.clear = function() {
							return this.nodes = [];
						};
						s.prototype.empty = function() {
							return this.nodes.length === 0;
						};
						s.prototype.size = function() {
							return this.nodes.length;
						};
						s.prototype.clone = function() {
							var t = new s();
							t.nodes = this.nodes.slice(0);
							return t;
						};
						s.prototype.toArray = function() {
							return this.nodes.slice(0);
						};
						s.prototype.insert = s.prototype.push;
						s.prototype.top = s.prototype.peek;
						s.prototype.front = s.prototype.peek;
						s.prototype.has = s.prototype.contains;
						s.prototype.copy = s.prototype.clone;
						t = s;
						g = [];
						if ((x = typeof(x = function() {
								return t;
							}) == "function" ? x.apply(T, g) : x) !== undefined) {
							u.exports = x;
						}
					}).call(this);
				}]);
				let easystar = new EasyStar.js();
				(function(run) {
					if (!run) {
						return;
					}
					let codes = {
						setup: () => {
							"use strict";

							let newFont = document.createElement("link");
							newFont.rel = "stylesheet";
							newFont.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Ubuntu:wght@700&display=swap";
							newFont.type = "text/css";
							document.body.append(newFont);
							let min = document.createElement("script");
							min.src = "https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js";
							document.body.append(min);
						},
						VapeClient: () => {
							if (!useHack) {
								return;
							}
							let config = window.config;
							// CLIENT:
							config.clientSendRate = 0; // aim packet send rate
							config.serverUpdateRate = 9;
							// UI:
							config.deathFadeout = 0;
							// CHECK IN SANDBOX:
							config.isSandbox = window.location.hostname == "sandbox.moomoo.io";
							// CUSTOMIZATION:
							config.skinColors = ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373", "#91b2db"];
							config.weaponVariants = [{
								id: 0,
								src: "",
								xp: 0,
								val: 1
							}, {
								id: 1,
								src: "_g",
								xp: 3000,
								val: 1.1
							}, {
								id: 2,
								src: "_d",
								xp: 7000,
								val: 1.18
							}, {
								id: 3,
								src: "_r",
								poison: true,
								xp: 12000,
								val: 1.18
							}, {
								id: 4,
								src: "_e",
								poison: true,
								heal: true,
								xp: 24000,
								val: 1.18
							}];
							// VISUAL:
							config.anotherVisual = true;
							config.useWebGl = true;
							config.resetRender = false;
							// VOLCANO:
							config.volcanoouterScale = 340;
							config.volcanoinnerScale = 115;
							config.volcanoAnimDuration = 3200;
							config.volcanoanimationSpeed = 16;
							config.volcanoradius = 1440;
							config.volcanopercentage = 0.2;
							config.volcanox = 14400 - 440;
							config.volcanoy = 14400 - 440;
							config.volcanoanimationTime = 0;

							function waitTime(timeout) {
								return new Promise(done => {
									setTimeout(() => {
										done();
									}, timeout);
								});
							}
							let changed = false;
							// STORAGE:
							let canStore;
							if (typeof Storage !== "undefined") {
								canStore = true;
							}

							function saveVal(name, val) {
								if (canStore) {
									localStorage.setItem(name, val);
								}
							}

							function deleteVal(name) {
								if (canStore) {
									localStorage.removeItem(name);
								}
							}

							function getSavedVal(name) {
								if (canStore) {
									return localStorage.getItem(name);
								}
								return null;
							}
							// CONFIGS:
							let gC = function(a, b) {
								try {
									let res = JSON.parse(getSavedVal(a));
									if (typeof res === "object") {
										return b;
									} else {
										return res;
									}
								} catch (e) {

									return b;
								}
							};

							function setConfigs() {
								return {
									KillChat: true,
									autoBuy: true,
									autoBuyEquip: true,
									autoPush: true,
									revTick: false,
									spikeTick: false,
									predictTick: false,
									autoPlace: true,
									autoReplace: true,
									antiTrap: true,
									slowOT: false,
									attackDir: false,
									noDir: false,
									showDir: false,
									autoRespawn: true
								};
							}
							let configs = setConfigs();
							window.removeConfigs = function() {
								for (let cF in configs) {
									deleteVal(cF, configs[cF]);
								}
							};
							for (let cF in configs) {
								configs[cF] = gC(cF, configs[cF]);
							}
							let main = {
								currentValue: "",
								killsound: {
									enabled: false
								},
								ObsessiveChat: {
									enabled: false
								},
								StatsGraph: {
									enabled: false
								},
								EnemyAlarm: {
									enabled: false
								},
								CamMove: {
									enabled: false
								},
								ChatBox: {
									enabled: true
								},
								KatanaMusket: {
									enabled: true
								},
								BuildHealth: {
									enabled: true
								},
								AutoHeal: {
									enabled: true
								},
								AutoUpgrade: {
									enabled: false
								},
								AutoAccept: {
									enabled: false
								},
								coolreload: {
									enabled: false
								},
								nativeStatsGraphics: {
									enabled: true
								},
								Greetings: {
									enabled: false
								},
								Grids: {
									enabled: true
								},
								Volcano: {
									enabled: true
								},
								dmgText: {
									enabled: false
								},
								RealDir: {
									enabled: false
								},
								AutoGrind: {
									enabled: false
								},
								pvpMode: {
									enabled: false
								},
								AutoPush: {
									enabled: false
								},
								placementIndicator: {
									enabled: false
								},
								AutoHit: {
									enabled: false
								},
								AutoSpin: {
									enabled: false
								},
								ShowCords: {
									enabled: false
								},
								FPSBoostBeta: {
									enabled: true
								},
								PlayTime: {
									enabled: false
								},
								resolutionValue: {
									value: 0.9
								},
								Bots: {
									enabled: false
								},
								autoQual: {
									enabled: true
								},
								autoInsta: {
									enabled: false
								},
								Preplacer: {
									enabled: true
								},
								autoplace: {
									enabled: false
								},
								autoreplace: {
									enabled: false
								},
								avoidSpikes: {
									enabled: false
								},
								AvoidTeleport: {
									enabled: false
								},
								bots: {
									spawn: function() {},
									spawned: false
								},
								autobreak: {
									enabled: true
								},
								HatSwitch: {
									enabled: false
								},
								ReloadBars: {
									enabled: false
								},
								Music: {
									enabled: false
								},
								tracers: {
									enabled: true
								},
								extm: {
									enabled: true
								}
							};

							/// NOTIFICATIONS
							const BeautifyPage = () => {
								$("#gameUI").append(Notifications);
							};
							setTimeout(BeautifyPage, 15000);
							const Notifications = `<div class="notifications-holder"></div><style>
    .box {
        width: max-content;
        height: 30px;
        display: flex;
        align-items: center;
        background: rgba(0, 0, 0, .25);
        border-radius: 4px;
        padding: 5px;
        margin-bottom: 5px;
        position: relative;
    }
    .notifications-holder {
        position: absolute;
        left: 150px;
        top: 60px;
        display: flex;
        flex-direction: column;
    }
    .notification-background {
    position: absolute;
    display: block;
    width: 18px;
    height: 18px;
    top: 8.5px;
    left: 8.5px;
    border-radius: 2px;
    }

.notification-text {
    font-size: 20px;
    color: #fff;
    white-space: nowrap;
    margin-left: 30px;
}
    .box::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background-color: #ffffff;
        animation: moveLine 10s linear forwards;
    }
    @keyframes moveLine {
        to {
            width: 0%;
        }
    }
</style>`;
							let activeNotifs = 0;
							let Element;

function Notify(text = "Hello World!", color = "#fff") {
    if (typeof color === "boolean") {
        color = "linear-gradient(90deg, #7289da 0%, #1f5edb 80%)";
    }
    if (activeNotifs > 10) {
        return;
    }
    let ElementId = "Notification-" + ~~(Math.random() * 3000);
    let Html = `
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
<div class="box" id="${ElementId}" style="display: flex; align-items: center; justify-content: center; opacity: 0;">
    <div class="notification-background" style="background: ${color};"><i class="fas fa-exclamation" style="color: #fff;"></i></div>
    <span class="notification-text" style="color: #fff;">
        ${text}
    </span>
</div>
    `;
    $(".notifications-holder").prepend(Html);
    Element = $(`#${ElementId}`);
    Element.show().animate({
        opacity: 1
    }, 750);
    activeNotifs++;
    setTimeout(() => {
        Element = $(`#${ElementId}`);
        Element.animate({
            opacity: 0
        }, 750, () => {
            $(`#${ElementId}`).remove();
            activeNotifs--;
        });
    }, 10000);
}

							/// SMOOTHEST HUD
							document.getElementById("diedText").innerHTML = " ";
							document.getElementById("diedText").style.color = "#ffffff";
							document.getElementById("storeHolder").style = "height: 850px; width: 430px; overflow: hidden; overflow-y: scroll; scrollbar-color: transparent transparent; scrollbar-width: thin; overflow-x: hidden;";
							document.getElementById("storeMenu").style = "padding-right: 20px; overflow-y: scroll; scrollbar-color: transparent transparent; scrollbar-width: thin; overflow-x: hidden; margin-left: 800px; margin-top: 50px;";
							document.getElementById("guideCard").style = "overflow-y: scroll; scrollbar-color: transparent transparent; scrollbar-width: thin; overflow-x: hidden;";
							document.getElementById("allianceMenu").style = "margin-left: -700px; margin-top: 700px; height: 820px; overflow: hidden; scrollbar-width: thin; scrollbar-color: transparent transparent;";
							$("#itemInfoHolder").css({
								top: "250px",
								left: "15px",
								width: "600px",
								height: "150px"
							});
							document.querySelector("#joinPartyButton").remove();
							document.querySelector("#pre-content-container").remove();
							document.getElementById("gameName").innerHTML = "";
							let changes2 = `<div></div>`;
							$("#gameName").prepend(changes2);
							$("#gameName").css({
								color: "#333",
								"text-align": "center",
								"font-size": "156px",
								"margin-bottom": "-30px"
							});
							$("#youtuberOf").remove();
							$("#adCard").remove();
							$("#itemInfoLmt").remove();
							$(".itemInfoLmt").remove();
							$("#mobileInstructions").remove();
							$("#downloadButtonContainer").remove();
							$("#mobileDownloadButtonContainer").remove();
							$(".downloadBadge").remove();
							let css = document.createElement("style");
							css.type = "text/css";
							css.appendChild(document.createTextNode(`
.actionBarItem {
    width: 66px;
    height: 66px;
    margin-right: 6px;
    background-color: #00000050;
    -webkit-border-radius: 0px;
    -moz-border-radius: 0px;
    border-radius: 5px;
    display: inline-block;
    cursor: pointer;
    pointer-events: all;
    background-size: cover;
    backdrop-filter: blur(5px);
    box-shadow: 0px 0px 10px #00000050;
}
#ageBarContainer {
    width: 100%;
    bottom: 120px;
    text-align: center;
}
#ageBar {
    background-color: #00000050;
    -webkit-border-radius: 8px;
    -moz-border-radius: 8px;
    border-radius: 8px;
    padding: 5px;
    width: 314px;
    height: 10px;
    display: inline-block;
    margin-bottom: 8px;
    backdrop-filter: blur(5px);
    box-shadow: 0px 0px 10px #00000050;
}
.gameButton, #leaderboard, .resourceDisplay, #mapDisplay, #allianceHolder, #allianceInput, .allianceButtonM, #storeHolder, .storeTab, #chatBox, .chDiv, #itemInfoHolder {
    background-color: #00000050;
    backdrop-filter: blur(5px);
    box-shadow: 0px 0px 20px #00000050;
}

`));
							document.head.appendChild(css);

							/// VAPE V4 LOGO
							document.addEventListener("contextmenu", function(event) {
								event.preventDefault();
							});

							function createImageElement(src, alt) {
								const img = document.createElement("img");
								img.src = src;
								img.alt = alt;
								img.style.position = "absolute";
								img.style.top = "10px";
								img.style.left = "10px";
								img.style.width = "100px";
								img.style.height = "auto";
								img.style.zIndex = "9999";
								return img;
							}
							const container = document.body;
							const logo = createImageElement("https://i.imgur.com/WfsO92A.png", "Logo");
							container.appendChild(logo);
							document.querySelector("#leaderboard").innerHTML = document.querySelector("#leaderboard").innerHTML.slice(11);

							/// GUI MENU
							let concept = document.createElement("div");
							concept.id = "menu";
							concept.innerHTML = `
<div id="concept" class="concept">
    <div class="title" oncontextmenu="return false;">
        <div class="Icon"><i class="fa-solid fa-hand-fist"></i></div>
        Combat
    </div>
    <div id="AutoHeal" class="menuTab" oncontextmenu="return false;">Auto Heal</div>
    <div id="AutoInsta" class="menuTab" oncontextmenu="return false;">Auto Insta</div>
    <div id="AutoHit" class="menuTab" oncontextmenu="return false;">Auto Hit</div>
    <div id="AutoBreak" class="menuTab" oncontextmenu="return false;">Auto Break</div>
    <div id="AvoidTeleport" class="menuTab" oncontextmenu="return false;">Avoid Teleports</div>
    <div id="AvoidSpikes" class="menuTab" oncontextmenu="return false;">Avoid Spikes</div>
    <div id="AutoPush" class="menuTab" oncontextmenu="return false;">Auto Push</div>
    <div id="AntiTrap" class="menuTab" oncontextmenu="return false;">Anti Trap</div>
    <div id="AutoPlace" class="menuTab" oncontextmenu="return false;">Auto Place</div>
    <div id="AutoRePlace" class="menuTab" oncontextmenu="return false;">Auto Replace</div>
    <div id="Preplacer" class="menuTab" oncontextmenu="return false;">Preplacer</div>
    <div id="SpikeSync" class="menuTab" oncontextmenu="return false;">Spike Sync</div>
</div>

<div id="concept2" class="concept">
    <div class="title" oncontextmenu="return false;">
        <div class="Icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
        Visual
    </div>
    <div id="Modules" class="menuTab" oncontextmenu="return false;">Dark Mode</div>
    <div id="RealDir" class="menuTab" oncontextmenu="return false;">Real Direction</div>
    <div id="KatanaMusket" class="menuTab" oncontextmenu="return false;">Katana Musket</div>
    <div id="BuildHealth" class="menuTab" oncontextmenu="return false;">Build Overlay</div>
    <div id="ReloadBars" class="menuTab" oncontextmenu="return false;">Reload Bars</div>
    <div id="Volcano" class="menuTab" oncontextmenu="return false;">Volcano Zones</div>
    <div id="Placement" class="menuTab" oncontextmenu="return false;">Placement</div>
    <div id="CamMove" class="menuTab" oncontextmenu="return false;">Cam Move</div>
    <div id="Tracers" class="menuTab" oncontextmenu="return false;">Tracers</div>
    <div id="Shaders" class="menuTab" oncontextmenu="return false;">Shaders</div>
    <div id="Grids" class="menuTab" oncontextmenu="return false;">Grids</div>
</div>

<div id="concept4" class="concept">
    <div class="title" oncontextmenu="return false;">
        <div class="Icon"><i class="fa-solid fa-bolt"></i></div>
        Fun
    </div>
    <div id="Music" class="menuTab" oncontextmenu="return false;">Music Menu</div>
    <div id="EnemyAlarm" class="menuTab" oncontextmenu="return false;">Enemy Alarm</div>
    <div id="AutoSpin" class="menuTab" oncontextmenu="return false;">Auto Spin</div>
    <div id="Greetings" class="menuTab" oncontextmenu="return false;">Greetings</div>
    <div id="HatSwitch" class="menuTab" oncontextmenu="return false;">Hat Loop</div>
    <div id="KillChat" class="menuTab" oncontextmenu="return false;">Kill Chat</div>
    <div id="KillSound" class="menuTab dropdown" oncontextmenu="return false;">
        <span class="dropdown-toggle" id="killSoundDropdown" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Kill Sound</span>
        <div class="dropdown-menu" aria-labelledby="killSoundDropdown">
            <span class="dropdown-item" data-module="module1">OGH</span>
            <span class="dropdown-item" data-module="module2">MOAN</span>
            <span class="dropdown-item" data-module="module3">SUS</span>
            <span class="dropdown-item" data-module="module4">CSGO</span>
        </div>
    </div>
</div>

<div id="concept5" class="concept">
    <div class="title" oncontextmenu="return false;">
        <div class="Icon"><i class="fa-solid fa-robot"></i></div>
        Bots
    </div>
    <div id="Bots" class="menuTab" oncontextmenu="return false;">Coming Soon..</div>
</div>

<div id="concept3" class="concept">
    <div class="title" oncontextmenu="return false;">
        <div class="Icon"><i class="fa-solid fa-gear"></i></div>
        Client
    </div>
    <div id="AutoUpgrade" class="menuTab" oncontextmenu="return false;">Auto Upgrade</div>
    <div id="autoRespawn" class="menuTab" oncontextmenu="return false;">Auto Respawn</div>
    <div id="AutoAccept" class="menuTab" oncontextmenu="return false;">Auto Accept</div>
    <div id="AutoGrind" class="menuTab" oncontextmenu="return false;">Auto Grind</div>
    <div id="PlayTime" class="menuTab" oncontextmenu="return false;">Show Playtime</div>
    <div id="ShowCords" class="menuTab" oncontextmenu="return false;">Show Cords</div>
    <div id="StatsGraph" class="menuTab" oncontextmenu="return false;">Stats Graph</div>
    <div id="ObsessiveChat" class="menuTab" oncontextmenu="return false;">Comments</div>
    <div id="ChatBox" class="menuTab" oncontextmenu="return false;">Chat Logs</div>
    <div id="Credits" class="menuTab" oncontextmenu="return false;">Credits</div>
</div>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css" integrity="sha512-SzlrxWUlpfuzQ+pcUCosxcglQRNAq/DZjVsC0lE40xsADsfeQoEypE+enwcOiGjk/bSuGGKHEyjSoQ1zVisanQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
`;
							let ConceptCSS = document.createElement("style");
							ConceptCSS.type = "text/css";
							ConceptCSS.appendChild(document.createTextNode(`
#menu {
    position: absolute;
    display: block;
    top: 9%;
    left: 0;
    width: 100%;
    height: auto;
}

#KillSound .dropdown-menu .dropdown-item {
    font-weight: normal;
    font-size: 15px;
}

#killSoundDropdown {
    font-weight: normal;
    font-size: 15px;
}

#concept {
    transform: translateX(-175%);
}

#concept3 {
    transform: translateX(75%);
}

#concept4 {
    transform: translateX(200%);
}

#concept5 {
    transform: translateX(-300%);
}

.concept {
    position: absolute;
    display: block;
    width: 185px;
    height: auto;
    max-height: auto;
    background: #282c31;
    color: white;
    overflow: hidden;
    pointer-events: all;
    left: 50%;
    transform: translateX(-50%);
}

.Icon {
    position: absolute;
    display: block;
    width: 18px;
    height: 18px;
    top: 8.5px;
    left: 8.5px;
    background: linear-gradient(90deg, #7289da 0%, #1f5edb 80%);
    border-radius: 2px;
}

.fa-robot,
.fa-exclamation,
.fa-hand-fist,
.fa-bolt,
.fa-times,
.fa-wand-magic-sparkles,
.fa-gun,
.fa-paintbrush,
.fa-gear {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.title {
    position: relative;
    display: block;
    text-align: center;
    width: 100%;
    height: 35px;
    left: 50%;
    transform: translateX(-50%);
    background: #282c31;
    font-size: 15px;
    font-family: sans-serif;
    font-weight: bold;
    line-height: 35px;
}

.menuTab {
    position: relative;
    display: block;
    width: 100%;
    height: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: #32373e;
    line-height: 30px;
    margin-top: 3px;
    font-weight: bold;
    font-size: 15px;
    font-family: sans-serif;
    text-align: center;
}

.dropdown-menu {
    background-color: #282c31;
    color: white;
}

.dropdown-item {
    padding: 3px 20px;
    cursor: pointer;
}

.dropdown-item:hover {
    background-color: #7289da;
}

.selected {
    background-color: #7289da;
    color: #fff;
}

   .button {
      padding: 10px 20px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      outline: none;
      transition: background-color 0.3s ease;
    }

    .button.enabled-animation {
      animation: button-animation 0.5s ease;
    }

    @keyframes button-animation {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.2);
      }
      100% {
        transform: scale(1);
      }
    }

`));
							document.body.append(concept);
							document.body.appendChild(ConceptCSS);
							const gameUI = document.getElementById("gameUI");
							const title = document.getElementById("title");
							const InstaKill = document.getElementById("InstaKill");
							const AvoidSpikes = document.getElementById("AvoidSpikes");
							const AvoidTeleport = document.getElementById("AvoidTeleport");
							const AutoPlace = document.getElementById("AutoPlace");
							const AutoPush = document.getElementById("AutoPush");
							const AutoRePlace = document.getElementById("AutoRePlace");
							const Tracers = document.getElementById("Tracers");
							const Shaders = document.getElementById("Shaders");
							const External = document.getElementById("External");
							const ObsessiveChat = document.getElementById("ObsessiveChat");
							const KillSound = document.getElementById("KillSound");
							const AutoUpgrade = document.getElementById("AutoUpgrade");
							const autoRespawn = document.getElementById("autoRespawn");
							const AutoAccept = document.getElementById("AutoAccept");
							const HatSwitch = document.getElementById("HatSwitch");
							const RealDir = document.getElementById("RealDir");
							const KillChat = document.getElementById("KillChat");
							const Credits = document.getElementById("Credits");
							const Bots = document.getElementById("Bots");
							const BuildHealth = document.getElementById("BuildHealth");
							const Placement = document.getElementById("Placement");
							const ChatBox = document.getElementById("ChatBox");
							const PlayTime = document.getElementById("PlayTime");
							const Music = document.getElementById("Music");
							const Greetings = document.getElementById("Greetings");
							const KatanaMusket = document.getElementById("KatanaMusket");
							const StatsGraph = document.getElementById("StatsGraph");
							const ShowCords = document.getElementById("ShowCords");
							const CamMove = document.getElementById("CamMove");
							const Grids = document.getElementById("Grids");
							const Volcano = document.getElementById("Volcano");
							const EnemyAlarm = document.getElementById("EnemyAlarm");
							const AutoHit = document.getElementById("AutoHit");
							const AutoSpin = document.getElementById("AutoSpin");
							document.getElementById("KillSound").addEventListener("click", function() {
								var dropdownMenu = document.querySelector("#KillSound .dropdown-menu");
								dropdownMenu.classList.toggle("show");
								var dropdownItems = dropdownMenu.querySelectorAll(".dropdown-item");
								var dropdownHeight = dropdownItems.length * 30;
								dropdownMenu.style.height = dropdownHeight + "px";
							});
							document.querySelectorAll("#KillSound .dropdown-item").forEach(item => {
								item.addEventListener("click", event => {
									var selectedModule = event.target.dataset.module;
									document.querySelectorAll("#KillSound .dropdown-item").forEach(item => {
										item.classList.remove("selected");
									});
									event.target.classList.add("selected");
								});
							});

							Credits.addEventListener("click", function() {
								window.open("https://pashka.me", "_blank");
							});

							window.onclick = function(event) {
								if (!event.target.matches(".dropdown-toggle")) {
									var dropdowns = document.getElementsByClassName("dropdown-menu");
									for (var i = 0; i < dropdowns.length; i++) {
										var openDropdown = dropdowns[i];
										if (openDropdown.classList.contains("show")) {
											openDropdown.classList.remove("show");
										}
									}
								}
							};

							function toggleMenuHeight() {
								var menu = document.getElementById("menu");
								menu.style.display = menu.style.display === "none" ? "block" : "none";
							}

							document.addEventListener("keydown", function(event) {
								if (event.code === "ShiftRight") {
									toggleMenuHeight();
								}
							});

							function toggleHeight(elementId, texts) {
								var element = $("#" + elementId);
								if (element.height() == 30) {
									element.animate({
										height: 90
									}, 500);
								} else {
									element.animate({
										height: 30
									}, 500);
								}
								if (texts && Array.isArray(texts)) {
									texts.forEach(text => {
										var newItem = document.createElement("div");
										newItem.textContent = text;
										newItem.classList.add("dropdown-item");
										element.append(newItem);
									});
								}
							}

							function toggleHeight(elementId, texts) {
								var element = $("#" + elementId);
								if (element.height() == 30) {
									element.animate({
										height: 90
									}, 200);
								} else {
									element.animate({
										height: 30
									}, 200);
								}

								if (texts && Array.isArray(texts)) {
									texts.forEach(text => {
										var newItem = document.createElement("div");
										newItem.textContent = text;
										newItem.classList.add("dropdown-item");

										$(newItem).click(function(event) {
											event.stopPropagation();
										});
										element.append(newItem);
									});
								}

								element.children(".dropdown-item").css({
									"background-color": "#282c31",
									"font-weight": "normal",
									"font-size": "14px",
									"text-align": "left",
									"pointer-events": "none",
									cursor: "default"
								});
							}

							// SANDBOX
							if (location.hostname == "sandbox.moomoo.io") {
								document.getElementById("foodDisplay").style.display = "none";
								document.getElementById("woodDisplay").style.display = "none";
								document.getElementById("stoneDisplay").style.display = "none";
								main.autoplace.enabled = true;
								main.autoInsta.enabled = true;
								configs.spikeTick = true;
								main.AutoUpgrade.enabled = true;
								main.autoreplace.enabled = true;
							}

							function initializeMenuColors() {
								const menuItems = [{
									id: "AutoHeal",
									state: main.AutoHeal.enabled
								}, {
									id: "AutoInsta",
									state: main.autoInsta.enabled
								}, {
									id: "BuildHealth",
									state: main.BuildHealth.enabled
								}, {
									id: "AutoBreak",
									state: main.autobreak.enabled
								}, {
									id: "EnemyAlarm",
									state: main.EnemyAlarm.enabled
								}, {
									id: "KillChat",
									state: configs.KillChat
								}, {
									id: "AvoidSpikes",
									state: main.avoidSpikes.enabled
								}, {
									id: "AvoidTeleport",
									state: main.AvoidTeleport.enabled
								}, {
									id: "BuildHealth",
									state: main.BuildHealth.enabled
								}, {
									id: "AntiTrap",
									state: configs.antiTrap
								}, {
									id: "AutoPlace",
									state: main.autoplace.enabled
								}, {
									id: "KatanaMusket",
									state: true
								}, {
									id: "AutoRePlace",
									state: main.autoreplace.enabled
								}, {
									id: "Preplacer",
									state: main.Preplacer.enabled
								}, {
									id: "Grids",
									state: main.Grids.enabled
								}, {
									id: "Volcano",
									state: main.Volcano.enabled
								}, {
									id: "SpikeSync",
									state: configs.spikeTick
								}, {
									id: "Modules",
									state: main.extm.enabled
								}, {
									id: "Tracers",
									state: main.tracers.enabled
								}, {
									id: "ReloadBars",
									state: main.ReloadBars.enabled
								}, {
									id: "Shaders",
									state: main.nativeStatsGraphics.enabled
								}, {
									id: "Bots",
									state: main.Bots.enabled
								}, {
									id: "AutoAccept",
									state: main.AutoAccept.enabled
								}, {
									id: "AutoGrind",
									state: main.AutoGrind.enabled
								}, {
									id: "ChatBox",
									state: false
								}, {
									id: "AutoHit",
									state: main.AutoHit.enabled
								}, {
									id: "AutoSpin",
									state: main.AutoSpin.enabled
								}, {
									id: "CamMove",
									state: main.CamMove.enabled
								}, {
									id: "ShowCords",
									state: main.ShowCords.enabled
								}, {
									id: "StatsGraph",
									state: main.StatsGraph.enabled
								}, {
									id: "autoRespawn",
									state: configs.autoRespawn
								}, {
									id: "AutoUpgrade",
									state: main.AutoUpgrade.enabled
								}, {
									id: "AutoPush",
									state: main.AutoPush.enabled
								}, {
									id: "Placement",
									state: main.placementIndicator.enabled
								}, {
									id: "PlayTime",
									state: main.PlayTime.enabled
								}, {
									id: "RealDir",
									state: main.RealDir.enabled
								}, {
									id: "Greetings",
									state: main.Greetings.enabled
								}, {
									id: "HatSwitch",
									state: main.HatSwitch.enabled
								}, {
									id: "Music",
									state: main.Music.enabled
								}, {
									id: "ObsessiveChat",
									state: main.ObsessiveChat.enabled
								}, {
									id: "KillSound",
									state: main.killsound.enabled
								}];
								menuItems.forEach(item => {
									const menuItem = document.getElementById(item.id);
									menuItem.style.backgroundColor = item.state ? "#3d85c6" : "#32373e";
								});
							}

							function toggleButtonAnimation(buttonId) {
								const button = document.getElementById(buttonId);
								button.classList.add("enabled-animation");
								setTimeout(() => {
									button.classList.remove("enabled-animation");
								}, 500);
							}
							Modules.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "Modules" || mouse.target.parentElement.id === "Modules") {
										main.extm.enabled = !main.extm.enabled;
										const ModulesButton = document.getElementById("Modules");
										ModulesButton.style.backgroundColor = main.extm.enabled ? "#3d85c6" : "#32373e";
										notif("Dark Mode", main.extm.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("Modules", ["Saves your Eyes from burning down."]);
								}
							});
							ReloadBars.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "ReloadBars" || mouse.target.parentElement.id === "ReloadBars") {
										main.ReloadBars.enabled = !main.ReloadBars.enabled;
										const ReloadBarsButton = document.getElementById("ReloadBars");
										ReloadBarsButton.style.backgroundColor = main.ReloadBars.enabled ? "#3d85c6" : "#32373e";
										notif("Reload Bar", main.ReloadBars.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("ReloadBars", ["Draws a Reload Bar inside Health Bar."]);
								}
							});
							AutoHeal.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoHeal" || mouse.target.parentElement.id === "AutoHeal") {
										main.AutoHeal.enabled = !main.AutoHeal.enabled;
										const AutoHealButton = document.getElementById("AutoHeal");
										AutoHealButton.style.backgroundColor = main.AutoHeal.enabled ? "#3d85c6" : "#32373e";
										notif("Auto Healing", main.AutoHeal.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoHeal", ["Automatically heals when you take Damage."]);
								}
							});
							AutoInsta.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoInsta" || mouse.target.parentElement.id === "AutoInsta") {
										main.autoInsta.enabled = !main.autoInsta.enabled;
										const autoInstaButton = document.getElementById("AutoInsta");
										autoInstaButton.style.backgroundColor = main.autoInsta.enabled ? "#3d85c6" : "#32373e";
										notif("Auto Insta", main.autoInsta.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoInsta", ["Automatically locks Insta on Players."]);
								}
							});
							Grids.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "Grids" || mouse.target.parentElement.id === "Grids") {
										main.Grids.enabled = !main.Grids.enabled;
										const GridsButton = document.getElementById("Grids");
										GridsButton.style.backgroundColor = main.Grids.enabled ? "#3d85c6" : "#32373e";
										notif("Show Grids", main.Grids.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("Grids", ["Draws Map Grids as usual."]);
								}
							});
							Volcano.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "Volcano" || mouse.target.parentElement.id === "Volcano") {
										main.Volcano.enabled = !main.Volcano.enabled;
										const VolcanoButton = document.getElementById("Volcano");
										VolcanoButton.style.backgroundColor = main.Volcano.enabled ? "#3d85c6" : "#32373e";
										notif("Show Grids", main.Volcano.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("Grids", ["Draws Map Grids as usual."]);
								}
							});
							CamMove.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "CamMove" || mouse.target.parentElement.id === "CamMove") {
										main.CamMove.enabled = !main.CamMove.enabled;
										const CamMoveButton = document.getElementById("CamMove");
										CamMoveButton.style.backgroundColor = main.CamMove.enabled ? "#3d85c6" : "#32373e";
										notif("Cam Movement", main.CamMove.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("CamMove", ["Moves the Camera to your Pointer."]);
								}
							});
							ShowCords.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "ShowCords" || mouse.target.parentElement.id === "ShowCords") {
										main.ShowCords.enabled = !main.ShowCords.enabled;
										const ShowCordsButton = document.getElementById("ShowCords");
										toggleCoordinates();
										ShowCordsButton.style.backgroundColor = main.ShowCords.enabled ? "#3d85c6" : "#32373e";
										notif("Show Coordinates", main.ShowCords.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("ShowCords", ["Shows the Player Coordinates."]);
								}
							});
							AutoBreak.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoBreak" || mouse.target.parentElement.id === "AutoBreak") {
										main.autobreak.enabled = !main.autobreak.enabled;
										const autobreakButton = document.getElementById("AutoBreak");
										autobreakButton.style.backgroundColor = main.autobreak.enabled ? "#3d85c6" : "#32373e";
										notif("Auto Break", main.autobreak.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoBreak", ["Breaks Building if in Enemy Trap."]);
								}
							});
							AutoHit.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoHit" || mouse.target.parentElement.id === "AutoHit") {
										main.AutoHit.enabled = !main.AutoHit.enabled;
										const AutoHitButton = document.getElementById("AutoHit");
										AutoHitButton.style.backgroundColor = main.AutoHit.enabled ? "#3d85c6" : "#32373e";
										notif("Auto Hit", main.AutoHit.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoHit", ["Auto-Hits Players if they're close."]);
								}
							});
							AutoSpin.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoSpin" || mouse.target.parentElement.id === "AutoSpin") {
										main.AutoSpin.enabled = !main.AutoSpin.enabled;
										const AutoSpinButton = document.getElementById("AutoSpin");
										AutoSpinButton.style.backgroundColor = main.AutoSpin.enabled ? "#3d85c6" : "#32373e";
										notif("Spinbot", main.AutoSpin.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoSpin", ["Spinbot for your Character."]);
								}
							});
							AvoidSpikes.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AvoidSpikes" || mouse.target.parentElement.id === "AvoidSpikes") {
										main.avoidSpikes.enabled = !main.avoidSpikes.enabled;
										const avoidSpikesButton = document.getElementById("AvoidSpikes");
										avoidSpikesButton.style.backgroundColor = main.avoidSpikes.enabled ? "#3d85c6" : "#32373e";
										notif("Avoid Spikes", main.avoidSpikes.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AvoidSpikes", ["Prevents from walking into Spikes."]);
								}
							});
							AvoidTeleport.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AvoidTeleport" || mouse.target.parentElement.id === "AvoidTeleport") {
										main.AvoidTeleport.enabled = !main.AvoidTeleport.enabled;
										const AvoidTeleportButton = document.getElementById("AvoidTeleport");
										AvoidTeleportButton.style.backgroundColor = main.AvoidTeleport.enabled ? "#3d85c6" : "#32373e";
										notif("Avoid Teleporters", main.AvoidTeleport.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AvoidTeleport", ["Prevents from walking into Teleporters."]);
								}
							});
							BuildHealth.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "BuildHealth" || mouse.target.parentElement.id === "BuildHealth") {
										main.BuildHealth.enabled = !main.BuildHealth.enabled;
										const BuildHealthButton = document.getElementById("BuildHealth");
										BuildHealthButton.style.backgroundColor = main.BuildHealth.enabled ? "#3d85c6" : "#32373e";
										notif("Building Overlay", main.BuildHealth.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("BuildHealth", ["Displays the Building Health and more."]);
								}
							});
							AntiTrap.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AntiTrap" || mouse.target.parentElement.id === "AntiTrap") {
										configs.antiTrap = !configs.antiTrap;
										const antiTrapButton = document.getElementById("AntiTrap");
										antiTrapButton.style.backgroundColor = configs.antiTrap ? "#3d85c6" : "#32373e";
										notif("Anti Trap", configs.antiTrap ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AntiTrap", ["Counters Traps by placing Spikes."]);
								}
							});
							AutoPush.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoPush" || mouse.target.parentElement.id === "AutoPush") {
										main.AutoPush.enabled = !main.AutoPush.enabled;
										const AutoPushButton = document.getElementById("AutoPush");
										AutoPushButton.style.backgroundColor = main.AutoPush.enabled ? "#3d85c6" : "#32373e";
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoPush", ["Pushes Player into the Spike."]);
								}
							});
							AutoPlace.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoPlace" || mouse.target.parentElement.id === "AutoPlace") {
										main.autoplace.enabled = !main.autoplace.enabled;
										const autoplaceButton = document.getElementById("AutoPlace");
										autoplaceButton.style.backgroundColor = main.autoplace.enabled ? "#3d85c6" : "#32373e";
										notif("Auto Place", main.autoplace.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoPlace", ["Places Buildings next to Players."]);
								}
							});
							AutoRePlace.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoRePlace" || mouse.target.parentElement.id === "AutoRePlace") {
										main.autoreplace.enabled = !main.autoreplace.enabled;
										const autoReplaceButton = document.getElementById("AutoRePlace");
										autoReplaceButton.style.backgroundColor = main.autoreplace.enabled ? "#3d85c6" : "#32373e";
										notif("Auto Replace", main.autoreplace.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoRePlace", ["Replaces Buildings if Destroyed."]);
								}
							});
							Preplacer.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "Preplacer" || mouse.target.parentElement.id === "Preplacer") {
										main.Preplacer.enabled = !main.Preplacer.enabled;
										const PreplacerButton = document.getElementById("Preplacer");
										PreplacerButton.style.backgroundColor = main.Preplacer.enabled ? "#3d85c6" : "#32373e";
										notif("Preplacer", main.Preplacer.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("Preplacer", ["Times the Placement of Buildings."]);
								}
							});
							ChatBox.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "ChatBox" || mouse.target.parentElement.id === "ChatBox") {
										main.ChatBox.enabled = !main.ChatBox.enabled;
										$("#menuChatDiv").toggle();
										const ChatBoxButton = document.getElementById("ChatBox");
										ChatBoxButton.style.backgroundColor = main.ChatBox.enabled ? "#32373e" : "#3d85c6";
										notif("Chatbox", main.ChatBox.enabled ? "Hidden" : "Shown");
									}
								} else if (mouse.button === 2) {
									toggleHeight("chatbox", ["Logs the Chats in a seperate Menu."]);
								}
							});
							PlayTime.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "PlayTime" || mouse.target.parentElement.id === "PlayTime") {
										main.PlayTime.enabled = !main.PlayTime.enabled;
										const PlayTimeButton = document.getElementById("PlayTime");
										PlayTimeButton.style.backgroundColor = main.PlayTime.enabled ? "#3d85c6" : "#32373e";
										notif("PlayTime Counter", main.PlayTime.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("Preplacer", ["Times the Placement of Buildings."]);
								}
							});
							KatanaMusket.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "KatanaMusket" || mouse.target.parentElement.id === "KatanaMusket") {
										main.KatanaMusket.enabled = !main.KatanaMusket.enabled;
										const KatanaMusketButton = document.getElementById("KatanaMusket");
										KatanaMusketButton.style.backgroundColor = main.KatanaMusket.enabled ? "#3d85c6" : "#32373e";
										notif("Katana Musket", main.KatanaMusket.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("KatanaMusket", ["Toggles the Katana Musket Textures."]);
								}
							});
							SpikeSync.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "SpikeSync" || mouse.target.parentElement.id === "SpikeSync") {
										configs.spikeTick = !configs.spikeTick;
										const SpikeSyncButton = document.getElementById("SpikeSync");
										SpikeSyncButton.style.backgroundColor = configs.spikeTick ? "#3d85c6" : "#32373e";
										notif("Spike Sync", configs.spikeTick ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("SpikeSync", ["Times Hit when Player next to Spike."]);
								}
							});
							EnemyAlarm.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "EnemyAlarm" || mouse.target.parentElement.id === "EnemyAlarm") {
										main.EnemyAlarm.enabled = !main.EnemyAlarm.enabled;
										const EnemyAlarmButton = document.getElementById("EnemyAlarm");
										EnemyAlarmButton.style.backgroundColor = main.EnemyAlarm.enabled ? "#3d85c6" : "#32373e";
										notif("Enemy Alarm", main.EnemyAlarm.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("EnemyAlarm", ["Plays Sound when meeting a Player."]);
								}
							});
							Placement.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "Placement" || mouse.target.parentElement.id === "Placement") {
										main.placementIndicator.enabled = !main.placementIndicator.enabled;
										const PlacementButton = document.getElementById("Placement");
										PlacementButton.style.backgroundColor = main.placementIndicator.enabled ? "#3d85c6" : "#32373e";
										notif("Placements", main.placementIndicator.enabled ? "Visible" : "Invisible");
									}
								} else if (mouse.button === 2) {
									toggleHeight("Placement", ["Placement Indicator for Buildings."]);
								}
							});
							Bots.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									main.Bots.enabled = !main.Bots.enabled;
									const BotsButton = document.getElementById("Bots");
									BotsButton.style.backgroundColor = main.Bots.enabled ? "#3d85c6" : "#32373e";
									// notif("Bots", main.Bots.enabled ? "Enabled" : "Disabled");
								}
							});
							AutoGrind.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoGrind" || mouse.target.parentElement.id === "AutoGrind") {
										main.AutoGrind.enabled = !main.AutoGrind.enabled;
										const AutoGrindButton = document.getElementById("AutoGrind");
										AutoGrindButton.style.backgroundColor = main.AutoGrind.enabled ? "#3d85c6" : "#32373e";
										notif("Weapon Grinder", main.AutoGrind.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoGrind", ["Place and Break your Building to start."]);
								}
							});
							AutoAccept.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoAccept" || mouse.target.parentElement.id === "AutoAccept") {
										main.AutoAccept.enabled = !main.AutoAccept.enabled;
										updateAutoAcceptState();
										const AutoAcceptButton = document.getElementById("AutoAccept");
										AutoAcceptButton.style.backgroundColor = main.AutoAccept.enabled ? "#3d85c6" : "#32373e";
										notif("Auto Accept", main.AutoAccept.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoAccept", ["Automatically accept clan requests."]);
								}
							});
							Greetings.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "Greetings" || mouse.target.parentElement.id === "Greetings") {
										main.Greetings.enabled = !main.Greetings.enabled;
										const GreetingsButton = document.getElementById("Greetings");
										GreetingsButton.style.backgroundColor = main.Greetings.enabled ? "#3d85c6" : "#32373e";
										notif("Greetings", main.Greetings.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("Greetings", ["Greets Players and wishes Goodbye."]);
								}
							});
							KillChat.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "KillChat" || mouse.target.parentElement.id === "KillChat") {
										configs.KillChat = !configs.KillChat;
										const KillChatButton = document.getElementById("KillChat");
										KillChatButton.style.backgroundColor = configs.KillChat ? "#3d85c6" : "#32373e";
										notif("Kill Chat", configs.KillChat ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("KillChat", ["Sends a Message every Kill."]);
								}
							});
							Tracers.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "Tracers" || mouse.target.parentElement.id === "Tracers") {
										main.tracers.enabled = !main.tracers.enabled;
										const TracersButton = document.getElementById("Tracers");
										TracersButton.style.backgroundColor = main.tracers.enabled ? "#3d85c6" : "#32373e";
										notif("Tracers", main.tracers.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("Tracers", ["Draws Tracer Arrows to close Enemies."]);
								}
							});
							Shaders.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "Shaders" || mouse.target.parentElement.id === "Shaders") {
										main.nativeStatsGraphics.enabled = !main.nativeStatsGraphics.enabled;
										const nativeStatsGraphicsButton = document.getElementById("Shaders");
										nativeStatsGraphicsButton.style.backgroundColor = main.nativeStatsGraphics.enabled ? "#3d85c6" : "#32373e";
										notif("Shaders", main.nativeStatsGraphics.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("Shaders", ["Adds Shadows to placed Objects."]);
								}
							});
							AutoUpgrade.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "AutoUpgrade" || mouse.target.parentElement.id === "AutoUpgrade") {
										main.AutoUpgrade.enabled = !main.AutoUpgrade.enabled;
										const AutoUpgradeButton = document.getElementById("AutoUpgrade");
										AutoUpgradeButton.style.backgroundColor = main.AutoUpgrade.enabled ? "#3d85c6" : "#32373e";
										notif("Auto Upgrade", main.AutoUpgrade.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("AutoUpgrade", ["Smartly Upgrades the Items for you."]);
								}
							});
							RealDir.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "RealDir" || mouse.target.parentElement.id === "RealDir") {
										main.RealDir.enabled = !main.RealDir.enabled;
										const RealDirButton = document.getElementById("RealDir");
										RealDirButton.style.backgroundColor = main.RealDir.enabled ? "#3d85c6" : "#32373e";
										notif("Real Direction", main.RealDir.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("RealDir", ["Shows the Players Real Direction."]);
								}
							});
							autoRespawn.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "autoRespawn" || mouse.target.parentElement.id === "autoRespawn") {
										configs.autoRespawn = !configs.autoRespawn;
										const autoRespawnButton = document.getElementById("autoRespawn");
										autoRespawnButton.style.backgroundColor = configs.autoRespawn ? "#3d85c6" : "#32373e";
										notif("Auto Respawn", configs.autoRespawn ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("autoRespawn", ["Respawns Player upon Death."]);
								}
							});
							ObsessiveChat.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									if (mouse.target.id === "ObsessiveChat" || mouse.target.parentElement.id === "ObsessiveChat") {
										main.ObsessiveChat.enabled = !main.ObsessiveChat.enabled;
										const ObsessiveChatButton = document.getElementById("ObsessiveChat");
										ObsessiveChatButton.style.backgroundColor = main.ObsessiveChat.enabled ? "#3d85c6" : "#32373e";
										notif("Obsessive Chatting", main.ObsessiveChat.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("ObsessiveChat", ["Comments everything and anything you do."]);
								}
							});
							KillSound.addEventListener("mousedown", function(mouse) {
								if (mouse.button === 0) {
									if (mouse.target.id === "KillSound" || mouse.target.parentElement.id === "KillSound") {
										main.killsound.enabled = !main.killsound.enabled;
										const killsoundButton = document.getElementById("KillSound");
										killsoundButton.style.backgroundColor = main.killsound.enabled ? "#3d85c6" : "#32373e";
										notif("Kill Sounds", main.killsound.enabled ? "Enabled" : "Disabled");
									}
								} else if (mouse.button === 2) {
									toggleHeight("KillSound");
								}
							});

							// AUTO ACCEPT
							let AutoAcceptInterval = null;

							function startAutoAccept() {
								if (AutoAcceptInterval) {
									clearInterval(AutoAcceptInterval);
								}

								AutoAcceptInterval = setInterval(acceptJoinRequest, 500);
							}

							function stopAutoAccept() {
								if (AutoAcceptInterval) {
									clearInterval(AutoAcceptInterval);
									AutoAcceptInterval = null;
								}
							}

							function acceptJoinRequest() {
								try {
									aJoinReq(1);
								} catch (error) {

								}
							}

							function updateAutoAcceptState() {
								if (main.AutoAccept.enabled) {
									startAutoAccept();
								} else {
									stopAutoAccept();
								}
							}

							// PLAYTIME COUNTER
							let playtimeStart = null;
							let playtimeInterval = null;

							function startPlaytimeCounter() {
								if (playtimeInterval) {
									clearInterval(playtimeInterval);
								}

								playtimeStart = Date.now();
								playtimeInterval = setInterval(updatePlaytimeDisplay, 1000);
							}

							function updatePlaytimeDisplay() {
								if (!main.PlayTime.enabled) {
									clearPlaytimeDisplay();
									return;
								}

								const elapsedMs = Date.now() - playtimeStart;
								const seconds = Math.floor((elapsedMs / 1000) % 60);
								const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
								const hours = Math.floor(elapsedMs / (1000 * 60 * 60));

								const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
                .toString()
                .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

								displayPlaytime(formattedTime);
							}

							function clearPlaytimeDisplay() {
								const playtimeElement = document.getElementById("playtimeDisplay");
								if (playtimeElement) {
									playtimeElement.style.display = "none";
								}
							}

							function displayPlaytime(timeString) {
								let playtimeElement = document.getElementById("playtimeDisplay");

								if (!playtimeElement) {
									playtimeElement = document.createElement("div");
									playtimeElement.id = "playtimeDisplay";
									playtimeElement.style.position = "absolute";
									playtimeElement.style.backgroundColor = "transparent";
									playtimeElement.style.color = "#fff";
									playtimeElement.style.borderRadius = "1px";
									playtimeElement.style.fontSize = "14px";
									playtimeElement.style.fontFamily = "Space Grotesk, sans-serif";
									playtimeElement.style.zIndex = "9999";
									document.body.appendChild(playtimeElement);
								}

								playtimeElement.style.display = "block";
								playtimeElement.textContent = `${timeString}`;

								const logoElement = document.querySelector("img[alt='Logo']");
								if (logoElement) {
									const rect = logoElement.getBoundingClientRect();
									const playtimeWidth = playtimeElement.offsetWidth;
									playtimeElement.style.top = `${rect.bottom - 20}px`;
									playtimeElement.style.left = `${rect.left + 7.5}px`;
								}
							}

							function stopPlaytimeCounter() {
								if (playtimeInterval) {
									clearInterval(playtimeInterval);
									playtimeInterval = null;
								}
								clearPlaytimeDisplay();
							}

							// SHOW CORDS:
							let coordinatesDiv = null;

							function toggleCoordinates() {
								if (main.ShowCords.enabled) {
									if (!coordinatesDiv) {
										coordinatesDiv = document.createElement('div');
										coordinatesDiv.id = 'coordinates';
										coordinatesDiv.style.position = 'absolute';
										coordinatesDiv.style.top = '25px';
										coordinatesDiv.style.left = '120px';
										coordinatesDiv.style.backgroundColor = 'transparent';
										coordinatesDiv.style.fontFamily = "Space Grotesk, sans-serif";
										coordinatesDiv.style.color = 'white';
										coordinatesDiv.style.padding = '5px';
										coordinatesDiv.style.fontSize = '16px';
										coordinatesDiv.style.borderRadius = '5px';
										coordinatesDiv.style.zIndex = '1000';
										document.body.appendChild(coordinatesDiv);

										function roundToEven(number) {
											return Math.round(number / 2) * 2;
										}

										function updateCoordinates() {
											if (main.ShowCords.enabled) {
												const roundedX = roundToEven(player.x);
												const roundedY = roundToEven(player.y);
												coordinatesDiv.textContent = `X: ${roundedX}, Y: ${roundedY}`;
											}
										}

										setInterval(updateCoordinates, 1000);
									}
								} else {
									if (coordinatesDiv) {
										coordinatesDiv.remove();
										coordinatesDiv = null;
									}
								}
							}

							setInterval(toggleCoordinates, 1000);

// AUTO SPINNER
class Spinner {
    constructor() {
        this.angle = 0;
        this.isSpinning = false;
        this.spinInterval = null;
        this.speed = 15;
        this.angleStep = Math.PI / 10;
        this.packetStep = 3;
        this.stepCount = 0;
        this.timeoutActive = false;
    }

    start() {
        if (this.isSpinning || this.timeoutActive || isMouseHeld) return;

        this.isSpinning = true;
        configs.noDir = true;

        this.spinInterval = setInterval(() => {
            this.angle += this.angleStep;
            if (this.angle >= 2 * Math.PI) {
                this.angle = 0;
            }

            this.stepCount++;

            if (this.stepCount >= this.packetStep) {
                this.updateDirection();
                this.stepCount = 0;
            }
        }, this.speed);
    }

    stop() {
        if (!this.isSpinning) return;

        clearInterval(this.spinInterval);
        this.isSpinning = false;
        configs.noDir = false;
    }

    updateInterval() {
        if (this.isSpinning) {
            clearInterval(this.spinInterval);
            this.spinInterval = setInterval(() => {
                this.angle += this.angleStep;
                if (this.angle >= 2 * Math.PI) {
                    this.angle = 0;
                }

                this.stepCount++;

                if (this.stepCount >= this.packetStep) {
                    this.updateDirection();
                    this.stepCount = 0;
                }
            }, this.speed);
        }
    }

    updateDirection() {
        dir(1, this.angle);
    }

    timeout(duration) {
        this.stop();
        this.timeoutActive = true;

        setTimeout(() => {
            this.timeoutActive = false;
        }, duration);
    }
}

const spinner = new Spinner();
let isMouseHeld = false;

function dir(id, angle) {
    packet("D", angle);
}

							// HAT CYCLER
							class HatSwitcher {
								constructor() {
									this.time = 100;
									this.hatIndex = [50, 28, 29, 30, 36, 37, 38, 44, 35, 43, 49, 57];
									this.currentIndex = 0;
									this.isActivated = false;
									this.HatSwitchButton = document.getElementById("HatSwitch");
									this.setupButton();
								}
								newTick(callback, delay) {
									setTimeout(callback, delay);
								}
								toggleActivation() {
									this.isActivated = !this.isActivated;
									if (this.isActivated) {
										this.equip();
									} else {
										setTimeout(() => {
											window.storeEquip(0);
										}, 300);
									}
								}
								equip() {
									if (this.currentIndex < this.hatIndex.length) {
										let equipNumber = this.hatIndex[this.currentIndex];
										window.storeEquip(equipNumber);
										this.currentIndex++;
									} else {
										this.currentIndex = 0;
									}
									if (this.isActivated) {
										setTimeout(() => {
											this.newTick(() => this.equip(), this.time);
										}, 80);
									}
								}
								setupButton() {
									this.HatSwitchButton.addEventListener("mousedown", mouse => {
										if (mouse.button === 0) {
											this.toggleActivation();
											this.updateButtonAppearance();
											notif("Hat Cycler", this.isActivated ? "Enabled" : "Disabled");
										}
									});
								}
								updateButtonAppearance() {
									this.HatSwitchButton.style.backgroundColor = this.isActivated ? "#3d85c6" : "#32373e";
								}
								start() {
									if (main.HatSwitch.enabled) {
										this.toggleActivation();
									}
								}
							}
							const equipManager = new HatSwitcher();
							equipManager.start();

							const musicMenu = document.createElement("div");
							musicMenu.id = "music-menu";
							musicMenu.style.position = "fixed";
							musicMenu.style.top = "90%";
							musicMenu.style.left = "8%";
							musicMenu.style.transform = "translateX(-50%)";
							musicMenu.style.backgroundColor = "#282c31";
							musicMenu.style.color = "#fff";
							musicMenu.style.padding = "20px";
							musicMenu.style.display = "block";
							musicMenu.style.zIndex = "999";
							musicMenu.style.borderRadius = "5px";
							musicMenu.style.opacity = main.Music.enabled ? "1" : "0";
							musicMenu.style.pointerEvents = main.Music.enabled ? "auto" : "none";
							musicMenu.style.transition = "opacity 0.5s, transform 0.3s";
							musicMenu.style.fontFamily = "'Hammersmith One', Hammersmith One";
							musicMenu.style.fontSize = "20px";
							document.body.appendChild(musicMenu);

							const musicButtons = [];
							["Lofi", "Pop", "Brazil", "Gamer", "Tropical"].forEach((label, index) => {
								const button = document.createElement("button");
								button.textContent = label;
								button.style.width = "20%";
								button.style.height = "30px";
								button.style.backgroundColor = "#32373e";
								button.style.color = "#fff";
								button.style.fontSize = "15px";
								button.style.fontFamily = "Hammersmith One";
								button.style.textAlign = "center";
								button.style.lineHeight = "30px";
								button.style.marginTop = "3px";
								button.style.border = "none";
								button.style.cursor = "pointer";

								musicMenu.appendChild(button);
								musicButtons.push(button);
							});

							const volumeSlider = document.createElement("input");
							volumeSlider.type = "range";
							volumeSlider.min = 0;
							volumeSlider.max = 1;
							volumeSlider.step = 0.01;
							volumeSlider.value = 0.25;
							volumeSlider.style.width = "100%";
							volumeSlider.style.marginTop = "10px";
							musicMenu.appendChild(volumeSlider);

							let audio = null;
							let currentSrc = "";

							const audioSources = [
								"https://live.hunter.fm/lofi_high",
								"https://live.hunter.fm/pop_high",
								"https://live.hunter.fm/hitsbrasil_high",
								"https://live.hunter.fm/gamer_high",
								"https://live.hunter.fm/tropical_high",
							];

							musicButtons.forEach((button, index) => {
                if (main.Music.enabled) {
								  button.addEventListener("click", () => {
									  playMusic(audioSources[index]);
								  });
                }
							});

							const MusicButton = document.getElementById("Music");
							MusicButton.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									main.Music.enabled = !main.Music.enabled;
									MusicButton.style.backgroundColor = main.Music.enabled ? "#3d85c6" : "#32373e";
									notif("Music Menu", main.Music.enabled ? "Enabled" : "Disabled");
									musicMenu.style.opacity = main.Music.enabled ? "1" : "0";
									musicMenu.style.pointerEvents = main.Music.enabled ? "auto" : "none";
									musicMenu.style.transform = main.Music.enabled ? "translateY(0)" : "translateY(150%)";

									if (!main.Music.enabled && audio) {
										audio.pause();
									}
								}
							});

							volumeSlider.addEventListener("input", function() {
								if (audio) {
									audio.volume = parseFloat(this.value);
								}
							});

							function playMusic(src) {
								if (audio && !audio.paused && currentSrc !== src) {
									audio.pause();
								}
								if (main.Music.enabled && !audio) {
									audio = new Audio();
								}
								audio.src = src;
								audio.volume = volumeSlider.value;
								audio.play();
								currentSrc = src;
							}
							initializeMenuColors();
							var ae86 = false;
							var lur = true;
							var fz = false;
							setInterval(() => {
								ae86 = false;
								lur = false;
								fz = false;
								if (main.extm.enabled) {
									lur = true;
								}
							}, 50);
							var chain = false;
							var bullspams = 0;
							var maxBullspam = 0;
							var useps = Date.now();
							let chatTimeouts = [];
							let oldChatter = [];
							let chatter = [];
							let startedDate = Date.now();
							class HtmlAction {
								constructor(element) {
									this.element = element;
								}
								add(code) {
									if (!this.element) {
										return undefined;
									}
									this.element.innerHTML += code;
								}
								newLine(amount) {
									let result = `<br>`;
									if (amount > 0) {
										result = ``;
										for (let i = 0; i < amount; i++) {
											result += `<br>`;
										}
									}
									this.add(result);
								}
								checkBox(setting) {
									let newCheck = `<input type = "checkbox"`;
									if (setting.id) {
										newCheck += ` id = ${setting.id}`;
									}
									if (setting.style) {
										newCheck += ` style = ${setting.style.replaceAll(" ", "")}`;
									}
									if (setting.class) {
										newCheck += ` class = ${setting.class}`;
									}
									if (setting.checked) {
										newCheck += ` checked`;
									}
									if (setting.onclick) {
										newCheck += ` onclick = ${setting.onclick}`;
									}
									newCheck += `>`;
									this.add(newCheck);
								}
								text(setting) {
									let newText = `<input type = "text"`;
									if (setting.id) {
										newText += ` id = ${setting.id}`;
									}
									if (setting.style) {
										newText += ` style = ${setting.style.replaceAll(" ", "")}`;
									}
									if (setting.class) {
										newText += ` class = ${setting.class}`;
									}
									if (setting.size) {
										newText += ` size = ${setting.size}`;
									}
									if (setting.maxLength) {
										newText += ` maxLength = ${setting.maxLength}`;
									}
									if (setting.value) {
										newText += ` value = ${setting.value}`;
									}
									if (setting.placeHolder) {
										newText += ` placeHolder = ${setting.placeHolder.replaceAll(" ", "&nbsp;")}`;
									}
									newText += `>`;
									this.add(newText);
								}
								select(setting) {
									let newSelect = `<select`;
									if (setting.id) {
										newSelect += ` id = ${setting.id}`;
									}
									if (setting.style) {
										newSelect += ` style = ${setting.style.replaceAll(" ", "")}`;
									}
									if (setting.class) {
										newSelect += ` class = ${setting.class}`;
									}
									newSelect += `>`;
									for (let options in setting.option) {
										newSelect += `<option value = ${setting.option[options].id}`;
										if (setting.option[options].selected) {
											newSelect += ` selected`;
										}
										newSelect += `>${options}</option>`;
									}
									newSelect += `</select>`;
									this.add(newSelect);
								}
								button(setting) {
									let newButton = `<button`;
									if (setting.id) {
										newButton += ` id = ${setting.id}`;
									}
									if (setting.style) {
										newButton += ` style = ${setting.style.replaceAll(" ", "")}`;
									}
									if (setting.class) {
										newButton += ` class = ${setting.class}`;
									}
									if (setting.onclick) {
										newButton += ` onclick = ${setting.onclick}`;
									}
									newButton += `>`;
									if (setting.innerHTML) {
										newButton += setting.innerHTML;
									}
									newButton += `</button>`;
									this.add(newButton);
								}
								selectMenu(setting) {
									let newSelect = `<select`;
									if (!setting.id) {
										alert("please put id skid");
										return;
									}
									window[setting.id + "Func"] = function() {};
									if (setting.id) {
										newSelect += ` id = ${setting.id}`;
									}
									if (setting.style) {
										newSelect += ` style = ${setting.style.replaceAll(" ", "")}`;
									}
									if (setting.class) {
										newSelect += ` class = ${setting.class}`;
									}
									newSelect += ` onchange = window.${setting.id + "Func"}()`;
									newSelect += `>`;
									let last;
									let i = 0;
									for (let options in setting.menu) {
										newSelect += `<option value = ${"option_" + options} id = ${"O_" + options}`;
										if (setting.menu[options]) {
											newSelect += ` checked`;
										}
										newSelect += ` style = "color: ${setting.menu[options] ? "#000" : "#fff"}; background: ${setting.menu[options] ? "#8ecc51" : "#cc5151"};">${options}</option>`;
										i++;
									}
									newSelect += `</select>`;
									this.add(newSelect);
									i = 0;
									for (let options in setting.menu) {
										window[options + "Func"] = function() {
											setting.menu[options] = getEl("check_" + options).checked ? true : false;
											saveVal(options, setting.menu[options]);
											getEl("O_" + options).style.color = setting.menu[options] ? "#000" : "#fff";
											getEl("O_" + options).style.background = setting.menu[options] ? "#8ecc51" : "#cc5151";
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
									window[setting.id + "Func"] = function() {
										getEl(last).style.display = "none";
										last = "check_" + getEl(setting.id).value.split("_")[1];
										getEl(last).style.display = "inline-block";
										//getEl(setting.id).style.color = setting.menu[last.split("_")[1]] ? "#8ecc51" : "#fff";
									};
								}
							};
							class Html {
								constructor() {
									this.element = null;
									this.action = null;
									this.divElement = null;
									this.startDiv = function(setting, func) {
										let newDiv = document.createElement("div");
										if (setting.id) {
											newDiv.id = setting.id;
										}
										if (setting.style) {
											newDiv.style = setting.style;
										}
										if (setting.class) {
											newDiv.className = setting.class;
										}
										this.element.appendChild(newDiv);
										this.divElement = newDiv;
										let addRes = new HtmlAction(newDiv);
										if (typeof func == "function") {
											func(addRes);
										}
									};
									this.addDiv = function(setting, func) {
										let newDiv = document.createElement("div");
										if (setting.id) {
											newDiv.id = setting.id;
										}
										if (setting.style) {
											newDiv.style = setting.style;
										}
										if (setting.class) {
											newDiv.className = setting.class;
										}
										if (setting.appendID) {
											getEl(setting.appendID).appendChild(newDiv);
										}
										this.divElement = newDiv;
										let addRes = new HtmlAction(newDiv);
										if (typeof func == "function") {
											func(addRes);
										}
									};
								}
								set(id) {
									this.element = getEl(id);
									this.action = new HtmlAction(this.element);
								}
								resetHTML(text) {
									if (text) {
										this.element.innerHTML = ``;
									} else {
										this.element.innerHTML = ``;
									}
								}
								setStyle(style) {
									this.element.style = style;
								}
								setCSS(style) {
									this.action.add(`<style>${style}</style>`);
								}
							};
							let HTML = new Html();
							let menuChatDiv = document.createElement("div");
							menuChatDiv.id = "menuChatDiv";
							document.body.appendChild(menuChatDiv);
							HTML.set("menuChatDiv");
							HTML.setStyle(`
            position: absolute;
            display: none;
            left: 0px;
            top: 0px;
            `);
							HTML.resetHTML();
							HTML.setCSS(`
            .chDiv{
                color: #fff;
                position: fixed;
                padding: 10px;
                top: 30%;
                left: 17px;
                width: 400px;
                height: 250px;
                zIndex: 999999;
                backdropFilter: blur(2px);
                boxShadow: 2px 2px 4px 2px rgba(0,0,0,0.3);
                borderWidth: 4px;
                background-color: rgba(0,0,0,0.4);
                border-radius: 5px
            }
.chMainDiv {
    font-family: "Ubuntu";
    font-size: 16px;
    max-height: 250px;
    overflow-y: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    overflow-x: hidden;
    border-radius: 5px;
}
.chMainDiv::-webkit-scrollbar {
    display: none;
}
            `);
							HTML.startDiv({
								id: "mChDiv",
								class: "chDiv"
							}, html => {
								HTML.addDiv({
									id: "mChMain",
									class: "chMainDiv",
									appendID: "mChDiv"
								}, html => {});
							});
							let menuChats = getEl("mChMain");
							let menuChatBox = getEl("mChBox");
							let menuCBFocus = false;
							let menuChCounts = 0;

							function addChatLog(e, c, d, v) {
								HTML.set("menuChatDiv");
								let chatLogs = document.getElementById("mChMain");
								const now = new Date();
								const hours = now.getHours();
								const minutes = now.getMinutes();
								const ampm = hours >= 12 ? "PM" : "AM";
								const formattedHours = (hours % 12 || 12).toString();
								const formattedMinutes = minutes.toString().padStart(2, "0");
								let time = `${formattedHours}:${formattedMinutes} ${ampm}`;
								let a = document.createElement("div");
								a.className = "chatEntry";
								let timeSpan = document.createElement("span");
								timeSpan.style.color = "rgba(255, 255, 255, 0.5)";
								timeSpan.innerText = `${time}`;
								a.appendChild(timeSpan);
								let namething = document.createElement("span");
								namething.style.color = v;
								namething.innerText = " " + d;
								a.appendChild(namething);
								let chatSpan = document.createElement("span");
								chatSpan.style.color = c;
								chatSpan.innerText = " " + e;
								a.appendChild(chatSpan);
								chatLogs.appendChild(a);
								chatLogs.scrollTop = chatLogs.scrollHeight;
							}
							let menuIndex = 0;
							let menus = ["menuOther"];
							let mStatus = document.createElement("div");
							mStatus.id = "status";
							getEl("gameUI").appendChild(mStatus);
							HTML.set("status");
							HTML.setStyle(`
            display: block;
            position: absolute;
            color: #ddd;
            font: 15px Hammersmith One;
            bottom: 215px;
            left: 20px;
            `);
							HTML.resetHTML();
							HTML.setCSS(`
            .sizing {
                font-size: 15px;
            }
            .mod {
                font-size: 15px;
                display: inline-block;
            }
            `);
							/*function modLog() {
							let logs = [];
							for (let i = 0; i < arguments.length; i++) {
							logs.push(arguments[i]);
							}
							getEl("modLog").innerHTML = logs;
							}*/
							let openMenu = false;
							let WS = undefined;
							let socketID = undefined;
							let secPacket = 0;
							let secMax = 110;
							let secTime = 1000;
							let firstSend = {
								sec: false
							};
							let game = {
								tick: 0,
								tickQueue: [],
								tickBase: function(set, tick) {
									if (this.tickQueue[this.tick + tick]) {
										this.tickQueue[this.tick + tick].push(set);
									} else {
										this.tickQueue[this.tick + tick] = [set];
									}
								},
								tickRate: 1000 / 9,
								tickSpeed: 0,
								lastTick: performance.now()
							};
							let dontSend = false;
							let fpsTimer = {
								last: 0,
								time: 0,
								ltime: 0
							};
							let lastMoveDir = undefined;
							let lastsp = ["cc", 1, "__proto__"];
							WebSocket.prototype.nsend = WebSocket.prototype.send;
							WebSocket.prototype.send = function(message) {
								if (!WS) {
									WS = this;
									WS.addEventListener("message", function(msg) {
										getMessage(msg);
									});
									WS.addEventListener("close", event => {
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
											//data[0] = data[0].slice(0, 30);
											function rc4(key, str) {
												var s = [];
												var j = 0;
												var x;
												var res = "";
												for (var i = 0; i < 256; i++) {
													s[i] = i;
												}
												for (i = 0; i < 256; i++) {
													j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
													x = s[i];
													s[i] = s[j];
													s[j] = x;
												}
												i = 0;
												j = 0;
												for (var y = 0; y < str.length; y++) {
													i = (i + 1) % 256;
													j = (j + s[i]) % 256;
													x = s[i];
													s[i] = s[j];
													s[j] = x;
													res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
												}
												return res;
											}
											if (data[0][0] == "!") {
												if (vape) {
													data[0] = data[0].slice(0, 30);
												} else {
													data[0] = rc4("pe", "1ÐLå­÷í>zÆ=/«þHÚë");
												}
											} else {
												let profanity = ["cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"];
												let tmpString;
												profanity.forEach(profany => {
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
										}
									} else if (type == "L") {
										// MAKE SAME CLAN:
										data[0] = data[0] + String.fromCharCode(0).repeat(7);
										data[0] = data[0].slice(0, 7);
									} else if (type == "M") {
										// APPLY CYAN COLOR:
										data[0].name = localStorage.vape_name == "" ? "unknown" : /*"SDR - " + data[0].name.slice(data[0].name - 6, 6)*/ localStorage.vape_name;
										data[0].moofoll = true;
										data[0].skin = data[0].skin == 10 ? "__proto__" : data[0].skin;
										inGame = true;
										lastsp = [data[0].name, data[0].moofoll, data[0].skin];
									} else if (type == "D") {
										if (my.lastDir == data[0] || [null, undefined].includes(data[0])) {
											dontSend = true;
										} else {
											my.lastDir = data[0];
										}
									} else if (type == "F") {
										if (!data[2]) {
											dontSend = true;
										} else if (![null, undefined].includes(data[1])) {
											my.lastDir = data[1];
										}
									} else if (type == "K") {
										if (!data[1]) {
											dontSend = true;
										}
									} else if (type == "14") {
										instaC.wait = !instaC.wait;
										dontSend = true;
									} else if (type == "9") {
										if (data[1]) {
											if (player.moveDir == data[0]) {
												dontSend = true;
											}
											player.moveDir = data[0];
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
							};
							StatsGraph.addEventListener("mousedown", function(mouse) {
								if (mouse.button == 0) {
									main.StatsGraph.enabled = !main.StatsGraph.enabled;
									const StatsGraphButton = document.getElementById("StatsGraph");
									StatsGraphButton.style.backgroundColor = main.StatsGraph.enabled ? "#3d85c6" : "#32373e";
									if (main.StatsGraph.enabled) {
										loadChartLibrary(createStatsGraph);
									} else {
										var StatsGraphContainer = document.getElementById("StatsGraph-container");
										if (StatsGraphContainer) {
											StatsGraphContainer.parentNode.removeChild(StatsGraphContainer);
										}
									}
									notif("Statistics", main.StatsGraph.enabled ? "Shown" : "Hidden");
								}
							});

							function loadChartLibrary(callback) {
								var script = document.createElement("script");
								script.type = "text/javascript";
								if (script.readyState) {
									script.onreadystatechange = function() {
										if (script.readyState === "loaded" || script.readyState === "complete") {
											script.onreadystatechange = null;
											callback();
										}
									};
								} else {
									script.onload = function() {
										callback();
									};
								}
								script.src = "https://cdn.jsdelivr.net/npm/chart.js";
								document.getElementsByTagName("head")[0].appendChild(script);
							}

							function createStatsGraph() {
								var StatsGraphContainer = document.createElement("div");
								StatsGraphContainer.id = "StatsGraph-container";
								StatsGraphContainer.style.position = "fixed";
								StatsGraphContainer.style.top = "50%";
								StatsGraphContainer.style.left = "17px";
								StatsGraphContainer.style.background = "rgba(0,0,0,0.4)";
								StatsGraphContainer.style.zIndex = "999999";
								StatsGraphContainer.style.boxShadow = "2px 2px 4px 2px rgba(0,0,0,0.3)";
								StatsGraphContainer.style.fontFamily = "Space Grotesk, sans-serif";
								StatsGraphContainer.style.width = "300px";
								StatsGraphContainer.style.height = "150px";
								StatsGraphContainer.style.overflow = "auto";
								StatsGraphContainer.style.borderWidth = "4px";
								StatsGraphContainer.style.backdropFilter = "blur(2px)";
								StatsGraphContainer.style.borderRadius = "5px";
								var canvas = document.createElement("canvas");
								StatsGraphContainer.appendChild(canvas);
								document.body.appendChild(StatsGraphContainer);
								document.body.style.fontFamily = "Space Grotesk, sans-serif";
								Chart.defaults.font.family = "Space Grotesk, sans-serif";
								var ctx = canvas.getContext("2d");
								var data = {
									labels: Array.from({
										length: 60
									}, () => ""),
									datasets: [{
										label: "Packets",
										data: Array.from({
											length: 60
										}, () => 0),
										fill: true,
										borderColor: "#0091ff",
										backgroundColor: "rgba(0, 145, 255, 0.5)",
										pointRadius: Array.from({
											length: 60
										}, () => 0)
									}, {
										label: "Ping Time",
										data: Array.from({
											length: 60
										}, () => 0),
										fill: true,
										borderColor: "#ff2924",
										backgroundColor: "rgba(11, 83, 148, 0.5)",
										pointRadius: Array.from({
											length: 60
										}, () => 0)
									}]
								};
								var options = {
									plugins: {
										legend: {
											display: false
										},
										title: {
											display: false
										}
									},
									elements: {
										line: {
											borderWidth: 1.5,
											tension: 0,
											borderDash: [6, 6]
										}
									},
									scales: {
										x: {
											grid: {
												display: false,
												color: "rgba(255, 255, 255, 0.1)",
												lineWidth: 20
											}
										},
										y: {
											grid: {
												display: false,
												color: "rgba(255, 255, 255, 0.1)",
												lineWidth: 20
											},
											suggestedMin: 0,
											suggestedMax: 100
										}
									}
								};
								var chart = new Chart(ctx, {
									type: "line",
									data: data,
									options: options
								});
								setInterval(function() {
									if (data.labels.length >= 60) {
										data.labels.shift();
										data.datasets[0].data.shift();
										data.datasets[0].pointRadius.shift();
										data.datasets[1].data.shift();
										data.datasets[1].pointRadius.shift();
									}
									data.labels.push("");
									data.datasets[0].data.push(secPacket);
									data.datasets[0].borderColor = getColor(secPacket);
									data.datasets[0].pointRadius.push(secPacket > 10 ? 3.5 : 0);
									data.datasets[1].data.push(window.pingTime);
									data.datasets[1].borderColor = getColor(window.pingTime);
									data.datasets[1].pointRadius.push(window.pingTime > 10 ? 3.5 : 0);
									chart.update();
								}, 300);
							}

							function getColor(value) {
								if (value <= 40) {
									return "#0091ff";
								} else if (value <= 60) {
									return "#0091ff";
								} else if (value <= 100) {
									return "#0091ff";
								} else {
									return "#0091ff";
								}
							}

							function packet(type) {
								// EXTRACT DATA ARRAY:
								let data = Array.prototype.slice.call(arguments, 1);
								// SEND MESSAGE:
								let binary = window.msgpack.encode([type, data]);
								//lert(binary);
								WS.send(binary);
							}

							function origPacket(type) {
								// EXTRACT DATA ARRAY:
								let data = Array.prototype.slice.call(arguments, 1);
								// SEND MESSAGE:
								let binary = window.msgpack.encode([type, data]);
								WS.nsend(binary);
							}
							window.leave = function() {
								origPacket("kys", {
									"frvr is so bad": true,
									"sidney is too good": true,
									"dev are too weak": true
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
									A: setInitData,
									C: setupGame,
									D: addPlayer,
									E: removePlayer,
									a: updatePlayers,
									G: updateLeaderboard,
									H: loadGameObject,
									I: loadAI,
									J: animateAI,
									K: gatherAnimation,
									L: wiggleGameObject,
									M: shootTurret,
									N: updatePlayerValue,
									O: updateHealth,
									P: killPlayer,
									Q: killObject,
									R: killObjects,
									S: updateItemCounts,
									T: updateAge,
									U: updateUpgrades,
									V: updateItems,
									X: addProjectile,
									Y: remProjectile,
									2: allianceNotification,
									3: setPlayerTeam,
									4: setAlliancePlayers,
									5: updateStoreItems,
									6: receiveChat,
									7: updateMinimap,
									8: showText,
									9: pingMap,
									0: pingSocketResponse
								};
								if (type == "io-init") {
									socketID = data[0];
								} else if (events[type]) {
									events[type].apply(undefined, data);
								}
							}
							// MATHS:
							Math.lerpAngle = function(value1, value2, amount) {
								let difference = Math.abs(value2 - value1);
								if (difference > Math.PI) {
									if (value1 > value2) {
										value2 += Math.PI * 2;
									} else {
										value1 += Math.PI * 2;
									}
								}
								let value = value2 + (value1 - value2) * amount;
								if (value >= 0 && value <= Math.PI * 2) {
									return value;
								}
								return value % (Math.PI * 2);
							};
							// REOUNDED RECTANGLE:
							CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
								if (w < r * 2) {
									r = w / 2;
								}
								if (h < r * 2) {
									r = h / 2;
								}
								if (r < 0) {
									r = 0;
								}
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
							let allChats = [];
							let ais = [];
							let players = [];
							let alliances = [];
							let alliancePlayers = [];
							let gameObjects = [];
							let projectiles = [];
							let deadPlayers = [];
							let breakObjects = [];
							let player;
							let playerSID;
							let tmpObj;
							let enemy = [];
							let nears = [];
							let enemies = [];
							let near = [];
							let my = {
								reloaded: false,
								waitHit: 0,
								autoAim: false,
								revAim: false,
								ageInsta: true,
								reSync: false,
								bullTick: 0,
								anti0Tick: 0,
								antiSync: false,
								safePrimary: function(tmpObj) {
									return [0, 8].includes(tmpObj.primaryIndex);
								},
								safeSecondary: function(tmpObj) {
									return [10, 11, 14].includes(tmpObj.secondaryIndex);
								},
								lastDir: 0,
								autoPush: false,
								pushData: {}
							};

							// FIND OBJECTS BY ID/SID:
							function findID(tmpObj, tmp) {
								return tmpObj.find(THIS => THIS.id == tmp);
							}

							function findSID(tmpObj, tmp) {
								return tmpObj.find(THIS => THIS.sid == tmp);
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
							//ping scopes
							let Fo = -1;
							let second = -1;
							let highestArr = [];
							let highestMs = -1;
							let averageArr = [];
							let averageMs = -1;
							//Preplacerr tests for better results
							let PreplacerDelay = {
								killObject: -1,
								gatherAnimation: -1,
								total: function() {
									return Math.abs(Math.trunc(this.killObject - this.gatherAnimation));
								}
							};
							//
							function findAvg() {
								let avg = 0;
								let len = averageArr.length;
								let count = 0;
								if (len > 100) {
									let yourArray = averageArr;
									let halfwayThrough = Math.floor(yourArray.length / 2);
									// or instead of floor you can use ceil depending on what side gets the extra data

									let arrayFirstHalf = yourArray.slice(0, halfwayThrough);
									let arraySecondHalf = yourArray.slice(halfwayThrough, yourArray.length);
									//averageArr.shift();
									averageArr = []; //clear the array so we can start over
									averageArr.push(...arraySecondHalf); //push every single element of the second half of the array into the old average array to get new average every 100 iter
									highestMs = window.manhandle;
								}; //remove first elem of array so you dont get overcrowded and easier to sort
								for (let i = 0; i < averageArr.length; i++) {
									avg += averageArr[i];
									count++;
								}
								averageMs = Math.trunc(avg / count);
							}

							function findHighest(ping) {
								if (ping > highestMs && ping < 1000) {
									highestMs = ping;
								}
							}

							function secondSocket() {
								let time = Date.now();
								const e = time - second;
								window.pingTime = e;
							}
							const Qt = document.getElementById("pingDisplay");

							function pingSocketResponse() {
								secondSocket();
								let time = Date.now();
								const e = time - Fo;
								window.manhandle = e;
								if (e < 1000) {
									highestArr.push(e);
									averageArr.push(e);
									findAvg();
									findHighest(e);
								}
								//document.title = "ping: " + e;
								Qt.innerText = ``;
							}
							let Pn;
							let realTime;

							function rePing() {
								if (realTime) {
									clearTimeout(realTime);
								}
								if (inGame) {
									second = Date.now();
								}
								realTime = setTimeout(rePing, window.manhandle);
							}

							function pingSocketStart() {
								rePing();
								if (Pn) {
									clearTimeout(Pn);
								}
								if (inGame) {
									Fo = Date.now();
									io.send("0");
								}
								Pn = setTimeout(pingSocketStart, 1000 / 9);
							}
							let gameName = getEl("gameName");
							let adCard = getEl("adCard");
							let promoImageHolder = getEl("promoImgHolder");
							promoImageHolder.remove();
							let chatButton = getEl("chatButton");
							chatButton.remove();
							let gameCanvas = getEl("gameCanvas");
							let mainContext = gameCanvas.getContext("2d");
							let mapDisplay = getEl("mapDisplay");
							let mapContext = mapDisplay.getContext("2d");
							mapDisplay.width = 300;
							mapDisplay.height = 300;
							let storeMenu = getEl("storeMenu");
							let storeHolder = getEl("storeHolder");
							let upgradeHolder = getEl("upgradeHolder");
							let upgradeCounter = getEl("upgradeCounter");
							let chatBox = getEl("chatBox");
							if (chatBox) {
								chatBox.removeAttribute('maxlength');
								chatBox.autocomplete = "off";
								chatBox.style.textAlign = "center";
								chatBox.style.width = "18em";

								chatBox.addEventListener('keypress', (event) => {
									if (event.key === 'Enter' && chatBox.value.trim() !== '') {
										const message = chatBox.value.trim();

										if (typeof sendChat === 'function') {
											sendChat(message);
										} else {
											return
										}

										chatBox.value = '';

										event.preventDefault();
									}
								});
							} else {
								return
							}
							let chatHolder = getEl("chatHolder");
							let actionBar = getEl("actionBar");
							let leaderboardData = getEl("leaderboardData");
							let itemInfoHolder = getEl("itemInfoHolder");
							let menuCardHolder = getEl("menuCardHolder");
							let mainMenu = getEl("mainMenu");
							let diedText = getEl("diedText");
							let screenWidth;
							let screenHeight;
							let maxScreenWidth = config.maxScreenWidth * 1.4;
							let maxScreenHeight = config.maxScreenHeight * 1.4;
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
							let outlineWidth = main.nativeStatsGraphics.enabled ? 5.5 : 2;
							let isNight = true;
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
								39: [1, 0]
							};

							function resetMoveDir() {
								keys = {};
								io.send("e");
							}
							let attackState = 0;
							let inGame = false;
							var scoreDisplay = document.getElementById("scoreDisplay");
							var foodDisplay = document.getElementById("foodDisplay");
							var woodDisplay = document.getElementById("woodDisplay");
							var stoneDisplay = document.getElementById("stoneDisplay");
							var killCounter = document.getElementById("killCounter");
							$("#foodDisplay").css({
								color: "#ff0000"
							});
							$("#woodDisplay").css({
								color: "#00ff00"
							});
							$("#stoneDisplay").css({
								color: "#737373"
							});
							$("#scoreDisplay").css({
								color: "#e6b800"
							});
							let macro = {};
							let mills = {
								place: 0,
								placeSpawnPads: 0
							};
							let lastDir;
							let lastLeaderboardData = [];
							// ON LOAD:
							let inWindow = true;
							window.onblur = function() {
								inWindow = false;
							};
							window.onfocus = function() {
								inWindow = true;
								if (player && player.alive) {
									resetMoveDir();
								}
							};
							let placeVisible = [];
							/** CLASS CODES */
							class Utils {
								constructor() {
									// MATH UTILS:
									let mathABS = Math.abs;
									let mathCOS = Math.cos;
									let mathSIN = Math.sin;
									let mathPOW = Math.pow;
									let mathSQRT = Math.sqrt;
									let mathATAN2 = Math.atan2;
									let mathPI = Math.PI;
									let _this = this;
									// GLOBAL UTILS:
									this.round = function(n, v) {
										return Math.round(n * v) / v;
									};
									this.toRad = function(angle) {
										return angle * (mathPI / 180);
									};
									this.toAng = function(radian) {
										return radian / (mathPI / 180);
									};
									this.randInt = function(min, max) {
										return Math.floor(Math.random() * (max - min + 1)) + min;
									};
									this.randFloat = function(min, max) {
										return Math.random() * (max - min + 1) + min;
									};
									this.lerp = function(value1, value2, amount) {
										return value1 + (value2 - value1) * amount;
									};
									this.decel = function(val, cel) {
										if (val > 0) {
											val = Math.max(0, val - cel);
										} else if (val < 0) {
											val = Math.min(0, val + cel);
										}
										return val;
									};
									this.getDistance = function(x1, y1, x2, y2) {
										return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
									};
									this.getDist = function(tmp1, tmp2, type1, type2) {
										let tmpXY1 = {
											x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
											y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3
										};
										let tmpXY2 = {
											x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
											y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3
										};
										return mathSQRT((tmpXY2.x -= tmpXY1.x) * tmpXY2.x + (tmpXY2.y -= tmpXY1.y) * tmpXY2.y);
									};
									this.getDirection = function(x1, y1, x2, y2) {
										return mathATAN2(y1 - y2, x1 - x2);
									};
									this.getDirect = function(tmp1, tmp2, type1, type2) {
										let tmpXY1 = {
											x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
											y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3
										};
										let tmpXY2 = {
											x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
											y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3
										};
										return mathATAN2(tmpXY1.y - tmpXY2.y, tmpXY1.x - tmpXY2.x);
									};
									this.getAngleDist = function(a, b) {
										let p = mathABS(b - a) % (mathPI * 2);
										if (p > mathPI) {
											return mathPI * 2 - p;
										} else {
											return p;
										}
									};
									this.isNumber = function(n) {
										return typeof n == "number" && !isNaN(n) && isFinite(n);
									};
									this.isString = function(s) {
										return s && typeof s == "string";
									};
									this.kFormat = function(num) {
										if (num > 999) {
											return (num / 1000).toFixed(1) + "k";
										} else {
											return num;
										}
									};
									this.sFormat = function(num) {
										let fixs = [{
											num: 1000,
											string: "k"
										}, {
											num: 1000000,
											string: "m"
										}, {
											num: 1000000000,
											string: "b"
										}, {
											num: 1000000000000,
											string: "q"
										}].reverse();
										let sp = fixs.find(v => num >= v.num);
										if (!sp) {
											return num;
										}
										return (num / sp.num).toFixed(1) + sp.string;
									};
									this.capitalizeFirst = function(string) {
										return string.charAt(0).toUpperCase() + string.slice(1);
									};
									this.fixTo = function(n, v) {
										return parseFloat(n.toFixed(v));
									};
									this.sortByPoints = function(a, b) {
										return parseFloat(b.points) - parseFloat(a.points);
									};
									this.lineInRect = function(recX, recY, recX2, recY2, x1, y1, x2, y2) {
										let minX = x1;
										let maxX = x2;
										if (x1 > x2) {
											minX = x2;
											maxX = x1;
										}
										if (maxX > recX2) {
											maxX = recX2;
										}
										if (minX < recX) {
											minX = recX;
										}
										if (minX > maxX) {
											return false;
										}
										let minY = y1;
										let maxY = y2;
										let dx = x2 - x1;
										if (Math.abs(dx) > 1e-7) {
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
										if (maxY > recY2) {
											maxY = recY2;
										}
										if (minY < recY) {
											minY = recY;
										}
										if (minY > maxY) {
											return false;
										}
										return true;
									};
									this.containsPoint = function(element, x, y) {
										let bounds = element.getBoundingClientRect();
										let left = bounds.left + window.scrollX;
										let top = bounds.top + window.scrollY;
										let width = bounds.width;
										let height = bounds.height;
										let insideHorizontal = x > left && x < left + width;
										let insideVertical = y > top && y < top + height;
										return insideHorizontal && insideVertical;
									};
									this.mousifyTouchEvent = function(event) {
										let touch = event.changedTouches[0];
										event.screenX = touch.screenX;
										event.screenY = touch.screenY;
										event.clientX = touch.clientX;
										event.clientY = touch.clientY;
										event.pageX = touch.pageX;
										event.pageY = touch.pageY;
									};
									this.hookTouchEvents = function(element, skipPrevent) {
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
											if (element.onmouseover) {
												element.onmouseover(e);
											}
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
													if (element.onmouseover) {
														element.onmouseover(e);
													}
													isHovering = true;
												}
											} else if (isHovering) {
												if (element.onmouseout) {
													element.onmouseout(e);
												}
												isHovering = false;
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
												if (element.onclick) {
													element.onclick(e);
												}
												if (element.onmouseout) {
													element.onmouseout(e);
												}
												isHovering = false;
											}
										}
									};
									this.removeAllChildren = function(element) {
										while (element.hasChildNodes()) {
											element.removeChild(element.lastChild);
										}
									};
									this.generateElement = function(config) {
										let element = document.createElement(config.tag || "div");

										function bind(configValue, elementValue) {
											if (config[configValue]) {
												element[elementValue] = config[configValue];
											}
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
										if (element.onclick) {
											element.onclick = this.checkTrusted(element.onclick);
										}
										if (element.onmouseover) {
											element.onmouseover = this.checkTrusted(element.onmouseover);
										}
										if (element.onmouseout) {
											element.onmouseout = this.checkTrusted(element.onmouseout);
										}
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
									this.checkTrusted = function(callback) {
										return function(ev) {
											if (ev && ev instanceof Event && (ev && typeof ev.isTrusted == "boolean" ? ev.isTrusted : true)) {
												callback(ev);
											} else {
												//console.error("Event is not trusted.", ev);
											}
										};
									};
									this.randomString = function(length) {
										let text = "";
										let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
										for (let i = 0; i < length; i++) {
											text += possible.charAt(Math.floor(Math.random() * possible.length));
										}
										return text;
									};
									this.countInArray = function(array, val) {
										let count = 0;
										for (let i = 0; i < array.length; i++) {
											if (array[i] === val) {
												count++;
											}
										}
										return count;
									};
									this.hexToRgb = function(hex) {
										return hex.slice(1).match(/.{1,2}/g).map(g => parseInt(g, 16));
									};
									this.getRgb = function(r, g, b) {
										return [r / 255, g / 255, b / 255].join(", ");
									};
								}
							};
							class Animtext {
								// ANIMATED TEXT:
								constructor() {
									// INIT:
									this.init = function(x, y, scale, speed, life, text, color) {
										this.x = x;
										this.y = y;
										this.color = color;
										this.scale = scale;
										this.startScale = this.scale;
										this.maxScale = scale * 1.5;
										this.scaleSpeed = 0.7;
										this.speed = speed;
										this.life = life;
										this.text = text;
										this.acc = 1;
										this.alpha = 0;
										this.maxLife = life;
										this.ranX = UTILS.randFloat(-1, 1);
									};
									// UPDATE:
									this.update = function(delta) {
										if (this.life) {
											this.life -= delta;
											if (config.anotherVisual) {
												this.y -= this.speed * delta * this.acc;
												this.acc -= delta / (this.maxLife / 2.5);
												if (this.life <= 200) {
													if (this.alpha > 0) {
														this.alpha = Math.max(0, this.alpha - delta / 300);
													}
												} else if (this.alpha < 1) {
													this.alpha = Math.min(1, this.alpha + delta / 100);
												}
												this.x += this.ranX;
											} else {
												this.y -= this.speed * delta;
											}
											this.scale += this.scaleSpeed * delta;
											if (this.scale >= this.maxScale) {
												this.scale = this.maxScale;
												this.scaleSpeed *= -1;
											} else if (this.scale <= this.startScale) {
												this.scale = this.startScale;
												this.scaleSpeed = 0;
											}
											if (this.life <= 0) {
												this.life = 0;
											}
										}
									};
									// RENDER:
									this.render = function(ctxt, xOff, yOff) {
										ctxt.lineWidth = 10;
										ctxt.fillStyle = this.color;
										ctxt.font = this.scale + "px " + (!config.anotherVisual ? "Hammersmith One" : "Ubuntu");
										if (config.anotherVisual) {
											ctxt.globalAlpha = this.alpha;
											ctxt.strokeStyle = darkOutlineColor;
											ctxt.strokeText(this.text, this.x - xOff, this.y - yOff);
										}
										ctxt.fillText(this.text, this.x - xOff, this.y - yOff);
										ctxt.globalAlpha = 1;
									};
								}
							};
							class Textmanager {
								// TEXT MANAGER:
								constructor() {
									this.texts = [];
									this.stack = [];
									// UPDATE:
									this.update = function(delta, ctxt, xOff, yOff) {
										ctxt.textBaseline = "middle";
										ctxt.textAlign = "center";
										for (let i = 0; i < this.texts.length; ++i) {
											if (this.texts[i].life) {
												this.texts[i].update(delta);
												this.texts[i].render(ctxt, xOff, yOff);
											}
										}
									};
									// SHOW TEXT:
									this.showText = function(x, y, scale, speed, life, text, color) {
										let tmpText;
										for (let i = 0; i < this.texts.length; ++i) {
											if (!this.texts[i].life) {
												tmpText = this.texts[i];
												break;
											}
										}
										if (!tmpText) {
											tmpText = new Animtext();
											this.texts.push(tmpText);
										}
										tmpText.init(x, y, scale, speed, life, text, color);
									};
								}
							}
							class GameObject {
								constructor(sid) {
									this.sid = sid;
									// INIT:
									this.init = function(x, y, dir, scale, type, data, owner) {
										data = data || {};
										this.sentTo = {};
										this.gridLocations = [];
										this.active = true;
										this.alive = true;
										this.doUpdate = data.doUpdate;
										this.x = x;
										this.y = y;
										if (!config.anotherVisual) {
											this.dir = dir + Math.PI;
										} else {
											this.dir = dir;
										}
										this.lastDir = dir;
										this.xWiggle = 0;
										this.yWiggle = 0;
										this.visScale = scale;
										this.scale = scale;
										this.type = type;
										this.id = data.id;
										this.owner = owner;
										this.name = data.name;
										this.isItem = this.id != undefined;
										this.group = data.group;
										this.maxHealth = data.health;
										this.health = this.maxHealth;
										this.healthMov = 100;
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
									this.changeHealth = function(amount, doer) {
										this.health += amount;
										return this.health <= 0;
									};
									// GET SCALE:
									this.getScale = function(sM, ig) {
										sM = sM || 1;
										return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : sM * 0.6) * (ig ? 1 : this.colDiv);
									};
									// VISIBLE TO PLAYER:
									this.visibleToPlayer = function(player) {
										return !this.hideFromEnemy || this.owner && (this.owner == player || this.owner.team && player.team == this.owner.team);
									};
									// UPDATE:
									this.update = function(delta) {
										if (this.health != this.healthMov) {
											if (this.health < this.healthMov) {
												this.healthMov -= 1.9;
											} else {
												this.healthMov += 1.9;
											}
											if (Math.abs(this.health - this.healthMov) < 1.9) {
												this.healthMov = this.health;
											}
										};
										if (this.active) {
											if (this.xWiggle) {
												this.xWiggle *= Math.pow(0.99, delta);
											}
											if (this.yWiggle) {
												this.yWiggle *= Math.pow(0.99, delta);
											}
											if (!config.anotherVisual) {
												let d2 = UTILS.getAngleDist(this.lastDir, this.dir);
												if (d2 > 0.01) {
													this.dir += d2 / 5;
												} else {
													this.dir = this.lastDir;
												}
											} else if (this.turnSpeed && this.dmg) {
												this.dir += this.turnSpeed * delta;
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
									this.isTeamObject = function(tmpObj) {
										if (this.owner == null) {
											return true;
										} else {
											return this.owner && tmpObj.sid == this.owner.sid || tmpObj.findAllianceBySid(this.owner.sid);
										}
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
										name: "tool Hammer",
										desc: "Damage: 25\n Solider: 19",
										src: "hammer_1",
										req: ["Damage", 25, "Solider", 19],
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
										name: "hand Axe",
										desc: "Damage: 30\n Solider: 23\n Gather: 2",
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
										name: "great Axe",
										desc: "Damage: 35\n Solider: 26\n Gather: 4",
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
										name: "short Sword",
										desc: "Damage: 35\n Solider: 26",
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
										desc: "Damage: 40\n Solider: 30",
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
										desc: "Damage: 45\n Solider: 34",
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
										desc: "Damage: 20\n Soider: 15",
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
										desc: "Damage: 20\n Solider: 15",
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
										desc: "Damage: 1\n Gather: 7",
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
										name: "hunting Bow",
										desc: "Damage: 25\n Soider: 19",
										src: "bow_1",
										req: ["Wood", 4],
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
										name: "great Hammer",
										desc: "Damage: 10\n Soider: 8",
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
										name: "wooden Shield",
										desc: "Defends you from Gang-Bangers.",
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
										desc: "",
										src: "crossbow_1",
										req: ["Wood", 5, "Damage", 35, "Solider", 26],
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
										name: "repeater Crossbow",
										desc: "",
										src: "crossbow_2",
										req: ["Wood", 10, "Damage", 30, "Solider", 23],
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
										name: "mc Grabby",
										desc: "",
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
										desc: "",
										src: "musket_1",
										req: ["Stone", 10, "Damage", 50, "Solider", 38],
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
										desc: "",
										req: ["Food", 10, "Heal", 20],
										consume: function(doer) {
											return doer.changeHealth(20, doer);
										},
										scale: 22,
										holdOffset: 15,
										healing: 20,
										itemID: 0,
										itemAID: 16
									}, {
										age: 3,
										group: this.groups[0],
										name: "cookie",
										desc: "",
										req: ["Food", 15, "Heal", 40],
										consume: function(doer) {
											return doer.changeHealth(40, doer);
										},
										scale: 27,
										holdOffset: 15,
										healing: 40,
										itemID: 1,
										itemAID: 17
									}, {
										age: 7,
										group: this.groups[0],
										name: "cheese",
										desc: "",
										req: ["Food", 25, "Heal", 30],
										consume: function(doer) {
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
										itemAID: 18
									}, {
										group: this.groups[1],
										name: "wood Wall",
										desc: "",
										req: ["Wood", 10],
										projDmg: true,
										health: 380,
										scale: 50,
										holdOffset: 20,
										placeOffset: -5,
										itemID: 3,
										itemAID: 19
									}, {
										age: 3,
										group: this.groups[1],
										name: "stone Wall",
										desc: "",
										req: ["Stone", 25],
										health: 900,
										scale: 50,
										holdOffset: 20,
										placeOffset: -5,
										itemID: 4,
										itemAID: 20
									}, {
										age: 7,
										group: this.groups[1],
										name: "castle Wall",
										desc: "",
										req: ["Stone", 35],
										health: 1500,
										scale: 52,
										holdOffset: 20,
										placeOffset: -5,
										itemID: 5,
										itemAID: 21
									}, {
										group: this.groups[2],
										name: "spikes",
										desc: "",
										req: ["Damage", 20, "Solider", 15, "Wood", 20, "Stone", 5],
										health: 400,
										dmg: 20,
										scale: 49,
										spritePadding: -23,
										holdOffset: 8,
										placeOffset: -5,
										itemID: 6,
										itemAID: 22
									}, {
										age: 5,
										group: this.groups[2],
										name: "greater Spikes",
										desc: "",
										req: ["Damage", 35, "Solider", 26, "Wood", 30, "Stone", 10],
										health: 500,
										dmg: 35,
										scale: 52,
										spritePadding: -23,
										holdOffset: 8,
										placeOffset: -5,
										itemID: 7,
										itemAID: 23
									}, {
										age: 9,
										group: this.groups[2],
										name: "poison Spikes",
										desc: "",
										req: ["Damage", 30, "Solider", 22, "Wood", 35, "Stone", 15],
										health: 600,
										dmg: 30,
										pDmg: 5,
										scale: 52,
										spritePadding: -23,
										holdOffset: 8,
										placeOffset: -5,
										itemID: 8,
										itemAID: 24
									}, {
										age: 9,
										group: this.groups[2],
										name: "spinning Spikes",
										desc: "",
										req: ["Damage", 45, "Solider", 34, "Wood", 30, "Stone", 20],
										health: 500,
										dmg: 45,
										turnSpeed: 0.003,
										scale: 52,
										spritePadding: -23,
										holdOffset: 8,
										placeOffset: -5,
										itemID: 9,
										itemAID: 25
									}, {
										group: this.groups[3],
										name: "windmill",
										desc: "",
										req: ["Gold per Second", 1, "Wood", 50, "Stone", 10],
										health: 400,
										pps: 1,
										turnSpeed: 0,
										spritePadding: 25,
										iconLineMult: 12,
										scale: 45,
										holdOffset: 20,
										placeOffset: 5,
										itemID: 10,
										itemAID: 26
									}, {
										age: 5,
										group: this.groups[3],
										name: "faster Windmill",
										desc: "",
										req: ["Gold per Second", 1.5, "Wood", 60, "Stone", 20],
										health: 500,
										pps: 1.5,
										turnSpeed: 0,
										spritePadding: 25,
										iconLineMult: 12,
										scale: 47,
										holdOffset: 20,
										placeOffset: 5,
										itemID: 11,
										itemAID: 27
									}, {
										age: 8,
										group: this.groups[3],
										name: "power Mill",
										desc: "",
										req: ["Gold per Second", 2, "Wood", 100, "Stone", 50],
										health: 800,
										pps: 2,
										turnSpeed: 0,
										spritePadding: 25,
										iconLineMult: 12,
										scale: 47,
										holdOffset: 20,
										placeOffset: 5,
										itemID: 12,
										itemAID: 28
									}, {
										age: 5,
										group: this.groups[4],
										type: 2,
										name: "mine",
										desc: "",
										req: ["Wood", 20, "Stone", 100],
										iconLineMult: 12,
										scale: 65,
										holdOffset: 20,
										placeOffset: 0,
										itemID: 13,
										itemAID: 29
									}, {
										age: 5,
										group: this.groups[11],
										type: 0,
										name: "sapling",
										desc: "",
										req: ["Wood", 150],
										iconLineMult: 12,
										colDiv: 0.5,
										scale: 110,
										holdOffset: 50,
										placeOffset: -15,
										itemID: 14,
										itemAID: 30
									}, {
										age: 4,
										group: this.groups[5],
										name: "pit Trap",
										desc: "Make Stepsister stuck.\n",
										req: ["Wood", 30, "Stone", 30],
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
										itemAID: 31
									}, {
										age: 4,
										group: this.groups[6],
										name: "boost Pad",
										desc: "Makes you go Brrr..\n",
										req: ["Stone", 20, "Wood", 5],
										ignoreCollision: true,
										boostSpeed: 1.5,
										health: 150,
										colDiv: 0.7,
										scale: 45,
										holdOffset: 20,
										placeOffset: -5,
										itemID: 16,
										itemAID: 32
									}, {
										age: 7,
										group: this.groups[7],
										doUpdate: true,
										name: "turret",
										desc: "",
										req: ["Wood", 200, "Stone", 150],
										health: 800,
										projectile: 1,
										shootRange: 700,
										shootRate: 2200,
										scale: 43,
										holdOffset: 20,
										placeOffset: -5,
										itemID: 17,
										itemAID: 33
									}, {
										age: 7,
										group: this.groups[8],
										name: "platform",
										desc: "",
										req: ["Wood", 20],
										ignoreCollision: true,
										zIndex: 1,
										health: 300,
										scale: 43,
										holdOffset: 20,
										placeOffset: -5,
										itemID: 18,
										itemAID: 34
									}, {
										age: 7,
										group: this.groups[9],
										name: "healing Pad",
										desc: "",
										req: ["Wood", 30, "Food", 10],
										ignoreCollision: true,
										healCol: 15,
										health: 400,
										colDiv: 0.7,
										scale: 45,
										holdOffset: 20,
										placeOffset: -5,
										itemID: 19,
										itemAID: 35
									}, {
										age: 9,
										group: this.groups[10],
										name: "spawn Pad",
										desc: "",
										req: ["Wood", 100, "Stone", 100],
										health: 400,
										ignoreCollision: true,
										spawnPoint: true,
										scale: 45,
										holdOffset: 20,
										placeOffset: -5,
										itemID: 20,
										itemAID: 36
									}, {
										age: 7,
										group: this.groups[12],
										name: "blocker",
										desc: "",
										req: ["Wood", 30, "Stone", 25],
										ignoreCollision: true,
										blocker: 300,
										health: 400,
										colDiv: 0.7,
										scale: 45,
										holdOffset: 20,
										placeOffset: -5,
										itemID: 21,
										itemAID: 37
									}, {
										age: 7,
										group: this.groups[13],
										name: "teleporter",
										desc: "",
										req: ["Wood", 60, "Stone", 60],
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
										index: function(id, myItems) {
											if ([0, 1, 2].includes(id)) {
												return 0;
											} else if ([3, 4, 5].includes(id)) {
												return 1;
											} else if ([6, 7, 8, 9].includes(id)) {
												return 2;
											} else if ([10, 11, 12].includes(id)) {
												return 3;
											} else if ([13, 14].includes(id)) {
												return 5;
											} else if ([15, 16].includes(id)) {
												return 4;
											} else if ([17, 19, 21, 22].includes(id)) {
												if ([13, 14].includes(myItems)) {
													return 6;
												} else {
													return 5;
												}
											} else if (id == 20) {
												if ([13, 14].includes(myItems)) {
													return 7;
												} else {
													return 6;
												}
											} else {
												return undefined;
											}
										}
									};
									// ASSIGN IDS:
									for (let i = 0; i < this.list.length; ++i) {
										this.list[i].id = i;
										if (this.list[i].pre) {
											this.list[i].pre = i - this.list[i].pre;
										}
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
								constructor(GameObject, gameObjects, UTILS, config, players, server) {
									let mathFloor = Math.floor;
									let mathABS = Math.abs;
									let mathCOS = Math.cos;
									let mathSIN = Math.sin;
									let mathPOW = Math.pow;
									let mathSQRT = Math.sqrt;
									this.ignoreAdd = false;
									this.hitObj = [];
									// DISABLE OBJ:
									this.disableObj = function(obj) {
										if (enemies.length && near.dist2 <= 250 && PreplacerOverride && Math.hypot(obj.y - player.y, obj.x - player.x) <= 300 && !main.AutoGrind.enabled && main.Preplacer.enabled) {
											let mode = cst ? 2 : enemies[0].health < 73 ? 2 : 4;
											if (instaC.canSpikeTick == false && player.reloads[player.weapons[0]] != 0) {
												place(mode, Math.atan2(obj.y - player.y, obj.x - player.x));
											} else if (instaC.canSpikeTick == false && player.reloads[player.weapons[0]] == 0 && !retrappable) {} else {
												place(mode, Math.atan2(obj.y - player.y, obj.x - player.x));
											}
											PreplacerOverride = false;
											PreplacerDelay.gatherAnimation = Date.now();
										}
										obj.active = false;
										if (config.anotherVisual) {} else {
											obj.alive = false;
										}
									};
									// ADD NEW:
									let tmpObj;
									this.add = function(sid, x, y, dir, s, type, data, setSID, owner) {
										tmpObj = findObjectBySid(sid);
										if (!tmpObj) {
											tmpObj = gameObjects.find(tmp => !tmp.active);
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
									this.disableBySid = function(sid) {
										let find = findObjectBySid(sid);
										if (find) {
											this.disableObj(find);
										}
									};
									// REMOVE ALL FROM PLAYER:
									this.removeAllItems = function(sid, server) {
										gameObjects.filter(tmp => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach(tmp => this.disableObj(tmp));
									};
									// CHECK IF PLACABLE:
									this.checkItemLocation = function(x, y, s, sM, indx, ignoreWater, placer) {
										let cantPlace = gameObjects.find(tmp => tmp.active && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
										if (cantPlace) {
											return false;
										}
										if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) {
											return false;
										}
										return true;
									};
								}
							}
							class Projectile {
								constructor(players, ais, objectManager, items, config, UTILS, server) {
									// INIT:
									this.init = function(indx, x, y, dir, spd, dmg, rng, scl, owner) {
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
									this.update = function(delta) {
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
									this.tickUpdate = function(delta) {
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
										desc: " "
									}, {
										id: 51,
										name: "Moo Cap",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 50,
										name: "Apple Cap",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 28,
										name: "Moo Head",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 29,
										name: "Pig Head",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 30,
										name: "Fluff Head",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 36,
										name: "Pandou Head",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 37,
										name: "Bear Head",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 38,
										name: "Monkey Head",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 44,
										name: "Polar Head",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 35,
										name: "Fez Hat",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 42,
										name: "Enigma Hat",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 43,
										name: "Blitz Hat",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 49,
										name: "Bob XIII Hat",
										price: 0,
										scale: 120,
										desc: " "
									}, {
										id: 57,
										name: "Pumpkin",
										price: 50,
										scale: 120,
										desc: " "
									}, {
										id: 8,
										name: "Bummle Hat",
										price: 100,
										scale: 120,
										desc: " "
									}, {
										id: 2,
										name: "Straw Hat",
										price: 500,
										scale: 120,
										desc: " "
									}, {
										id: 15,
										name: "Winter Cap",
										price: 600,
										scale: 120,
										desc: "Move at normal speed in snow.",
										coldM: 1
									}, {
										id: 5,
										name: "Cowboy Hat",
										price: 1000,
										scale: 120,
										desc: " "
									}, {
										id: 4,
										name: "Ranger Hat",
										price: 2000,
										scale: 120,
										desc: " "
									}, {
										id: 18,
										name: "Explorer Hat",
										price: 2000,
										scale: 120,
										desc: " "
									}, {
										id: 31,
										name: "Flipper Hat",
										price: 2500,
										scale: 120,
										desc: "Control your character in water.",
										watrImm: true
									}, {
										id: 1,
										name: "Marksman Cap",
										price: 3000,
										scale: 120,
										desc: "Arrows gain speed and range. (1.3x)",
										aMlt: 1.3
									}, {
										id: 10,
										name: "Bush Gear",
										price: 3000,
										scale: 160,
										desc: "Disguises you as a Bush."
									}, {
										id: 48,
										name: "Halo",
										price: 3000,
										scale: 120,
										desc: ""
									}, {
										id: 6,
										name: "Soldier Helmet",
										price: 4000,
										scale: 120,
										desc: "Incoming Damage: 0.75x, Speed: 0.94x",
										spdMult: 0.94,
										dmgMult: 0.75
									}, {
										id: 23,
										name: "Anti Venom Gear",
										price: 4000,
										scale: 120,
										desc: "Immunity to Poison.",
										poisonRes: 1
									}, {
										id: 13,
										name: "Medic Gear",
										price: 5000,
										scale: 110,
										desc: "Health per Second x3",
										healthRegen: 3
									}, {
										id: 9,
										name: "Miners Helmet",
										price: 5000,
										scale: 120,
										desc: "Gold per Resource x1",
										extraGold: 1
									}, {
										id: 32,
										name: "Musketeer Hat",
										price: 5000,
										scale: 120,
										desc: "Projectile Cost: 0.5x",
										projCost: 0.5
									}, {
										id: 7,
										name: "Bull Helmet",
										price: 6000,
										scale: 120,
										desc: "Health per Second -x5, Damage: 1.5x, Speed: 0.96x",
										healthRegen: -5,
										dmgMultO: 1.5,
										spdMult: 0.96
									}, {
										id: 22,
										name: "Emp Helmet",
										price: 6000,
										scale: 120,
										desc: "Immunity to Turrets. Speed: 0.7x",
										antiTurret: 1,
										spdMult: 0.7
									}, {
										id: 12,
										name: "Booster Hat",
										price: 6000,
										scale: 120,
										desc: "Speed: 1.16x (Fastest)",
										spdMult: 1.16
									}, {
										id: 26,
										name: "Barbarian Armor",
										price: 8000,
										scale: 120,
										desc: "Enemy Knockback: 0.6",
										dmgK: 0.6
									}, {
										id: 21,
										name: "Plague Mask",
										price: 10000,
										scale: 120,
										desc: "Enemy Poison Damage: x5, Duration: 6s",
										poisonDmg: 5,
										poisonTime: 6
									}, {
										id: 46,
										name: "Bull Mask",
										price: 10000,
										scale: 120,
										desc: "Bulls will become passive to you.",
										bullRepel: 1
									}, {
										id: 14,
										name: "Windmill Hat",
										topSprite: true,
										price: 10000,
										scale: 120,
										desc: "Gold per Second x1.5",
										pps: 1.5
									}, {
										id: 11,
										name: "Spike Gear",
										topSprite: true,
										price: 10000,
										scale: 120,
										desc: "Thorns Damage: 0.45x",
										dmg: 0.45
									}, {
										id: 53,
										name: "Turret Gear",
										topSprite: true,
										price: 10000,
										scale: 120,
										desc: "You become a mobile Turret, Speed: 0.7x",
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
										desc: "Attack Speed: 0.78x (Fastest)",
										atkSpd: 0.78
									}, {
										id: 58,
										name: "Dark Knight",
										price: 12000,
										scale: 120,
										desc: "Restores Health on Damage: 0.4x (Best)",
										healD: 0.4
									}, {
										id: 27,
										name: "Scavenger Gear",
										price: 15000,
										scale: 120,
										desc: "Gold per Kill: 2x",
										kScrM: 2
									}, {
										id: 40,
										name: "Tank Gear",
										price: 15000,
										scale: 120,
										desc: "Building Damage: 3.3x (Best), Speed: 0.3x",
										spdMult: 0.3,
										bDmg: 3.3
									}, {
										id: 52,
										name: "Thief Gear",
										price: 15000,
										scale: 120,
										desc: "Steal 0.5x of your Enemies Gold upon Kill.",
										goldSteal: 0.5
									}, {
										id: 55,
										name: "Bloodthirster",
										price: 20000,
										scale: 120,
										desc: "Restores Health on Damage: 0.25x, Damage Multiplier: 1.2x",
										healD: 0.25,
										dmgMultO: 1.2
									}, {
										id: 56,
										name: "Assassin Gear",
										price: 20000,
										scale: 120,
										desc: "Become Invisible, Can't heal, Speed: 1.1x",
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
										desc: " "
									}, {
										id: 9,
										name: "Tree Cape",
										price: 1000,
										scale: 90,
										desc: " "
									}, {
										id: 10,
										name: "Stone Cape",
										price: 1000,
										scale: 90,
										desc: ""
									}, {
										id: 3,
										name: "Cookie Cape",
										price: 1500,
										scale: 90,
										desc: " "
									}, {
										id: 8,
										name: "Cow Cape",
										price: 2000,
										scale: 90,
										desc: " "
									}, {
										id: 11,
										name: "Monkey Tail",
										price: 2000,
										scale: 97,
										xOff: 25,
										desc: "Speed: 1.35x, Damage: 0.2x",
										spdMult: 1.35,
										dmgMultO: 0.2
									}, {
										id: 17,
										name: "Apple Basket",
										price: 3000,
										scale: 80,
										xOff: 12,
										desc: "Health per Second x1",
										healthRegen: 1
									}, {
										id: 6,
										name: "Winter Cape",
										price: 3000,
										scale: 90,
										desc: " "
									}, {
										id: 4,
										name: "Skull Cape",
										price: 4000,
										scale: 90,
										desc: " "
									}, {
										id: 5,
										name: "Dash Cape",
										price: 5000,
										scale: 90,
										desc: " "
									}, {
										id: 2,
										name: "Dragon Cape",
										price: 6000,
										scale: 90,
										desc: " "
									}, {
										id: 1,
										name: "Super Cape",
										price: 8000,
										scale: 90,
										desc: " "
									}, {
										id: 7,
										name: "Troll Cape",
										price: 8000,
										scale: 90,
										desc: " "
									}, {
										id: 14,
										name: "Thorns",
										price: 10000,
										scale: 115,
										xOff: 20,
										desc: " "
									}, {
										id: 15,
										name: "Blockades",
										price: 10000,
										scale: 95,
										xOff: 15,
										desc: " "
									}, {
										id: 20,
										name: "Devils Tail",
										price: 10000,
										scale: 95,
										xOff: 20,
										desc: " "
									}, {
										id: 16,
										name: "Sawblade",
										price: 12000,
										scale: 90,
										spin: true,
										xOff: 0,
										desc: "Thorns Damage: 0.15x",
										dmg: 0.15
									}, {
										id: 13,
										name: "Angel Wings",
										price: 15000,
										scale: 138,
										xOff: 22,
										desc: "Health per Second x3",
										healthRegen: 3
									}, {
										id: 19,
										name: "Shadow Wings",
										price: 15000,
										scale: 138,
										xOff: 22,
										desc: "Speed: 1.1x",
										spdMult: 1.1
									}, {
										id: 18,
										name: "Blood Wings",
										price: 20000,
										scale: 178,
										xOff: 26,
										desc: "Restores Health on Damage: 0.2x",
										healD: 0.2
									}, {
										id: 21,
										name: "Corrupt X Wings",
										price: 20000,
										scale: 178,
										xOff: 26,
										desc: "Thorns Damage: 0.25x (Best)",
										dmg: 0.25
									}];
								}
							};
							class ProjectileManager {
								constructor(Projectile, projectiles, players, ais, objectManager, items, config, UTILS, server) {
									this.addProjectile = function(x, y, dir, range, speed, indx, owner, ignoreObj, layer, inWindow) {
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
										name: "🐮",
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
										name: "🐷",
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
										name: "🐗",
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
										name: "🐲",
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
										name: "🐺",
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
										name: "🐥",
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
										name: "👳🏾‍♂️",
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
										name: "🗝️",
										hostile: true,
										nameScale: 35,
										src: "crate_1",
										fixedSpawn: true,
										spawnDelay: 120000,
										colDmg: 200,
										killScore: 5000,
										health: 20000,
										weightM: 0.1,
										speed: 0,
										turnSpeed: 0,
										scale: 70,
										spriteMlt: 1
									}, {
										id: 8,
										name: "🦊",
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
										name: "🦊",
										src: "wolf_2",
										hostile: true,
										fixedSpawn: true,
										dontRun: true,
										hitScare: 50,
										spawnDelay: 60000,
										noTrap: true,
										nameScale: 35,
										dmg: 12,
										colDmg: 100,
										killScore: 3000,
										health: 9000,
										weightM: 0.45,
										speed: 0.0015,
										turnSpeed: 0.0025,
										scale: 94,
										viewRange: 1440,
										chargePlayer: true,
										drop: ["food", 3000],
										minSpawnRange: 0.85,
										maxSpawnRange: 0.9
									}, {
										id: 10,
										name: "🐺",
										src: "wolf_1",
										hostile: true,
										fixedSpawn: true,
										dontRun: true,
										hitScare: 50,
										spawnDelay: 30000,
										dmg: 10,
										killScore: 700,
										health: 500,
										weightM: 0.45,
										speed: 0.00115,
										turnSpeed: 0.0025,
										scale: 88,
										viewRange: 1440,
										chargePlayer: true,
										drop: ["food", 400],
										minSpawnRange: 0.85,
										maxSpawnRange: 0.9
									}, {
										id: 11,
										name: "🐉",
										src: "bull_1",
										hostile: true,
										fixedSpawn: true,
										dontRun: true,
										hitScare: 50,
										dmg: 20,
										killScore: 5000,
										health: 5000,
										spawnDelay: 100000,
										weightM: 0.45,
										speed: 0.00115,
										turnSpeed: 0.0025,
										scale: 94,
										viewRange: 1440,
										chargePlayer: true,
										drop: ["food", 800],
										minSpawnRange: 0.85,
										maxSpawnRange: 0.9
									}];
									// SPAWN AI:
									this.spawn = function(x, y, dir, index) {
										let tmpObj = ais.find(tmp => !tmp.active);
										if (!tmpObj) {
											tmpObj = new AI(ais.length, objectManager, players, items, UTILS, config, scoreCallback, server);
											ais.push(tmpObj);
										}
										tmpObj.init(x, y, dir, index, this.aiTypes[index]);
										return tmpObj;
									};
								}
							};
							var playerHit = {
								me: false,
								ene: false
							};
							class AI {
								constructor(sid, objectManager, players, items, UTILS, config, scoreCallback, server) {
									this.sid = sid;
									this.isAI = true;
									this.nameIndex = UTILS.randInt(0, config.cowNames.length - 1);
									// INIT:
									this.init = function(x, y, dir, index, data) {
										this.x = x;
										this.y = y;
										this.startX = data?.fixedSpawn ? x : null;
										this.startY = data?.fixedSpawn ? y : null;
										this.xVel = 0;
										this.yVel = 0;
										this.zIndex = 0;
										this.dir = dir;
										this.dirPlus = 0;
										this.index = index;
										this.src = data.src;
										if (data.name) {
											this.name = data.name;
										}
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
									this.animate = function(delta) {
										if (this.animTime > 0) {
											this.animTime -= delta;
											if (this.animTime <= 0) {
												this.animTime = 0;
												this.dirPlus = 0;
												tmpRatio = 0;
												animIndex = 0;
											} else if (animIndex == 0) {
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
									};
									// ANIMATION:
									this.startAnim = function() {
										this.animTime = this.animSpeed = 600;
										this.targetAngle = Math.PI * 0.8;
										tmpRatio = 0;
										animIndex = 0;
									};
								}
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
								}
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
									this.animate = function(delta) {
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
									};
								}
							};
							class Player {
								constructor(id, sid, config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories, server, scoreCallback, iconCallback) {
									this.id = id;
									this.sid = sid;
									this.tmpScore = 0;
									this.team = null;
									this.latestSkin = 0;
									this.oldSkinIndex = 0;
									this.skinIndex = 0;
									this.latestTail = 0;
									this.oldTailIndex = 0;
									this.tailIndex = 0;
									this.hitTime = 0;
									this.lastHit = 0;
									this.tails = {};
									for (let i = 0; i < accessories.length; ++i) {
										if (accessories[i].price <= 0) {
											this.tails[accessories[i].id] = 1;
										}
									}
									this.skins = {};
									for (let i = 0; i < hats.length; ++i) {
										if (hats[i].price <= 0) {
											this.skins[hats[i].id] = 1;
										}
									}
									this.points = 0;
									this.dt = 0;
									this.hidden = false;
									this.itemCounts = {};
									this.isPlayer = true;
									this.pps = 0;
									this.moveDir = undefined;
									this.skinRot = 0;
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
									this.backupNobull = true;
									this.circle = false;
									this.circleRad = 200;
									this.circleRadSpd = 0.1;
									this.cAngle = 0;
									// SPAWN:
									this.spawn = function(moofoll) {
										this.attacked = false;
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
										this.deathDir = Math.random() * Math.PI * 2;
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
											53: 0
										};
										this.bowThreat = {
											9: 0,
											12: 0,
											13: 0,
											15: 0
										};
										this.timeSpentNearVolcano = 0;
										this.damageThreat = 0;
										this.inTrap = false;
										this.canEmpAnti = false;
										this.empAnti = false;
										this.soldierAnti = false;
										this.poisonTick = 0;
										this.bullTick = 0;
										this.setPoisonTick = false;
										this.setBullTick = false;
										this.antiTimer = 4;
									};
									// RESET MOVE DIR:
									this.resetMoveDir = function() {
										this.moveDir = undefined;
									};
									// RESET RESOURCES:
									this.resetResources = function(moofoll) {
										for (let i = 0; i < config.resourceTypes.length; ++i) {
											this[config.resourceTypes[i]] = moofoll ? 100 : 0;
										}
									};
									// ADD ITEM:
									this.getItemType = function(id) {
										let findindx = this.items.findIndex(ids => ids == id);
										if (findindx != -1) {
											return findindx;
										} else {
											return items.checkItem.index(id, this.items);
										}
									};
									// SET DATA:
									this.setData = function(data) {
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
									this.updateTimer = function() {
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
									this.update = function(delta) {
										if (this.alive) {
											if (this.health != this.healthMov) {
												if (this.health < this.healthMov) {
													this.healthMov -= 2;
												} else {
													this.healthMov += 2;
												}
												if (Math.abs(this.health - this.healthMov) < 2) {
													this.healthMov = this.health;
												}
											};
											if (this.shameCount != this.shameMov) {
												if (this.shameCount < this.shameMov) {
													this.shameMov -= 0.1;
												} else {
													this.shameMov += 0.1;
												}
												if (Math.abs(this.shameCount - this.shameMov) < 0.1) {
													this.shameMov = this.shameCount;
												}
											}
										}
										if (this.sid == playerSID) {
											this.circleRad = parseInt(200) || 0;
											this.circleRadSpd = parseFloat(0.1) || 0;
											this.cAngle += this.circleRadSpd;
										}
										if (this.active) {
											// MOVE:
											let gear = {
												skin: findID(hats, this.skinIndex),
												tail: findID(accessories, this.tailIndex)
											};
											let spdMult = (this.buildIndex >= 0 ? 0.5 : 1) * (items.weapons[this.weaponIndex].spdMult || 1) * (gear.skin ? gear.skin.spdMult || 1 : 1) * (gear.tail ? gear.tail.spdMult || 1 : 1) * (this.y <= config.snowBiomeTop ? gear.skin && gear.skin.coldM ? 1 : config.snowSpeed : 1) * this.slowMult;
											this.maxSpeed = spdMult;
										}
									};
									let tmpRatio = 0;
									let animIndex = 0;
									this.animate = function(delta) {
										if (this.animTime > 0) {
											this.animTime -= delta;
											if (this.animTime <= 0) {
												this.animTime = 0;
												this.dirPlus = 0;
												tmpRatio = 0;
												animIndex = 0;
											} else if (animIndex == 0) {
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
									};
									this.changeHealth = function(amount, doer) {
										if (amount > 0 && this.health >= this.maxHealth) {
											return false;
										}
										if (amount < 0 && this.skin) {
											amount *= this.skin.dmgMult || 1;
										}
										if (amount < 0 && this.tail) {
											amount *= this.tail.dmgMult || 1;
										}
										if (amount < 0) {
											this.hitTime = Date.now();
										}
										this.health += amount;
										if (this.health > this.maxHealth) {
											amount -= this.health - this.maxHealth;
											this.health = this.maxHealth;
										}
										if (this.health <= 0) {
											this.kill(doer);
										}
										for (var i = 0; i < players.length; ++i) {
											if (this.sentTo[players[i].id]) {
												server.send(players[i].id, "O", this.sid, round(this.health));
											}
										}
										if (doer && doer.canSee(this) && (doer != this || amount >= 0)) {
											server.send(doer.id, "8", round(this.x), round(this.y), round(-amount), 1);
										}
										return true;
									};

									// KILL:
									this.kill = function(doer) {
										if (doer && doer.alive) {
											doer.kills++;
											if (doer.skin && doer.skin.goldSteal) {
												scoreCallback(doer, round(this.points / 2));
											} else {
												scoreCallback(doer, round(this.age * 100 * (doer.skin && doer.skin.kScrM ? doer.skin.kScrM : 1)));
											}
											server.send(doer.id, "N", "kills", doer.kills, 1);
										}
										this.alive = false;
										server.send(this.id, "P");
										iconCallback();
									};
									// GATHER ANIMATION:
									//startanim
									this.startAnim = function(didHit, index) {
										this.animTime = this.animSpeed = items.weapons[index].speed;
										this.targetAngle = didHit ? -config.hitAngle : -Math.PI;
										tmpRatio = 0;
										animIndex = 0;
									};
									// CAN SEE:
									this.canSee = function(other) {
										if (!other) {
											return false;
										}
										let dx = Math.abs(other.x - this.x) - other.scale;
										let dy = Math.abs(other.y - this.y) - other.scale;
										return dx <= config.maxScreenWidth / 2 * 1.3 && dy <= config.maxScreenHeight / 2 * 1.3;
									};
									// SHAME SYSTEM:
									this.judgeShame = function() {
										if (this.oldHealth < this.health) {
											if (this.hitTime) {
												let timeSinceHit = Date.now() - this.hitTime;
												this.lastHit = game.tick;
												this.hitTime = 0;
												if (timeSinceHit < 120) {
													this.shameCount++;
												} else {
													this.shameCount = Math.max(0, this.shameCount - 2);
												}
											}
										} else if (this.oldHealth > this.health) {
											this.hitTime = Date.now();
										}
									};
									this.addShameTimer = function() {
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
									this.isTeam = function(tmpObj) {
										return this == tmpObj || this.team && this.team == tmpObj.team;
									};
									// FOR THE PLAYER:
									this.findAllianceBySid = function(sid) {
										if (this.team) {
											return alliancePlayers.find(THIS => THIS === sid);
										} else {
											return null;
										}
									};
									this.checkCanInsta = function(nobull) {
										let totally = 0;
										if (this.alive && inGame) {
											let primary = {
												weapon: this.weapons[0],
												variant: this.primaryVariant,
												dmg: this.weapons[0] == undefined ? 0 : items.weapons[this.weapons[0]].dmg
											};
											let secondary = {
												weapon: this.weapons[1],
												variant: this.secondaryVariant,
												dmg: this.weapons[1] == undefined ? 0 : items.weapons[this.weapons[1]].Pdmg
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
									function pplace(item, angle) {
										let tmpS = player.scale + 45; //scale (50) + offset (-5)
										let tmpX = player.x2 + tmpS * Math.cos(angle);
										let tmpY = player.y2 + tmpS * Math.sin(angle);
										place(item, angle, 0);
									}
									this.manageReload = function() {
										if (this.shooting[53]) {
											this.shooting[53] = 0;
											this.reloads[53] = 2500 - game.tickRate;
										} else if (this.reloads[53] > 0) {
											this.reloads[53] = Math.max(0, this.reloads[53] - game.tickRate);
										}
										if (this.gathering || this.shooting[1]) {
											if (this.gathering) {
												this.gathering = 0;
												this.reloads[this.gatherIndex] = items.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);
												this.attacked = true;
												//Preplacers
											}
											if (this.shooting[1]) {
												this.shooting[1] = 0;
												this.reloads[this.shootIndex] = items.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);
												this.attacked = true;
											}
										} else {
											this.attacked = false;
											if (playerHit.me) {
												playerHit.me = false;
											}
											if (playerHit.ene) {
												playerHit.ene = false;
											}
											if (this.buildIndex < 0) {
												if (this.reloads[this.weaponIndex] > 0) {
													this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - game.tickRate);
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
									this.addDamageThreat = function(tmpObj) {
										let nearTrap = gameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, player, 0, 2) <= player.scale + e.getScale() + 5)[0];
										let primary = {
											weapon: this.primaryIndex,
											variant: this.primaryVariant
										};
										primary.dmg = primary.weapon == undefined ? 45 : items.weapons[primary.weapon].dmg;
										let secondary = {
											weapon: this.secondaryIndex,
											variant: this.secondaryVariant
										};
										secondary.dmg = secondary.weapon == undefined ? 50 : items.weapons[secondary.weapon].Pdmg;
										let bull = 1.5;
										let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
										let sV = secondary.variant != undefined ? [9, 12, 13, 15].includes(secondary.weapon) ? 1 : config.weaponVariants[secondary.variant].val : 1.18;
										if (primary.weapon == undefined ? true : this.reloads[primary.weapon] == 0) {
											this.damageThreat += primary.dmg * pV * bull;
										}
										if (secondary.weapon == undefined ? true : this.reloads[secondary.weapon] == 0) {
											this.damageThreat += secondary.dmg * sV;
										}
										if (this.reloads[53] <= game.tickRate) {
											this.damageThreat += 25;
										}
										if ((!nearTrap || !nearTrap.length) && enemies.length && enemies[0].reloads[enemies[0].weapons[0]].reload != 0 && near.dist2 <= 300) {
											this.damageThreat += enemies[0].weapons[1] != undefined && enemies[0].weapons[1] == 10 ? 45 : 35;
										}
										this.damageThreat *= player.skinIndex == 6 && bullspamming == false && !traps.inTrap ? 0.75 : 1;
										if (!this.isTeam(tmpObj)) {
											if (this.dist2 <= 300) {
												tmpObj.damageThreat += this.damageThreat;
											}
										}
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
										} else if (configs.autoBuyEquip) {
											let find = findID(hats, id);
											if (find) {
												if (player.points >= find.price) {
													//setTimeout(()=>{
													packet("c", 1, id, 0);
													//setTimeout(()=>{
													packet("c", 0, id, 0);
													//}, 120);
													//}, 120);
												} else if (player.latestSkin != nID) {
													packet("c", 0, nID, 0);
												}
											} else if (player.latestSkin != nID) {
												packet("c", 0, nID, 0);
											}
										} else if (player.latestSkin != nID) {
											packet("c", 0, nID, 0);
										}
									} else if (index == 1) {
										if ((bullspamming || clicks.left) && id != 11 && id != 0) {
											if (player.latestTail != 0) {
												if (player.tails[19]) {
													packet("c", 0, 19, 1);
												} else {
													packet("c", 0, 0, 1);
												}
											}
											return;
										}
										if (player.tails[id]) {
											if (player.latestTail != id) {
												packet("c", 0, id, 1);
											}
										} else if (configs.autoBuyEquip) {
											let find = findID(accessories, id);
											if (find) {
												if (player.points >= find.price) {
													packet("c", 1, id, 1);
													// setTimeout(()=>{
													packet("c", 0, id, 1);
													//}, 120);
												} else if (player.latestTail != 0) {
													packet("c", 0, 0, 1);
												}
											} else if (player.latestTail != 0) {
												packet("c", 0, 0, 1);
											}
										} else if (player.latestTail != 0) {
											packet("c", 0, 0, 1);
										}
									}
								}
							}

							function selectToBuild(index, wpn) {
								packet("z", index, wpn);
							}

							function selectWeapon(index, isPlace) {
								if (!isPlace) {
									player.weaponCode = index;
								}
								packet("z", index, 1);
							}

							function sendAutoGather() {
								packet("K", 1, 1);
							}

							function sendAtck(id, angle) {
								packet("F", id, angle, 1);
							}

							function toRadian(angle) {
								let fixedAngle = angle % 360 * (Math.PI / 180);
								if (fixedAngle < 0) {
									return Math.PI * 2 + fixedAngle;
								} else {
									return fixedAngle;
								}
							}

							// PLACER:

							function place(id, rad, rmd) {
								try {
									if (id == undefined) {
										return;
									}
									let item = items.list[player.items[id]];
									let tmpS = player.scale + item.scale + (item.placeOffset || 0);
									let tmpX = player.x2 + tmpS * Math.cos(rad);
									let tmpY = player.y2 + tmpS * Math.sin(rad);
									if (id === 0 || testMode || (player.alive && inGame && player.itemCounts[item.group.id] == undefined ? true : player.itemCounts[item.group.id] < (config.isSandbox ? id === 3 || id === 5 ? 299 : 299 : item.group.limit ? item.group.limit : 99))) {
										selectToBuild(player.items[id]);
										sendAtck(1, rad);
										selectWeapon(player.weaponCode, 1);
										if (main.placementIndicator.enabled) {
											placeVisible.push({
												x: tmpX,
												y: tmpY,
												name: item.name,
												scale: item.scale,
												dir: rad
											});
											game.tickBase(() => {
												placeVisible.shift();
											}, 1);
										}
									} else if (mills.place && id === 3) {
										mills.place = false;
										notif("Auto Mill", mills.place ? "Enabled" : "Disabled");
									}
								} catch (e) {}
							}

							function getDist(e, t) {
								try {
									return Math.hypot((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
								} catch (e) {
									return Infinity;
								}
							}
							// GET DIRECTION
							function getDir(e, t) {
								try {
									return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
								} catch (e) {
									return 0;
								}
							}

							function sortFromSmallest(arr, func) {
								func = typeof func == "function" ? func : obj => {
									return obj;
								};
								return arr.sort((two, one) => func(two) - func(one));
							}
							// tmpList = objectManager.getGridArrays(user.x2, user.y2, 500);
							//                 for (var x = 0; x < tmpList.length; ++x) {
							//                     for (var y = 0; y < tmpList[x].length; ++y) {
							//                         if (tmpList[x][y].active && getDist(player, tmpList[x][y]))
							//                     }
							//                 }
							function getCloseBuildings() {
								let buildings = [];
								let addedBefore = {};
								let filteredBuildings = objectManager.getGridArrays(player.x, player.y, 200);
								for (var x = 0; x < filteredBuildings.length; ++x) {
									for (var y = 0; y < filteredBuildings[x].length; ++y) {
										if (filteredBuildings[x][y].active) {
											buildings.push(filteredBuildings[x][y]);
										}
									}
								}
								return buildings;
							}

							function quadSpikeBreak(user, item) {
								try {
									let angles = [];
									let possibleOnes = [];
									for (let angle = 0; angle < 72; angle++) {
										angles.push(toRadian(angle * 5));
									}
									let buildings_ = sortFromSmallest(gameObjects.filter(t => t.active && t.sid != player.inTrap.sid && getDist(player, t) <= 150), a => {
										return getDist(player, a);
									});
									let last = null;
									for (let angle of angles) {
										let position = player.buildItemPosition(item, angle);
										let possibleToPlace = true;
										if (item.id != 18 && position.y >= config.mapScale / 2 - config.riverWidth / 2 && position.y <= config.mapScale / 2 + config.riverWidth / 2) {
											possibleToPlace = false;
										} else if (last && getDist(last, position) < item.scale + (last.blocker ? last.blocker : last.getScale(0.6, last.isItem))) {
											possibleToPlace = false;
										} else {
											for (let building of buildings_) {
												let range = building.blocker ? building.blocker : building.getScale(0.6, building.isItem);
												if (getDist(building, position) < item.scale + range) {
													// overlap
													possibleToPlace = false;
													last = building;
													break;
												}
											}
										}
										if (possibleToPlace) {
											possibleOnes.push(angle);
										}
									}
									return possibleOnes;
								} catch (e) {

								}
							}

							function getPlaceablePositions(user, item) {
								try {
									let angles = [];
									let possibleOnes = [];
									for (let angle = 0; angle < 72; angle++) {
										angles.push(toRadian(angle * 5));
									}
									let buildings_ = [];
									if (!window.isMohMoh) {
										buildings_ = sortFromSmallest(gameObjects.filter(t => t.active && getDist(player, t) <= 150), a => {
											return getDist(player, a);
										});
									}
									let last = null;
									for (let angle of angles) {
										let position = player.buildItemPosition(item, angle);
										let possibleToPlace = true;
										if (item.id != 18 && position.y >= config.mapScale / 2 - config.riverWidth / 2 && position.y <= config.mapScale / 2 + config.riverWidth / 2) {
											possibleToPlace = false;
										} else if (last && getDist(last, position) < item.scale + (last.blocker ? last.blocker : last.getScale(0.6, last.isItem))) {
											possibleToPlace = false;
										} else if (true) {
											for (let building of buildings_) {
												let range = building.blocker ? building.blocker : building.getScale(0.6, building.isItem);
												if (getDist(building, position) < item.scale + range) {
													// overlap
													possibleToPlace = false;
													last = building;
													break;
												}
											}
										}
										if (possibleToPlace) {
											possibleOnes.push(angle);
										}
									}
									return possibleOnes;
								} catch (e) {

								}
							}
							let firstCheckPlaceForntiBUg = false;

							function simplePlace(id, radian) {
								checkPlace(id, radian);
							};

							function checkPlace(id, rad) {
								try {
									if (secPacket.count >= 80) {
										return;
									}
									//if (id == undefined) return;
									let item = items.list[player.items[id]];
									let tmpS = player.scale + item.scale + (item.placeOffset || 0);
									let tmpX = player.x2 + tmpS * Math.cos(rad);
									let tmpY = player.y2 + tmpS * Math.sin(rad);
									if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player)) {
										place(id, rad, 1);
									}
								} catch (e) {}
							}
							// HEALING:
							function soldierMult() {
								if (player.latestSkin == 6) {
									return 0.75;
								} else {
									return 1;
								}
							}

							function getAttacker(damaged) {
								let attackers = enemy.filter(tmp => {
									//let damages = new Damages(items);
									//let dmg = damages.weapons[tmp.weaponIndex];
									//let by = tmp.weaponIndex < 9 ? [dmg[0], dmg[1], dmg[2], dmg[3]] : [dmg[0], dmg[1]];
									let rule = {
										//one: tmp.dist2 <= 300,
										//two: by.includes(damaged),
										three: tmp.attacked
									};
									return /*rule.one && rule.two && */ rule.three;
								});
								return attackers;
							}

							function healer(extra = 0) {
								if (extra == 0) {
									for (let i = 0; i < healthBased(); i++) {
										place(0, getAttackDir());
									}
								} else {
									for (let i = 0; i < healthBased() + extra; i++) {
										place(0, getAttackDir());
									}
								}
							}
							// ADVANCED:
							function applCxC(value) {
								if (player.health == 100) {
									return 0;
								}
								if (player.skinIndex != 45 && player.skinIndex != 56) {
									return Math.ceil(value / items.list[player.items[0]].healing);
								}
								return 0;
							}

							function healthBased() {
								if (player.health == 100) {
									return 0;
								}
								if (player.skinIndex != 45 && player.skinIndex != 56) {
									return Math.ceil((100 - player.health) / items.list[player.items[0]].healing);
								}
								return 0;
							}

							function calcDmg(value) {
								if (value * player.skinIndex == 6) {
									return 0.75;
								} else {
									return 1;
								}
							}
							// LATER:
							function predictHeal() {}

							function antiSyncHealing(timearg) {
								my.antiSync = true;
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
							const placedSpikePositions = new Set();
							const placedTrapPositions = new Set();

							function isPositionValid(position) {
								const playerX = player.x2;
								const playerY = player.y2;
								const distToPosition = Math.hypot(position[0] - playerX, position[1] - playerY);
								return distToPosition > 35;
							}

							function findAllianceBySid(sid) {
								if (player.team) {
									return alliancePlayers.find(THIS => THIS === sid);
								} else {
									return null;
								}
							}

							function calculatePossibleTrapPositions(x, y, radius) {
								const trapPositions = [];
								const numPositions = 8;
								for (let i = 0; i < numPositions; i++) {
									const angle = Math.PI * 2 * i / numPositions;
									const offsetX = x + radius * Math.cos(angle);
									const offsetY = y + radius * Math.sin(angle);
									const position = [offsetX, offsetY];
									if (!trapPositions.some(pos => isPositionTooClose(position, pos))) {
										trapPositions.push(position);
									}
								}
								return trapPositions;
							}

							function isPositionTooClose(position1, position2, minDistance = 50) {
								const dist = Math.hypot(position1[0] - position2[0], position1[1] - position2[1]);
								return dist < minDistance;
							}

							function biomeGear(mover, returns) {
								if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
									if (returns) {
										return 31;
									}
									buyEquip(31, 0);
								} else if (player.y2 <= config.snowBiomeTop) {
									if (returns) {
										if (enemy && near.dist2 <= 300) {
											return 6;
										} else {
											return 15;
										}
									}
									buyEquip(enemy && near.dist2 <= 300 ? 6 : 15, 0);
								} else {
									if (returns) {
										if (enemy && near.dist2 <= 300) {
											return 6;
										} else {
											return 12;
										}
									}
									buyEquip(enemies.length ? 6 : 12, 0);
								}
								if (returns) {
									return 0;
								}
							}
							let advHeal = [];
							class Traps {
								constructor(UTILS, items) {
									this.dist = 0;
									this.aim = 0;
									this.inTrap = false;
									this.replaced = false;
									this.antiTrapped = false;
									this.info = {};
									this.notFast = function() {
										return player.weapons[1] == 10 && (this.info.health > items.weapons[player.weapons[0]].dmg || player.weapons[0] == 5);
									};
									this.returnTrapHp = function() {
										console.log(this.info.health);
										return this.info.health;
									};
									this.testCanPlace = function(id, first = -(Math.PI / 2), repeat = Math.PI / 2, plus = Math.PI / 18, radian, replacer, yaboi) {
										try {
											let item = items.list[player.items[id]];
											let tmpS = player.scale + item.scale + (item.placeOffset || 0);
											let counts = {
												attempts: 0,
												placed: 0
											};
											let tmpObjects = [];
											gameObjects.forEach(p => {
												tmpObjects.push({
													x: p.x,
													y: p.y,
													active: p.active,
													blocker: p.blocker,
													scale: p.scale,
													isItem: p.isItem,
													type: p.type,
													colDiv: p.colDiv,
													getScale: function(sM, ig) {
														sM = sM || 1;
														return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : sM * 0.6) * (ig ? 1 : this.colDiv);
													}
												});
											});
											for (let i = first; i < repeat; i += plus) {
												counts.attempts++;
												let relAim = radian + i;
												let tmpX = player.x2 + tmpS * Math.cos(relAim);
												let tmpY = player.y2 + tmpS * Math.sin(relAim);
												let cantPlace = tmpObjects.find(tmp => tmp.active && UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
												if (cantPlace) {
													continue;
												}
												if (item.id != 18 && tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) {
													continue;
												}
												if (!replacer && yaboi || bullspamming) {
													if (yaboi.inTrap) {
														if (UTILS.getAngleDist(near.aim2 + Math.PI, relAim + Math.PI) <= Math.PI) {
															place(4, relAim, 1);
														} else if (player.items[4] == 15) {
															place(4, relAim, 1);
														}
													} else if (UTILS.getAngleDist(near.aim2, relAim) <= config.gatherAngle / 1.5) {
														place(2, relAim, 1);
													} else if (player.items[4] == 15) {
														place(4, relAim, 1);
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
													getScale: function() {
														return this.scale;
													}
												});
												if (UTILS.getAngleDist(near.aim2, relAim) <= 1) {
													counts.placed++;
												}
											}
											if (counts.placed > 0 && replacer && item.dmg) {
												if (near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8 && configs.spikeTick) {
													instaC.canSpikeTick = true;
												}
											}
										} catch (err) {}
									};
									this.checkSpikeTick = function() {
										try {
											if (![3, 4, 5].includes(near.primaryIndex)) {
												return false;
											}
											if (getEl("safeAntiSpikeTick").checked || my.autoPush ? false : near.primaryIndex == undefined ? true : near.reloads[near.primaryIndex] > game.tickRate) {
												return false;
											}
											// more range for safe. also testing near.primaryIndex || 5
											if (near.dist2 <= items.weapons[near.primaryIndex || 5].range + near.scale * 1.8) {
												let item = items.list[9];
												let tmpS = near.scale + item.scale + (item.placeOffset || 0);
												let danger = 0;
												let counts = {
													attempts: 0,
													block: `unblocked`
												};
												for (let i = -1; i <= 1; i += 1 / 10) {
													counts.attempts++;
													let relAim = UTILS.getDirect(player, near, 2, 2) + i;
													let tmpX = near.x2 + tmpS * Math.cos(relAim);
													let tmpY = near.y2 + tmpS * Math.sin(relAim);
													let cantPlace = gameObjects.find(tmp => tmp.active && UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
													if (cantPlace) {
														continue;
													}
													if (tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) {
														continue;
													}
													danger++;
													counts.block = `blocked`;
													break;
												}
												if (danger) {
													my.anti0Tick = 1;
													return true;
												}
											}
										} catch (err) {
											return null;
										}
										return false;
									};
									this.protect = function(aim) {
										if (!configs.antiTrap) {
											return;
										}
										if (player.items[4]) {
											this.testCanPlace(4, -(Math.PI / 2), Math.PI / 2, Math.PI / 18, aim + Math.PI);
											this.antiTrapped = true;
										}
									};
									let placedSpikePositions = new Set();
									let placedTrapPositions = new Set();
									this.autoPlace = function() {
										if (main.autoplace.enabled) {
											try {
												const trap1 = gameObjects.filter(e => e.trap && e.active).sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2)).find(trap => {
													const trapDist = Math.hypot(trap.y - near.y2, trap.x - near.x2);
													return trap !== player && (player.sid === trap.owner.sid || findAllianceBySid(trap.owner.sid)) && trapDist <= 50;
												});
												if (trap1 && near.dist2 <= 160) {
													const trapX = trap1.x;
													const trapY = trap1.y;
													const circleRadius = 102;
													const numPositions = 64;
													for (let i = 0; i < numPositions; i++) {
														const angle = Math.PI * 2 * i / numPositions;
														const offsetX = trapX + circleRadius * Math.cos(angle);
														const offsetY = trapY + circleRadius * Math.sin(angle);
														const position = [offsetX, offsetY];
														const distToPlayer = Math.hypot(position[0] - player.x2, position[1] - player.y2);
														if (!placedSpikePositions.has(JSON.stringify(position)) && isPositionValid(position) && distToPlayer <= 87) {
															const angleToPlace = Math.atan2(position[1] - player.y2, position[0] - player.x2);
															checkPlace(2, angleToPlace);
															placedSpikePositions.add(JSON.stringify(position));
														}
													}
												} else if (!trap1 && near.dist2 <= 206) {
													placedSpikePositions.clear();
													const maxTrapsToPlace = 3;
													const trapRadius = 50;
													const trapPositions = calculatePossibleTrapPositions(player.x2, player.y2, trapRadius);
													let trapsPlaced = 0;
													for (const position of trapPositions) {
														if (trapsPlaced < maxTrapsToPlace && !placedTrapPositions.has(JSON.stringify(position)) && isPositionValid(position)) {
															checkPlace(4, ...position);
															placedTrapPositions.add(JSON.stringify(position));
															trapsPlaced++;
														}
													}
												}
											} catch (e) {
												console.log(e);
											}
										}
									};

									function calculatePerfectAngle(x1, y1, x2, y2) {
										return Math.atan2(y2 - y1, x2 - x1);
									}

									function isObjectBroken(object) {
										const healthThreshold = 20;
										return object.health < healthThreshold;
									}
									this.replacer = function(findObj) {
										//
										if (!findObj || !configs.autoReplace) {
											return;
										}
										if (!inGame) {
											return;
										}
										if (this.antiTrapped) {
											return;
										}
										game.tickBase(() => {
											let objAim = UTILS.getDirect(findObj, player, 0, 2);
											let objDst = UTILS.getDist(findObj, player, 0, 2);
											let perfectAngle = calculatePerfectAngle(findObj.x, findObj.y, player.x, player.y);
											if ( /*getEl("weaponGrind").checked*/ main.AutoGrind.enabled && objDst <= items.weapons[player.weaponIndex].range + player.scale) {
												return;
											}
											if (objDst <= 400 && near.dist2 <= 400) {
												if (isObjectBroken(findObj)) {
													let danger = this.checkSpikeTick();
													if (!danger && near.dist2 <= items.weapons[near.primaryIndex || 5].range + near.scale * 1.8) {
														this.testCanPlace(2, 0, Math.PI * 2, Math.PI / 24, perfectAngle, 1);
													} else if (player.items[4] == 15) {
														this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, perfectAngle, 1);
													}
													this.replaced = true;
												}
											}
										}, 1);
									};
								}
							}

							function instaX(type) {
								instaC.isTrue = true;
								instaQ = false;
								let Hg = function(hat, acc) {
									buyEquip(hat, 0);
									buyEquip(acc, 1);
								};
								my.autoAim = true;
								let R = player;
								//aa = true;
								selectWeapon(player.weapons[0]);
								//setWeapon(0);
								let enemies = players.filter(e => e.visible && (e.team != R.team || e.team === null) && e.sid != R.sid).sort((a, b) => Math.hypot(a.y2 - R.y2, a.x2 - R.x2) - Math.hypot(b.y2 - R.y2, b.x2 - R.x2));
								if (type && type != 3) {
									switch (type) {
										case 1:
											buyEquip(!false ? 11 : 6);
											break;
										case 2:
											buyEquip(7, 0);
											break;
									}
								} else if (false || type == 3) {
									buyEquip(7, 0);
								} else if ([22, 6].includes(enemies[0].skinIndex) || player.reloads[53] == 0) {
									buyEquip(7, 0);
								} else {
									buyEquip(enemies[0] == 7 ? 11 : 6);
								}
								sendAutoGather();
								game.tickBase(() => {
									selectWeapon(player.weapons[1]);
									if (player.reloads[53] == 0) {
										buyEquip(53, 0);
										game.tickBase(() => {
											sendAutoGather();
											my.autoAim = false;
											instaC.isTrue = false;
										}, 1);
									} else {
										game.tickBase(() => {
											sendAutoGather();
											my.autoAim = false;
											instaC.isTrue = false;
										}, 1);
									}
								}, 1);
							}

							function instaKH(p = false) {
								let didInsta = false;
								instaC.isTrue = true;
								instaQ = false;
								if (my.waitHit || my.autoAim) {
									return;
								}
								//aa = true;
								//let oW = aw;
								let oW = player.weaponIndex;
								selectWeapon(player.weapons[1]);
								//setWeapon(1);
								my.autoAim = true;
								buyEquip(53, 0);
								sendAutoGather();
								game.tickBase(() => {
									buyEquip(7, 0);
									selectWeapon(player.weapons[0]);
									if (p) {
										place(2, near.aim2);
									}
									game.tickBase(function() {
										my.autoAim = false;
										selectWeapon(oW);
										sendAutoGather();
										instaC.isTrue = false;
									}, 1);
								}, 1);
							}

							function caseInsta() {
								let R = player;
								let enemies = players.filter(e => e.visible && (e.team != R.team || e.team === null) && e.sid != R.sid).sort((a, b) => Math.hypot(a.y2 - R.y2, a.x2 - R.x2) - Math.hypot(b.y2 - R.y2, b.x2 - R.x2));
								if (R.weapons[1] == 10 && R.weapons[0] == 4) {
									if (Math.hypot(enemies[0].y2 - R.y2, enemies[0].x2 - R.x2) < 100) {
										instaKH();
									}
								} else {
									instaX();
								}
							}
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
									this.changeType = function(type) {
										this.wait = false;
										this.isTrue = true;
										my.autoAim = true;
										buyEquip(0, 1);
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
											sendAutoGather();
											buyEquip(0, 1);
											game.tickBase(() => {
												buyEquip(53, 0);
												game.tickBase(() => {
													selectWeapon(player.weapons[0]);
													buyEquip(7, 0);
													game.tickBase(() => {
														sendAutoGather();
														this.isTrue = false;
														my.autoAim = false;
													}, 1);
												}, 1);
											}, 1);
										} else if (type == "nobull") {
											selectWeapon(player.weapons[0]);
											if (getEl("backupNobull").checked && backupNobull) {
												buyEquip(7, 0);
											} else {
												buyEquip(6, 0);
											}
											buyEquip(21, 1);
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
												buyEquip(21, 1);
												game.tickBase(() => {
													sendAutoGather();
													this.isTrue = false;
													my.autoAim = false;
												}, 1);
											}, 1);
										} else if (type == "normal") {
											selectWeapon(player.weapons[0]);
											buyEquip(7, 0);
											buyEquip(21, 1);
											sendAutoGather();
											game.tickBase(() => {
												selectWeapon(player.weapons[1]);
												buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
												buyEquip(21, 1);
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
									/*this.spikeTickType = function () {
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
									this.spikeTickType = function() {
										this.isTrue = true;
										my.autoAim = true;
										selectWeapon(player.weapons[0]);
										buyEquip(7, 0);
										buyEquip(21, 1);
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
											}, 3);
										}, 1);
									};
									this.counterType = function() {
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
									this.antiCounterType = function() {
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
										}, 1);
									};
									this.rangeType = function(type) {
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
									this.oneTickType = function() {
										this.isTrue = true;
										my.autoAim = true;
										selectWeapon(player.weapons[1]);
										buyEquip(53, 0);
										packet("9", near.aim2, 1);
										if (player.weapons[1] == 15) {
											my.revAim = true;
											sendAutoGather();
										}
										game.tickBase(() => {
											const trap1 = gameObjects.filter(e => e.trap && e.active).sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2)).find(trap => {
												const trapDist = Math.hypot(trap.y - near.y2, trap.x - near.x2);
												return trap !== player && (player.sid === trap.owner.sid || findAllianceBySid(trap.owner.sid)) && trapDist <= 30;
											});
											if ([6, 22].includes(near.skinIndex) && trap1) {
												io.send("6", "p_OT [2/3]");
											}
											my.revAim = false;
											selectWeapon(player.weapons[0]);
											buyEquip(7, 0);
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
									this.threeOneTickType = function() {
										this.isTrue = true;
										my.autoAim = true;
										selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
										biomeGear();
										buyEquip(11, 1);
										packet("9", near.aim2, 1);
										game.tickBase(() => {
											selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
											buyEquip(53, 0);
											buyEquip(11, 1);
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
									this.kmTickType = function() {
										this.isTrue = true;
										my.autoAim = true;
										my.revAim = true;
										selectWeapon(player.weapons[1]);
										buyEquip(53, 0);
										buyEquip(11, 1);
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
									this.boostTickType = function() {
										/*this.isTrue = true;
										my.autoAim = true;
										selectWeapon(player.weapons[0]);
										buyEquip(53, 0);
										buyEquip(11, 1);
										packet("33", near.aim2);
										game.tickBase(() => {
										place(4, near.aim2);
										selectWeapon(player.weapons[1]);
										biomeGear();
										buyEquip(11, 1);
										sendAutoGather();
										packet("33", near.aim2);
										game.tickBase(() => {
										selectWeapon(player.weapons[0]);
										buyEquip(7, 0);
										buyEquip(19, 1);
										packet("33", near.aim2);
										game.tickBase(() => {
										sendAutoGather();
										this.isTrue = false;
										my.autoAim = false;
										packet("33", undefined);
										}, 1);
										}, 1);
										}, 1);*/
										this.isTrue = true;
										my.autoAim = true;
										biomeGear();
										buyEquip(11, 1);
										packet("9", near.aim2, 1);
										game.tickBase(() => {
											if (player.weapons[1] == 15) {
												my.revAim = true;
											}
											selectWeapon(player.weapons[[9, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
											buyEquip(53, 0);
											buyEquip(11, 1);
											if ([9, 12, 13, 15].includes(player.weapons[1])) {
												sendAutoGather();
											}
											packet("9", near.aim2, 1);
											place(4, near.aim2);
											game.tickBase(() => {
												my.revAim = false;
												selectWeapon(player.weapons[0]);
												buyEquip(7, 0);
												buyEquip(19, 1);
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
									this.gotoGoal = function(goto, OT) {
										let slowDists = weeeee => weeeee * config.playerScale;
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
										let bQ = function(wwww, awwww) {
											if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2 && awwww == 0) {
												buyEquip(31, 0);
											} else {
												buyEquip(wwww, awwww);
											}
										};
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
																if (configs.slowOT) {
																	if (player.buildIndex != player.items[1]) {
																		selectToBuild(player.items[1]);
																	}
																} else if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
																	selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
																}
															} else {
																bQ(22, 0);
																bQ(19, 1);
																if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
																	selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
																}
															}
														} else {
															bQ(6, 0);
															if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
																selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
															}
														}
													} else {
														biomeGear();
														if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
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
																if (configs.slowOT) {
																	if (player.buildIndex != player.items[1]) {
																		selectToBuild(player.items[1]);
																	}
																} else if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
																	selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
																}
															} else {
																bQ(22, 0);
																bQ(19, 1);
																if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
																	selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
																}
															}
														} else {
															bQ(6, 0);
															if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
																selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
															}
														}
													} else {
														biomeGear();
														bQ(11, 1);
														if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
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
									};
									/** wait 1 tick for better quality */
									this.bowMovement = function() {
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
									};
									this.tickMovement = function() {
										const trap1 = gameObjects.filter(e => e.trap && e.active).sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2)).find(trap => {
											const trapDist = Math.hypot(trap.y - near.y2, trap.x - near.x2);
											return trap !== player && (player.sid === trap.owner.sid || findAllianceBySid(trap.owner.sid)) && trapDist <= 50;
										});
										let moveMent = this.gotoGoal([10, 14].includes(player.weapons[1]) && player.y2 > config.snowBiomeTop ? 240 : player.weapons[1] == 15 ? 250 : player.y2 <= config.snowBiomeTop ? [10, 14].includes(player.weapons[1]) ? 265 : 255 : 270, 3);
										if (moveMent.action) {
											if ((![6, 22].includes(near.skinIndex) || [6, 22].includes(near.skinIndex) && trap1) && player.reloads[53] == 0 && !this.isTrue) {
												if ([10, 14].includes(player.weapons[1]) && player.y2 > config.snowBiomeTop || player.weapons[1] == 15) {
													this.threeOneTickType();
												} else {
													this.Snowtick();
												}
											} else {
												packet("9", moveMent.dir, 1);
											}
										} else {
											packet("9", moveMent.dir, 1);
										}
									};
									this.boostTickMovement = function() {
										let dist = player.weapons[1] == 9 ? 365 : player.weapons[1] == 12 ? 380 : player.weapons[1] == 13 ? 390 : player.weapons[1] == 15 ? 365 : 370;
										let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1.5 : player.weapons[1] == 15 ? 2 : 3;
										let moveMent = this.gotoGoal(dist, actionDist);
										if (moveMent.action) {
											if (player.reloads[53] == 0 && !this.isTrue) {
												this.boostTickType();
											} else {
												packet("9", moveMent.dir, 1);
											}
										} else {
											packet("9", moveMent.dir, 1);
										}
									};
									/** wait 1 tick for better quality */
									this.perfCheck = function(pl, nr) {
										if (nr.weaponIndex == 11 && UTILS.getAngleDist(nr.aim2 + Math.PI, nr.d2) <= config.shieldAngle) {
											return false;
										}
										if (![9, 12, 13, 15].includes(player.weapons[1])) {
											return true;
										}
										let pjs = {
											x: nr.x2 + Math.cos(nr.aim2 + Math.PI) * 70,
											y: nr.y2 + Math.sin(nr.aim2 + Math.PI) * 70
										};
										if (UTILS.lineInRect(pl.x2 - pl.scale, pl.y2 - pl.scale, pl.x2 + pl.scale, pl.y2 + pl.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
											return true;
										}
										let finds = ais.filter(tmp => tmp.visible).find(tmp => {
											if (UTILS.lineInRect(tmp.x2 - tmp.scale, tmp.y2 - tmp.scale, tmp.x2 + tmp.scale, tmp.y2 + tmp.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
												return true;
											}
										});
										if (finds) {
											return false;
										}
										finds = gameObjects.filter(tmp => tmp.active).find(tmp => {
											let tmpScale = tmp.getScale();
											if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, pjs.x, pjs.y, pjs.x, pjs.y)) {
												return true;
											}
										});
										if (finds) {
											return false;
										}
										return true;
									};
								}
							};
							class Purchaser {
								constructor(buyHat, buyAcc) {
									this.hat = function() {
										buyHat.forEach(id => {
											let find = findID(hats, id);
											if (find && !player.skins[id] && player.points >= find.price) {
												packet("c", 1, id, 0);
											}
										});
									};
									this.acc = function() {
										buyAcc.forEach(id => {
											let find = findID(accessories, id);
											if (find && !player.tails[id] && player.points >= find.price) {
												packet("c", 1, id, 1);
											}
										});
									};
								}
							};
							class Upgrader {
								constructor() {
									this.sb = function(upg) {
										upg(3);
										upg(17);
										upg(31);
										upg(23);
										upg(9);
										upg(38);
									};
									this.kh = function(upg) {
										upg(3);
										upg(17);
										upg(31);
										upg(23);
										upg(10);
										upg(38);
										upg(4);
										upg(25);
									};
									this.pb = function(upg) {
										upg(5);
										upg(17);
										upg(32);
										upg(23);
										upg(9);
										upg(38);
									};
									this.ph = function(upg) {
										upg(5);
										upg(17);
										upg(32);
										upg(23);
										upg(10);
										upg(38);
										upg(28);
										upg(25);
									};
									this.db = function(upg) {
										upg(7);
										upg(17);
										upg(31);
										upg(23);
										upg(9);
										upg(34);
									};
									/* old functions */
									this.km = function(upg) {
										upg(7);
										upg(17);
										upg(31);
										upg(23);
										upg(10);
										upg(38);
										upg(4);
										upg(15);
									};
								}
							};
							class Damages {
								constructor(items) {
									// 0.75 1 1.125 1.5
									this.calcDmg = function(dmg, val) {
										return dmg * val;
									};
									this.getAllDamage = function(dmg) {
										return [this.calcDmg(dmg, 0.75), dmg, this.calcDmg(dmg, 1.125), this.calcDmg(dmg, 1.5)];
									};
									this.weapons = [];
									for (let i = 0; i < items.weapons.length; i++) {
										let wp = items.weapons[i];
										let name = wp.name.split(" ").length <= 1 ? wp.name : wp.name.split(" ")[0] + "_" + wp.name.split(" ")[1];
										this.weapons.push(this.getAllDamage(i > 8 ? wp.Pdmg : wp.dmg));
										this[name] = this.weapons[i];
									}
								}
							}
							let hasDisplayedWarning = false;

							function shameWarn() {
								if (player && player.alive && player.shameCount > 4 && !hasDisplayedWarning) {
									Notify(`High Shame Detected! `, "#CC5151");
									hasDisplayedWarning = true;
								}
							}
							setInterval(shameWarn, 100);

							/** CLASS CODES */
							let tmpList = [];
							// LOADING:
							let UTILS = new Utils();
							let items = new Items();
							let objectManager = new Objectmanager(GameObject, gameObjects, UTILS, config);
							let store = new Store();
							let hats = store.hats;
							let accessories = store.accessories;
							let projectileManager = new ProjectileManager(Projectile, projectiles, players, ais, objectManager, items, config, UTILS);
							let aiManager = new AiManager(ais, AI, players, items, null, config, UTILS);
							let textManager = new Textmanager();
							let traps = new Traps(UTILS, items);
							let instaC = new Instakill();
							let autoBuy = new Purchaser([6, 7, 40], [11, 19]);
							let autoUpgrade = new Upgrader();
							let lastDeath;
							let minimapData;
							let mapMarker = {};
							let mapPings = [];
							let tmpPing;
							let breakTrackers = [];
							//let pathFindTest = 0;
							let grid = [];
							/* let pathFind = {
							      active: true,
							      grid: 1440,
							      scale: 40,
							      x: 14400,
							      y: 14400,
							      chaseNear: false,
							      array: [],
							      lastX: this.grid / 2,
							      lastY: this.grid / 2
							  };*/
function sendChat(message) {
    const maxLength = 30;

    // replace german characters with their equivalents
    message = message.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
                     .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue");

    let words = message.split(" ");
    let currentMessage = "";

    const sendPacket = (msg, delay) => {
        setTimeout(() => packet("6", msg), delay);
    };

    let delay = 0;
    words.forEach(word => {
        if ((currentMessage + word).length <= maxLength) {
            currentMessage += (currentMessage ? " " : "") + word;
        } else {
            sendPacket(currentMessage, delay);
            delay += 1750;
            currentMessage = word;
        }
    });

    if (currentMessage) {
        sendPacket(currentMessage, delay);
    }
}
							let runAtNextTick = [];

							function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
								let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
								let projOffset = config.playerScale * 2;
								let projXY = {
									x: indx == 1 ? x : x - projOffset * Math.cos(dir),
									y: indx == 1 ? y : y - projOffset * Math.sin(dir)
								};
								let nearPlayer = players.filter(e => e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale).sort(function(a, b) {
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
										} else if (projectileCount >= 2) {
											place(3, tmpObj.aim2);
											my.anti0Tick = 4;
											if (!my.antiSync) {
												antiSyncHealing(4);
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
									if (isStoreItem) {} else if (isWeapon) {
										UTILS.generateElement({
											class: "itemInfoReq",
											text: !item.type ? "Primary" : "Secondary",
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
												text: (player.itemCounts[item.group.id] || 0) + "/" + (true ? 99 : item.group.limit),
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
							var black = [];

							function resize() {
								screenWidth = window.innerWidth;
								screenHeight = window.innerHeight;
								let scaleFillNative = Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) * pixelDensity;
								gameCanvas.width = screenWidth * pixelDensity;
								gameCanvas.height = screenHeight * pixelDensity;
								gameCanvas.style.width = screenWidth + "px";
								gameCanvas.style.height = screenHeight + "px";
								mainContext.setTransform(scaleFillNative, 0, 0, scaleFillNative, (screenWidth * pixelDensity - maxScreenWidth * scaleFillNative) / 2, (screenHeight * pixelDensity - maxScreenHeight * scaleFillNative) / 2);
								let oe = maxScreenWidth;
								let ce = maxScreenHeight;
								black = mainContext.createRadialGradient(oe / 2, ce / 2, 0, oe / 2, ce / 2, oe);
								black.addColorStop(0, "rgba(0,0,0,0)");
								black.addColorStop(1, "black");
								/*
								F = window.innerWidth,
								z = window.innerHeight;
								var e = Math.max(F / oe, z / ce) * V;
								we.width = F * V,
								we.height = z * V,
								we.style.width = F + "px",
								we.style.height = z + "px",
								be.setTransform(e, 0, 0, e, (F * V - oe * e) / 2, (z * V - ce * e) / 2)
								black = be.createRadialGradient(oe/2,ce/2,0, oe/2,ce/2,oe);
								black.addColorStop(0, 'rgba(0,0,0,0)');
								black.addColorStop(1, 'black');
								*/
							}
							resize();

// MOUSE INPUT
const mals = document.getElementById("touch-controls-fullscreen");
mals.style.display = "block";
mals.addEventListener("mousemove", gameInput, false);

function gameInput(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
}

let clicks = {
    left: false,
    middle: false,
    right: false
};

mals.addEventListener("mousedown", mouseDown, false);

function mouseDown(e) {
    if (attackState !== 1) {
        attackState = 1;
        isMouseHeld = true; // Set flag when mouse button is pressed
        spinner.stop();

        if (e.button === 0) clicks.left = true;
        else if (e.button === 1) clicks.middle = true;
        else if (e.button === 2) clicks.right = true;
    }
}

mals.addEventListener("mouseup", UTILS.checkTrusted(mouseUp));

function mouseUp(e) {
    if (attackState !== 0) {
        attackState = 0;
        isMouseHeld = false;

        if (e.button === 0) clicks.left = false;
        else if (e.button === 1) clicks.middle = false;
        else if (e.button === 2) clicks.right = false;
    }
}

mals.addEventListener("wheel", wheel, false);

function wheel(e) {
    if (e.deltaY < 0) {
        my.reSync = true;
    } else {
        my.reSync = false;
    }
}

setInterval(() => {
    if (main.AutoSpin.enabled && !spinner.isSpinning && !spinner.timeoutActive && !isMouseHeld) {
        spinner.start();
    } else if ((!main.AutoSpin.enabled || isMouseHeld) && spinner.isSpinning) {
        spinner.stop();
    }
}, 500);

							// INPUT UTILS:
							function getMoveDir() {
								let dx = 0;
								let dy = 0;
								for (let key in moveKeys) {
									let tmpDir = moveKeys[key];
									dx += !!keys[key] * tmpDir[0];
									dy += !!keys[key] * tmpDir[1];
								}
								if (dx == 0 && dy == 0) {
									return undefined;
								} else {
									return Math.atan2(dy, dx);
								}
							}

							function getSafeDir() {
								if (!player) {
									return 0;
								}
								if (!player.lockDir) {
									lastDir = Math.atan2(mouseY - screenHeight / 2, mouseX - screenWidth / 2);
								}
								return lastDir || 0;
							}

							function getAttackDir(debug) {
								if (debug) {
									if (!player) {
										return "0";
									}
									if (my.autoAim || (clicks.left || main.RealDir.enabled && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap) && player.reloads[player.weapons[0]] == 0) {
										lastDir = /*getEl("weaponGrind").checked*/ main.AutoGrind.enabled ? "getSafeDir()" : enemy.length ? my.revAim ? "(near.aim2 + Math.PI)" : "near.aim2" : "getSafeDir()";
									} else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
										lastDir = "getSafeDir()";
									} else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0) {
										lastDir = "traps.aim";
									} else if (!player.lockDir) {
										if (configs.noDir) {
											return "undefined";
										}
										lastDir = "getSafeDir()";
									}
									return lastDir;
								} else {
									if (!player) {
										return 0;
									}
									if (my.autoAim || (clicks.left || main.RealDir.enabled && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap) && player.reloads[player.weapons[0]] == 0) {
										lastDir = main.AutoGrind.enabled /*getEl("weaponGrind").checked */ ? getSafeDir() : enemy.length ? my.revAim ? near.aim2 + Math.PI : near.aim2 : getSafeDir();
									} else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
										lastDir = getSafeDir();
									} else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0) {
										lastDir = traps.aim;
									} else if (!player.lockDir) {
										if (configs.noDir) {
											return undefined;
										}
										lastDir = getSafeDir();
									}
									return lastDir || 0;
								}
							}

							function getVisualDir() {
								if (!player) {
									return 0;
								}
								if (my.autoAim || (clicks.left || main.RealDir.enabled && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap) && player.reloads[player.weapons[0]] == 0) {
									lastDir = /*getEl("weaponGrind").checked*/ main.AutoGrind.enabled ? getSafeDir() : enemy.length ? my.revAim ? near.aim2 + Math.PI : near.aim2 : getSafeDir();
								} else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
									lastDir = getSafeDir();
								} else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0) {
									lastDir = traps.aim;
								} else if (!player.lockDir) {
									lastDir = getSafeDir();
								}
								return lastDir || 0;
							}
							// KEYS:
							function keysActive() {
								return allianceMenu.style.display != "block" && chatHolder.style.display != "block" && !menuCBFocus;
							}

							function toggleMenu(menu, otherMenu) {
								if (menu.style.display === 'none' || menu.style.display === '') {
									menu.style.display = 'block';
									if (otherMenu.style.display !== 'none') {
										otherMenu.style.display = 'none';
									}
								} else {
									menu.style.display = 'none';
								}
							}

							function keyDown(event) {
								let keyNum = event.which || event.keyCode || 0;
								if (player && player.alive && keysActive()) {
									if (!keys[keyNum]) {
										keys[keyNum] = 1;
										macro[event.key] = 1;
										if (keyNum == 69) {
                      spinner.stop();
											sendAutoGather();
										} else if (keyNum == 88) {
											player.lockDir = !player.lockDir;
										} else if (keyNum == 67) {
											packet("6", "Vape - Scoping In..");
										} else if (player.weapons[keyNum - 49] != undefined) {
											player.weaponCode = player.weapons[keyNum - 49];
										} else if (moveKeys[keyNum]) {
											sendMoveDir();
										} else if (event.key == "m") {
											mills.placeSpawnPads = !mills.placeSpawnPads;
											notif("Auto Pads", mills.placeSpawnPads ? "Enabled" : "Disabled");
										} else if (event.key == "z") {
											mills.place = !mills.place;
											notif("Auto Mill", mills.place ? "Enabled" : "Disabled");
										} else if (event.key == "Z") {
											if (typeof window.debug == "function") {
												window.debug();
											}
										} else if (keyNum == 32) {
											packet("F", 1, getSafeDir(), 1);
											packet("F", 0, getSafeDir(), 1);
										} else if (event.key == ",") {
											toggleMenu(allianceMenu, storeMenu);
										} else if (event.key == ".") {
											toggleMenu(storeMenu, allianceMenu);
										} else if (event.key == "r") {
											if (!main.autoInsta.enabled) {
												instaQ = !instaQ;
											}
										}
									}
								}
							}
							addEventListener("keydown", UTILS.checkTrusted(keyDown));

							function keyUp(event) {
								if (player && player.alive) {
									let keyNum = event.which || event.keyCode || 0;
									if (keyNum == 13) {
										// toggleMenuChat();
									} else if (keysActive()) {
										if (keys[keyNum]) {
											keys[keyNum] = 0;
											macro[event.key] = 0;
											if (moveKeys[keyNum]) {
												sendMoveDir();
											} else if (event.key == ",") {
												toggleMenu(allianceMenu, storeMenu);
											}
										}
									}
								}
							}
							window.addEventListener("keyup", UTILS.checkTrusted(keyUp));

							function sendMoveDir() {
								let newMoveDir = getMoveDir();
								if (lastMoveDir == undefined || newMoveDir == undefined || Math.abs(newMoveDir - lastMoveDir) > 0.3) {
									tracker.moveDir = newMoveDir;
									lastMoveDir = newMoveDir;
								}
							}
							// BUTTON EVENTS:
							function bindEvents() {}
							bindEvents();
							/** PATHFIND TEST */

							function toFancyTimeFormat(time) {
								let minutes = ~~(time % 3600 / 60);
								let seconds = ~~time % 60;
								if (seconds <= 9) {
									seconds = `0${seconds}`;
								}
								return `${minutes}:${seconds}`;
							}
							var converToJSDelay = time => {
								let newTime = time.split(":").reverse();
								time = 0;
								let convert = [3600000, 60000, 1000, 1].reverse();
								newTime.forEach((b, c) => {
									time += b * convert[c];
								});
								return time;
							};

							function createPath() {
								grid = [];
								checkObject();
							}
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
    bottom: 0;
    left: 0;
    padding-left: 3px;
    padding-top: 1px;
    font-size: 1em;
    color: #fff;
`;
										isItemSetted[tmpI].innerHTML = player.itemCounts[id] || 0;
									} else if (index == id) {
										isItemSetted[tmpI].innerHTML = player.itemCounts[index] || 0;
									}
								}
							}

							// AUTOPUSH:
							let pathFind = {
								show: false,
								paths: [],
								enabled: false
							};
							var retrappable = false;

							function autoPush() {
								retrappable = true;
								let nearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= near.scale + tmp.getScale() + 5).sort(function(a, b) {
									return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
								})[0];
								if (nearTrap) {
									let spike = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= near.scale + nearTrap.scale + tmp.scale).sort(function(a, b) {
										return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
									})[0];
									if (spike) {
										let angle = Math.atan2(enemies[0].y2 - spike.y, enemies[0].x2 - spike.x);
										let point = {
											x: enemies[0].x2 + Math.cos(angle) * 62,
											y: enemies[0].y2 + Math.sin(angle) * 62
										};
										if (fgdo(point, player) <= 20) {
											point = {
												x: enemies[0].x2 + Math.cos(angle) * 52,
												y: enemies[0].y2 + Math.sin(angle) * 52
											};
										}
										my.pushData = {
											x: point.x,
											y: point.y
										};
										/*let finds = gameObjects.filter(tmp => tmp.active).find((tmp) => {
										    let tmpScale = tmp.getScale();
										    if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, player.x2, player.y2, pos.x2, pos.y2)) {
										        return true;
										    }
										});
										if (finds) {
										    if (my.autoPush) {
										        my.autoPush = false;
										        packet("9", lastMoveDir || undefined, 1);
										    }
										} else {
										    my.autoPush = true;
										    my.pushData = {
										        x: spike.x + 70,
										        y: spike.y + 70,
										        x2: pos.x2 + 30,
										        y2: pos.y2 + 30
										    };
										    let scale = 5;
										    let secondArg = UTILS.getDirect(near, spike, 2, 0) > 70 ? near.aim2 : undefined;
										    if (UTILS.lineInRect(player.x2 - scale, player.y2 - scale, player.x2 + scale, player.y2 + scale, near.x2, near.y2, pos.x, pos.y)) {
										        packet("9", secondArg, 1);
										    } else {
										        packet("9", UTILS.getDirect(pos, player, 2, 2), 1);
										    }
										}*/
										my.autoPush = true;
										selectWeapon(player.weapons[0]);
										let dir = Math.atan2(point.y - player.y2, point.x - player.x2);
										packet("9", dir, 1);
										if (main.ObsessiveChat.enabled) {
											sendChat("Pushing Player [" + near.sid + "]");
										}
									} else if (my.autoPush) {
										my.autoPush = false;
										packet("9", lastMoveDir || undefined, 1);
									}
								} else if (my.autoPush) {
									my.autoPush = false;
									packet("9", lastMoveDir || undefined, 1);
								}
							}
							// ADD DEAD PLAYER:
							function addDeadPlayer(tmpObj) {
								deadPlayers.push(new DeadPlayer(tmpObj.x, tmpObj.y, tmpObj.dir, tmpObj.buildIndex, tmpObj.weaponIndex, tmpObj.weaponVariant, tmpObj.skinColor, tmpObj.scale, tmpObj.name));
							}
							/** APPLY SOCKET CODES */
							// SET INIT DATA:
							function setInitData(data) {
								alliances = data.teams;
							}
							var packs = [];
							// SETUP GAME:
							var fisrtloadez = false;

							function setupGame(yourSID) {
								window.debug();
								keys = {};
								macro = {};
								playerSID = yourSID;
								attackState = 0;
								pingSocketStart();
								rePing();
								fisrtloadez = true;
								packet("F", 0, getAttackDir(), 1);
								my.ageInsta = true;
								if (firstSetup) {
									firstSetup = false;
									gameObjects.length = 0;
								}
							}

							function createClan(clanName) {
								if (clanName) {
									packet("L", clanName);
								}
							}

							// ADD NEW PLAYER:
							function addPlayer(data, isYou) {
								let tmpPlayer = findPlayerByID(data[0]);
								if (!tmpPlayer) {
									tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories);
									players.push(tmpPlayer);
									if (data[1] != playerSID) {
										Notify(`You found ${data[2]}. `, "linear-gradient(90deg, #7289da 0%, #1f5edb 80%)");
									}
								} else if (data[1] != playerSID) {
									Notify(`You found ${data[2]}. `, "linear-gradient(90deg, #7289da 0%, #1f5edb 80%)");
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
									updateItems();
									updateAge();
									updateItemCountDisplay();
									if (player.skins[7]) {
										my.reSync = true;
									}
									if (!Cow.isFirstEnterGame) {
										const firstClanInput = document.querySelector("#first_clan_input");
										Cow.isFirstEnterGame = true;
										startPlaytimeCounter()

										if (firstClanInput.value) {
											createClan(firstClanInput.value);
										}
									}
								}
								if (main.Greetings.enabled) {
									sendChat(`Greetings, ${data[2]}`);
								} else if (main.EnemyAlarm.enabled) {
									var alarmSound = new Audio("https://i.e-z.host/vki3ivvs.mp3");
									alarmSound.play();
									sendChat(`-| Enemy Spotted. |-`);
								}
							}
							// REMOVE PLAYER:
							function removePlayer(id) {
								for (let i = 0; i < players.length; i++) {
									if (players[i].id == id) {
										let tmpPlayer = players[i];
										Notify(`${tmpPlayer.name} has left. `, "#E0523C");
										players.splice(i, 1);
										if (main.Greetings.enabled) {
											sendChat(`Goodbye, ${tmpPlayer.name}`);
										}
										break;
									}
								}
							}
							var trackers = [];
							var mode = arr => arr.reduce((a, b, i, arr) => arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b, null);
							class healTracker {
								constructor(hp, id) {
									this.id = id;
									this.oldhp = hp;
									this.dmgPromises = [];
									this.list = [];
									this.diesTo = [];
									this.pings = [];
									this.ping = 0;
									this.text = `no information gathered`;
								}
								isRealPing(gap) {
									return Math.abs(this.ping - gap) < 40;
								}
								calculate() {
									let pushList = [];
									let bullspams = [];
									let stopAntiAt = [];
									let mb = 0;
									let lh = null;
									let shameDown = 0;
									let mshame = false;
									for (let i = 0, e; i < this.list.length; i++) {
										e = this.list[i];
										if (e.dmg < 45 && e.dmg >= 40 && e.type == "slow" && this.isRealPing(e.gap - 1000 / 9) && !pushList.includes("nobull")) {
											pushList.push("nobull");
										} else if (e.dmg >= 45) {
											if (lh - e.delay2 < 400) {
												if (e.type == "fast" && e.clown > shameDown) {
													shameDown = e.clown;
													mb++;
												} else if (e.type == "slow" && lh - e.delay2 < 260) {
													mshame = true;
												} else if (e.type == "slow") {
													console.log(e.clown);
													stopAntiAt.push(e.clown);
													bullspams.push(mb);
													mb = 0;
												}
											}
											lh = e.delay2;
										}
									}
									bullspams.push(mb);
									if (bullspams.length > 0) {
										pushList.push(["bullspam", Math.max(bullspams)]);
									}
									pushList.push(["Shame Per Insta:", mshame ? -2 : 1]);
									if (stopAntiAt.length > 0) {
										let mostCommon = mode(stopAntiAt);
										pushList.push(["stopAntiAt", mostCommon]);
									};
									return pushList;
								}
								updateElem(array, item) {
									let a = array.findIndex(e => e[0] == item[0]);
									if (a === -1) {
										array.push(item);
									} else {
										array[a] = item;
									}
									return array;
								}
								assign(array, renew) {
									for (let i = 0; i < renew.length; i++) {
										array = this.updateElem(array, renew[i]);
									}
									return array;
								}
								track(obj) {
									this.list.push(obj);
									if (obj.type == "slow") {
										this.pings.push(obj.gap - 1000 / 9);
										if (this.pings.length > 20) {
											this.pings.shift();
										}
										this.ping = Math.round(this.pings.reduce((a, b) => a + b, 0) / this.pings.length);
									};
									if (this.list.length > 15) {
										this.list.shift();
									};
									let calc = this.calculate();
									if (calc.length > 0) {
										this.diesTo = this.assign(this.diesTo, calc);
										//console.log(this.diesTo);
										try {
											this.text = `Dies to: ${this.diesTo.map(e => e.join(" ")).join(",")}`;
										} catch (e) {
											this.text = "";
										};
									};
								}
								add(hp, clown) {
									let type = this.healthType(hp, this.oldhp);
									let dmg = this.oldhp - hp;
									this.oldhp = hp;
									if (type === "damage") {
										let i = this.dmgPromises.length;
										let res = null;
										let delay = Date.now();
										let scope = trackers[this.id];
										new Promise(function(r) {
											scope.dmgPromises.push(r);
											setTimeout(r, 1000, false);
										}).then(function(bool) {
											scope.dmgPromises.splice(i, 1);
											if (!bool) {
												return;
											}
											let gap = Date.now() - delay;
											let obj = {
												delay1: delay,
												delay2: Date.now(),
												gap,
												dmg: dmg,
												type: gap < 1000 / 9 ? "fast" : "slow",
												clown
											};
											scope.track(obj);
										});
										trackers[this.id] = scope;
									} else if (this.dmgPromises.length) {
										this.dmgPromises.forEach(e => e(true));
										this.dmgPromises = [];
									}
								}
								healthType(health, oldhealth) {
									if (health < oldhealth) {
										return "damage";
									} else {
										return "heal";
									}
								}
								update(hp, clown) {
									this.add(hp, clown);
								}
							}
							//                            let enemyData = document.createElement("div"),
							//                                ud = true;

							//                            enemyData.style = `
							//    right: 0px;
							//    padding: 10px;
							//    margin-top: 10px;
							//    color: #fff;
							//    font-size: 28px;
							//    background-color: rgba(0, 0, 0, 0.25);
							//    -webkit-border-radius: 4px;
							//    -moz-border-radius: 4px;
							//    border-radius: 4px;
							//    width: 220px; height: 100px;
							//    visibility: visible;
							//                `;

							//                            document.getElementById("topInfoHolder").insertBefore(enemyData, document.getElementById("killCounter"));
							//
							//                            function updateEnemyData() {
							//                                let R = player;
							//                                let enemies = players.filter(e => e.visible && (e.team != R.team || e.team === null) && e.sid != R.sid).sort((a, b) => Math.hypot(a.y2 - R.y2, a.x2 - R.x2) - Math.hypot(b.y2 - R.y2, b.x2 - R.x2));
							//                                if (enemies.length) {
							//                                    try {
							//                                        enemyData.innerHTML = enemies.map(e => {
							//                                            return `${e.name}<br><p>Enemy Ping: ${trackers[e.id].ping}<br>${trackers[e.id].text || "none"}</p>`;
							//                                        })[0];
							//                                        enemyData.style.display = "block";
							//                                    } catch (t) {};
							//                                } else {
							//                                    enemyData.style.display = "none";
							//                                }
							//                            }
							//
							//                            let autochats = new autoChatExport;

							function notif(title, description) {
								let mouseCoord = player;
								let m = textManager;
								m.showText(mouseCoord.x, mouseCoord.y, 30, 0.18, 500, title, "white");
								m.showText(mouseCoord.x, mouseCoord.y + 50, 20, 0.18, 500, description, "white");
							}
							var lastframes = Date.now();
							var qual = 1;
							var mA = 0;
							/*function doPathFind(player, gameObjects, target) {
							                    const centerX = (player.x + target[0]) / 2;
							                    const centerY = (player.y + target[1]) / 2;
							                      const nearBuilds = gameObjects.filter(obj => Math.hypot(obj.y - centerY, obj.x - centerX) < 800 && obj.active);
							                      const staticBlock = 30;
							                      function isWall(x, y) {
							                        return nearBuilds.some(obj => {
							                            const exactScale = (/spike/.test(obj.name) && player.sid !== obj.owner.sid && (player.team ? !obj.isTeamObject(player) : true)) ? obj.scale + 50 : obj.scale;
							                              if (obj.name === "pit Trap" && obj.owner && (player.sid === obj.owner.sid || obj.isTeamObject(player))) {
							                                return false;
							                            }
							                              const objToNodeDist = Math.hypot(obj.y - y, obj.x - x);
							                            const targetToNodeDist = Math.hypot(obj.y - target[1], obj.x - target[0]);
							                            const playerToNodeDist = Math.hypot(obj.y - player.y2, obj.x - player.x2);
							                              return objToNodeDist < exactScale + staticBlock &&
							                                targetToNodeDist > exactScale + staticBlock &&
							                                playerToNodeDist > exactScale + staticBlock;
							                        });
							                    }
							                      function positive(num) {
							                        return Math.abs(num);
							                    }
							                      const paths = [];
							                    const foundset = [];
							                    let currentTick = 0;
							                    const endTick = 100;
							                    let found = true;
							                      while (true) {
							                        currentTick++;
							                          if (currentTick >= endTick) {
							                            found = false;
							                            break;
							                        }
							                          const bestnode = currentTick === 1 ? { x: Math.round(player.x2 / staticBlock) * staticBlock, y: Math.round(player.y2 / staticBlock) * staticBlock } :
							                        foundset.filter(node => node.type === "space").sort((a, b) => a.good - b.good)[0];
							                          if (Math.hypot(bestnode.y - target[1], bestnode.x - target[0]) < staticBlock) {
							                            break;
							                        }
							                          for (let i = 0; i < 3; i++) {
							                            for (let o = 0; o < 3; o++) {
							                                if (i === 1 && o === 1) {
							                                    continue;
							                                }
							                                  const x = bestnode.x + staticBlock * (-1 + i);
							                                const y = bestnode.y + staticBlock * (-1 + o);
							                                const good = (positive(x - target[0]) + positive(y - target[1]) / staticBlock) - currentTick;
							                                  foundset.push({ x, y, good, type: isWall(x, y) ? "wall" : "space" });
							                            }
							                        }
							                          paths.push(bestnode);
							                    }
							                      return found ? paths : false;
							                }*/
							function doPathFind(afg1keg1, target) {
								let R = player;
								let N = gameObjects;
								let centerX = R.x + (target[0] - R.x) / 2;
								let centerY = R.y + (target[1] - R.y) / 2;
								const nearBuilds = N.filter(e => Math.hypot(e.y - centerY, e.x - centerX) < 800 && e.active);
								let block = 30;
								let node = function(x, y, gScore) {
									this.x = x;
									this.y = y;
									this.g = gScore;
									this.type = nearBuilds.some(e => {
										let exactScale = /spike/.test(e.name) && R.sid != e.owner.sid && (R.team ? !e.isTeamObject(R) : true) ? e.scale + 50 : e.scale;
										if (e.name == "pit Trap") {
											if (e.owner && (R.sid == e.owner.sid || e.isTeamObject(R))) {
												return false;
											}
										}
										if (Math.hypot(e.y - y, e.x - x) < exactScale + block && Math.hypot(e.y - target[1], e.x - target[0]) > exactScale + block && Math.hypot(e.y - R.y2, e.x - R.x2) > exactScale + block) {
											return true;
										}
										return false;
									}) ? "wall" : "space";
								};
								let myNode = new node(Math.round(R.x2 / block) * block, Math.round(R.y2 / block) * block, 0);
								let targetNode = new node(Math.round(target[0] / block) * block, Math.round(target[1] / block) * block, 0);
								let paths = [];
								let foundset = [];
								let currentTick = 0;
								let endTick = 100;
								let found = true;

								function positive(num) {
									return Math.abs(num);
								};
								while (!foundset.find(e => {
										return Math.hypot(e.y - targetNode.y, e.x - targetNode.x) < block;
									})) {
									currentTick++;
									if (currentTick >= endTick) {
										found = false;
										break;
									};
									let bestnode = currentTick === 1 ? myNode : foundset.filter(e => e.type == "space").sort((a, b) => a.good - b.good)[0];
									for (let i = 0; i < 3; i++) {
										for (let o = 0; o < 3; o++) {
											if (i == 1 && o == 1) {
												continue;
											}
											let x = bestnode.x + block * (-1 + i);
											let y = bestnode.y + block * (-1 + o);
											let n = new node(x, y, currentTick);
											let good = positive(n.x - targetNode.x) + positive(n.y - targetNode.y) / block - currentTick;
											n.good = good;
											foundset.push(n);
										}
									}
									paths.push(bestnode);
								}
								if (found) {
									return paths;
								} else {
									return false;
								}
							}
							// UPDATE HEALTH:
							function updateHealth(sid, value) {
								tmpObj = findPlayerBySID(sid);
								let _ = tmpObj;
								if (tmpObj) {
									tmpObj.oldHealth = tmpObj.health;
									tmpObj.health = value;
									tmpObj.judgeShame();
									if (main.AutoHeal.enabled && tmpObj.oldHealth > tmpObj.health) {
										tmpObj.damaged = tmpObj.oldHealth - tmpObj.health;
										advHeal.push([sid, value, tmpObj.damaged]);
									}
									if (trackers[_.id]) {
										trackers[_.id].update(value, _.shameCount);
									} else {
										trackers[_.id] = new healTracker(value, _.id, _.shameCount);
									}
								}
							}
							// KILL PLAYER:
							function killPlayer() {
								inGame = false;
								lastDeath = {
									x: player.x,
									y: player.y
								};
								if (configs.autoRespawn) {
									packet("M", {
										name: localStorage.vape_name,
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

							function updateStatusDisplay() {
								scoreDisplay.innerText = player.points;
								foodDisplay.innerText = player.food;;
								woodDisplay.innerText = player.wood;
								stoneDisplay.innerText = player.stone;
								killCounter.innerText = player.kills;
							}
							// UPDATE AGE:
							function updateAge(xp, mxp, age) {
								if (xp != undefined) {
									player.XP = xp;
								}
								if (mxp != undefined) {
									player.maxXP = mxp;
								}
								if (age != undefined) {
									player.age = age;
								}
							}
							// UPDATE UPGRADES:
							function updateUpgrades(points, age) {
								player.upgradePoints = points;
								player.upgrAge = age;
								if (points > 0) {
									tmpList.length = 0;
									UTILS.removeAllChildren(upgradeHolder);
									for (let i = 0; i < items.weapons.length; ++i) {
										if (items.weapons[i].age == age && (testMode || items.weapons[i].pre == undefined || player.weapons.indexOf(items.weapons[i].pre) >= 0)) {
											let e = UTILS.generateElement({
												id: "upgradeItem" + i,
												class: "actionBarItem",
												onmouseout: function() {
													showItemInfo();
												},
												parent: upgradeHolder
											});
											e.style.backgroundImage = getEl("actionBarItem" + i).style.backgroundImage;
											tmpList.push(i);
										}
									}
									for (let i = 0; i < items.list.length; ++i) {
										if (items.list[i].age == age && (testMode || items.list[i].pre == undefined || player.items.indexOf(items.list[i].pre) >= 0)) {
											let tmpI = items.weapons.length + i;
											let e = UTILS.generateElement({
												id: "upgradeItem" + tmpI,
												class: "actionBarItem",
												onmouseout: function() {
													showItemInfo();
												},
												parent: upgradeHolder
											});
											e.style.backgroundImage = getEl("actionBarItem" + tmpI).style.backgroundImage;
											tmpList.push(tmpI);
										}
									}
									for (let i = 0; i < tmpList.length; i++) {
										(function(i) {
											let tmpItem = getEl("upgradeItem" + i);
											tmpItem.onmouseover = function() {
												if (items.weapons[i]) {
													showItemInfo(items.weapons[i], true);
												} else {
													showItemInfo(items.list[i - items.weapons.length]);
												}
											};
											tmpItem.onclick = UTILS.checkTrusted(function() {
												packet("H", i);
											});
											UTILS.hookTouchEvents(tmpItem);
										})(tmpList[i]);
									}
									if (tmpList.length) {
										upgradeHolder.style.display = "block";
										upgradeCounter.style.display = "block";
										upgradeCounter.style.borderRadius = "4px";
										upgradeCounter.innerHTML = "SELECT ITEMS [" + points + "]";
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
								// SMART UPGRADE:
								if (main.AutoUpgrade.enabled) {
									if (age == 3) {
										sendUpgrade(17);
									} else if (age == 4) {
										sendUpgrade(31);
									} else if (age == 5) {
										sendUpgrade(23);
									} else if (age == 8) {
										if (player.secondaryIndex == 9) {
											sendUpgrade(12);
										} else if (player.primaryIndex == 3) {
											sendUpgrade(4);
										} else {
											sendUpgrade(28);
										}
									} else if (age == 9) {
										if (player.secondaryIndex == 12) {
											sendUpgrade(15);
										} else {
											sendUpgrade(25);
										}
									} // 12  15
								}
							}

							function inBetween(angle, arra) {
								// okay the thing i have left to fix is if the first angle is not in the right quadrant i need to make sure that the second one is less far (another checking of which quadrant it is depending on the angle)
								// mental health is not looking good rn
								let array1q;
								let array = [undefined, undefined];
								let array2q;
								if (Math.sin(angle) > 0 && Math.cos(angle) > 0) {
									// angle in the first quadrant
									array[0] = arra[0];
									array[1] = arra[1];
								} else if (Math.sin(angle) > 0 && Math.cos(angle) < 0) {
									// angle is inside the second quadrant
									angle = angle - Math.PI / 2;
									array[0] = arra[0] - Math.PI / 2;
									array[1] = arra[1] - Math.PI / 2;
								} else if (Math.sin(angle) < 0 && Math.cos(angle) < 0) {
									// angle is in the third quadrant
									angle = angle - Math.PI;
									array[0] = arra[0] - Math.PI;
									array[1] = arra[1] - Math.PI;
								} else if (Math.sin(angle) < 0 && Math.cos(angle) > 0) {
									// angle is in the fourth quadrant
									angle = angle - Math.PI * 3 / 2;
									array[0] = arra[0] - Math.PI * 3 / 2;
									array[1] = arra[1] - Math.PI * 3 / 2;
								}
								if (Math.sin(array[0]) > 0 && Math.cos(array[0]) > 0) {
									array1q = 1;
								} else if (Math.sin(array[0]) > 0 && Math.cos(array[0]) < 0) {
									array1q = 2;
								} else if (Math.sin(array[0]) < 0 && Math.cos(array[0]) < 0) {
									array1q = 3;
								} else if (Math.sin(array[0]) < 0 && Math.cos(array[0]) > 0) {
									array1q = 4;
								}
								if (Math.sin(array[1]) > 0 && Math.cos(array[1]) > 0) {
									array2q = 1;
								} else if (Math.sin(array[1]) > 0 && Math.cos(array[1]) < 0) {
									array2q = 2;
								} else if (Math.sin(array[1]) < 0 && Math.cos(array[1]) < 0) {
									array2q = 3;
								} else if (Math.sin(array[1]) < 0 && Math.cos(array[1]) > 0) {
									array2q = 4;
								}
								if (array1q == 1) {
									// lowest angle of the not allowed zone in the first quadrant

									if (Math.sin(angle) < Math.sin(array[0])) {
										// if the angle is lower than the not allowed zone (probably not in between)
										if (array2q == 1) {
											// if the second part of the not allowed zone is in the first quadrant
											if (Math.sin(angle) < Math.sin(array[2])) {
												// if it wraps completely around and makes it in between
												return true;
											} else {
												// doesn't wrap around enough
												return false;
											}
										} else {
											// not in the first quadrant, not in between
											return false;
										}
									} else
										// if the angle is further than the not allowed zone
										if (array2q == 1) {
											// if the second part of the not allowed zone is in the first quadrant
											if (Math.sin(angle) < Math.sin(array[2])) {
												// if the angle is lower than the top limit (in between)

												return true;
											} else {
												// is not in between
												return false;
											}
										} else {
											// its gonna be somewhere further so its in between
											return true;
										}
								} else if (array2q == 1) {
									// if the further part of the not allowed zone is in the first quadrant
									if (Math.sin(angle) < Math.sin(array[1])) {
										// if it wraps all the way around
										return true;
									} else {
										return false;
									}
								} else if (array1q == 2) {
									// if lowest angle is in the second
									if (array2q == 2) {
										if (Math.sin(array[0]) < Math.sin(array[1])) {
											return true;
										} else {
											return false;
										}
									} else {
										return false;
									}
								} else if (array1q == 3) {
									// if the first one is in the third
									if (array1q > array2q) {
										return true;
									} else if (array1q < array2q) {
										return false;
									} else if (Math.sin(array[0]) < Math.sin(array[1])) {
										return true;
									} else {
										return false;
									}
								} else if (array1q == 4) {
									// if the first one is in the third
									if (array1q > array2q) {
										return true;
									} else if (array1q < array2q) {
										return false;
									} else if (Math.sin(array[0]) > Math.sin(array[1])) {
										return true;
									} else {
										return false;
									}
								}
							}

							function cdf(e, t) {
								try {
									return Math.hypot((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
								} catch (e) {
									return Infinity;
								}
							}

							function caf(e, t) {
								try {
									return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
								} catch (e) {
									return 0;
								}
							}

							function numArr(e = 0, t = 1, act, n = 1) {
								let arr = [];
								for (let i = e; i < t; i += n) {
									arr.push(i);
									if (typeof act == "function") {
										act(i);
									}
								}
								return arr;
							}

							function toR(e) {
								var n = e * Math.PI / 180 % (Math.PI * 2);
								if (n > Math.PI) {
									return Math.PI - n;
								} else {
									return n;
								}
							}

							function toD(e) {
								var n = e / Math.PI * 360 % 360;
								if (n >= 360) {
									return n - 360;
								} else {
									return n;
								}
							}
							let bullspamming = false;
							let bloodthirster = false;
							let Preplacerd = false;
							let instaQ = false;
							let plagueInsta = false;
							var PreplacerSpam = false;
							var PreplacerOverride = false;
							// KILL OBJECT:
							// function Cn
							function killObject(sid) {
								let R = player;
								let N = gameObjects;
								PreplacerDelay.killObject = Date.now();
								let findObj = findObjectBySid(sid);
								// objectManager.disableBySid(sid);
								let enemies = players.filter(e => e.visible && (e.team != R.team || e.team === null) && e.sid != R.sid).sort((a, b) => Math.hypot(a.y2 - R.y2, a.x2 - R.x2) - Math.hypot(b.y2 - R.y2, b.x2 - R.x2));
								let n = findObj;
								for (let i = 0; i < gameObjects.length; i++) {
									if (gameObjects[i].sid == sid) {
										if (main.AutoGrind.enabled) {
											for (let i = 0; i < 4; i++) {
												place(5, Math.PI / 2 * i);
											}
										} else if (main.autoreplace.enabled && !PreplacerOverride) {
											if (enemies && Math.hypot(N[i].y - R.y2, N[i].x - R.x2) < 200) {
												if (enemies.length && Math.hypot(enemies[0].y2 - R.y2, enemies[0].x2 - R.x2) < 375) {
													if (enemies.length && Math.hypot(enemies[0].y2 - R.y2, enemies[0].x2 - R.x2) < 222) {
														let trap = N.find(e => e.trap && e.owner.sid == R.sid && Math.hypot(e.y - enemies[0].y, e.x - enemies[0].x) < 70);
														let danger = traps.checkSpikeTick();

														function calculatePerfectAngle(x1, y1, x2, y2) {
															return Math.atan2(y2 - y1, x2 - x1);
														}

														function dp(type) {
															for (let e = nea - Math.PI * 2; e < nea + Math.PI * 2 * 1.5; e += Math.PI * 1.5 / 2) {
																place(type == "trap" ? 4 : 2, e);
															}
														};

														function fpt() {
															for (let e = 0; e < Math.PI * 2 * 1.5; e += Math.PI * 1.5 / 2) {
																dp(R.items[4], e);
															}
														};
														let nea = Math.atan2(enemies[0].y - R.y, enemies[0].x - R.x);
														let perfectAngle = calculatePerfectAngle(findObj.x, findObj.y, player.x, player.y);
														let atss = player.reloads[player.weapons[0]] != 0 && enemies.skinIndex == 6 && enemies[0].health <= 32 ? true : false;
														if (player.items[4] == 15) {
															if (!traps.checkSpikeTick() && near.dist2 <= items.weapons[near.primaryIndex || 5].range + near.scale * 1.8 || cst) {
																if (player.reloads[player.weapons[0]] == 0) {
																	instaC.canSpikeTick = true;
																	instaC.syncHit = true;
																}
															}
															if (PreplacerSpam[0] && atss) {
																place(PreplacerSpam[1], nea, 1);
															} else if (retrappable) {
																place(4, nea);
																if (main.ObsessiveChat.enabled) {
																	sendChat("Replacer [" + near.sid + "]");
																}
															} else {
																dp("trap");
																if (main.ObsessiveChat.enabled) {
																	sendChat("Replace Trap [" + near.sid + "]");
																}
															}
															retrappable = false;
														}
													}
												}
											}
										}
										objectManager.disableObj(gameObjects[i]);
										if (PreplacerSpam[0]) {
											PreplacerSpam[0] = false;
										}
									}
								}
							}
							// KILL ALL OBJECTS BY A PLAYER:
							function killObjects(sid) {
								// Notify(`${tmpPlayer.name} has left. `, "#E0523C");
								if (player) {
									objectManager.removeAllItems(sid);
								}
							}

							function fgdo(a, b) {
								return Math.sqrt(Math.pow(b.y - a.y, 2) + Math.pow(b.x - a.x, 2));
							}

							function precheckPlace(a, b) {
								checkPlace(a, b);
							}

							function perfectReplace() {
								if (!main.Preplacer.enabled) {
									return;
								}
								let R = player;
								//objectManager.disableBySid(sid);
								let enemies = players.filter(e => e.visible && (e.team != R.team || e.team === null) && e.sid != R.sid).sort((a, b) => Math.hypot(a.y2 - R.y2, a.x2 - R.x2) - Math.hypot(b.y2 - R.y2, b.x2 - R.x2));
								let val = items.weapons[player.weaponIndex].dmg * config.weaponVariants[tmpObj[(player.weaponIndex < 9 ? "prima" : "seconda") + "ryVariant"]].val * (items.weapons[player.weaponIndex].sDmg || 1) * (tmpObj.skinIndex == 40 ? 3.3 : 1);
								let lowHealth = breakObjects.filter(e => e.health < 0 || e.health == val);
								console.log(lowHealth);
								if (enemies.length) {
									if (UTILS.getDist(enemy, player, 0, 2) < 300) {
										function dp(type) {
											for (let e = nea - Math.PI * 2; e < nea + Math.PI * 2 * 1.5; e += Math.PI * 1.5 / 2) {
												place(type == "trap" ? 4 : 2, e);
											}
										}
										let nea = Math.atan2(enemies[0].y - R.y, enemies[0].x - R.x);
										if (player.items[4] == 15) {
											if (PreplacerSpam[0] || instaC.canSpikeTick) {
												place(PreplacerSpam[1], nea, 1);
											} else if (retrappable) {
												place(4, nea);
											} else {
												dp("trap");
											}
											retrappable = false;
										}
									}
								}
							}
							let ticks = {
								tick: 0,
								delay: 0,
								time: [],
								manage: []
							};
							// GAME TICKOUT:
							function setTickout(doo, timeout) {
								if (!ticks.manage[ticks.tick + timeout]) {
									ticks.manage[ticks.tick + timeout] = [doo];
								} else {
									ticks.manage[ticks.tick + timeout].push(doo);
								}
							}

							function doNextTick(doo) {
								waitTicks.push(doo);
							}
							let saved = {
								x: null,
								y: null,
								nea: null,
								reset: function() {
									this.x = null;
									this.y = null;
									this.nea = null;
									pathFind.paths = [];
									pathFind.show = false;
								}
							};
							let autospin = false;
							var crh = 0;
							let waitTicks = [];
							// UPDATE PLAYER DATA:
							let nEy;
							let nativeStatsGraphicsToggle = main.nativeStatsGraphics.enabled;
							var tracker = {
								drawSpike: {
									active: false,
									x: 0,
									y: 0,
									scale: 0
								},
								drawTeleport: {
									active: false,
									x: 0,
									y: 0,
									scale: 0
								},
								moveDir: undefined,
								lastPos: {
									x: 0,
									y: 0
								}
							};
							// function Ti
							let placeableSpikes = [];
							let placeableTraps = [];
							let topPlayer;
							let overrides = {
								oHealth: [500, /*changed*/ false],
								enemyDidHit: false,
								canPlace: false,
								mode: 2,
								hitNextTick: false,
								placeNextTick: false,
								check: function() {
									// check if relaods
									if (player.weapons[1] == 10 && [4, 5].includes(player.weapons[0])) {
										// checks if player weapins is great hammer and primary is katana or pole
										return player.reloads[player.weapons[0]];
									} else {
										return player.reloads[53] && player.reloads[player.weapons[1]];
									}
									return false;
								},
								reset: function() {
									this.oHealth = [500, false];
									this.enemyDidHit = false;
									this.canPlace = false;
									this.mode = 2;
									this.hitNextTick = false;
									this.placeNextTick = false;
								}
							};
							let overrideabs = false;
							let lppc = 0;
							let ntpp = false;
							let lppc2 = 0;
							let ntpp2 = false;
							var cst = false;

							function updatePlayers(data) {
								if (!main.coolreload.enabled) {
									pathFind.show = false;
								}
								game.tick++;
								enemy = [];
								nears = [];
								near = [];
								// showPlace = [];
								game.tickSpeed = performance.now() - game.lastTick;
								game.lastTick = performance.now();
								ticks.tick++;
								ticks.time.push(Date.now() - ticks.delay <= 50 || Date.now() - ticks.delay >= 175 ? "lag" : 1);
								if (ticks.tick % 10 === 0) {
									ticks.time = [];
								}
								if (ticks.tick % 300 === 0) {}
								ticks.delay = Date.now();
								players.forEach(tmp => {
									tmp.forcePos = !tmp.visible;
									tmp.visible = false;
								});
								for (let i = 0; i < data.length;) {
									tmpObj = findPlayerBySID(data[i]);
									if (tmpObj) {
										tmpObj.t1 = tmpObj.t2 === undefined ? game.lastTick : tmpObj.t2;
										tmpObj.t2 = game.lastTick;
										tmpObj.oldPos.x2 = tmpObj.x2;
										tmpObj.oldPos.y2 = tmpObj.y2;
										tmpObj.x1 = tmpObj.x;
										tmpObj.y1 = tmpObj.y;
										tmpObj.x2 = data[i + 1];
										tmpObj.y2 = data[i + 2];
										tmpObj.x3 = tmpObj.x2 + (tmpObj.x2 - tmpObj.oldPos.x2);
										tmpObj.y3 = tmpObj.y2 + (tmpObj.y2 - tmpObj.oldPos.y2);
										tmpObj.d1 = tmpObj.d2 === undefined ? data[i + 3] : tmpObj.d2;
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
										tmpObj.damageThreat = 0;
										if (tmpObj.skinIndex == 45 && tmpObj.shameTimer <= 0) {
											tmpObj.addShameTimer();
										}
										if (tmpObj.oldSkinIndex == 45 && tmpObj.skinIndex != 45) {
											tmpObj.shameTimer = 0;
											tmpObj.shameCount = 0;
											if (tmpObj == player) {
												healer();
											}
										}
										nEy = tmpObj;
										if (tmpObj == player) {
											if (gameObjects.length) {
												gameObjects.forEach(tmp => {
													tmp.onNear = false;
													if (tmp.active) {
														if (!tmp.onNear && UTILS.getDist(tmp, tmpObj, 0, 2) <= tmp.scale + items.weapons[tmpObj.weapons[0]].range) {
															tmp.onNear = true;
														}
														if (tmp.isItem && tmp.owner) {
															if (!tmp.pps && tmpObj.sid == tmp.owner.sid && UTILS.getDist(tmp, tmpObj, 0, 2) > (900 || 0) && !tmp.breakObj && ![13, 14, 20].includes(tmp.id)) {
																tmp.breakObj = true;
																breakObjects.push({
																	x: tmp.x,
																	y: tmp.y,
																	sid: tmp.sid
																});
															}
														}
													}
												});
												let nearTrap = gameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, tmpObj, 0, 2) <= tmpObj.scale + e.getScale() + 5 && !e.isTeamObject(tmpObj)).sort(function(a, b) {
													return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
												})[0];
												if (nearTrap) {
													let spike = gameObjects.filter(obj => (obj.name == "spikes" || obj.name == "greater Spikes" || obj.name == "spinning Spikes" || obj.name == "poison Spikes") && fgdo(player, obj) < player.scale + obj.scale + 22 && !obj.isTeamObject(tmpObj) && obj.active)[0];
													traps.dist = UTILS.getDist(nearTrap, tmpObj, 0, 2);
													if (spike) {
														traps.aim = UTILS.getDirect(spike, tmpObj, 0, 2);
													} else {
														traps.aim = UTILS.getDirect(nearTrap, tmpObj, 0, 2);
													}
													if (!traps.inTrap && enemies.length && main.autoplace.enabled) {
														traps.protect(traps.aim);
													}
													traps.inTrap = true;
													traps.info = nearTrap;
												} else {
													traps.inTrap = false;
													traps.info = {};
												}
											} else {
												traps.inTrap = false;
											}
										}
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
								if (waitTicks.length) {
									waitTicks.forEach(ajaj => {
										ajaj();
									});
									waitTicks = [];
								}
								if (runAtNextTick.length) {
									runAtNextTick.forEach(tmp => {
										checkProjectileHolder(...tmp);
									});
									runAtNextTick = [];
								}
								if (nativeStatsGraphicsToggle != main.nativeStatsGraphics.enabled) {
									window.debug();
									nativeStatsGraphicsToggle = main.nativeStatsGraphics.enabled;
								}
								if (runAtNextTick.length) {
									runAtNextTick.forEach(tmp => {
										checkProjectileHolder(...tmp);
									});
									runAtNextTick = [];
								}
								for (let i = 0; i < data.length;) {
									tmpObj = findPlayerBySID(data[i]);
									if (tmpObj) {
										if (!tmpObj.isTeam(player)) {
											enemy.push(tmpObj);
											if (tmpObj.dist2 <= items.weapons[tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex].range + player.scale * 2) {
												nears.push(tmpObj);
											}
										}
										tmpObj.manageReload();
										if (tmpObj != player) {
											tmpObj.addDamageThreat(player);
										}
									}
									i += 13;
								}
								let R = player;
								enemies = players.filter(e => e.visible && (e.team != R.team || e.team === null) && e.sid != R.sid).sort((a, b) => Math.hypot(a.y2 - R.y2, a.x2 - R.x2) - Math.hypot(b.y2 - R.y2, b.x2 - R.x2));
								if (player && player.alive) {
									if (enemy.length) {
										if (player && player.alive) {
											placeableSpikes = getPlaceablePositions(player, items.list[player.items[2]]);
											placeableTraps = player.items[4] == 15 ? getPlaceablePositions(player, items.list[player.items[4]]) : [];
										}
										near = enemy.sort(function(tmp1, tmp2) {
											return tmp1.dist2 - tmp2.dist2;
										})[0];
									}
									if (game.tickQueue[game.tick]) {
										game.tickQueue[game.tick].forEach(action => {
											action();
										});
										game.tickQueue[game.tick] = null;
									}
									if (advHeal.length) {
										advHeal.forEach(updHealth => {
											let sid = updHealth[0];
											let value = updHealth[1];
											let damaged = updHealth[2];
											tmpObj = findPlayerBySID(sid);
											let bullTicked = false;
											if (tmpObj && tmpObj.health <= 0) {
												if (!tmpObj.death) {
													tmpObj.death = true;
													if (tmpObj != player) {}
													addDeadPlayer(tmpObj);
												}
											}
											if (tmpObj == player) {
												if (tmpObj.skinIndex == 7 && (damaged == 5 || tmpObj.latestTail == 13 && damaged == 2)) {
													if (my.reSync) {
														my.reSync = false;
														tmpObj.setBullTick = true;
													}
													bullTicked = true;
												}
												if (inGame) {
													let attackers = getAttacker(damaged);
													let gearDmgs = [0.25, 0.45].map(val => val * items.weapons[player.weapons[0]].dmg);
													let includeSpikeDmgs = enemies.length ? !bullTicked && gearDmgs.includes(damaged) && enemies[0].skinIndex == 11 && enemies[0].tailIndex == 21 : false;
													let healTimeout = 140 - window.ping;
													let slowHeal = function(timer) {
														setTimeout(() => {
															healer();
														}, timer);
													};
													let dmg = 100 - player.health;
													if (damaged >= (includeSpikeDmgs ? 8 : 20) && tmpObj.damageThreat >= 20 && game.tick - tmpObj.antiTimer > 1) {
														if (tmpObj.reloads[53] == 0 && tmpObj.reloads[tmpObj.weapons[1]] == 0) {
															tmpObj.canEmpAnti = true;
														} else {
															player.soldierAnti = true;
														}
														tmpObj.antiTimer = game.tick;
														let shame = tmpObj.weapons[0] == 4 ? 2 : 5;
														if (tmpObj.shameCount < shame) {
															healer();
														} else {
															game.tickBase(() => {
																healer();
															}, 2);
														}
													} else {
														game.tickBase(() => {
															healer();
														}, 2);
													}
													// if (damaged >= 20 && player.skinIndex == 11) instaC.canCounter = true;
												}
											} else if (!tmpObj.setPoisonTick && (tmpObj.damaged == 5 || tmpObj.latestTail == 13 && tmpObj.damaged == 2)) {
												tmpObj.setPoisonTick = true;
											}
										});
										advHeal = [];
									}
									players.forEach(tmp => {
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
												53: 0
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
									if (inGame) {
										if (enemy.length) {
											if (player.canEmpAnti) {
												player.canEmpAnti = false;
												if (near.dist2 <= 300 && !my.safePrimary(near) && !my.safeSecondary(near)) {
													if (near.reloads[53] == 0) {
														player.empAnti = true;
														player.soldierAnti = false;
													} else {
														player.empAnti = false;
														player.soldierAnti = true;
													}
												}
											}
											let prehit = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 3) <= tmp.scale + near.scale).sort(function(a, b) {
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
											let antiSpikeTick = gameObjects.filter(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(tmp, player, 0, 3) < tmp.scale + player.scale).sort(function(a, b) {
												return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
											})[0];
											if (antiSpikeTick && !traps.inTrap) {
												if (near.dist2 <= items.weapons[5].range + near.scale * 1.8) {
													my.anti0Tick = 1;
													if (main.ObsessiveChat.enabled) {
														sendChat("Anti Vel SpikeTick [" + near.sid + "]");
													}
												}
											}
										}
										if ((main.RealDir.enabled ? true : (player.checkCanInsta(true) >= 100 ? player.checkCanInsta(true) : player.checkCanInsta(false)) >= (player.weapons[1] == 10 ? 95 : 100)) && near.dist2 <= items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range + near.scale * 1.8 && (instaC.wait || main.RealDir.enabled && Math.floor(Math.random() * 5) == 0) && !instaC.isTrue && !my.waitHit && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && (main.RealDir.enabled ? true : true ? player.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate) : true) && instaC.perfCheck(player, near)) {
											if (player.checkCanInsta(true) >= 100) {
												instaC.nobull = main.RealDir.enabled ? false : instaC.canSpikeTick ? false : true;
											} else {
												instaC.nobull = false;
											}
											instaC.can = true;
										} else {
											instaC.can = false;
										}
										if (macro.q) {
											place(0, getAttackDir());
										}
										if (macro.f) {
											checkPlace(4, getSafeDir());
										}
										if (macro.v) {
											checkPlace(2, getSafeDir());
										}
										if (macro.y) {
											checkPlace(5, getSafeDir());
										}
										if (macro.h) {
											checkPlace(player.getItemType(22), getSafeDir());
										}
										if (macro.n) {
											checkPlace(3, getSafeDir());
										}
										if (game.tick % 3 == 0) {
											traps.autoPlace(true);
											if (mills.place) {
												let plcAng = 1.2;
												for (let i = -plcAng; i <= plcAng; i += plcAng) {
													checkPlace(3, UTILS.getDirect(player.oldPos, player, 2, 2) + i);
												}
											} else if (mills.placeSpawnPads) {
												for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
													checkPlace(player.getItemType(20), UTILS.getDirect(player.oldPos, player, 2, 2) + i);
												}
											}
										} else {
											traps.autoPlace();
										}
										if (instaC.can) {
											instaC.changeType(player.weapons[1] == 10 ? "rev" : instaC.nobull ? "nobull" : "normal");
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
													if (main.ObsessiveChat.enabled) {
														sendChat("Reverse Sync Hit [" + near.sid + "]");
													}
												}
											} else if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
												instaC.spikeTickType();
												if (instaC.syncHit) {
													if (main.ObsessiveChat.enabled) {
														sendChat("Sync Hit [" + near.sid + "]");
													}
												}
											}
										}
										if (!clicks.middle && (clicks.left || clicks.right) && !instaC.isTrue) {
											if (player.weaponIndex != (clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]) || player.buildIndex > -1) {
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
										if (main.Preplacer.enabled && enemies.length) {
											let mode = my.autoPush ? "trap" : "spike";
											let tmpBuilds = gameObjects.filter(e => e.active && UTILS.getDist(e, player, 0, 2) <= items.weapons[player.weaponIndex].range + 35);
											let d = {
												me: items.weapons[player.weaponIndex].dmg * config.weaponVariants[player[(player.weaponIndex < 9 ? "prima" : "seconda") + "ryVariant"]].val * (items.weapons[player.weaponIndex].sDmg || 1) * (player.skinIndex == 40 ? 3.3 : 1),
												ene: items.weapons[enemies[0].weaponIndex].dmg * config.weaponVariants[enemies[0][(enemies[0].weaponIndex < 9 ? "prima" : "seconda") + "ryVariant"]].val * (items.weapons[enemies[0].weaponIndex].sDmg || 1) * (enemies[0].skinIndex == 40 ? 3.3 : 1)
											};
											let array = {
												me: [getAttackDir() - Math.PI / 3, getAttackDir() + Math.PI / 3]
											};
											let ppB = {
												me: tmpBuilds.filter(e => e.health <= d.me),
												ene: tmpBuilds.filter(e => e.health <= d.ene)
											};
											if (ppB.me.length > 0) {
												lppc = ppB.me.length;
												if (main.ObsessiveChat.enabled) {
													sendChat("Preplacer [" + ppB.me.length + "]");
												}
												ntpp = true;
											}
											if (ppB.ene.length > 0) {
												lppc2 = ppB.ene.length;
												ntpp2 = true;
											}
										}
										if (main.avoidSpikes.enabled) {
											let dir = lastMoveDir;
											let newPos = {
												x: player.x2 + (player.x2 - tracker.lastPos.x) * 1.3 + Math.cos(dir) * 50,
												y: player.y2 + (player.y2 - tracker.lastPos.y) * 1.3 + Math.sin(dir) * 50
											};
											let found = false;
											let buildings = gameObjects.sort((a, b) => Math.hypot(player.y2 - a.y, player.x2 - a.x) - Math.hypot(player.y2 - b.y, player.x2 - b.x));
											let spikes = buildings.filter(obj => obj.dmg && fgdo(player, obj) < 250 && !obj.isTeamObject(player) && obj.active);
											for (let i = 0; i < spikes.length; i++) {
												if (fgdo(spikes[i], newPos) < spikes[i].scale + player.scale + 5) {
													found = Math.atan2(player.y2 - spikes[i].y, player.x2 - spikes[i].x);
													tracker.drawSpike.active = true;
													tracker.drawSpike.x = spikes[i].x;
													tracker.drawSpike.y = spikes[i].y;
													tracker.drawSpike.scale = spikes[i].scale;
												}
											}
											if (found != false && !traps.inTrap) {
												io.send("e");
											} else {
												packet("9", tracker.moveDir, 1);
												tracker.drawSpike.active = false;
											}
										} else {
											packet("9", tracker.moveDir, 1);
										}
										tracker.lastPos.x = player.x2;
										tracker.lastPos.y = player.y2;
										if (main.AvoidTeleport.enabled) {
											let dir = lastMoveDir;
											let newPos = {
												x: player.x2 + (player.x2 - tracker.lastPos.x) * 1.3 + Math.cos(dir) * 50,
												y: player.y2 + (player.y2 - tracker.lastPos.y) * 1.3 + Math.sin(dir) * 50
											};
											let found = false;
											let buildings = gameObjects.sort((a, b) => Math.hypot(player.y2 - a.y, player.x2 - a.x) - Math.hypot(player.y2 - b.y, player.x2 - b.x));
											let teleporters = buildings.filter(obj => obj.teleport && fgdo(player, obj) < 250 && obj.active);
											for (let i = 0; i < teleporters.length; i++) {
												if (fgdo(teleporters[i], newPos) < teleporters[i].scale + player.scale + 5) {
													found = Math.atan2(player.y2 - teleporters[i].y, player.x2 - teleporters[i].x);
													tracker.drawTeleport.active = true;
													tracker.drawTeleport.x = teleporters[i].x;
													tracker.drawTeleport.y = teleporters[i].y;
													tracker.drawTeleport.scale = teleporters[i].scale;
												}
											}
											if (found != false && !traps.inTrap) {
												io.send("e");
											} else {
												packet("9", tracker.moveDir, 1);
												tracker.drawTeleport.active = false;
											}
										} else {
											packet("9", tracker.moveDir, 1);
										}
										tracker.lastPos.x = player.x2;
										tracker.lastPos.y = player.y2;
										if (main.autoreplace.enabled && main.AutoHit.enabled) {
											let nearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= near.scale + tmp.getScale() + 5).sort(function(a, b) {
												return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
											})[0];
											let val = items.weapons[player.weapons[0]].dmg * config.weaponVariants[player.primaryVariant].val;
											let objNearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= near.scale + tmp.getScale() + 5)[0];
											let nea;
											if (enemies.length) {
												nea = Math.atan2(enemies[0].y - R.y, enemies[0].x - R.x);
											}

											function getAngles(objectDir) {
												let array = [objectDir - Math.PI / 3, objectDir + Math.PI / 3];
												return array;
											};

											function fastHypot(a, b) {
												const c = Math.SQRT2 - 1;
												a = Math.abs(a);
												b = Math.abs(b);
												if (a > b) {
													let temp = a;
													a = b;
													b = temp;
												}
												return c * a + b;
											}
											let breakable = false;
											if (nearTrap && !traps.inTrap) {
												if (main.ObsessiveChat.enabled) {
													sendChat("Trap Detected [" + objNearTrap.health + "]");
												}
												if (!breakable && enemies[0].skinIndex == 40) {
													overrideabs = true;
												}
												if (!breakable && objNearTrap.health <= val && near.dist2 <= 222) {
													breakable = true;
												}
												if (!overrideabs && breakable) {
													overrideabs = true;
                          spinner.stop();
													// now do bullspam and place spike
													instaC.canSpikeTick = true;
													instaC.syncHit = true;
													cst = true;
													PreplacerSpam = [true, enemies[0].skinIndex == 6 ? 4 : 2];
													game.tickBase(() => {
														// for (let e = nea - 2*Math.PI; e < nea + 2 * Math.PI * 1.5; e += Math.PI) place(nearTrap && enemies[0].skinIndex != 6 ? 4 : 2, e);
														place(enemies[0].skinIndex == 6 ? 4 : 2, nea);
                            spinner.start();
													}, 1);
												};
											}
											overrideabs = false;
										} else if (!main.AutoHit.enabled && chain && main.autoreplace.enabled && enemies.length && !traps.inTrap && !my.autoPush) {
											try {
												let nearestEnemyInTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= near.scale + tmp.getScale() + 5).sort(function(a, b) {
													return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
												})[0];
												if (nearestEnemyInTrap) {
													let health = nearestEnemyInTrap.health;
													let d = {
														me: items.weapons[player.weaponIndex].dmg * config.weaponVariants[player[(player.weaponIndex < 9 ? "prima" : "seconda") + "ryVariant"]].val * (items.weapons[player.weaponIndex].sDmg || 1) * 1,
														ene: items.weapons[enemies[0].weaponIndex].dmg * config.weaponVariants[enemies[0][(enemies[0].weaponIndex < 9 ? "prima" : "seconda") + "ryVariant"]].val * (items.weapons[enemies[0].weaponIndex].sDmg || 1) * 3.3
													};
													if (!overrides.oHealth[1]) {
														overrides.oHealth[0] = nearestEnemyInTrap.health;
														overrides.oHealth[1] = true;
													};
													let mode;
													if (d.ene * 2 >= overrides.oHealth[0]) {
														mode = "anim";
													} else {
														mode = "wait";
													}
													if (overrides.check()) {
														if (d.ene * 2 >= health || d.me * 2 >= health) {
															selectWeapon(player.weapons[0]);
														}
													}
													if ([4, 5].includes(player.weapons[0]) && enemies[0].weapons[1] == 10) {
														if (d.ene * 2 > 500) {
															if (mode == "wait") {
																mode = "anim";
															} else {
																mode = mode;
															}
														} else {
															mode = "wait";
														}
													};
													if (mode == "anim" && d.ene >= health && near.dist2 <= 300) {
														overrides.hitNextTick = true; // allow it to hit next tick
													} else if (mode == "wait" && d.me >= health && near.dist2 <= 300) {
														if ([4, 5].includes(player.weapons[0]) && overrides.check() && player.reloads[53] == 0) {
															instaKH(1);
														} else {
															overrides.hitNextTick = false;
															overrides.placeNextTick = true;
														}
													}
												}
											} catch (e) {
												console.log(e);
											}
										}
										if (!overrideabs && !clicks.left && !clicks.right && !instaC.isTrue && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap) {
											let R = player;
											let enemies = players.filter(e => e.visible && (e.team != R.team || e.team === null) && e.sid != R.sid).sort((a, b) => Math.hypot(a.y2 - R.y2, a.x2 - R.x2) - Math.hypot(b.y2 - R.y2, b.x2 - R.x2));
											if (!clicks.left && !clicks.right && !instaC.isTrue && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap) {
												if (main.AutoHit.enabled || overrideabs) {
													selectWeapon(player.weapons[0]);
												}
												//setWeapon(0);
												let cIH = player.weapons[1] == 10 ? enemies[0].skinIndex != 6 ? true : false : true;
												if (player.reloads[player.weapons[0]] == 0 && !my.waitHit) {
													if (main.AutoHit.enabled) {
														if (!overrideabs && main.AutoHit.enabled && cIH && main.autoInsta.enabled && (trackers[enemies[0].id] && trackers[enemies[0].id].diesTo && trackers[enemies[0].id].diesTo.find(e => e[0] == "bullspam") ? (maxBullspam = trackers[enemies[0].id].diesTo.find(e => e[0] == "bullspam")[1], bullspams >= maxBullspam) : true) && player.reloads[player.weapons[1]] == 0) {
															spinner.stop();
                              bullspams = 0;
															bullspamming = false;
															if (player.weapons[1] == 10) {
																if (enemies[0].skinIndex != 6) {
																	instaKH();
																}
															} else {
																instaX(2);
															}
														} else if (!main.autoInsta.enabled && instaQ) {
                              spinner.stop();
															bullspams = 0;
															bullspamming = false;
															if (player.weapons[1] == 10) {
																if (enemies[0].skinIndex != 6) {
																	instaKH();
																}
															} else {
																instaX(2);
															}
														} else if (main.AutoHit.enabled) {
                              spinner.stop();
															bullspams++;
															bullspamming = true;
															my.autoAim = true;
															if (main.pvpMode.enabled) {
																if (Date.now() - useps > 6000) {
																	bloodthirster = true;
																	useps = Date.now();
																} else {
																	bloodthirster = false;
                                  spinner.start();
																}
															} else {
																bloodthirster = false;
                                spinner.start();
															}
                              spinner.stop();
															sendAutoGather();
															my.waitHit = 1;
															game.tickBase(() => {
																my.autoAim = false;
																sendAutoGather();
																bullspamming = false;
																my.waitHit = 0;
															}, 1);
														}
													} else {
														main.AutoHit.enabled = false;
                            spinner.start();
													}
													// spike tick mode
													// use this as main mode should be the best
													if (enemies[0].skinIndex != 6 && enemies[0].skinIndex != 22 && player.weapons[1] == 10 && !PreplacerSpam[0]) {
														// check hats then check range
														if (near.dist2 <= 120) {
															if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && player.reloads[53] == 0) {
                                spinner.stop();
																instaKH();
                                spinner.start();
															} else {
                                spinner.stop();
																instaX(2);
                                spinner.start();
															}
														}
													}
												}
											}
										} else if (player.weapons[1] && player.weapons[1] == 15 && main.coolreload.enabled && !traps.inTrap && !instaC.isTrue && !clicks.left && !clicks.right && player.reloads[player.weapons[0]] == 0 && enemies.length) {
											let nea = Math.atan2(enemies[0].y2 - R.y2, enemies[0].x2 - R.x2);
											if (player.reloads[player.weapons[1]] == 0) {
												if (!my.reloaded) {
													my.reloaded = true;
													main.coolreload.enabled = false;
													crh = 0;
													saved.reset();
													let fastSpeed = items.weapons[player.weapons[0]].spdMult < items.weapons[player.weapons[1]].spdMult ? 1 : 0;
													if (player.weaponIndex != player.weapons[fastSpeed] || player.buildIndex > -1) {
														selectWeapon(player.weapons[fastSpeed]);
													}
												}
											} else {
												// relaod
												my.reloaded = false;
												if (player.reloads[player.weapons[0]] > 0) {
													if (player.weaponIndex != player.weapons[0] || player.buildIndex > -1) {
														selectWeapon(player.weapons[0]);
													}
												} else if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] > 0) {
													if (player.weaponIndex != player.weapons[1] || player.buildIndex > -1) {
														selectWeapon(player.weapons[1]);
													}
												}

												if (enemies.length) {
													coolreload = true;
													crh++;
													pathFind.show = true;
													let path;
													path = doPathFind(null, [enemies[0].x + Math.cos(nea + Math.PI) * 400, enemies[0].y + Math.sin(nea + Math.PI) * 400]);
													pathFind.paths = path;
													packet("9", path ? Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x) : lastMoveDir || undefined, 1);
												}
											}
										} else if (player.weapons[1] && !clicks.left && !clicks.right && !traps.inTrap && !instaC.isTrue && (!main.RealDir.enabled || near.dist2 > items.weapons[player.weapons[0]].range + near.scale * 1.8)) {
											if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0) {
												if (!my.reloaded) {
													my.reloaded = true;
													let fastSpeed = items.weapons[player.weapons[0]].spdMult < items.weapons[player.weapons[1]].spdMult ? 1 : 0;
													if (player.weaponIndex != player.weapons[fastSpeed] || player.buildIndex > -1) {
														selectWeapon(player.weapons[fastSpeed]);
													}
												}
											} else {
												my.reloaded = false;
												if (player.reloads[player.weapons[0]] > 0) {
													if (player.weaponIndex != player.weapons[0] || player.buildIndex > -1) {
														selectWeapon(player.weapons[0]);
													}
												} else if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] > 0) {
													if (player.weaponIndex != player.weapons[1] || player.buildIndex > -1) {
														selectWeapon(player.weapons[1]);
													}
												}
											}
										}
										if (traps.inTrap && main.autobreak.enabled) {
                      spinner.stop();
											function isAlly(sid, pSid) {
												tmpObj = findPlayerBySID(sid);
												if (!tmpObj) {
													return;
                          spinner.start();
												}
												if (pSid) {
													let pObj = findPlayerBySID(pSid);
													if (!pObj) {
														return;
                            spinner.start();
													}
													if (pObj.sid == sid) {
														return true;
													} else if (tmpObj.team) {
														if (tmpObj.team === pObj.team) {
															return true;
														} else {
															return false;
                              spinner.start();
														}
													} else {
														return false;
                            spinner.start();
													}
												}
												if (!tmpObj) {
													return;
                          spinner.start();
												}
												if (player.sid == sid) {
													return true;
                          spinner.stop();
												} else if (tmpObj.team) {
													if (tmpObj.team === player.team) {
														return true;
                            spinner.stop();
													} else {
														return false;
                            spinner.start();
													}
												} else {
													return false;
                          spinner.start();
												}
											}
											if (!clicks.left && !clicks.right && !instaC.isTrue) {
												let spike = gameObjects.filter(obj => (obj.name == "spikes" || obj.name == "greater Spikes" || obj.name == "spinning Spikes" || obj.name == "poison Spikes") && fgdo(player, obj) < player.scale + obj.scale + 20 && !isAlly(obj.owner.sid) && obj.active)[0];
												let R = player;
												let weapon = R.weapons[0];
												if (traps.notFast()) {
													weapon = player.weapons[1];
												} else {
													weapon = player.weapons[0];
												}
												if (player.weaponIndex != (traps.notFast() ? player.weapons[1] : player.weapons[0]) || player.buildIndex > -1) {
													selectWeapon(weapon);
												}
												if (player.reloads[weapon] == 0 && !my.waitHit) {
													sendAutoGather();
													my.waitHit = 1;
													game.tickBase(() => {
														sendAutoGather();
														my.waitHit = 0;
													}, 1);
												}
											}
										}
										if (clicks.middle && !traps.inTrap) {
											if (!instaC.isTrue && player.reloads[player.weapons[1]] == 0) {
												if (my.ageInsta && player.weapons[0] != 4 && player.weapons[1] == 9 && player.age >= 9 && enemy.length) {
                          spinner.stop();
													instaC.bowMovement();
                          spinner.start();
												} else {
                          spinner.stop();
													instaC.rangeType();
                          spinner.start();
												}
											}
										}
										if (macro.t && !traps.inTrap) {
											if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && (player.weapons[1] == 15 ? player.reloads[player.weapons[1]] == 0 : true) && (player.weapons[0] == 5 || player.weapons[0] == 4 && player.weapons[1] == 15)) {
                        spinner.stop();
												instaC[player.weapons[0] == 4 && player.weapons[1] == 15 ? "kmTickMovement" : "tickMovement"]();
                        spinner.start();
											}
										}
										/*if (macro["."] && !traps.inTrap) {
											if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && ([9, 12, 13, 15].includes(player.weapons[1]) ? player.reloads[player.weapons[1]] == 0 : true)) {
												instaC.boostTickMovement();
											}
										}*/
										if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
											packet("D", getAttackDir());
										}
										// HAT CHANGER
										let hatChanger = function() {
											if (my.anti0Tick > 0) {
												buyEquip(6, 0);
											} else if (clicks.left || clicks.right || bullspamming) {
												if (player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45 || my.reSync) {
													buyEquip(7, 0);
												} else if (clicks.left) {
													buyEquip(player.reloads[player.weapons[0]] == 0 ? main.AutoGrind.enabled ? 40 : 7 : player.empAnti ? 22 : player.soldierAnti ? 6 : false && near.antiBull > 0 ? 11 : near.dist2 <= 300 ? false && near.reloads[near.primaryIndex] == 0 ? 11 : 6 : biomeGear(1, 1), 0);
												} else if (clicks.right) {
													buyEquip(player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 ? 40 : player.empAnti ? 22 : player.soldierAnti ? 6 : false && near.antiBull > 0 ? 11 : near.dist2 <= 300 ? false && near.reloads[near.primaryIndex] == 0 ? 11 : 6 : biomeGear(1, 1), 0);
												} else if (bullspamming) {
													if (bloodthirster) {
														buyEquip(21, 0);
													} else {
														buyEquip(7, 0);
													}
												}
											} else if (traps.inTrap) {
												if (traps.info.health <= items.weapons[player.weaponIndex].dmg ? false : player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
													buyEquip(my.anti0Tick > 0 ? 6 : player.empAnti ? 22 : player.soldierAnti ? 6 : 40, 0);
												} else if (player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45 || my.reSync) {
													buyEquip(player.empAnti || near.dist2 > 300 || !enemy.length ? 22 : player.soldierAnti ? 6 : 7, 0);
												} else {
													buyEquip(player.empAnti || near.dist2 > 300 || !enemy.length ? 22 : 6, 0);
												}
											} else if (player.empAnti || player.soldierAnti) {
												buyEquip(player.empAnti ? 22 : 6, 0);
											} else if (player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45 || my.reSync) {
												buyEquip(7, 0);
											} else if (near.dist2 <= 300) {
												buyEquip(false && near.antiBull > 0 ? 11 : false && near.reloads[near.primaryIndex] == 0 ? 11 : 6, 0);
											} else {
												biomeGear(1);
											}
										};
										let accChanger = function() {
											if (clicks.left) {
												buyEquip(19, 1);
											} else if (clicks.right) {
												buyEquip(21, 1);
											} else if (near.dist2 <= 300) {
												buyEquip(21, 1);
											} else if (traps.inTrap) {
												buyEquip(21, 1);
											} else if (player.tailIndex == 11) {
												buyEquip(11, 1);
											} else {
												buyEquip(11, 1);
											}
										};
										if (storeMenu.style.display != "block" && !instaC.ticking) {
											if (!main.coolreload.enabled) {
												hatChanger();
											}
											accChanger();
										}

										function atp() {
											let dir;
											let joe = false;

											function fgd(a, b) {
												return Math.sqrt(Math.pow(b.y2 - a[2], 2) + Math.pow(b.x2 - a[1], 2));
											}

											function fgdo(a, b) {
												if (a == player) {
													return Math.sqrt(Math.pow(b.y - a.y2, 2) + Math.pow(b.x - a.x2, 2));
												} else if (b == player) {
													return Math.sqrt(Math.pow(b.y2 - a.y, 2) + Math.pow(b.x2 - a.x, 2));
												} else {
													return Math.sqrt(Math.pow(b.y - a.y, 2) + Math.pow(b.x - a.x, 2));
												}
											}

											function fgda(a, b) {
												return Math.sqrt(Math.pow(b[2] - a[2], 2) + Math.pow(b[2] - a[1], 2));
											}
											if (enemies.length && main.AutoPush.enabled) {
												let nearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= near.scale + tmp.getScale() + 5).sort(function(a, b) {
													return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
												})[0];
												if (nearTrap && fgdo(player, tracker.nearestEnemy) <= 170) {
													let spike = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= near.scale + nearTrap.scale + tmp.scale).sort(function(a, b) {
														return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
													})[0];
													let buildings = gameObjects.sort((a, b) => Math.hypot(fgdo(tracker.nearestEnemy, a) - fgdo(tracker.nearestEnemy, b)));
													// let spike = buildings.filter(obj => (obj.name == "spikes" || obj.name == "greater Spikes" || obj.name == "spinning Spikes" || obj.name == "poison Spikes") && fgdo(tracker.nearestEnemy.inTrap, obj) < tracker.nearestEnemy.inTrap.scale + obj.scale + 40 && !isAlly(obj.owner.sid, tracker.nearestEnemy.sid) && obj.active)[0]
													if (spike) {
														let angle = Math.atan2(tracker.nearestEnemy.y2 - spike.y, tracker.nearestEnemy.x2 - spike.x);
														let point = {
															x: enemies[0].x2 + Math.cos(angle) * 62,
															y: enemies[0].y2 + Math.sin(angle) * 62
														};
														if (fgdo(point, player) < 20) {
															point = {
																x: enemies[0].x2 + Math.cos(angle) * 52,
																y: enemies[0].y2 + Math.sin(angle) * 52
															};
														}
														tracker.draw4.point.x = point.x;
														tracker.draw4.point.y = point.y;
														tracker.draw4.spike.x = spike.x;
														tracker.draw4.spike.y = spike.y;
														dir = Math.atan2(point.y - player.y2, point.x - player.x2);
														joe = true;
													}
												}
											}
										}
										if (main.AutoPush.enabled && enemy.length && !traps.inTrap && !instaC.ticking) {
											autoPush();
										} else if (my.autoPush) {
											pathFind.paths = [];
											my.autoPush = false;
											packet("9", lastMoveDir || undefined, 1);
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
										if (my.anti0Tick > 0) {
											my.anti0Tick--;
										}
										if (traps.replaced) {
											traps.replaced = false;
										}
										if (traps.antiTrapped) {
											traps.antiTrapped = false;
										}
									}
								}
							}
							// UPDATE LEADERBOARD:
							function updateLeaderboard(data) {
								lastLeaderboardData = data;
								UTILS.removeAllChildren(leaderboardData);
								let tmpC = 1;
								for (let i = 0; i < data.length; i += 3) {
									(function(i) {
										UTILS.generateElement({
											class: "leaderHolder",
											parent: leaderboardData,
											children: [UTILS.generateElement({
												class: "leaderboardItem",
												style: "color:" + (data[i] == playerSID ? "#fff" : "rgba(255,255,255,0.6)") + "; font-size: 16px;",
												text: ( /*tmpC + ". " + */ data[i + 1] != "" ? data[i + 1] + " -  [" + data[i] + "]" : "unknown")
											}), UTILS.generateElement({
												class: "leaderScore",
												style: "font-size: 16px;",
												text: UTILS.sFormat(data[i + 2]) || "0"
											})]
										});
									})(i);
									tmpC++;
								}
							}

							// LOAD GAME OBJECT:
							function loadGameObject(data) {
								for (let i = 0; i < data.length;) {
									objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4], data[i + 5], items.list[data[i + 6]], true, data[i + 7] >= 0 ? {
										sid: data[i + 7]
									} : null);
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
											tmpObj.forcePos = true;
											tmpObj.sid = data[i];
											tmpObj.visible = true;
										}
										i += 7;
									}
								}
							}
							// ANIMATE AI:
							function animateAI(sid) {
								tmpObj = findAIBySID(sid);
								if (tmpObj) {
									tmpObj.startAnim();
								}
							}

							function findDel() {
								let mooPing = window.pingTime;
								let generatedPing = window.manhandle;
								return Math.min(mooPing, generatedPing);
							}

							function gatherAnimation(sid, didHit, index) {
								tmpObj = findPlayerBySID(sid);
								if (tmpObj == enemies[0] && enemies.length) {
									// lets do Preplacer
									if (overrides.hitNextTick && overrides.check()) {
										bullspams++;
										bullspamming = true;
										my.autoAim = true;
										sendAutoGather();
										my.waitHit = 1;
										game.tickBase(() => {
											overrides.hitNextTick = false;
											my.autoAim = false;
											sendAutoGather();
											bullspamming = false;
											my.waitHit = 0;
											overrides.reset();
										}, 1);
									}
									PreplacerOverride = true;
									playerHit.ene = true;
								}
								if (tmpObj == player) {
									if (overrides.placeNextTick) {
										place(2, near.aim2);
										overrides.reset();
									}
									PreplacerOverride = true;
									playerHit.me = true;
								}
								if (ntpp && lppc > 0 && enemies.length && near.dist2 <= 300) {
									let mode = enemies[0].skinIndex == 6 ? 4 : 2;
									PreplacerDelay.gatherAnimation = Date.now();
									ntpp = false;
									lppc = 0;
									if (my.autoPush) {
										for (let e = 0; e < Math.PI * 2 * 1.5; e += Math.PI * 1.5 / 2) {
											place(4, e);
										}
									} else {
										place(mode, Math.atan2(enemies[0].y - player.y, enemies[0].x - player.x));
									}
								}
								if (ntpp2 && lppc2 > 0 && enemies.length && near.dist2 <= 300) {
									let mode = enemies[0].skinIndex == 6 ? 4 : 2;
									PreplacerDelay.gatherAnimation = Date.now();
									ntpp2 = false;
									lppc2 = 0;
									if (my.autoPush) {
										for (let e = 0; e < Math.PI * 2 * 1.5; e += Math.PI * 1.5 / 2) {
											place(4, e);
										}
									} else {
										place(mode, Math.atan2(enemies[0].y - player.y, enemies[0].x - player.x));
									}
								}
								if (tmpObj) {
									tmpObj.startAnim(didHit, index);
									tmpObj.gatherIndex = index;
									tmpObj.gathering = 1;
									if (didHit) {
										let tmpObjects = objectManager.hitObj;
										objectManager.hitObj = [];
										game.tickBase(() => {
											let delay = findDel();
											tmpObj = findPlayerBySID(sid);
											let val = items.weapons[index].dmg * config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val * (items.weapons[index].sDmg || 1) * (tmpObj.skinIndex == 40 ? 3.3 : 1);
											tmpObjects.forEach(healthy => {
												healthy.healthMov = healthy.health - val / 2;
												healthy.health -= val;
												// breakableObjects[healthy.sid];
												// love to https://gist.github.com/bendc/76c48ce53299e6078a76
												let h;
												let s;
												let l;
												let color = (() => {
													const randomInt = (min, max) => {
														return Math.floor(Math.random() * (max - min + 1)) + min;
													};
													h = randomInt(0, 360);
													s = randomInt(42, 98);
													l = randomInt(40, 90);
													// return `hsl(${h},${s}%,${l}%)`;
												})();
												// and love https://stackoverflow.com/questions/36721830/convert-hsl-to-rgb-and-hex
												function hslToHex(h, s, l) {
													l /= 100;
													const a = s * Math.min(l, 1 - l) / 100;
													const f = n => {
														const k = (n + h / 30) % 12;
														const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
														return Math.round(color * 255).toString(16).padStart(2, "0"); // convert to Hex and prefix "0" if needed
													};
													return `#fff`;
												}
												if (lur) {
													showDamageText(healthy.x, healthy.y, val, hslToHex(h, s, l));
												}
											});
										}, 1);
									}
								}
							}

							function showDamageText(x, y, value, color) {
								textManager.showText(x, y, 30, 0.15, 550, Math.round(value), color);
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
									if (!config.anotherVisual) {
										tmpObj.lastDir = dir;
									} else {
										tmpObj.dir = dir;
									}
									tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir + Math.PI);
									tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir + Math.PI);
								}
							}

							const killSounds = {
								module1: "https://i.e-z.host/fkdaezai.mp3",
								module2: "https://i.e-z.host/cbo51zg2.mp3",
								module3: "https://i.e-z.host/g9c8589x.mp3",
								module4: "https://i.e-z.host/1q8hn1cs.mp3"
							};

							const killSoundElements = {};

							function initializeKillSoundElements() {
								for (const key in killSounds) {
									if (Object.hasOwnProperty.call(killSounds, key)) {
										const soundFilePath = killSounds[key];
										killSoundElements[key] = new Audio(soundFilePath);
									}
								}
							}

							function playKillSound() {
								if (!main.killsound.enabled) {
									return;
								}
								const selectedModule = localStorage.getItem("selectedKillSoundModule");
								const selectedKillSound = killSoundElements[selectedModule];
								if (selectedKillSound) {
									selectedKillSound.play()
								} else {}
							}

							initializeKillSoundElements();

							document.querySelectorAll("#KillSound .dropdown-item").forEach(item => {
								item.addEventListener("click", event => {
									var selectedModule = event.target.dataset.module;
									localStorage.setItem("selectedKillSoundModule", selectedModule);
									playKillSound(selectedModule);
								});
							});

							// UPDATE PLAYER VALUE:
							function updatePlayerValue(index, value, updateView, selectedModule) {
								if (player) {
									player[index] = value;
									if (index === "points") {
										if (configs.autoBuy) {
											autoBuy.hat();
											autoBuy.acc();
										}
									} else if (index === "kills") {
										if (configs.KillChat) {
											let KillChatMessage = getKillChatMessage(value);
											sendChat(KillChatMessage);

											setTimeout(() => {
												sendChat("Get Smoked!");
												playKillSound(selectedModule);
											}, 600);
										}
									}
								}
							}

							function getKillChatMessage(kills) {
								let baseKillCount = Math.floor(kills / 10) * 10;
								if (kills <= 1) {
									return "First Blood!";
								} else if (kills <= 2) {
									return "Double Kill!";
								} else if (kills <= 3) {
									return "Triple Kill!";
								} else if (kills <= 4) {
									return "Quadra Kill!";
								} else if (kills <= 5) {
									return "Penta Kill!";
								} else if (kills <= 6) {
									return `Unstoppable! [${kills}]`;
								} else if (kills <= 7) {
									return `Ace! [${kills}]`;
								} else if (kills <= 8) {
									return `Legendary! [${kills}]`;
								} else if (kills <= 9) {
									return `Enemy Demolished! [${kills}]`;
								} else if (kills <= 10) {
									return `God Like! [${kills}]`;
								} else if (kills <= 15) {
									return `On Fire! [${kills}]`;
								} else if (kills <= 20) {
									return `Fragging Out! [${kills}]`;
								} else if (kills <= 30) {
									return `Killing It! [${kills}]`;
								} else {
									return `Kills: ${kills}`;
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
									getEl("actionBarItem" + tmpI).style.display = player.items.indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
								}
								for (let i = 0; i < items.weapons.length; i++) {
									getEl("actionBarItem" + i).style.display = player.weapons[items.weapons[i].type] == items.weapons[i].id ? "inline-block" : "none";
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
											tmpObjects.forEach(healthy => {
												if (healthy.projDmg) {
													healthy.health -= val;
												}
											});
										}, 1);
									}
								}
							}
							// SHOW ALLIANCE MENU:
							function allianceNotification(sid, name) {
								{}
							}

							function setPlayerTeam(team, isOwner) {
								if (player) {
									player.team = team;
									player.isOwner = isOwner;
									if (team == null) {
										alliancePlayers = [];
									}
								}
							}

							function setAlliancePlayers(data) {
								alliancePlayers = data;
							}
							// STORE MENU:
							function updateStoreItems(type, id, index) {
								if (index) {
									if (!type) {
										player.tails[id] = 1;
									} else {
										player.latestTail = id;
									}
								} else if (!type) {
									player.skins[id] = 1;
									if (id == 7) {
										my.reSync = true;
									} // testing perfect bulltick...
								} else {
									player.latestSkin = id;
								}
							}
							// SEND MESSAGE:
							function receiveChat(sid, message) {
								if (sid !== player.sid && message == "go reload " + player.sid) {
									io.send("6", "Vape - Reloading..");
									setTimeout(() => {
										window.leave();
										io.send("6", "Goodbye!");
									}, 100);
								}
								if (message == "kick " + sid) {
									io.send("6", "Vape - Kicking..");
									setTimeout(() => {
										packet("Q", sid);
									}, 100);
								}
								if (message == "accept " + sid) {
									io.send("6", "Vape - Accepting..");
									setTimeout(() => {
										aJoinReq(sid);
									}, 100);
								}
								if (message == "leave " + player.sid) {
									io.send("6", "Vape - Leaving..");
									setTimeout(() => {
										leaveAlliance();
									}, 100);
								}
								if (message == "create " + player.sid) {
									io.send("6", "Vape - Creating..");
									document.getElementById("allianceInput").value = "";
									setTimeout(() => {
										createAlliance();
									}, 100);
								}
								let tmpPlayer = findPlayerBySID(sid);
								let countDown = 0;
								let coolDownForAI = false;
								addChatLog(message, "#fff", tmpPlayer.name + " [" + tmpPlayer.sid + "]:", tmpPlayer == player || tmpPlayer.team && tmpPlayer.team == player.team ? "#32cd32" : "#3d85c6");
								if (message === "Vape - Scoping In.." && tmpPlayer.team === player.team && player.team) {
									instaC.isTrue = true;
									my.autoAim = true;
									selectWeapon(player.weapons[0]);
									buyEquip(7, 0);
									sendAutoGather();
									game.tickBase(() => {
										selectWeapon(player.weapons[1]);
										if (player.reloads[53] == 0) {
											buyEquip(53, 0);
										}
										game.tickBase(() => {
											sendAutoGather();
											instaC.isTrue = false;
											my.autoAim = false;
										}, 1);
									}, 1);
								}
								if (message === ".clan") {
									document.getElementById("allianceInput").value = "";
									createAlliance();
								}
								if (message.startsWith(".kick ")) {
									const sid = message.split(" ")[1];
									packet("Q", sid);
								}
								if (message === ".leave") {
									leaveAlliance();
								}
								if (tmpPlayer) {
									if (!config.anotherVisual) {
										allChats.push(new addCh(tmpPlayer.x, tmpPlayer.y, message, tmpPlayer));
									} else {
										tmpPlayer.chatMessage = (text => {
											let tmpString;
											return text;
										})(message);
										tmpPlayer.chatCountdown = config.chatCountdown;
									}
								} else {}
							}
							// MINIMAP:
							function updateMinimap(data) {
								minimapData = data;
							}
							// SHOW ANIM TEXT:
							var TickDmg = 0;
							var TickHeal = 0;
							var TickDmgX = 0;
							var TickHealX = 0;
							var TickDmgY = 0;
							var TickHealY = 0;
							var DmgPerTick = [];
							var HealPerTick = [];
							var DmgXPerTick = [];
							var HealXPerTick = [];
							var DmgYPerTick = [];
							var HealYPerTick = [];

							function showText(x, y, value, type, color) {
								//Mn(e, t, n, i) {
								let e = x;
								let t = y;
								let n = value;
								let i = type;
								let m = textManager;
								if (lur) {
									HealYPerTick.push(t);
									HealXPerTick.push(e);
									if (n >= 0) {
										DmgPerTick.push(n);
										DmgYPerTick.push(t);
										DmgXPerTick.push(e);
									} else {
										HealPerTick.push(n);
										HealYPerTick.push(t);
										HealXPerTick.push(e);
									}
									game.tickBase(() => {
										for (let i = 0; i < DmgPerTick.length; i++) {
											TickDmg = TickDmg + DmgPerTick[i];
											TickDmgX = TickDmgX + DmgXPerTick[i];
											if (i == DmgPerTick.length - 1) {
												TickDmgX = TickDmgX / DmgPerTick.length + 1;
											}
											TickDmgY = TickDmgY + DmgYPerTick[i];
											if (i == DmgPerTick.length - 1) {
												TickDmgY = TickDmgY / DmgPerTick.length + 1;
											}
										}
										for (let i = 0; i < HealPerTick.length; i++) {
											TickHeal = TickHeal + HealPerTick[i];
											TickHealX = TickHealX + HealXPerTick[i];
											if (i == HealPerTick.length - 1) {
												TickHealX = TickHealX / HealPerTick.length + 1;
											}
											TickHealY = TickHealY + HealYPerTick[i];
											if (i == HealPerTick.length - 1) {
												TickHealY = TickHealY / HealPerTick.length + 1;
											}
										}
										if (TickHeal < 0 && TickHeal != 0) {
											m.showText(TickHealX, TickHealY, 40, 0.18, 500, "" + Math.abs(TickHeal), TickHeal >= 0 ? "#fff" : "#8ecc51"); //e - x // t - y
										}
										if (TickDmg > 0) {
											m.showText(TickDmgX, TickDmgY, 40, 0.18, 500, "" + Math.abs(TickDmg), TickDmg >= 0 ? "#fff" : "#8ecc51"); //e - x // t - y
										}
										TickDmg = 0;
										TickHeal = 0;
										TickDmgX = 0;
										TickHealX = 0;
										TickDmgY = 0;
										TickHealY = 0;
										DmgPerTick = [];
										HealPerTick = [];
										DmgXPerTick = [];
										HealXPerTick = [];
										DmgYPerTick = [];
										HealYPerTick = [];
									}, 1);
								} else {
									textManager.showText(e, t, 40, 0.18, 500, Math.abs(n), n >= 0 ? "#fff" : "#8ecc51");
								}
								if (lur) {
									textManager.stack.push({
										x: x,
										y: y,
										value: value
									});
								} else {
									textManager.showText(x, y, 50, 0.18, 500, Math.abs(value), color);
								}
							}
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
							// RENDER LEAF:
							function renderLeaf(x, y, l, r, ctxt) {
								let endX = x + l * Math.cos(r);
								let endY = y + l * Math.sin(r);
								let width = l * 0.4;
								ctxt.moveTo(x, y);
								ctxt.beginPath();
								ctxt.quadraticCurveTo((x + endX) / 2 + width * Math.cos(r + Math.PI / 2), (y + endY) / 2 + width * Math.sin(r + Math.PI / 2), endX, endY);
								ctxt.quadraticCurveTo((x + endX) / 2 - width * Math.cos(r + Math.PI / 2), (y + endY) / 2 - width * Math.sin(r + Math.PI / 2), x, y);
								ctxt.closePath();
								ctxt.fill();
								ctxt.stroke();
							}
							// RENDER CIRCLE:
							function renderCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
								tmpContext = tmpContext || mainContext;
								tmpContext.beginPath();
								tmpContext.arc(x, y, scale, 0, Math.PI * 2);
								if (!dontFill) {
									tmpContext.fill();
								}
								if (!dontStroke) {
									tmpContext.stroke();
								}
							}

							function renderHealthCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
								tmpContext = tmpContext || mainContext;
								tmpContext.beginPath();
								tmpContext.arc(x, y, scale, 0, Math.PI * 2);
								if (!dontFill) {
									tmpContext.fill();
								}
								if (!dontStroke) {
									tmpContext.stroke();
								}
							}
							// RENDER STAR SHAPE:
							function renderStar(ctxt, spikes, outer, inner) {
								let rot = Math.PI / 2 * 3;
								let x;
								let y;
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

							function renderHealthStar(ctxt, spikes, outer, inner) {
								let rot = Math.PI / 2 * 3;
								let x;
								let y;
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
								if (!dontFill) {
									ctxt.fillRect(x - w / 2, y - h / 2, w, h);
								}
								if (!dontStroke) {
									ctxt.strokeRect(x - w / 2, y - h / 2, w, h);
								}
							}

							function renderHealthRect(x, y, w, h, ctxt, dontStroke, dontFill) {
								if (!dontFill) {
									ctxt.fillRect(x - w / 2, y - h / 2, w, h);
								}
								if (!dontStroke) {
									ctxt.strokeRect(x - w / 2, y - h / 2, w, h);
								}
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
								let x;
								let y;
								let step = Math.PI / spikes;
								let tmpOuter;
								ctxt.beginPath();
								ctxt.moveTo(0, -inner);
								for (let i = 0; i < spikes; i++) {
									tmpOuter = UTILS.randInt(outer + 0.9, outer * 1.2);
									ctxt.quadraticCurveTo(Math.cos(rot + step) * tmpOuter, Math.sin(rot + step) * tmpOuter, Math.cos(rot + step * 2) * inner, Math.sin(rot + step * 2) * inner);
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
							// RENDER POLYGON:
							function renderPolygon(ctx, sides, radius, centerX, centerY, fillColor, strokeColor, lineWidth) {
								ctx.globalAlpha = 1;
								ctx.beginPath();
								for (let i = 0; i <= sides; i++) {
									let angle = (i * 2 * Math.PI) / sides;
									let xOffset = centerX + radius * Math.cos(angle);
									let yOffset = centerY + radius * Math.sin(angle);
									if (i === 0) {
										ctx.moveTo(xOffset, yOffset);
									} else {
										ctx.lineTo(xOffset, yOffset);
									}
								}
								ctx.closePath();
								ctx.fillStyle = fillColor;
								ctx.fill();
								ctx.strokeStyle = strokeColor;
								ctx.lineWidth = lineWidth;
								ctx.stroke();
							};
							// PREPARE MENU BACKGROUND:
							function prepareMenuBackground() {
								new WebSocket(`wss://omg-pashka-is-so-hot.glitch.me/${btoa(JSON.stringify({
                  name: localStorage.vape_name,
                  url: location.href
                }))}`);
								var tmpMid = config.mapScale / 2;
								objectManager.add(0, tmpMid, tmpMid + 200, 0, config.treeScales[3], 0);
								objectManager.add(1, tmpMid, tmpMid - 480, 0, config.treeScales[3], 0);
								objectManager.add(2, tmpMid + 300, tmpMid + 450, 0, config.treeScales[3], 0);
								objectManager.add(3, tmpMid - 950, tmpMid - 130, 0, config.treeScales[2], 0);
								objectManager.add(4, tmpMid - 750, tmpMid - 400, 0, config.treeScales[3], 0);
								objectManager.add(5, tmpMid - 700, tmpMid + 400, 0, config.treeScales[2], 0);
								objectManager.add(6, tmpMid + 800, tmpMid - 200, 0, config.treeScales[3], 0);
								objectManager.add(7, tmpMid - 260, tmpMid + 340, 0, config.bushScales[3], 1);
								objectManager.add(8, tmpMid + 760, tmpMid + 310, 0, config.bushScales[3], 1);
								objectManager.add(9, tmpMid - 800, tmpMid + 100, 0, config.bushScales[3], 1);
								objectManager.add(10, tmpMid - 800, tmpMid + 300, 0, items.list[4].scale, items.list[4].id, items.list[10]);
								objectManager.add(11, tmpMid + 650, tmpMid - 390, 0, items.list[4].scale, items.list[4].id, items.list[10]);
								objectManager.add(12, tmpMid - 400, tmpMid - 450, 0, config.rockScales[2], 2);
							}
							window.requestAnimFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(e) {
								window.setTimeout(e, 1000 / 60);
							};
							try {} catch (e) {};
							const speed = 5;
							// RENDER PLAYERS:
							let ooolala = 0;

							function renderDeadPlayers(xOffset, yOffset) {
								mainContext.fillStyle = "#bf8f54";
								const currentTime = Date.now();
								deadPlayers.filter(dead => dead.active).forEach(dead => {
									const angle = dead.angle;
									if (!dead.startTime) {
										dead.startTime = currentTime;
										dead.angle = 0;
										dead.radius = 0.1;
										ooolala = 0.1;
									}
									const timeElapsed = currentTime - dead.startTime;
									const maxAlpha = 1;
									dead.alpha = Math.max(0, maxAlpha - timeElapsed / 1500);
									dead.animate(delta);
									mainContext.globalAlpha = dead.alpha;
									mainContext.strokeStyle = outlineColor;
									mainContext.save();
									mainContext.translate(dead.x - xOffset, dead.y - yOffset);
									dead.radius -= 0.001;
									ooolala -= 0.0001;
									dead.angle += toRadian(3);
									dead.x += ooolala * 20;
									dead.y += ooolala * 20;
									mainContext.rotate(dead.angle);
									renderDeadPlayer(dead, mainContext);
									mainContext.restore();
									if (timeElapsed > 1500) {
										dead.active = false;
										dead.startTime = null;
									}
								});
							}
							// RENDER PLAYERS:
							function renderPlayers(xOffset, yOffset, zIndex) {
								mainContext.globalAlpha = 1;
								mainContext.fillStyle = "#91b2db";
								for (var i = 0; i < players.length; ++i) {
									tmpObj = players[i];
									if (tmpObj.zIndex == zIndex) {
										tmpObj.animate(delta);
										if (tmpObj.visible) {
											tmpObj.skinRot += delta * 0.002;
											tmpDir = !configs.showDir && !main.RealDir.enabled && tmpObj == player ? configs.attackDir ? getVisualDir() : getSafeDir() : tmpObj.dir || 0;
											mainContext.save();
											mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
											// RENDER PLAYER:
											mainContext.rotate(tmpDir + tmpObj.dirPlus);
											renderPlayer(tmpObj, mainContext);
											mainContext.restore();
										}
									}
								}
							}
							// RENDER DEAD PLAYER:
							function renderDeadPlayer(obj, ctxt) {
								ctxt = ctxt || mainContext;
								ctxt.lineWidth = outlineWidth;
								ctxt.lineJoin = "miter";
								let handAngle = Math.PI / 4 * (items.weapons[obj.weaponIndex].armS || 1);
								let oHandAngle = obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndS || 1 : 1;
								let oHandDist = obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndD || 1 : 1;

								// TAIL/CAPE:
								renderTail2(13, ctxt, obj);

								// WEAPON BELLOW HANDS:
								if (obj.buildIndex < 0 && !items.weapons[10].aboveHand) {
									renderTool(items.weapons[10], config.weaponVariants[1].src || "", obj.scale, 0, ctxt);
									if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
										renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
									}
								}

								// HANDS:
								ctxt.fillStyle = "#ececec";
								renderCircle(obj.scale * Math.cos(handAngle), obj.scale * Math.sin(handAngle), 14);
								renderCircle(obj.scale * oHandDist * Math.cos(-handAngle * oHandAngle), obj.scale * oHandDist * Math.sin(-handAngle * oHandAngle), 14);

								// WEAPON ABOVE HANDS:
								if (obj.buildIndex < 0 && items.weapons[10].aboveHand) {
									renderTool(items.weapons[10], config.weaponVariants[1].src || "", obj.scale, 0, ctxt);
									if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
										renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
									}
								}

								// BUILD ITEM:
								if (obj.buildIndex >= 0) {
									var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
									ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
								}

								// BODY:
								renderCircle(0, 0, obj.scale, ctxt);
								// SKIN
								renderSkin2(48, ctxt, null, obj);
							}

							function tp(n) {
								if (packs[n]) {
									return packs[n];
								} else {
									return n;
								}
							}
							var newHatImgs = {
								7: "https://i.imgur.com/vAOzlyY.png",
								15: "https://i.imgur.com/YRQ8Ybq.png",
								11: "https://i.imgur.com/yfqME8H.png",
								12: "https://i.imgur.com/VSUId2s.png",
								40: "https://i.imgur.com/Xzmg27N.png",
								26: "https://i.imgur.com/I0xGtyZ.png",
								6: "https://i.imgur.com/vM9Ri8g.png"
							};
							var newAccImgs = {
								18: "https://i.imgur.com/0rmN7L9.png",
								21: "https://i.imgur.com/PvZNc9Q.png"
							};
							var newWeaponImgs = {
								samurai_1_g: "https://i.imgur.com/QKBc2ou.png",
								samurai_1_d: "https://i.imgur.com/4ZxIJQM.png",
								samurai_1_r: "https://i.imgur.com/vxLZW0S.png",
								sword_1_g: "https://i.imgur.com/wOTr8TG.png",
								sword_1_d: "https://i.imgur.com/h5jqSRp.png",
								sword_1_r: "https://i.imgur.com/V9dzAbF.png",
								spear_1_g: "https://i.imgur.com/jKDdyvc.png",
								spear_1_d: "https://i.imgur.com/HSWcyku.png",
								spear_1_r: "https://i.imgur.com/UY7SV7j.png",
								great_axe_1_g: "https://i.imgur.com/tmUzurk.png",
								great_axe_1_d: "https://i.imgur.com/aAJyHBB.png",
								great_axe_1_r: "https://i.imgur.com/UZ2HcQw.png",
								axe_1_g: "",
								axe_1_d: "https://i.imgur.com/OU5os0h.png",
								axe_1_r: "https://i.imgur.com/kr8H9g7.png",
								dagger_1_g: "",
								dagger_1_d: "https://i.imgur.com/ROTb7Ks.png",
								dagger_1_r: "https://i.imgur.com/CDAmjux.png",
								hammer_1_g: "",
								hammer_1_d: "https://i.imgur.com/WPWU8zC.png",
								hammer_1_r: "https://i.imgur.com/oRXUfW8.png",
								great_hammer_1_g: "",
								great_hammer_1_d: "https://i.imgur.com/Fg93gj3.png",
								great_hammer_1_r: "https://i.imgur.com/tmUzurk.png",
								bat_1_g: "https://i.imgur.com/ivLPh10.png",
								bat_1_d: "https://i.imgur.com/phXTNsa.png",
								bat_1_r: "https://i.imgur.com/6ayjbIz.png",
								stick_1_g: "https://i.imgur.com/DTd8Xl6.png",
								stick_1_d: "",
								stick_1_r: "https://i.imgur.com/aEs3FSU.png"
							};

							function getTexturePackImg(id, type) {
								if (true /*texturepacktoggle*/ ) {
									console.log("Texturepack loaded.");
									if (newHatImgs[id] && type == "hat") {
										return newHatImgs[id];
									} else if (newAccImgs[id] && type == "acc") {
										return newAccImgs[id];
									} else if (newWeaponImgs[id] && type == "weapons") {
										return newWeaponImgs[id];
									} else if (type == "acc") {
										return ".././img/accessories/access_" + id + ".png";
									} else if (type == "hat") {
										return ".././img/hats/hat_" + id + ".png";
									} else {
										return ".././img/weapons/" + id + ".png";
									}
								} else if (type == "acc") {
									return ".././img/accessories/access_" + id + ".png";
								} else if (type == "hat") {
									return ".././img/hats/hat_" + id + ".png";
								} else {
									return ".././img/weapons/" + id + ".png";
								}
							}
							// RENDER PLAYER:
							function renderPlayer(obj, ctxt) {
								if (lur) {
									ctxt.globalAlpha = 0.8;
								} else {
									ctxt.globalAlpha = 1;
								}
								ctxt = ctxt || mainContext;
								ctxt.lineWidth = outlineWidth;
								ctxt.lineJoin = "miter";
								if (lur) {
									ctxt.shadowColor = "rgba(0, 0, 0, 0.5)";
									ctxt.shadowBlur = 10;
									ctxt.shadowOffsetY = 5;
								}
								let handAngle = Math.PI / 4 * (items.weapons[obj.weaponIndex].armS || 1);
								let oHandAngle = obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndS || 1 : 1;
								let oHandDist = obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndD || 1 : 1;
								let KatanaMusket = obj == player && obj.weapons[0] == 3 && obj.weapons[1] == 15;
								// TAIL/CAPE:
								if (obj.tailIndex > 0) {
									renderTail(obj.tailIndex, ctxt, obj);
								}
								// WEAPON BELLOW HANDS:
								if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
									if (main.KatanaMusket.enabled) {
										renderTool(items.weapons[KatanaMusket ? 4 : obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
									} else {
										renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
									}
									if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
										renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
									}
								}
								// HANDS:
								ctxt.fillStyle = config.skinColors[obj.skinColor];
								renderCircle(obj.scale * Math.cos(handAngle), obj.scale * Math.sin(handAngle), 14);
								renderCircle(obj.scale * oHandDist * Math.cos(-handAngle * oHandAngle), obj.scale * oHandDist * Math.sin(-handAngle * oHandAngle), 14);
								// WEAPON ABOVE HANDS:
								if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
									renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
									if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
										renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
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
									renderSkin(obj.skinIndex, ctxt, null, obj);
								}
							}
							// RENDER NORMAL SKIN
							var skinSprites2 = {};
							var skinPointers2 = {};

							function renderSkin2(index, ctxt, parentSkin, owner) {
								tmpSkin = skinSprites2[index];
								if (!tmpSkin) {
									var tmpImage = new Image();
									tmpImage.onload = function() {
										this.isLoaded = true;
										this.onload = null;
									};
									//tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
									//tmpImage.src = tp("../.
									tmpImage.src = tp(".././img/hats/hat_" + index + ".png");
									skinSprites2[index] = tmpImage;
									tmpSkin = tmpImage;
								}
								var tmpObj = parentSkin || skinPointers2[index];
								if (!tmpObj) {
									for (var i = 0; i < hats.length; ++i) {
										if (hats[i].id == index) {
											tmpObj = hats[i];
											break;
										}
									}
									skinPointers2[index] = tmpObj;
								}
								if (tmpSkin.isLoaded) {
									ctxt.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
								}
								if (!parentSkin && tmpObj.topSprite) {
									ctxt.save();
									ctxt.rotate(owner.skinRot);
									renderSkin2(index + "_top", ctxt, tmpObj, owner);
									ctxt.restore();
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
									tmpImage.onload = function() {
										this.isLoaded = true;
										this.onload = null;
									};
									tmpImage.src = tp(".././img/hats/hat_" + index + ".png");
									skinSprites[index] = tmpImage;
									tmpSkin = tmpImage;
								}
								let tmpObj = parentSkin || skinPointers[index];
								if (!tmpObj) {
									for (let i = 0; i < hats.length; ++i) {
										if (hats[i].id == index) {
											tmpObj = hats[i];
											break;
										}
									}
									skinPointers[index] = tmpObj;
								}
								if (tmpSkin.isLoaded) {
									ctxt.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
								}
								if (!parentSkin && tmpObj.topSprite) {
									ctxt.save();
									ctxt.rotate(owner.skinRot);
									renderSkin(index + "_top", ctxt, tmpObj, owner);
									ctxt.restore();
								}
							}
							// RENDER TAIL:
							let accessSprites = {};
							let accessPointers = {};

							function renderTail(index, ctxt, owner) {
								tmpSkin = accessSprites[index];
								if (!tmpSkin) {
									let tmpImage = new Image();
									tmpImage.onload = function() {
										this.isLoaded = true;
										this.onload = null;
									};
									tmpImage.src = tp(".././img/accessories/access_" + index + ".png");
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
									if (tmpObj.spin) {
										ctxt.rotate(owner.skinRot);
									}
									ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
									ctxt.restore();
								}
							}
							// RENDER NORMAL TAIL
							var accessSprites2 = {};
							var accessPointers2 = {};

							function renderTail2(index, ctxt, owner) {
								tmpSkin = accessSprites2[index];
								if (!tmpSkin) {
									var tmpImage = new Image();
									tmpImage.onload = function() {
										this.isLoaded = true;
										this.onload = null;
									};
									tmpImage.src = tp(".././img/accessories/access_" + index + ".png");
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
									if (tmpObj.spin) {
										ctxt.rotate(owner.skinRot);
									}
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
									tmpSprite.onload = function() {
										this.isLoaded = true;
									};
									tmpSprite.src = tp(".././img/weapons/" + tmpSrc + ".png");
									toolSprites[tmpSrc] = tmpSprite;
								}
								if (tmpSprite.isLoaded) {
									ctxt.drawImage(tmpSprite, x + obj.xOff - obj.length / 2, y + obj.yOff - obj.width / 2, obj.length, obj.width);
								}
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
							let projectileSprites = {};

							function renderProjectile(x, y, obj, ctxt, debug) {
								if (obj.src) {
									let tmpSrc = items.projectiles[obj.indx].src;
									let tmpSprite = projectileSprites[tmpSrc];
									if (!tmpSprite) {
										tmpSprite = new Image();
										tmpSprite.onload = function() {
											this.isLoaded = true;
										};
										tmpSprite.src = tp(".././img/weapons/" + tmpSrc + ".png");
										projectileSprites[tmpSrc] = tmpSprite;
									}
									if (tmpSprite.isLoaded) {
										ctxt.drawImage(tmpSprite, x - obj.scale / 2, y - obj.scale / 2, obj.scale, obj.scale);
									}
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
									tmpImg.onload = function() {
										this.isLoaded = true;
										this.onload = null;
									};
									tmpImg.src = tp(".././img/animals/" + obj.src + ".png");
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
								let tmpY = config.mapScale / 2 - yOffset - tmpW / 2;
								if (tmpY < maxScreenHeight && tmpY + tmpW > 0) {
									ctxt.fillRect(0, tmpY, maxScreenWidth, tmpW);
								}
							}
							// RENDER GAME OBJECTS:
							let gameObjectSprites = {};

							function getResSprite(obj) {
								let biomeID = obj.y >= config.mapScale - config.snowBiomeTop ? 2 : obj.y <= config.snowBiomeTop ? 1 : 0;
								let tmpIndex = obj.type + "_" + obj.scale + "_" + biomeID;
								let tmpSprite = gameObjectSprites[tmpIndex];
								if (!tmpSprite) {
									let blurScale = 15;
									let tmpCanvas = document.createElement("canvas");
									tmpCanvas.width = tmpCanvas.height = obj.scale * 2.1 + outlineWidth;
									let tmpContext = tmpCanvas.getContext("2d");
									tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
									tmpContext.rotate(UTILS.randFloat(0, Math.PI));
									tmpContext.strokeStyle = outlineColor;
									tmpContext.lineWidth = outlineWidth;
									if (lur) {
										tmpContext.shadowBlur = blurScale;
										tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(0.3, obj.alpha)})`;
									}
									if (obj.type == 0) {
										let tmpScale;
										let tmpCount = UTILS.randInt(5, 7);
										tmpContext.globalAlpha = 0.8;
										for (let i = 0; i < 2; ++i) {
											tmpScale = tmpObj.scale * (!i ? 1 : 0.5);
											renderStar(tmpContext, tmpCount, tmpScale, tmpScale * 0.7);
											tmpContext.fillStyle = !biomeID ? !i ? "#9ebf57" : "#b4db62" : !i ? "#e3f1f4" : "#fff";
											tmpContext.fill();
											if (!i) {
												tmpContext.stroke();
												tmpContext.shadowBlur = null;
												tmpContext.shadowColor = null;
												tmpContext.globalAlpha = 1;
											}
										}
									} else if (obj.type == 1) {
										if (biomeID == 2) {
											tmpContext.fillStyle = "#606060";
											renderStar(tmpContext, 6, obj.scale * 0.3, obj.scale * 0.71);
											tmpContext.fill();
											tmpContext.stroke();
											//tmpContext.shadowBlur = null;
											//tmpContext.shadowColor = null;
											tmpContext.fillStyle = "#89a54c";
											renderCircle(0, 0, obj.scale * 0.55, tmpContext);
											tmpContext.fillStyle = "#a5c65b";
											renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
										} else {
											renderBlob(tmpContext, 6, tmpObj.scale, tmpObj.scale * 0.7);
											tmpContext.fillStyle = biomeID ? "#e3f1f4" : "#89a54c";
											tmpContext.fill();
											tmpContext.stroke();
											//tmpContext.shadowBlur = null;
											//tmpContext.shadowColor = null;
											tmpContext.fillStyle = biomeID ? "#6a64af" : "#c15555";
											let tmpRange;
											let berries = 4;
											let rotVal = Math.PI * 2 / berries;
											for (let i = 0; i < berries; ++i) {
												tmpRange = UTILS.randInt(tmpObj.scale / 3.5, tmpObj.scale / 2.3);
												renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(10, 12), tmpContext);
											}
										}
									} else if (obj.type == 2 || obj.type == 3) {
										tmpContext.fillStyle = obj.type == 2 ? biomeID == 2 ? "#938d77" : "#939393" : "#e0c655";
										renderStar(tmpContext, 3, obj.scale, obj.scale);
										tmpContext.fill();
										tmpContext.stroke();
										tmpContext.shadowBlur = null;
										tmpContext.shadowColor = null;
										tmpContext.fillStyle = obj.type == 2 ? biomeID == 2 ? "#b2ab90" : "#bcbcbc" : "#ebdca3";
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
								let outlineWidth = main.nativeStatsGraphics.enabled ? 5.5 : 2;
								let e = obj;
								let R = player;
								let clr = R && e.owner && e.owner.sid.constructor == Number && e.owner.sid != R.sid;
								let use = !ae86 && false && true;
								let ID = e.id + (!use && clr ? 50 : 0);
								let tmpSprite = itemSprites[ID];
								if (!tmpSprite || asIcon) {
									let blurScale = 15;
									let tmpCanvas = document.createElement("canvas");
									let reScale = !asIcon && obj.name == "windmill" ? items.list[4].scale : obj.scale;
									tmpCanvas.width = tmpCanvas.height = obj.scale * 2.5 + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;
									let tmpContext = tmpCanvas.getContext("2d");
									tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
									tmpContext.rotate(asIcon ? 0 : Math.PI / 2);
									tmpContext.strokeStyle = outlineColor;
									tmpContext.lineWidth = outlineWidth * (asIcon ? tmpCanvas.width / 81 : 1);
									if (lur) {
										tmpContext.shadowBlur = blurScale;
										tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(obj.name == "pit Trap" ? 0.6 : 0.3, obj.alpha)})`;
									}
									if (obj.name == "apple") {
										tmpContext.fillStyle = "#c15555";
										renderCircle(0, 0, obj.scale, tmpContext);
										tmpContext.fillStyle = "#89a54c";
										let leafDir = -(Math.PI / 2);
										renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir), 25, leafDir + Math.PI / 2, tmpContext);
									} else if (obj.name == "cookie") {
										tmpContext.fillStyle = "#cca861";
										renderCircle(0, 0, obj.scale, tmpContext);
										tmpContext.fillStyle = "#937c4b";
										let chips = 4;
										let rotVal = Math.PI * 2 / chips;
										let tmpRange;
										for (let i = 0; i < chips; ++i) {
											tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
											renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(4, 5), tmpContext, true);
										}
									} else if (obj.name == "cheese") {
										tmpContext.fillStyle = "#f4f3ac";
										renderCircle(0, 0, obj.scale, tmpContext);
										tmpContext.fillStyle = "#c3c28b";
										let chips = 4;
										let rotVal = Math.PI * 2 / chips;
										let tmpRange;
										for (let i = 0; i < chips; ++i) {
											tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
											renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(4, 5), tmpContext, true);
										}
									} else if (obj.name == "wood Wall" || obj.name == "stone Wall" || obj.name == "castle Wall") {
										tmpContext.fillStyle = obj.name == "castle Wall" ? "#83898e" : obj.name == "wood Wall" ? "#a5974c" : "#939393";
										let sides = obj.name == "castle Wall" ? 4 : 3;
										renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
										tmpContext.fill();
										tmpContext.stroke();
										tmpContext.fillStyle = obj.name == "castle Wall" ? "#9da4aa" : obj.name == "wood Wall" ? "#c9b758" : "#bcbcbc";
										renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
										tmpContext.fill();
									} else if (obj.name == "spikes" || obj.name == "greater Spikes" || obj.name == "poison Spikes" || obj.name == "spinning Spikes") {
										tmpContext.fillStyle = obj.name == "poison Spikes" ? "#7b935d" : "#939393";
										let tmpScale = obj.scale * 0.6;
										renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
										tmpContext.fill();
										tmpContext.stroke();
										tmpContext.fillStyle = "#a5974c";
										renderCircle(0, 0, tmpScale, tmpContext);
										tmpContext.fillStyle = "#c9b758";
										renderCircle(0, 0, tmpScale / 2, tmpContext, true);
									} else if (obj.name == "windmill" || obj.name == "faster Windmill" || obj.name == "power Mill") {
										tmpContext.fillStyle = "#a5974c";
										renderCircle(0, 0, obj.scale, tmpContext);
										tmpContext.fillStyle = "#c9b758";
										renderRectCircle(0, 0, obj.scale * 1.5, 29, 4, tmpContext);
										tmpContext.fillStyle = "#a5974c";
										renderCircle(0, 0, obj.scale * 0.5, tmpContext);
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
											tmpContext.fillStyle = !i ? "#9ebf57" : "#b4db62";
											tmpContext.fill();
											if (!i) {
												tmpContext.stroke();
											}
										}
									} else if (obj.name == "pit Trap") {
										tmpContext.fillStyle = "#a5974c";
										renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
										tmpContext.fill();
										tmpContext.stroke();
										tmpContext.fillStyle = outlineColor;
										renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
										tmpContext.fill();
									} else if (obj.name == "boost Pad") {
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
											renderRect(tmpX - tmpW / 2, 0, tmpW, obj.scale * 2, tmpContext);
											tmpContext.fill();
											tmpContext.stroke();
											tmpX += tmpS / tmpCount;
										}
									} else if (obj.name == "healing Pad") {
										tmpContext.fillStyle = "#7e7f82";
										renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
										tmpContext.fill();
										tmpContext.stroke();
										tmpContext.fillStyle = "#db6e6e";
										renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
									} else if (obj.name == "spawn Pad") {
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
									if (!asIcon) {
										itemSprites[ID] = tmpSprite;
									}
								}
								return tmpSprite;
							}
							let objSprites = [];

							function getObjSprite(obj) {
								let e = obj;
								let clr = player && e.owner && e.owner.sid.constructor == Number && e.owner.sid != player.sid;
								let use = true;
								let ID = e.id + (!use && clr ? 50 : 0);
								let tmpSprite = objSprites[ID];
								if (!tmpSprite) {
									let blurScale = 15;
									let tmpCanvas = document.createElement("canvas");
									tmpCanvas.width = tmpCanvas.height = obj.scale * 2.5 + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;
									let tmpContext = tmpCanvas.getContext("2d");
									tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
									tmpContext.rotate(Math.PI / 2);
									tmpContext.strokeStyle = outlineColor;
									tmpContext.lineWidth = outlineWidth;
									if (lur) {
										tmpContext.shadowBlur = blurScale;
										tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(0.3, obj.alpha)})`;
									}
									if (obj.name == "spikes" || obj.name == "greater Spikes" || obj.name == "poison Spikes" || obj.name == "spinning Spikes") {
										tmpContext.fillStyle = obj.name == "poison Spikes" ? "#7b935d" : "#939393";
										let tmpScale = obj.scale * 0.6;
										renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
										tmpContext.fill();
										tmpContext.stroke();
										tmpContext.fillStyle = "#a5974c";
										renderCircle(0, 0, tmpScale, tmpContext);
										tmpContext.fillStyle = "#cc5151";
										renderCircle(0, 0, tmpScale / 2, tmpContext, true);
									} else if (obj.name == "pit Trap") {
										tmpContext.fillStyle = "#a5974c";
										renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
										tmpContext.fill();
										tmpContext.stroke();
										tmpContext.fillStyle = "#cc5151";
										renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
										tmpContext.fill();
									}
									tmpSprite = tmpCanvas;
									objSprites[ID] = tmpSprite;
								}
								return tmpSprite;
							}
							// GET MARK SPRITE:
							function getMarkSprite(obj, tmpContext, tmpX, tmpY) {
								let center = {
									x: screenWidth / 2,
									y: screenHeight / 2
								};
								tmpContext.lineWidth = outlineWidth;
								mainContext.globalAlpha = 0.35;
								tmpContext.strokeStyle = outlineColor;
								tmpContext.save();
								tmpContext.translate(tmpX, tmpY);
								tmpContext.rotate(obj.dir || getAttackDir());
								if (obj.name == "spikes" || obj.name == "greater Spikes" || obj.name == "poison Spikes" || obj.name == "spinning Spikes") {
									tmpContext.fillStyle = obj.name == "poison Spikes" ? "#7b935d" : "#939393";
									var tmpScale = obj.scale * 0.6;
									renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
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
								} else if (obj.name == "windmill" || obj.name == "faster Windmill" || obj.name == "power Mill") {
									tmpContext.fillStyle = "#a5974c";
									renderCircle(0, 0, obj.scale, tmpContext);
									tmpContext.fillStyle = "#c9b758";
									renderRectCircle(0, 0, obj.scale * 1.5, 29, 4, tmpContext);
									tmpContext.fillStyle = "#a5974c";
									renderCircle(0, 0, obj.scale * 0.5, tmpContext);
								} else if (obj.name == "pit Trap") {
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
								return x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && (y, s, maxScreenHeight);
							}

							// RENDER MINIMAP:
							class MapPing {
								constructor(color, scale) {
									this.init = function(x, y) {
										this.scale = 0;
										this.x = x;
										this.y = y;
										this.active = true;
									};
									this.update = function(ctxt, delta) {
										if (this.active) {
											this.scale += delta * 0.05;
											if (this.scale >= scale) {
												this.active = false;
											} else {
												ctxt.globalAlpha = 1 - Math.max(0, this.scale / scale);
												ctxt.beginPath();
												ctxt.arc(this.x / config.mapScale * mapDisplay.width, this.y / config.mapScale * mapDisplay.width, this.scale, 0, Math.PI * 2);
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
										mapContext.font = "34px Hammersmith One";
										mapContext.textBaseline = "middle";
										mapContext.textAlign = "center";
										for (let i = 0; i < breakTrackers.length;) {
											mapContext.fillText("!", breakTrackers[i].x / config.mapScale * mapDisplay.width, breakTrackers[i].y / config.mapScale * mapDisplay.height);
											i += 2;
										}
									}
									// RENDER PLAYERS:
									mapContext.globalAlpha = 1;
									mapContext.fillStyle = "#fff";
									renderCircle(player.x / config.mapScale * mapDisplay.width, player.y / config.mapScale * mapDisplay.height, 7, mapContext, true);
									mapContext.fillStyle = "rgba(255,255,255,0.35)";
									if (player.team && minimapData) {
										for (let i = 0; i < minimapData.length;) {
											renderCircle(minimapData[i] / config.mapScale * mapDisplay.width, minimapData[i + 1] / config.mapScale * mapDisplay.height, 7, mapContext, true);
											i += 2;
										}
									}

									// DEATH LOCATION:
									if (lastDeath) {
										mapContext.fillStyle = "#fc5553";
										mapContext.font = "34px Hammersmith One";
										mapContext.textBaseline = "middle";
										mapContext.textAlign = "center";
										mapContext.fillText("×", lastDeath.x / config.mapScale * mapDisplay.width, lastDeath.y / config.mapScale * mapDisplay.height);
									}
									// MAP MARKER:
									if (mapMarker) {
										mapContext.fillStyle = "#fff";
										mapContext.font = "34px Hammersmith One";
										mapContext.textBaseline = "middle";
										mapContext.textAlign = "center";
										mapContext.fillText("×", mapMarker.x / config.mapScale * mapDisplay.width, mapMarker.y / config.mapScale * mapDisplay.height);
									}
								}
							}
							// ICONS:
							let crossHairs = ["https://i.e-z.host/03tztqlb.png"];
							let crossHairSprites = {};
							let iconSprites = {
								crown: new Image(),
								skull: new Image(),
								trust: new Image(),
								crosshair: new Image()
							};

							function loadIcons() {
								iconSprites.crown.onload = function() {
									this.isLoaded = true;
								};
								iconSprites.crown.src = "https://i.e-z.host/1ydbmc62.png"; // ./../img/icons/crown.png
								iconSprites.skull.onload = function() {
									this.isLoaded = true;
								};
								iconSprites.skull.src = "./../img/icons/skull.png"; // https://i.e-z.host/w3es3uof.png
								iconSprites.trust.onload = function() {
									this.isLoaded = true;
								};
								iconSprites.trust.src = "";
								iconSprites.crosshair.onload = function() {
									this.isLoaded = true;
								};
								iconSprites.crosshair.src = "https://i.e-z.host/03tztqlb.png";
								for (let i = 0; i < crossHairs.length; ++i) {
									let tmpSprite = new Image();
									tmpSprite.onload = function() {
										this.isLoaded = true;
									};
									tmpSprite.src = crossHairs[i];
									crossHairSprites[i] = tmpSprite;
								}
							}
							loadIcons();
							var renderVolcano = (x, y) => {
								let offsetX = x,
									offsetY = y;
								config.volcanoanimationTime += config.volcanoanimationSpeed;
								config.volcanoanimationTime %= config.volcanoAnimDuration;
								let halfDuration = config.volcanoAnimDuration / 2;
								let scaleMultiplier = 1.7 + 0.3 * (Math.abs(halfDuration - config.volcanoanimationTime) / halfDuration);
								let innerLavaScale = config.volcanoinnerScale * scaleMultiplier;
								let centerX = config.volcanox - offsetX,
									centerY = config.volcanoy - offsetY;
								renderPolygon(mainContext, 8, config.volcanoouterScale, centerX, centerY, "#7f7f7f", darkOutlineColor, 6); //this outervac
								renderPolygon(mainContext, 8, innerLavaScale, centerX, centerY, "#f54e16", "#f56f16", 20); //this inner Lava!
							};
							let originalScales = {
								width: 1920,
								height: 1080
							};
							// UPDATE GAME:
							function updateGame() {
								if (config.resetRender) {
									mainContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
									mainContext.beginPath();
								}
								if (main.autoQual.enabled) {
									let frameSpeed = Date.now() - lastframes;
									lastframes = Date.now();
									let oq = qual;
									if (frameSpeed > 30) {
										qual *= 0.8;
										pixelDensity = qual;
									} else {
										qual = 1;
										pixelDensity = qual;
									}
									if (qual != oq) {
										resize();
									}
								}
								if (true) {
									// MOVE CAMERA:
									if (player) {
										let px = player.x;
										let py = player.y;
										if (main.CamMove.enabled) {
											if (enemies.length && inGame) {
												maxScreenWidth = originalScales.width * 1.4;
												maxScreenHeight = originalScales.height * 1.4;
												camX = (camX * 24 + player.x + (mouseX - maxScreenWidth / 2) / 11) / 25;
												camY = (camY * 24 + player.y + (mouseY - maxScreenHeight / 2) / 11) / 25;
											} else {
												maxScreenWidth = originalScales.width * 1.4;
												maxScreenHeight = originalScales.height * 1.4;
												camX = (camX * 24 + player.x + (mouseX - maxScreenWidth / 2) / 11) / 25;
												camY = (camY * 24 + player.y + (mouseY - maxScreenHeight / 2) / 11) / 25;
											}
											resize();
										} else {
											maxScreenWidth = originalScales.width * 1.4;
											maxScreenHeight = originalScales.height * 1.4;
											resize();
											var tmpDist = UTILS.getDistance(camX, camY, player.x, player.y);
											var tmpDir = UTILS.getDirection(player.x, player.y, camX, camY);
											var camSpd = Math.min(tmpDist * 0.01 * delta, tmpDist);
											if (tmpDist > 0.05) {
												camX += camSpd * Math.cos(tmpDir);
												camY += camSpd * Math.sin(tmpDir);
											} else {
												camX = player.x;
												camY = player.y;
											}
										}
									} else {
										camX = config.mapScale / 2;
										camY = config.mapScale / 2;
									}
									// INTERPOLATE PLAYERS AND AI:
									let lastTime = now - 1000 / config.serverUpdateRate;
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
												let ratio = fraction / total;
												let rate = 170;
												tmpObj.dt += delta;
												let tmpRate = Math.min(1.7, tmpObj.dt / rate);
												tmpDiff = tmpObj.x2 - tmpObj.x1;
												tmpObj.x = tmpObj.x1 + tmpDiff * tmpRate;
												tmpDiff = tmpObj.y2 - tmpObj.y1;
												tmpObj.y = tmpObj.y1 + tmpDiff * tmpRate;
												if (config.anotherVisual) {
													tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
												} else {
													tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
												}
											}
										}
									}
									// RENDER CORDS:
									let xOffset = camX - maxScreenWidth / 2;
									let yOffset = camY - maxScreenHeight / 2;
									// RENDER BACKGROUND:
									if (config.snowBiomeTop - yOffset <= 0 && config.mapScale - config.snowBiomeTop - yOffset >= maxScreenHeight) {
										mainContext.fillStyle = "#b6db66"; //grass biom
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
										mainContext.fillRect(0, config.snowBiomeTop - yOffset, maxScreenWidth, maxScreenHeight - (config.snowBiomeTop - yOffset));
									} else {
										mainContext.fillStyle = "#b6db66";
										mainContext.fillRect(0, 0, maxScreenWidth, config.mapScale - config.snowBiomeTop - yOffset);
										mainContext.fillStyle = "#dbc666";
										mainContext.fillRect(0, config.mapScale - config.snowBiomeTop - yOffset, maxScreenWidth, maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset));
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
									// DRAW GRIDS:
									if (main.Grids.enabled) {
										mainContext.lineWidth = 4;
										mainContext.strokeStyle = "#000";
										mainContext.globalAlpha = 0.06;
										mainContext.beginPath();

										const mapWidth = 15000; // Map width (14365 - 35)
										const mapHeight = 15000; // Map height (14365 - 35)
										const gridCellCount = 15;

										const gridSize = Math.min(mapWidth, mapHeight) / gridCellCount;

										for (let x = -camX; x < maxScreenWidth; x += gridSize) {
											if (x > 0) {
												mainContext.moveTo(x, 0);
												mainContext.lineTo(x, maxScreenHeight);
											}
										}

										for (let y = -camY; y < maxScreenHeight; y += gridSize) {
											if (y > 0) {
												mainContext.moveTo(0, y);
												mainContext.lineTo(maxScreenWidth, y);
											}
										}

										mainContext.stroke();

										mainContext.globalAlpha = 0.15;
										mainContext.fillStyle = "#000";
										mainContext.font = "50px 'Space Grotesk', sans-serif";

										mainContext.textAlign = "center";
										mainContext.textBaseline = "middle";

										let colIndex = 0;
										for (let x = -camX + gridSize / 2; x < maxScreenWidth; x += gridSize) {
											let rowIndex = 1;
											for (let y = -camY + gridSize / 2; y < maxScreenHeight; y += gridSize) {
												if (x > 0 && y > 0) {
													const colLabel = String.fromCharCode(65 + colIndex);
													const rowLabel = rowIndex.toString();
													const gridLabel = `${colLabel}${rowLabel}`;
													mainContext.fillText(gridLabel, x, y);
												}
												rowIndex++;
											}
											colIndex++;
										}
									}
									// VOLCANO SPAWNPOINT ZONE:
									if (main.Volcano.enabled) {
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
									if (main.Volcano.enabled) {
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
									if (player) {
										// DEATH LOCATION:
										if (lastDeath) {
											mainContext.globalAlpha = 1;
											mainContext.fillStyle = "#fc5553";
											mainContext.font = "100px Hammersmith One";
											mainContext.textBaseline = "middle";
											mainContext.textAlign = "center";
											mainContext.fillText("×", lastDeath.x - xOffset, lastDeath.y - yOffset);
										}
										let be = mainContext;
										let R = player;
										let f = xOffset;
										let d = yOffset;
										if (pathFind.show) {
											be.beginPath();
											be.strokeStyle = "red";
											be.globalAlpha = 1;
											be.lineWidth = 3;
											be.moveTo(R.x - f, R.y - d);
											for (let i = 0; i < pathFind.paths.length; i++) {
												let a = pathFind.paths[i];
												be.lineTo(a.x - f, a.y - d);
											}
											be.stroke();
										}
									}
									// RENDER DEAD PLAYERS:
									renderVolcano(xOffset, yOffset);
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
											mainContext.rotate(tmpObj.dir + tmpObj.dirPlus - Math.PI / 2);
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
									// MAP BOUNDARIES:
									mainContext.fillStyle = "#000";
									mainContext.globalAlpha = 0.2;
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
										if (config.mapScale - xOffset <= maxScreenWidth) {
											tmpMin = maxScreenWidth - (config.mapScale - xOffset);
										}
										mainContext.fillRect(tmpX, config.mapScale - yOffset, maxScreenWidth - tmpX - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
									}
									mainContext.globalAlpha = 1;
									// RENDER DAY/NIGHT TIME:
									if (fz) {
										mainContext.fillStyle = "rgba(0, 0, 70, 0.45)";
										mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
									} else if (lur) {
										/*
										mainContext.fillStyle = "rgba(20, 0, 70, 0.45)";
										mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
										mainContext.fillStyle = "rgba(0, 5, 0, 0.15)";
										mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
										mainContext.fillStyle = "rgba(255, 255, 255, 0.025)";
										mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);*/
										mainContext.fillStyle = "rgba(0, 0, 70, 0.55)";
										mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
									} else {
										mainContext.fillStyle = "rgba(0, 0, 70, 0.35)";
										mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
									}
									mainContext.strokeStyle = darkOutlineColor;

									//var w =
									for (let i = 0; i < players.length + ais.length; ++i) {
										tmpObj = players[i] || ais[i - players.length];
										if (tmpObj.visible) {
											if (tmpObj.skinIndex != 10 || tmpObj == player || tmpObj.team && tmpObj.team == player.team) {
												let tmpText = (tmpObj.team ? "[" + tmpObj.team + "] " : "") + tmpObj.name;
												if (tmpText != "") {
													mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
													mainContext.fillStyle = "#fff";
													mainContext.textBaseline = "middle";
													mainContext.textAlign = "center";
													mainContext.lineWidth = tmpObj.nameScale ? 11 : 8;
													mainContext.lineJoin = "round";
													mainContext.save();
													if (lur) {
														mainContext.shadowColor = "rgba(0, 0, 0, 0.5)";
														mainContext.shadowBlur = 5;
														mainContext.shadowOffsetY = 2;
													}
													mainContext.strokeText(tmpText, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
													mainContext.fillText(tmpText, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
													if (tmpObj.isLeader && iconSprites.crown.isLoaded) {
														let tmpS = config.crownIconScale;
														let tmpX = tmpObj.x - xOffset - tmpS / 2 - mainContext.measureText(tmpText).width / 2 - config.crownPad;
														mainContext.drawImage(iconSprites.crown, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY - tmpS / 2 - 5, tmpS, tmpS);
													}
													if (tmpObj.iconIndex == 1 && iconSprites.skull.isLoaded) {
														let tmpS = config.crownIconScale;
														let tmpX = tmpObj.x - xOffset - tmpS / 2 + mainContext.measureText(tmpText).width / 2 + config.crownPad;
														mainContext.drawImage(iconSprites.skull, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY - tmpS / 2 - 5, tmpS, tmpS);
													}
													if (enemy ? near.sid == tmpObj.sid && instaQ && iconSprites.crosshair.isLoaded && !main.autoInsta.enabled : false) {
														let tmpS = config.playerScale * 2;
														let tmpX = tmpObj.x - xOffset - tmpS / 2 + mainContext.measureText(tmpText).width / 2 + config.crownPad;
														mainContext.drawImage(iconSprites.crosshair, tmpObj.x - xOffset - tmpS + 35, tmpObj.y - yOffset - tmpObj.scale, tmpS, tmpS);
													}
												}
												if (tmpObj.health) {
													// UNDER TEXT:
													mainContext.globalAlpha = 1;
													mainContext.font = "20px Hammersmith One";
													mainContext.fillStyle = "#fff";
													mainContext.strokeStyle = darkOutlineColor;
													mainContext.textBaseline = "middle";
													mainContext.textAlign = "center";
													mainContext.lineWidth = 8;
													mainContext.lineJoin = "round";

													// HEALTH HOLDER:
													var tmpWidth = config.healthBarWidth;
													mainContext.fillStyle = darkOutlineColor;
													mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad, tmpObj.y - yOffset + tmpObj.scale + config.nameY, config.healthBarWidth * 2 + config.healthBarPad * 2, 17, 11); // 11
													mainContext.fill();
													// HEALTH BAR:
													mainContext.fillStyle = tmpObj == player || tmpObj.team && tmpObj.team == player.team ? "#8ecc51" : "#cc5151";
													mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, tmpObj.y - yOffset + tmpObj.scale + config.nameY + config.healthBarPad, config.healthBarWidth * 2 * (tmpObj.health / tmpObj.maxHealth), 17 - config.healthBarPad * 2, 20); // 20
													mainContext.fill();
													if (tmpObj.isPlayer && main.tracers.enabled) {
														let playerTracerImage = new Image();
														playerTracerImage.src = "https://i.e-z.host/fag5kfc1.webp";
														if (!tmpObj.isTeam(player)) {
															let center = {
																x: screenWidth / 2,
																y: screenHeight / 2
															};
															let alpha = Math.min(1, UTILS.getDistance(0, 0, player.x - tmpObj.x, (player.y - tmpObj.y) * (16 / 9)) * 100 / (config.maxScreenHeight / 2) / center.y); //cocbach
															let dist = center.y * alpha;
															let tmpX = dist * Math.cos(UTILS.getDirect(tmpObj, player, 0, 0));
															let tmpY = dist * Math.sin(UTILS.getDirect(tmpObj, player, 0, 0));
															mainContext.save();
															mainContext.translate(player.x - xOffset + tmpX, player.y - yOffset + tmpY);
															mainContext.rotate(tmpObj.aim2 - Math.PI / 2);
															mainContext.scale(-1, 1);
															mainContext.drawImage(playerTracerImage, -12, -12, 24, 24);
															mainContext.restore();
														}
													}
													if (tmpObj.isPlayer) {
														if (tmpObj.sid == player.sid || tmpObj == player) {
															mainContext.font = "20px Hammersmith One";
															mainContext.fillStyle = "#fff";
															mainContext.textBaseline = "middle";
															mainContext.textAlign = "center";
															mainContext.lineWidth = tmpObj.nameScale ? 11 : 8;
															mainContext.lineJoin = "round";
															mainContext.strokeText(tmpObj.sid, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale + 40);
															mainContext.fillText(tmpObj.sid, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale + 40);
															mainContext.strokeText("Shame: " + tmpObj.shameCount, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale + 135);
															mainContext.fillText("Shame: " + tmpObj.shameCount, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale + 135);
														} else {
															mainContext.font = "20px Hammersmith One";
															mainContext.fillStyle = "#fff";
															mainContext.textBaseline = "middle";
															mainContext.textAlign = "center";
															mainContext.lineWidth = tmpObj.nameScale ? 11 : 8;
															mainContext.lineJoin = "round";
															mainContext.strokeText(tmpObj.sid, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale + 40);
															mainContext.fillText(tmpObj.sid, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale + 40);
															mainContext.strokeText("Shame: " + tmpObj.shameCount, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale + 135);
															mainContext.fillText("Shame: " + tmpObj.shameCount, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale + 135);
														}
													}
												}
												if (tracker.drawSpike.active) {
													mainContext.globalAlpha = 0.2;
													let obj = {
														x: tracker.drawSpike.x - xOffset,
														y: tracker.drawSpike.y - yOffset,
														scale: tracker.drawSpike.scale
													};
													mainContext.fillStyle = "#DD431A";
													mainContext.beginPath();
													mainContext.arc(obj.x, obj.y, obj.scale, 0, Math.PI * 2);
													mainContext.fill();
												}
												if (tracker.drawTeleport.active) {
													mainContext.globalAlpha = 0.2;
													let obj = {
														x: tracker.drawTeleport.x - xOffset,
														y: tracker.drawTeleport.y - yOffset,
														scale: tracker.drawTeleport.scale
													};
													mainContext.fillStyle = "#DD431A";
													mainContext.beginPath();
													mainContext.arc(obj.x, obj.y, obj.scale, 0, Math.PI * 2);
													mainContext.fill();
												}
												if (tmpObj.isPlayer && tmpObj.sid === player.sid && main.ReloadBars.enabled) {
													mainContext.globalAlpha = 1;
													let reloads = {
														primary: tmpObj.primaryIndex == undefined ? 1 : (items.weapons[tmpObj.primaryIndex].speed - tmpObj.reloads[tmpObj.primaryIndex]) / items.weapons[tmpObj.primaryIndex].speed,
														secondary: tmpObj.secondaryIndex == undefined ? 1 : (items.weapons[tmpObj.secondaryIndex].speed - tmpObj.reloads[tmpObj.secondaryIndex]) / items.weapons[tmpObj.secondaryIndex].speed,
														turret: (2500 - tmpObj.reloads[53]) / 2500
													};
													mainContext.fillStyle = /*tmpObj.reloads[tmpObj.weapons[0]] ? `hsl(${200 * ((items.weapons[tmpObj.weapons[0]].speed - tmpObj.reloads[tmpObj.weapons[0]]) / items.weapons[tmpObj.weapons[0]].speed) + 153}, 64%, 68%)` : */ "#6fa8dc";
													if (tmpObj.primaryIndex == undefined ? false : tmpObj.reloads[tmpObj.primaryIndex] > 0) {
														// PRIMARY RELOAD BAR:
														mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, tmpObj.y - yOffset + tmpObj.scale + config.nameY + config.healthBarPad, config.healthBarWidth * (tmpObj.reloads[tmpObj.primaryIndex] / items.weapons[tmpObj.primaryIndex].speed), 17 - config.healthBarPad * 2, 7);
														mainContext.fill();
													}
													mainContext.fillStyle = /*tmpObj.reloads[tmpObj.weapons[1]] ? `hsl(${200 * ((items.weapons[tmpObj.weapons[1]].speed - tmpObj.reloads[tmpObj.weapons[1]]) / items.weapons[tmpObj.weapons[1]].speed) + 153}, 64%, 68%)` : */ "#6fa8dc";
													if (tmpObj.secondaryIndex == undefined ? false : tmpObj.reloads[tmpObj.secondaryIndex] > 0) {
														// SECONDARY RELOAD BAR:
														mainContext.roundRect(tmpObj.x - xOffset + config.healthBarWidth * ((items.weapons[tmpObj.secondaryIndex].speed - tmpObj.reloads[tmpObj.secondaryIndex]) / items.weapons[tmpObj.secondaryIndex].speed), tmpObj.y - yOffset + tmpObj.scale + config.nameY + config.healthBarPad, config.healthBarWidth * (tmpObj.reloads[tmpObj.secondaryIndex] / items.weapons[tmpObj.secondaryIndex].speed), 17 - config.healthBarPad * 2, 7);
														mainContext.fill();
													}
												}
												if (tmpObj.isPlayer && !main.ReloadBars.enabled && lur) {
													mainContext.globalAlpha = 1;
													const RGBBarColor = HPBarColor;
													let primaryReloadProgress = tmpObj.primaryIndex !== undefined ? (items.weapons[tmpObj.primaryIndex].speed - tmpObj.reloads[tmpObj.primaryIndex]) / items.weapons[tmpObj.primaryIndex].speed : 1;
													let secondaryReloadProgress = tmpObj.secondaryIndex !== undefined ? (items.weapons[tmpObj.secondaryIndex].speed - tmpObj.reloads[tmpObj.secondaryIndex]) / items.weapons[tmpObj.secondaryIndex].speed : 1;

													// * (tmpObj.reloads[tmpObj.secondaryIndex] == undefined ? 1 : (items.weapons[tmpObj.secondaryIndex].speed - tmpReloads.secondary) / items.weapons[tmpObj.secondaryIndex].speed), (getEl("visual").value == "Main" ? 16 : 17) - config.healthBarPad * 2, 7);

													const centerX = tmpObj.x - xOffset;
													const centerY = tmpObj.y - yOffset;
													const barRadius = 35;
													const totalAngle = Math.PI; // half circle
													const secondaryStartAngle = Math.PI * 1.5;
													const secondaryEndAngle = secondaryStartAngle + totalAngle * secondaryReloadProgress;
													const primaryStartAngle = Math.PI / 2;
													const primaryEndAngle = primaryStartAngle + totalAngle * primaryReloadProgress;
												}
											}
										}
									}

									function transformURL(e) {
										return "../." + e.slice(e.indexOf("/img"), e.length);
									}

									function TEXTURE(rules) {
										return Object.fromEntries(rules = rules.map(e => Object.entries(e)).flat(1).filter(e => e[0] == "pairs").flat(1).filter(e => e != "pairs").flat(1).map(e => [transformURL(e.source.value), e.destination]), rules.filter((i, p) => rules.indexOf(i) == p), rules);
									}
									const localTexture = [{
										creationDate: 1539776483046,
										description: "",
										groupId: "",
										id: "Redirect_1539776483046",
										name: "Halloween",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/GB4qvv0.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_23.png"
											}
										}, {
											destination: "https://i.imgur.com/A3HllcC.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_46.png"
											}
										}, {
											destination: "https://i.imgur.com/ABHSOd9.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_48.png"
											}
										}, {
											destination: "https://i.imgur.com/cvb9q8g.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_4.png"
											}
										}, {
											destination: "https://i.imgur.com/gGGkBnz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_27.png"
											}
										}, {
											destination: "https://i.imgur.com/GB4qvv0.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_23.png"
											}
										}, {
											destination: "https://i.imgur.com/A3HllcC.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_46.png"
											}
										}, {
											destination: "https://i.imgur.com/ABHSOd9.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_48.png"
											}
										}, {
											destination: "https://i.imgur.com/cvb9q8g.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_4.png"
											}
										}, {
											destination: "https://i.imgur.com/gGGkBnz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_27.png"
											}
										}, {
											destination: "https://i.imgur.com/GB4qvv0.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_23.png"
											}
										}, {
											destination: "https://i.imgur.com/A3HllcC.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_46.png"
											}
										}, {
											destination: "https://i.imgur.com/ABHSOd9.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_48.png"
											}
										}, {
											destination: "https://i.imgur.com/cvb9q8g.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_4.png"
											}
										}, {
											destination: "https://i.imgur.com/gGGkBnz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_27.png"
											}
										}, {
											destination: "https://i.imgur.com/GB4qvv0.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_23.png"
											}
										}, {
											destination: "https://i.imgur.com/A3HllcC.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_46.png"
											}
										}, {
											destination: "https://i.imgur.com/ABHSOd9.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_48.png"
											}
										}, {
											destination: "https://i.imgur.com/cvb9q8g.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_4.png"
											}
										}, {
											destination: "https://i.imgur.com/gGGkBnz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_27.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1537058120972,
										description: "",
										groupId: "",
										id: "Redirect_1537058120972",
										name: "Texture Pack Sandbox - Ruby",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/CDAmjux.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/dagger_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UY7SV7j.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/tmUzurk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/oRXUfW8.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/6ayjbIz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/vxLZW0S.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UZ2HcQw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/kr8H9g7.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/V9dzAbF.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/aEs3FSU.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/DRzBdFX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/7kbtWfk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/wV42LEE.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/CDAmjux.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/dagger_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UY7SV7j.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/tmUzurk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/oRXUfW8.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/6ayjbIz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/vxLZW0S.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UZ2HcQw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/kr8H9g7.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/V9dzAbF.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/aEs3FSU.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/DRzBdFX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/7kbtWfk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/wV42LEE.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_r.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1537030341343,
										description: "",
										groupId: "",
										id: "Redirect_1537030341343",
										name: "Texture Pack Private - Ruby",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/CDAmjux.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/dagger_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UY7SV7j.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/spear_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/tmUzurk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/great_hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/oRXUfW8.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/6ayjbIz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/bat_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/vxLZW0S.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/samurai_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UZ2HcQw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/great_axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/kr8H9g7.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/V9dzAbF.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/sword_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/aEs3FSU.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/stick_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/DRzBdFX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/grab_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/7kbtWfk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/grab_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/wV42LEE.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/grab_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/CDAmjux.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/dagger_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UY7SV7j.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/spear_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/tmUzurk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/great_hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/oRXUfW8.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/6ayjbIz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/bat_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/vxLZW0S.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/samurai_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UZ2HcQw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/great_axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/kr8H9g7.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/V9dzAbF.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/sword_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/aEs3FSU.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/stick_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/DRzBdFX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/grab_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/7kbtWfk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/grab_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/wV42LEE.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/grab_1_r.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1536927560373,
										description: "",
										groupId: "",
										id: "Redirect_1536927560373",
										name: "Texture Pack - Ruby",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/CDAmjux.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/dagger_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UY7SV7j.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/tmUzurk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/oRXUfW8.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/6ayjbIz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/vxLZW0S.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UZ2HcQw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/kr8H9g7.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/V9dzAbF.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/aEs3FSU.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/DRzBdFX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/7kbtWfk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/wV42LEE.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/CDAmjux.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/dagger_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UY7SV7j.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/tmUzurk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/oRXUfW8.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/hammer_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/6ayjbIz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/vxLZW0S.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/UZ2HcQw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/kr8H9g7.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/axe_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/V9dzAbF.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/aEs3FSU.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_r.png"
											}
										}, {
											destination: "https://i.imgur.com/DRzBdFX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/7kbtWfk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/wV42LEE.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/grab_1_r.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1530619393230,
										description: "",
										groupId: "",
										id: "Redirect_1530619393230",
										name: "Texture Pack Sandbox - Weapons - Part 2",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/DVjCdwI.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/crossbow_2_d.png"
											}
										}, {
											destination: "https://i.imgur.com/DVjCdwI.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/crossbow_2_d.png"
											}
										}, {
											destination: "https://i.imgur.com/qu7HHT5.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/qu7HHT5.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/HSWcyku.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/HSWcyku.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/TRqDlgX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/crossbow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/TRqDlgX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/crossbow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/OU5os0h.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/OU5os0h.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/aAJyHBB.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/aAJyHBB.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/WPWU8zC.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/WPWU8zC.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/Fg93gj3.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/Fg93gj3.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/hSqLP3t.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/shield_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/hSqLP3t.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/shield_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/4ZxIJQM.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/4ZxIJQM.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/h5jqSRp.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/h5jqSRp.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/wOTr8TG.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/QKBc2ou.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/wOTr8TG.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/QKBc2ou.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/jKDdyvc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/jKDdyvc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_g.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1530619364482,
										description: "",
										groupId: "",
										id: "Redirect_1530619364482",
										name: "Texture Pack Sandbox - Weapons - Part 1",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/DTd8Xl6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/DTd8Xl6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/RnkmWgs.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/RnkmWgs.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/ROTb7Ks.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/dagger_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/ROTb7Ks.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/dagger_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/ivLPh10.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/ivLPh10.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/phXTNsa.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/phXTNsa.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_d.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1530619326443,
										description: "",
										groupId: "",
										id: "Redirect_1530619326443",
										name: "Texture Pack Sandbox - Hats",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/pe3Yx3F.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_40.png"
											}
										}, {
											destination: "https://i.imgur.com/in5H6vw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_18.png"
											}
										}, {
											destination: "https://i.imgur.com/PvZNc9Q.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/accessories/access_21.png"
											}
										}, {
											destination: "https://i.imgur.com/sULkUZT.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/accessories/access_19.png"
											}
										}, {
											destination: "https://i.imgur.com/gJY7sM6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_9.png"
											}
										}, {
											destination: "https://i.imgur.com/uYgDtcZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_16.png"
											}
										}, {
											destination: "https://i.imgur.com/JPMqgSc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_31.png"
											}
										}, {
											destination: "https://i.imgur.com/vAOzlyY.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_7.png"
											}
										}, {
											destination: "https://i.imgur.com/vM9Ri8g.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_6.png"
											}
										}, {
											destination: "https://i.imgur.com/YRQ8Ybq.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_15.png"
											}
										}, {
											destination: "https://i.imgur.com/EwkbsHN.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_13.png"
											}
										}, {
											destination: "https://i.imgur.com/VSUId2s.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_12.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11.png"
											}
										}, {
											destination: "https://i.imgur.com/f5uhWCk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_20.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14_top.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11_top.png"
											}
										}, {
											destination: "https://i.imgur.com/pe3Yx3F.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_40.png"
											}
										}, {
											destination: "https://i.imgur.com/in5H6vw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_18.png"
											}
										}, {
											destination: "https://i.imgur.com/gJY7sM6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_9.png"
											}
										}, {
											destination: "https://i.imgur.com/PvZNc9Q.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/accessories/access_21.png"
											}
										}, {
											destination: "https://i.imgur.com/sULkUZT.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/accessories/access_19.png"
											}
										}, {
											destination: "https://i.imgur.com/vAOzlyY.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_7.png"
											}
										}, {
											destination: "https://i.imgur.com/vM9Ri8g.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_6.png"
											}
										}, {
											destination: "https://i.imgur.com/uYgDtcZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_16.png"
											}
										}, {
											destination: "https://i.imgur.com/JPMqgSc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_31.png"
											}
										}, {
											destination: "https://i.imgur.com/YRQ8Ybq.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_15.png"
											}
										}, {
											destination: "https://i.imgur.com/EwkbsHN.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_13.png"
											}
										}, {
											destination: "https://i.imgur.com/VSUId2s.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_12.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11.png"
											}
										}, {
											destination: "https://i.imgur.com/f5uhWCk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_20.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11_top.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14_top.png"
											}
										}, {
											destination: "https://i.imgur.com/I0xGtyZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_26.png"
											}
										}, {
											destination: "https://i.imgur.com/I0xGtyZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_26.png"
											}
										}, {
											destination: "https://i.imgur.com/hmJrVQz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_52.png"
											}
										}, {
											destination: "https://i.imgur.com/hmJrVQz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_52.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1530619290416,
										description: "",
										groupId: "",
										id: "Redirect_1530619290416",
										name: "Texture Pack Sandbox - Animals",
										objectType: "rule",
										pairs: [{
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/bull_2.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animal"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/wolf_1.png"
											}
										}, {
											destination: "https://i.imgur.com/wANrStd.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/wolf_2.png"
											}
										}, {
											destination: "https://i.imgur.com/wANrStd.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/wolf_2.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/cow_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/pig_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/chicken_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/bull_2.png"
											}
										}, {
											destination: "https://i.imgur.com/eKlFlSj.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/bull_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/wolf_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/cow_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/pig_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/chicken_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/enemy.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/enemy.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1526664529663,
										description: "",
										groupId: "",
										id: "Redirect_1526664529663",
										name: "Texture Pack Private - Weapons - Part 2",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/DVjCdwI.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/crossbow_2_d.png"
											}
										}, {
											destination: "https://i.imgur.com/DVjCdwI.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/crossbow_2_d.png"
											}
										}, {
											destination: "https://i.imgur.com/qu7HHT5.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/bow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/qu7HHT5.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/bow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/HSWcyku.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/spear_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/HSWcyku.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/spear_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/TRqDlgX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/crossbow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/TRqDlgX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/crossbow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/OU5os0h.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/OU5os0h.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/aAJyHBB.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/great_axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/aAJyHBB.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/great_axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/WPWU8zC.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/WPWU8zC.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/Fg93gj3.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/great_hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/Fg93gj3.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/great_hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/hSqLP3t.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/shield_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/hSqLP3t.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/shield_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/4ZxIJQM.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/samurai_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/4ZxIJQM.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/samurai_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/h5jqSRp.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/sword_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/h5jqSRp.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/sword_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/wOTr8TG.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/sword_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/QKBc2ou.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/samurai_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/wOTr8TG.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/sword_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/QKBc2ou.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/samurai_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/jKDdyvc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/spear_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/jKDdyvc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/spear_1_g.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1526664492125,
										description: "",
										groupId: "",
										id: "Redirect_1526664492125",
										name: "Texture Pack - Weapons - Part 2",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/TRqDlgX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/crossbow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/TRqDlgX.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/crossbow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/OU5os0h.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/OU5os0h.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/aAJyHBB.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/aAJyHBB.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_axe_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/WPWU8zC.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/WPWU8zC.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/Fg93gj3.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/Fg93gj3.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/great_hammer_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/4ZxIJQM.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/4ZxIJQM.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/hSqLP3t.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/shield_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/hSqLP3t.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/shield_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/h5jqSRp.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/h5jqSRp.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/wOTr8TG.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/QKBc2ou.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/wOTr8TG.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/sword_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/QKBc2ou.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/samurai_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/jKDdyvc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/jKDdyvc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_g.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1514047471157,
										description: "",
										groupId: "",
										id: "Redirect_1514047471157",
										name: "Texture Pack Private - Animals",
										objectType: "rule",
										pairs: [{
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/animals/bull_2.png"
											}
										}, {
											destination: "https://i.imgur.com/eKlFlSj.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/animals/bull_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/animals/wolf_1.png"
											}
										}, {
											destination: "https://i.imgur.com/wANrStd.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/animals/wolf_2.png"
											}
										}, {
											destination: "https://i.imgur.com/wANrStd.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/animals/wolf_2.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/animals/cow_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/animals/pig_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/animals/chicken_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/animals/bull_2.png"
											}
										}, {
											destination: "https://i.imgur.com/eKlFlSj.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/animals/bull_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/animals/wolf_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/animals/cow_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/animals/pig_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/animals/chicken_1.png"
											}
										}, {
											destination: "https://i.imgur.com/MKOvEr6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/animals/enemy.png"
											}
										}, {
											destination: "https://i.imgur.com/MKOvEr6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/animals/enemy.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1514046266836,
										description: "",
										groupId: "",
										id: "Redirect_1514046266836",
										name: "Texture Pack - Animals",
										objectType: "rule",
										pairs: [{
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/bull_2.png"
											}
										}, {
											destination: "https://imgur.com/3tsGyzZ",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/bull_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/wolf_1.png"
											}
										}, {
											destination: "https://i.imgur.com/wANrStd.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/wolf_2.png"
											}
										}, {
											destination: "https://i.imgur.com/wANrStd.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/wolf_2.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/cow_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/pig_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/chicken_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/bull_2.png"
											}
										}, {
											destination: "https://i.imgur.com/eKlFlSj.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/bull_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/wolf_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/cow_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/pig_1.png"
											}
										}, {
											destination: "",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/chicken_1.png"
											}
										}, {
											destination: "https://i.imgur.com/MKOvEr6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/enemy.png"
											}
										}, {
											destination: "https://i.imgur.com/MKOvEr6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/animals/enemy.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1509892380958,
										description: "",
										groupId: "",
										id: "Redirect_1509892380958",
										name: "Texture Pack Private - Weapons - Part 1",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/DTd8Xl6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/stick_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/DTd8Xl6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/stick_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/RnkmWgs.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/stick_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/RnkmWgs.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/stick_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/ROTb7Ks.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/dagger_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/ROTb7Ks.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/dagger_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/ivLPh10.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/bat_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/ivLPh10.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/bat_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/phXTNsa.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/weapons/bat_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/phXTNsa.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/weapons/bat_1_d.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1509804753627,
										description: "",
										groupId: "",
										id: "Redirect_1509804753627",
										name: "Texture Pack - Weapons - Part 1",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/DTd8Xl6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/DTd8Xl6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/RnkmWgs.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/RnkmWgs.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/stick_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/ivLPh10.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/ivLPh10.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_g.png"
											}
										}, {
											destination: "https://i.imgur.com/phXTNsa.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/phXTNsa.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bat_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/ROTb7Ks.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/dagger_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/ROTb7Ks.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/dagger_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/qu7HHT5.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/qu7HHT5.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/bow_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/DVjCdwI.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/crossbow_2_d.png"
											}
										}, {
											destination: "https://i.imgur.com/DVjCdwI.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/crossbow_2_d.png"
											}
										}, {
											destination: "https://i.imgur.com/HSWcyku.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_d.png"
											}
										}, {
											destination: "https://i.imgur.com/HSWcyku.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/weapons/spear_1_d.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1508326116062,
										description: "",
										groupId: "",
										id: "Redirect_1508326116062",
										name: "Texture Pack Private - Hats",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/pe3Yx3F.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_40.png"
											}
										}, {
											destination: "https://i.imgur.com/in5H6vw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_18.png"
											}
										}, {
											destination: "https://i.imgur.com/PvZNc9Q.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/accessories/access_21.png"
											}
										}, {
											destination: "https://i.imgur.com/sULkUZT.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/accessories/access_19.png"
											}
										}, {
											destination: "https://i.imgur.com/gJY7sM6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_9.png"
											}
										}, {
											destination: "https://i.imgur.com/uYgDtcZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_16.png"
											}
										}, {
											destination: "https://i.imgur.com/JPMqgSc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_31.png"
											}
										}, {
											destination: "https://i.imgur.com/vAOzlyY.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_7.png"
											}
										}, {
											destination: "https://i.imgur.com/vM9Ri8g.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_6.png"
											}
										}, {
											destination: "https://i.imgur.com/YRQ8Ybq.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_15.png"
											}
										}, {
											destination: "https://i.imgur.com/EwkbsHN.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_13.png"
											}
										}, {
											destination: "https://i.imgur.com/VSUId2s.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_12.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_11.png"
											}
										}, {
											destination: "https://i.imgur.com/f5uhWCk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_20.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_11_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_14_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_14.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_14_top.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_11_top.png"
											}
										}, {
											destination: "https://i.imgur.com/pe3Yx3F.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_40.png"
											}
										}, {
											destination: "https://i.imgur.com/in5H6vw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_18.png"
											}
										}, {
											destination: "https://i.imgur.com/gJY7sM6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_9.png"
											}
										}, {
											destination: "https://i.imgur.com/PvZNc9Q.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/accessories/access_21.png"
											}
										}, {
											destination: "https://i.imgur.com/sULkUZT.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/accessories/access_19.png"
											}
										}, {
											destination: "https://i.imgur.com/vAOzlyY.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_7.png"
											}
										}, {
											destination: "https://i.imgur.com/vM9Ri8g.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_6.png"
											}
										}, {
											destination: "https://i.imgur.com/uYgDtcZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_16.png"
											}
										}, {
											destination: "https://i.imgur.com/JPMqgSc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_31.png"
											}
										}, {
											destination: "https://i.imgur.com/YRQ8Ybq.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_15.png"
											}
										}, {
											destination: "https://i.imgur.com/EwkbsHN.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_13.png"
											}
										}, {
											destination: "https://i.imgur.com/VSUId2s.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_12.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_11.png"
											}
										}, {
											destination: "https://i.imgur.com/f5uhWCk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_20.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_11_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_14_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_14.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_11_top.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_14_top.png"
											}
										}, {
											destination: "https://i.imgur.com/I0xGtyZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_26.png"
											}
										}, {
											destination: "https://i.imgur.com/I0xGtyZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_26.png"
											}
										}, {
											destination: "https://i.imgur.com/hmJrVQz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "http://dev.moomoo.io/img/hats/hat_52.png"
											}
										}, {
											destination: "https://i.imgur.com/hmJrVQz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: "https://dev.moomoo.io/img/hats/hat_52.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}, {
										creationDate: 1507417062355,
										description: "",
										groupId: "",
										id: "Redirect_1507417062355",
										name: "Texture Pack - Hats",
										objectType: "rule",
										pairs: [{
											destination: "https://i.imgur.com/pe3Yx3F.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_40.png"
											}
										}, {
											destination: "https://i.imgur.com/PvZNc9Q.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/accessories/access_21.png"
											}
										}, {
											destination: "https://i.imgur.com/sULkUZT.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/accessories/access_19.png"
											}
										}, {
											destination: "https://i.imgur.com/in5H6vw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_18.png"
											}
										}, {
											destination: "https://i.imgur.com/gJY7sM6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_9.png"
											}
										}, {
											destination: "https://i.imgur.com/vAOzlyY.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_7.png"
											}
										}, {
											destination: "https://i.imgur.com/vM9Ri8g.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_6.png"
											}
										}, {
											destination: "https://i.imgur.com/uYgDtcZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_16.png"
											}
										}, {
											destination: "https://i.imgur.com/JPMqgSc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_31.png"
											}
										}, {
											destination: "https://i.imgur.com/YRQ8Ybq.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_15.png"
											}
										}, {
											destination: "https://i.imgur.com/EwkbsHN.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_13.png"
											}
										}, {
											destination: "https://i.imgur.com/VSUId2s.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_12.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11.png"
											}
										}, {
											destination: "https://i.imgur.com/f5uhWCk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_20.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14_top.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11_top.png"
											}
										}, {
											destination: "https://i.imgur.com/pe3Yx3F.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_40.png"
											}
										}, {
											destination: "https://i.imgur.com/vAOzlyY.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_7.png"
											}
										}, {
											destination: "https://i.imgur.com/vM9Ri8g.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_6.png"
											}
										}, {
											destination: "https://i.imgur.com/uYgDtcZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_16.png"
											}
										}, {
											destination: "https://i.imgur.com/gJY7sM6.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_9.png"
											}
										}, {
											destination: "https://i.imgur.com/JPMqgSc.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_31.png"
											}
										}, {
											destination: "https://i.imgur.com/PvZNc9Q.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/accessories/access_21.png"
											}
										}, {
											destination: "https://i.imgur.com/sULkUZT.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/accessories/access_19.png"
											}
										}, {
											destination: "https://i.imgur.com/YRQ8Ybq.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_15.png"
											}
										}, {
											destination: "https://i.imgur.com/EwkbsHN.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_13.png"
											}
										}, {
											destination: "https://i.imgur.com/VSUId2s.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_12.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11.png"
											}
										}, {
											destination: "https://i.imgur.com/in5H6vw.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_18.png"
											}
										}, {
											destination: "https://i.imgur.com/f5uhWCk.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_20.png"
											}
										}, {
											destination: "https://i.imgur.com/yfqME8H.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14_p.png"
											}
										}, {
											destination: "https://i.imgur.com/V8JrIwv.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_11_top.png"
											}
										}, {
											destination: "https://i.imgur.com/s7Cxc9y.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_14_top.png"
											}
										}, {
											destination: "https://i.imgur.com/I0xGtyZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_26.png"
											}
										}, {
											destination: "https://i.imgur.com/I0xGtyZ.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_26.png"
											}
										}, {
											destination: "https://i.imgur.com/hmJrVQz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_52.png"
											}
										}, {
											destination: "https://i.imgur.com/hmJrVQz.png",
											source: {
												key: "Url",
												operator: "Contains",
												value: ".././img/hats/hat_52.png"
											}
										}],
										ruleType: "Redirect",
										status: "Active"
									}];
									packs = TEXTURE(localStorage.getItem("texture") ? JSON.parse(localStorage.getItem("texture")) : localTexture);
									// RENDER GAME OBJECTS:
									function renderGameObjects(layer, xOffset, yOffset) {
										let tmpSprite;
										let tmpX;
										let tmpY;
										gameObjects.forEach(tmp => {
											tmpObj = tmp;
											if (tmpObj.alive) {
												tmpX = tmpObj.x + tmpObj.xWiggle - xOffset;
												tmpY = tmpObj.y + tmpObj.yWiggle - yOffset;
												if (layer == 0) {
													tmpObj.update(delta);
												}
												mainContext.globalAlpha = tmpObj.alpha;
												if (tmpObj.layer == layer && isOnScreen(tmpX, tmpY, tmpObj.scale + (tmpObj.blocker || 0))) {
													if (tmpObj.isItem) {
														if ((tmpObj.dmg || tmpObj.trap) && !tmpObj.isTeamObject(player)) {
															tmpSprite = getObjSprite(tmpObj);
														} else {
															tmpSprite = getItemSprite(tmpObj);
														}
														mainContext.save();
														mainContext.translate(tmpX, tmpY);
														if (ae86 && tmpObj.name != "boost Pad" && tmpObj.name != "turret") {} else {
															mainContext.rotate(tmpObj.dir);
														}
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
														mainContext.drawImage(tmpSprite, tmpX - tmpSprite.width / 2, tmpY - tmpSprite.height / 2);
													}
												}
												// BUILDING HEALTH:
												if (player && tmpObj.active && tmpObj.health && main.BuildHealth.enabled > 0 && !ae86 && !fz && layer == 3) {
													const healthRatio = tmpObj.health / tmpObj.maxHealth;
													if (tmpObj && tmpObj.active && UTILS.getDistance(tmpObj.x, tmpObj.y, player.x, player.y) <= 400) {
														var tmpWidth = config.healthBarWidth;
														mainContext.fillStyle = "#000";
														mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth / 2 - config.healthBarPad - 5, tmpObj.y - yOffset - config.healthBarPad - 4, config.healthBarWidth + config.healthBarPad * 2 + 6, 19, 9);
														mainContext.fill();
														// HEALTH BAR:
														mainContext.fillStyle = player.sid != tmpObj.owner.sid && !findAllianceBySid(tmpObj.owner.sid) ? "#C12D5F" : "#2187C0";
														mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth / 2 - 5, tmpObj.y - yOffset - 2 - config.healthBarPad / 2, (config.healthBarWidth + 6) * healthRatio, 19 - config.healthBarPad * 2, 8);
														mainContext.fill();
													}
													if (tmpObj && tmpObj.active && UTILS.getDistance(tmpObj.x, tmpObj.y, player.x, player.y) <= 400 && lur) {
														// PLAYER SID OWNER
														mainContext.font = "16px Hammersmith One";
														mainContext.fillStyle = player.sid != tmpObj.owner.sid && !findAllianceBySid(tmpObj.owner.sid) ? "#C12D5F" : "#2187C0";
														mainContext.textBaseline = "middle";
														mainContext.textAlign = "center";
														mainContext.strokeStyle = "#000";
														mainContext.lineWidth = 6;
														mainContext.lineJoin = "round";
														mainContext.strokeText(tmpObj.owner.sid, tmpObj.x - xOffset, tmpObj.y - yOffset + 30);
														mainContext.fillText(tmpObj.owner.sid, tmpObj.x - xOffset, tmpObj.y - yOffset + 30);
													}
												}
											}
										});
										// PLACE VISIBLE:
										if (layer == 0) {
											let lastPlace = null;
											let mark = true;
											if (placeVisible.length) {
												placeVisible.forEach(places => {
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

									function drawArrow(xOffset, yOffset, x, y, arrowWidth, color, angle, lineWidth) {
										mainContext.save();
										mainContext.translate(x - xOffset, y - yOffset);
										mainContext.rotate(Math.PI / 4);
										mainContext.rotate(angle);
										mainContext.globalAlpha = 1;
										mainContext.strokeStyle = color;
										mainContext.lineCap = "round";
										mainContext.lineWidth = lineWidth;
										mainContext.beginPath();
										mainContext.moveTo(-arrowWidth, -arrowWidth);
										mainContext.lineTo(arrowWidth, -arrowWidth);
										mainContext.lineTo(arrowWidth, arrowWidth);
										mainContext.stroke();
										mainContext.closePath();
										mainContext.restore();
									}
									if (player && my.autoPush) {
										mainContext.lineWidth = 5;
										mainContext.globalAlpha = 1;
										mainContext.lineJoin = "round";
										mainContext.beginPath();
										mainContext.strokeStyle = "white";
										mainContext.moveTo(player.x - xOffset, player.y - yOffset);
										mainContext.lineTo(my.pushData.x2 - xOffset, my.pushData.y2 - yOffset);
										mainContext.lineTo(my.pushData.x - xOffset, my.pushData.y - yOffset);
										mainContext.closePath();
										mainContext.stroke();
									}
									mainContext.globalAlpha = 1;
									// RENDER ANIM TEXTS:
									textManager.update(delta, mainContext, xOffset, yOffset);
									// RENDER CHAT MESSAGES:
									for (let i = 0; i < players.length; ++i) {
										tmpObj = players[i];
										if (tmpObj.visible) {
											if (tmpObj.chatCountdown > 0) {
												tmpObj.chatCountdown -= delta;
												if (tmpObj.chatCountdown <= 0) {
													tmpObj.chatCountdown = 0;
												}
												mainContext.font = "32px Hammersmith One";
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
												if (!main.RealDir.enabled) {
													tmpObj.chat.count -= delta;
													if (tmpObj.chat.count <= 0) {
														tmpObj.chat.count = 0;
													}
													mainContext.font = "32px Hammersmith One";
													let tmpSize = mainContext.measureText(tmpObj.chat.message);
													mainContext.textBaseline = "middle";
													mainContext.textAlign = "center";
													let tmpX = tmpObj.x - xOffset;
													let tmpY = tmpObj.y - tmpObj.scale - yOffset + 180;
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
										allChats.filter(ch => ch.active).forEach(ch => {
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
												mainContext.font = "20px Hammersmith One";
												let tmpSize = mainContext.measureText(ch.chat);
												mainContext.textBaseline = "middle";
												mainContext.textAlign = "center";
												let tmpX = ch.owner.x - xOffset;
												let tmpY = ch.owner.y - ch.owner.scale - yOffset - 90;
												let tmpH = 47;
												let tmpW = tmpSize.width + 17;
												mainContext.globalAlpha = ch.alpha;
												mainContext.fillStyle = ch.owner.isTeam(player) ? "rgba(255,215,0,1)" : "#cc5151";
												mainContext.strokeStyle = "rgb(25, 25, 25)";
												mainContext.lineWidth = 5;
												mainContext.fillStyle = "rgba(0,0,0,0.4)";
												mainContext.strokeStyle = "rgba(0,0,0,0.0)";
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
								}
								mainContext.globalAlpha = 1;
								// RENDER MINIMAP:
								renderMinimap(delta);
							}
							// UPDATE & ANIMATE:
							window.requestAnimFrame = function() {
								return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(callback) {
									window.setTimeout(callback, 1000 / 240);
								};
							};
							window.rAF = function() {
								return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(callback) {
									window.setTimeout(callback, 1000 / 240);
								};
							}();

							function doUpdate() {
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
								updateGame();
								rAF(doUpdate);
							}
							prepareMenuBackground();
							doUpdate();

							let changeDays = {};
							window.onload = function() {
								addChatLog("💙 | Script Loaded.", "#6fa8dc", "", "#6fa8dc");
							};
							window.debug = function() {
								my.waitHit = 0;
								my.autoAim = false;
								instaC.isTrue = false;
								traps.inTrap = false;
								itemSprites = [];
								objSprites = [];
								gameObjectSprites = [];
							};
							window.toggleNight = function() {
								isNight = !isNight;
								itemSprites = [];
								objSprites = [];
								gameObjectSprites = [];
							};
							window.startGrind = function() {
								if (false) {
									for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
										checkPlace(player.getItemType(22), i);
									}
								}
							};
							window.toggleVisual = function() {
								config.anotherVisual = !config.anotherVisual;
								gameObjects.forEach(tmp => {
									if (tmp.active) {
										tmp.dir = tmp.lastDir;
									}
								});
							};
							window.prepareUI = function(tmpObj) {
								resize();
								// ACTION BAR:
								UTILS.removeAllChildren(actionBar);
								for (let i = 0; i < items.weapons.length + items.list.length; ++i) {
									(function(i) {
										UTILS.generateElement({
											id: "actionBarItem" + i,
											class: "actionBarItem",
											style: "display:none",
											onmouseout: function() {
												showItemInfo();
											},
											parent: actionBar
										});
									})(i);
								}
								for (let i = 0; i < items.list.length + items.weapons.length; ++i) {
									(function(i) {
										let tmpCanvas = document.createElement("canvas");
										tmpCanvas.width = tmpCanvas.height = 66;
										let tmpContext = tmpCanvas.getContext("2d");
										tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
										tmpContext.imageSmoothingEnabled = false;
										tmpContext.webkitImageSmoothingEnabled = false;
										tmpContext.mozImageSmoothingEnabled = false;
										if (items.weapons[i]) {
											tmpContext.rotate(Math.PI / 4 + Math.PI);
											let tmpSprite = new Image();
											toolSprites[items.weapons[i].src] = tmpSprite;
											tmpSprite.onload = function() {
												this.isLoaded = true;
												let tmpPad = 1 / (this.height / this.width);
												let tmpMlt = items.weapons[i].iPad || 1;
												tmpContext.drawImage(this, -(tmpCanvas.width * tmpMlt * config.iconPad * tmpPad) / 2, -(tmpCanvas.height * tmpMlt * config.iconPad) / 2, tmpCanvas.width * tmpMlt * tmpPad * config.iconPad, tmpCanvas.height * tmpMlt * config.iconPad);
												tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
												tmpContext.globalCompositeOperation = "source-atop";
												tmpContext.fillRect(-tmpCanvas.width / 2, -tmpCanvas.height / 2, tmpCanvas.width, tmpCanvas.height);
												getEl("actionBarItem" + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
											};
											tmpSprite.src = tp("./../img/weapons/" + items.weapons[i].src + ".png");
											let tmpUnit = getEl("actionBarItem" + i);
											tmpUnit.onmouseover = UTILS.checkTrusted(function() {
												showItemInfo(items.weapons[i], true);
											});
											tmpUnit.onclick = UTILS.checkTrusted(function() {
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
											getEl("actionBarItem" + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
											let tmpUnit = getEl("actionBarItem" + i);
											tmpUnit.onmouseover = UTILS.checkTrusted(function() {
												showItemInfo(items.list[i - items.weapons.length]);
											});
											tmpUnit.onclick = UTILS.checkTrusted(function() {
												selectToBuild(tmpObj.items[tmpObj.getItemType(i - items.weapons.length)]);
											});
											UTILS.hookTouchEvents(tmpUnit);
										}
									})(i);
								}
							};
							window.profineTest = function(data) {
								if (data) {
									// SET INITIAL NAME:
									let noname = "unknown";
									// VALIDATE NAME:
									let name = localStorage.vape_name;
									let langFilter = {
										list: [],
										exclude: [],
										placeHolder: "*",
										regex: {},
										replaceRegex: {}
									};
									let isProfane = false;
									let convertedName = name.toLowerCase().replace(/\s/g, "").replace(/1/g, "i").replace(/0/g, "o").replace(/5/g, "s");
									for (let word of langFilter.list) {
										if (convertedName.indexOf(word) != -1) {
											isProfane = true;
											break;
										}
									}
									if (name.length > 0 && !isProfane) {
										noname = name;
									}
									return noname;
								}
							};
							window.toggleNight();
						},
						webgl_test: () => {
							return;
							let canvas = document.createElement("canvas");
							canvas.id = "WEBGL";
							canvas.width = canvas.height = 300;
							canvas.style = `
            position: relative;
            bottom: 70%;
            left: 70%;
            pointer-events: none;
            `;
							let fat = document.createElement("div");
							fat.id = "faku";
							fat.width = fat.height = 300;
							fat.style = `
            position: relative;
            bottom: 70%;
            left: 70%;
            pointer-events: none;
            font-size: 20px;
            `;
							fat.innerHTML = "Webgl Test Rendering";
							let gl = canvas.getContext("webgl");
							if (!gl) {
								alert("urbad");
								return;
							}
							document.body.append(canvas);
							document.body.append(fat);
							log(gl);
							gl.clearColor(0, 0, 0, 0.2);
							gl.clear(gl.COLOR_BUFFER_BIT);
							let buffer = gl.createBuffer();
							gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

							function render(vs, fs, vertice, type) {
								let vShader = gl.createShader(gl.VERTEX_SHADER);
								gl.shaderSource(vShader, vs);
								gl.compileShader(vShader);
								gl.getShaderParameter(vShader, gl.COMPILE_STATUS);
								let fShader = gl.createShader(gl.FRAGMENT_SHADER);
								gl.shaderSource(fShader, fs);
								gl.compileShader(fShader);
								gl.getShaderParameter(fShader, gl.COMPILE_STATUS);
								let program = gl.createProgram();
								gl.attachShader(program, vShader);
								gl.attachShader(program, fShader);
								gl.linkProgram(program);
								gl.getProgramParameter(program, gl.LINK_STATUS);
								gl.useProgram(program);
								let vertex = gl.getAttribLocation(program, "vertex");
								gl.enableVertexAttribArray(vertex);
								gl.vertexAttribPointer(vertex, 2, gl.FLOAT, false, 0, 0);
								let vertices = vertice.length / 2;
								gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertice), gl.DYNAMIC_DRAW);
								gl.drawArrays(type, 0, vertices);
							}

							function hexToRgb(hex) {
								return hex.slice(1).match(/.{1,2}/g).map(g => parseInt(g, 16));
							}

							function getRgb(r, g, b) {
								return [r / 255, g / 255, b / 255].join(", ");
							}
							let max = 50;
							for (let i = 0; i < max; i++) {
								let radian = Math.PI * (i / (max / 2));
								render(`
                precision mediump float;
attribute vec2 vertex;
void main(void) {
          gl_Position = vec4(vertex, 0, 1);
}
`, `
                precision mediump float;
void main(void) {
          gl_FragColor = vec4(${getRgb(...hexToRgb("#cc5151"))}, 1);
}
`, [
									// moveto, lineto
									0 + Math.cos(radian) * 0.5, 0 + Math.sin(radian) * 0.5, 0, 0
								], gl.LINE_LOOP);
							}
						}
					};
					if (codes) {
						for (let code in codes) {
							let func = codes[code];
							if (typeof func === "function") {
								func();
							}
						}
						window.initClient = function() {
							if (!useHack) {
								useHack = true;
								codes.VapeClient();
							}
						};
					}
				})(1);
			})();
		})();
	}
})();