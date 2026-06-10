// Headless smoke test for the reef tank sim.
// Stubs the DOM/canvas, evals the page script, and drives the game through
// growth, fragging, orders, pests, and a save/load round-trip.
//
//   node test/smoke.js
const fs = require('fs');
const path = require('path');

// ---- DOM / browser stubs ----
function makeCtx() {
  return new Proxy({}, {
    get: (o, k) => {
      if (k === 'getImageData') return () => ({ data: [0, 0, 0, 255] });
      if (typeof k !== 'string') return undefined;
      return () => undefined;
    },
    set: () => true,
  });
}

function makeEl(tag) {
  return {
    tagName: tag, children: [], style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 720 }; },
    innerHTML: '', textContent: '', value: '3', width: 0, height: 0,
    id: '', className: '', checked: false,
    getContext() { return makeCtx(); },
    onclick: null, onchange: null,
  };
}

const elements = {};
global.document = {
  getElementById(id) { return elements[id] || (elements[id] = makeEl('div')); },
  createElement(tag) { return makeEl(tag); },
  querySelectorAll() { return []; },
  addEventListener() {},
};
global.window = global;
global.addEventListener = () => {};
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; },
};
global.requestAnimationFrame = () => 1;

// ---- load page script ----
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

const test = `
;(function(){
  const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg); };

  // --- setup: terrain, colonies, livestock ---
  cash = 1000;
  setCell(5, 5, 1, ROCK); setCell(10, 8, 1, ROCK); setCell(20, 10, 1, ROCK);
  computeLightMap();
  dipEnabled = true;
  const acro = createColony(0, 5, 5, 2);      // branching
  const monti = createColony(3, 10, 8, 2);    // encrusting
  const hammer = createColony(9, 20, 10, 2);  // lps_branch
  assert(acro && monti && hammer, 'colonies created');
  for (let i = 0; i < 40; i++) simulateDay();
  assert(acro.growthState.voxels.length > 10, 'branching grew');
  assert(monti.growthState.voxels.length > 10, 'encrusting grew');
  assert(acro.growthState.voxels[0].nmask !== undefined, 'nmask cached');
  assert(acro.growthState.voxels[0].fillTop !== undefined, 'colors cached');

  buyFish(0); buyFish(5);   // clown + wrasse
  buyInvert(0); buyInvert(4); // snail + peppermint
  assert(fish.length === 2 && inverts.length === 2, 'livestock bought');
  updateFish(100); updateInverts(100);
  render(); render();

  // --- frag rack: cut, sell, replant ---
  const topVox = acro.voxels.reduce((a, b) => (b.z > a.z ? b : a));
  const cashBefore = cash;
  fragVoxelAt(topVox.x, topVox.y, topVox.z);
  assert(rack.length >= 1, 'frag landed on rack');
  assert(cash === cashBefore, 'fragging itself pays nothing');
  const item0 = rack[0];
  const v0 = fragSaleValue(item0);
  sellFrag(0);
  assert(cash === cashBefore + v0, 'sellFrag paid ' + v0);

  // --- frag cut takes only the clicked branch, not the whole layer ---
  // Hand-built Y-shaped colony: trunk splits into two branches at z=3.
  setCell(15, 5, 1, ROCK);
  const ycol = createColony(0, 15, 5, 2, { free: true, noPest: true });
  const ygs = ycol.growthState;
  ygs.voxels = [
    [0,0,0],[0,0,1],[0,0,2],                            // trunk
    [-1,0,3],[-2,0,4],[-3,0,5],[-3,0,6],[-3,0,7],[-3,0,8], // branch A (left)
    [1,0,3],[2,0,4],[3,0,5],[3,0,6],[3,0,7],[3,0,8],       // branch B (right)
  ].map(p => ({ x: p[0], y: p[1], z: p[2], shell: 0, isTip: false, isPolyp: false }));
  ygs.voxSet = new Set(ygs.voxels.map(v => v.x + ',' + v.y + ',' + v.z));
  ygs.tips = [
    { x: -3, y: 0, z: 8, dx: 0, dy: 0, dz: 1, gen: 5, maxGen: 60 },
    { x: 3, y: 0, z: 8, dx: 0, dy: 0, dz: 1, gen: 5, maxGen: 60 },
  ];
  syncColonyMacro(ycol);
  computeLightMap(); rebuildSubVoxelMap(); rebuildLookup();
  // Branch A's top sits in macro cell (14, 5, 4): subvox x [-3,0), z [6,9)
  assert(isCoralCell(getCell(14, 5, 4)), 'branch A macro cell is coral');
  const rackBefore = rack.length;
  fragVoxelAt(14, 5, 4);
  assert(rack.length === rackBefore + 1, 'branch frag landed on rack');
  assert(rack[rack.length - 1].size === 3, 'cut exactly the clicked branch tip (got ' + rack[rack.length - 1].size + 'sv)');
  assert(ygs.voxSet.has('3,0,8'), 'sibling branch at same height survived');
  assert(ygs.voxSet.has('-3,0,5'), 'clicked branch below the cut survived');
  assert(ygs.tips.length === 1 && Math.round(ygs.tips[0].x) === 3, 'only the cut branch lost its tip');
  rack.pop();
  removeColony(ycol.id);

  rack.push({ speciesId: 0, size: 60, health: 1 });
  const nCol = colonies.length;
  const c2 = createColony(0, 10, 8, 2, { free: true, noPest: true, health: 1, boost: 60 });
  assert(c2 && colonies.length === nCol + 1, 'replant created colony');
  rack.pop();

  // --- orders ---
  rack.push({ speciesId: 0, size: 50, health: 1 }, { speciesId: 0, size: 50, health: 1 });
  orders.push({ id: 999, speciesId: 0, count: 2, minSize: 30, pricePer: 10,
                delivered: 0, accepted: true, offerEnd: day + 15, deadline: day + 30 });
  const repBefore = rep, cashBefore2 = cash;
  deliverOrder(999);
  assert(rep === Math.min(100, repBefore + 3), 'rep increased on completion');
  assert(cash === cashBefore2 + 20 + 4, 'order paid 2x$10 + $4 bonus');
  assert(!orders.find(o => o.id === 999), 'completed order removed');

  // order expiry penalty
  orders.push({ id: 998, speciesId: 0, count: 2, minSize: 30, pricePer: 10,
                delivered: 0, accepted: true, offerEnd: day - 1, deadline: day - 1 });
  const repBefore2 = rep;
  simulateOrders();
  assert(rep === Math.max(0, repBefore2 - 5), 'rep dropped on expiry');

  // --- pests ---
  assert(spawnAiptasiaNear(5, 5, 2), 'aiptasia spawned near rock');
  let aipCount = 0;
  for (let x = 0; x < TANK_W; x++) for (let y = 0; y < TANK_D; y++) for (let z = 0; z < TANK_H; z++)
    if (grid[x][y][z] === AIPTASIA) aipCount++;
  assert(aipCount >= 1, 'aiptasia present');
  hammer.flatworms = 0.5;
  const hpBefore = hammer.health;
  simulatePests();
  assert(hammer.health < hpBefore, 'flatworms sap health');
  // wrasse grazing clears flatworms over time
  for (let i = 0; i < 40; i++) simulatePests();
  assert(hammer.flatworms === 0, 'wrasse cleared flatworms');
  render();

  // --- save / load round-trip ---
  saveGame();
  const snap = {
    day, cash: Math.round(cash * 100), rep,
    nCol: colonies.length, nFish: fish.length, nInv: inverts.length,
    vox: colonies.map(c => c.growthState.voxels.length),
    macro: colonies.map(c => c.voxels.length),
    rack: rack.length, orders: orders.length,
  };
  let solidBefore = 0;
  for (let x = 0; x < TANK_W; x++) for (let y = 0; y < TANK_D; y++) for (let z = 0; z < TANK_H; z++)
    if (grid[x][y][z] !== EMPTY) solidBefore++;

  clearTank(); // wipe everything
  assert(colonies.length === 0 && day === 0, 'clearTank wiped state');

  assert(loadGame(), 'loadGame succeeded');
  assert(day === snap.day, 'day restored');
  assert(Math.round(cash * 100) === snap.cash, 'cash restored');
  assert(rep === snap.rep, 'rep restored');
  assert(colonies.length === snap.nCol, 'colony count restored');
  assert(fish.length === snap.nFish && inverts.length === snap.nInv, 'livestock restored');
  assert(rack.length === snap.rack && orders.length === snap.orders, 'rack/orders restored');
  colonies.forEach((c, i) => {
    assert(c.growthState.voxels.length === snap.vox[i],
      'growth voxels restored for ' + c.species.name + ' (' + c.growthState.voxels.length + ' vs ' + snap.vox[i] + ')');
    assert(c.voxels.length === snap.macro[i], 'macro voxels restored for ' + c.species.name);
  });
  let solidAfter = 0;
  for (let x = 0; x < TANK_W; x++) for (let y = 0; y < TANK_D; y++) for (let z = 0; z < TANK_H; z++)
    if (grid[x][y][z] !== EMPTY) solidAfter++;
  assert(solidAfter === solidBefore, 'grid occupancy restored (' + solidAfter + ' vs ' + solidBefore + ')');

  // loaded game keeps running
  for (let i = 0; i < 10; i++) simulateDay();
  render();

  console.log('SMOKE OK — day ' + day + ', ' + colonies.length + ' colonies, score ' + score + ', rep ' + rep);
})();
`;

(0, eval)(code + test);
console.log('save size: ' + Math.round((store.reefTankSave || '').length / 1024) + ' KB');
process.exit(0);
