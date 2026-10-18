const fs = require('fs');
const path = require('path');

const pkgDist = path.resolve(__dirname, '../node_modules/.pnpm/@sapphi-red+web-noise-suppressor@0.4.1/node_modules/@sapphi-red/web-noise-suppressor/dist');
const outDir = path.resolve(__dirname, '../packages/web/public/worklets');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. GTCRN
let gtcrn = fs.readFileSync(path.join(pkgDist, 'gtcrn/workletProcessor.js'), 'utf8');
const targetG = 'this.port.addEventListener(`message`,e=>{e.data===`destroy`&&this.destroy()})';
if (!gtcrn.includes(targetG)) {
  console.error('Target string not found in GTCRN worklet!');
  process.exit(1);
}
const fixedG = 'this.port.onmessage = (e) => { if (e.data === `destroy`) this.destroy(); }; this.port.start()';
gtcrn = gtcrn.replace(targetG, fixedG);
gtcrn += '\ntry { registerProcessor("nuvio-gtcrn-processor", s); } catch (e) {}';
fs.writeFileSync(path.join(outDir, 'gtcrn-worklet.js'), gtcrn, 'utf8');
console.log('Successfully created gtcrn-worklet.js');

// 2. RNNoise
let rnnoise = fs.readFileSync(path.join(pkgDist, 'rnnoise/workletProcessor.js'), 'utf8');
const targetR = 'this.port.addEventListener(`message`,e=>{e.data===`destroy`&&this.destroy()})';
if (!rnnoise.includes(targetR)) {
  console.error('Target string not found in RNNoise worklet!');
  process.exit(1);
}
const fixedR = 'this.port.onmessage = (e) => { if (e.data === `destroy`) this.destroy(); }; this.port.start()';
rnnoise = rnnoise.replace(targetR, fixedR);
rnnoise += '\ntry { registerProcessor("nuvio-rnnoise-processor", m); } catch (e) {}';
fs.writeFileSync(path.join(outDir, 'rnnoise-worklet.js'), rnnoise, 'utf8');
console.log('Successfully created rnnoise-worklet.js');
