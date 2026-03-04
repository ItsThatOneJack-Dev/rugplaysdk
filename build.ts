import { build } from "bun";

const userscriptHeader = `// ==UserScript==
// @name         RugplaySDK (RPSDK$)
// @namespace    https://itoj.dev
// @version      2.0
// @description  RugplaySDK
// @author       ItsThatOneJack
// @match        *://*.rugplay.com/*
// @updateURL    https://raw.githubusercontent.com/ItsThatOneJack-Dev/rugplaysdk/refs/heads/main/RugplaySDK.user.js
// @downloadURL  https://raw.githubusercontent.com/ItsThatOneJack-Dev/rugplaysdk/refs/heads/main/RugplaySDK.user.js
// @icon         https://itoj.dev/embed/icons/RPSDK$.png
// @grant        none
// ==/UserScript==\n\n`;

const baseDomainDefinition =
    'const BASE_DOMAIN = "rugplay.com";\nconst BASE_WS_DOMAIN = "ws."+BASE_DOMAIN;\n\n';

// Userscript build
await build({
    entrypoints: ["src/index.ts"],
    outdir: "dist",
    naming: "rugplaySDK.user.js",
    target: "browser",
    format: "iife",
    external: ["https://esm.sh/*"],
});

const userscriptOut = await Bun.file("dist/rugplaySDK.user.js").text();
await Bun.write(
    "dist/rugplaySDK.user.js",
    userscriptHeader + baseDomainDefinition + userscriptOut,
);
console.log("Built dist/rugplaySDK.user.js");

// Server build
await build({
    entrypoints: ["src/index.server.ts"],
    outdir: "dist",
    naming: "rugplaySDK.server.js",
    target: "bun",
    external: ["https://esm.sh/*"],
});

const serverOut = await Bun.file("dist/rugplaySDK.server.js").text();
await Bun.write("dist/rugplaySDK.server.js", baseDomainDefinition + serverOut);
console.log("Built dist/rugplaySDK.server.js");
