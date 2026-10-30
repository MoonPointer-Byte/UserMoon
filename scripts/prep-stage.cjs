const fs = require("fs");
const { execSync } = require("child_process");
const root = "D:/个人项目/UserMoon";
let classic = execSync("git show HEAD:src/pages/HomePage.tsx", { cwd: root }).toString("utf8");
classic = classic.replace("export function HomePage", "export function ClassicHome");
fs.writeFileSync(`${root}/src/pages/ClassicHome.tsx`, classic);
let bg = fs.readFileSync(`${root}/tmp-simon-bg.js`, "utf8");
bg = bg.replace(
  'var canvas=document.getElementById("background")',
  'var canvas=window.__STAGE_CANVAS||document.getElementById("background")',
);
fs.mkdirSync(`${root}/public`, { recursive: true });
fs.writeFileSync(`${root}/public/stage-fluid.js`, bg);
console.log("classic", classic.length, "fluid", bg.length);
