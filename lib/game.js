export const miniGame = [{
  title: "Bet",
  html: `<!DOCTYPE html>
<html lang='en'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
<style>
:root{--card-2:#2a3942;--ink:#e9edef;--muted:#8696a0;--accent:#00a884;--line:#2a3942;--cell-bg:#111b21;
--sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow:hidden;touch-action:none;}
.stage{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;}
.card{width:100%;max-width:360px;}
.header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);}
.header__title{font-size:17px;font-weight:600;}
.header__sub{font-size:12px;color:var(--muted);}
.stats{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:14px;}
.stats b{color:var(--ink);font-weight:600;margin-left:4px;}
.wrap{position:relative;background:var(--cell-bg);border:1px solid var(--line);border-radius:10px;overflow:hidden;}
canvas{display:block;width:100%;}
.overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:rgba(11,20,26,0.75);}
.overlay h2{font-size:19px;text-align:center;padding:0 16px;}
.overlay button{background:var(--accent);border:none;border-radius:8px;color:#0b141a;font-weight:700;font-family:inherit;padding:10px 22px;font-size:14px;cursor:pointer;}
.hint{font-size:11px;color:var(--muted);text-align:center;margin-top:10px;}
</style>
</head>
<body>
<main class='stage'>
  <div class='card'>
    <div class='header'>
      <div class='header__title'>SILA Brick Breaker</div>
      <div class='header__sub'>Drag paddle</div>
    </div>
    <div class='stats'><span>Score<b id='score'>0</b></span><span>Lives<b id='lives'>3</b></span><span>Best<b id='best'>0</b></span></div>
    <div class='wrap' id='wrap'>
      <canvas id='canvas' width='320' height='420'></canvas>
      <div class='overlay' id='overlay'>
        <h2 id='ov-title'>SILA Brick Breaker</h2>
        <button id='ov-btn'>Start</button>
      </div>
    </div>
    <div class='hint'>Drag left/right on the board to move the paddle</div>
  </div>
</main>
<script>
(function(){
const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const overlay=document.getElementById('overlay');
const ovTitle=document.getElementById('ov-title');
const ovBtn=document.getElementById('ov-btn');
let paddle,ball,bricks,score,lives,best=0,running=false,rows=5,cols=7;
const brickW=(W-20)/cols,brickH=16,brickGap=4;
const COLORS=['#f2593f','#f2a13f','#f2c265','#00c2a0','#00a884'];

function reset(){
  paddle={w:70,h:10,x:W/2-35,y:H-24};
  ball={x:W/2,y:H-40,r:6,dx:3.4,dy:-3.4};
  bricks=[];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      bricks.push({x:10+c*brickW,y:40+r*(brickH+brickGap),w:brickW-brickGap,h:brickH,alive:true,color:COLORS[r%COLORS.length]});
    }
  }
  score=0;lives=3;
  document.getElementById('score').textContent='0';
  document.getElementById('lives').textContent='3';
}
function start(){
  reset();
  running=true;
  overlay.style.display='none';
  loop();
}
function loseLife(){
  lives--;
  document.getElementById('lives').textContent=lives;
  if(lives<=0){ return gameOver(false); }
  ball={x:W/2,y:H-40,r:6,dx:3.4,dy:-3.4};
  paddle.x=W/2-35;
}
function gameOver(won){
  running=false;
  if(score>best) best=score;
  document.getElementById('best').textContent=best;
  ovTitle.textContent=won?'You cleared it! Score '+score:'Game over — Score '+score;
  ovBtn.textContent='Play again';
  overlay.style.display='flex';
}
function update(){
  ball.x+=ball.dx;ball.y+=ball.dy;
  if(ball.x-ball.r<0||ball.x+ball.r>W) ball.dx*=-1;
  if(ball.y-ball.r<0) ball.dy*=-1;
  if(ball.y+ball.r>paddle.y&&ball.y-ball.r<paddle.y+paddle.h&&ball.x>paddle.x&&ball.x<paddle.x+paddle.w){
    ball.dy=-Math.abs(ball.dy);
    const hitPos=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);
    ball.dx=hitPos*4.2;
  }
  if(ball.y-ball.r>H) return loseLife();
  let alive=0;
  for(const b of bricks){
    if(!b.alive) continue;
    alive++;
    if(ball.x+ball.r>b.x&&ball.x-ball.r<b.x+b.w&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+b.h){
      b.alive=false;
      ball.dy*=-1;
      score+=10;
      document.getElementById('score').textContent=score;
      break;
    }
  }
  if(alive===0) gameOver(true);
}
function draw(){
  ctx.fillStyle='#0e3a5f';
  ctx.fillRect(0,0,W,H);
  bricks.forEach(b=>{
    if(!b.alive) return;
    ctx.fillStyle=b.color;
    ctx.fillRect(b.x,b.y,b.w,b.h);
  });
  ctx.fillStyle='#e9edef';
  ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);
  ctx.beginPath();
  ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);
  ctx.fillStyle='#00a884';
  ctx.fill();
}
function loop(){
  if(!running) return;
  update();
  if(running){
    draw();
    requestAnimationFrame(loop);
  }
}
function movePaddleTo(clientX){
  const rect=canvas.getBoundingClientRect();
  const scale=W/rect.width;
  let x=(clientX-rect.left)*scale-paddle.w/2;
  x=Math.max(0,Math.min(W-paddle.w,x));
  paddle.x=x;
}
canvas.addEventListener('pointerdown',(e)=>{ if(running) movePaddleTo(e.clientX); });
canvas.addEventListener('pointermove',(e)=>{ if(running&&e.buttons) movePaddleTo(e.clientX); });
document.getElementById('wrap').addEventListener('touchmove',(e)=>{
  if(running){ movePaddleTo(e.touches[0].clientX); e.preventDefault(); }
},{passive:false});
ovBtn.addEventListener('click',start);
draw();
})();
</script>
</body>
</html>`
}, {
  title: "Bricks",
  html: `<style>
:root {
  --bg-dark: #000000;
  --card-bg: #0d0f12;
  --panel-bg: #181b20;
  --input-bg: #000000;
  --accent-red: #e50914;
  --accent-green: #28a745;
  --accent-gold: #f5b000;
  --text-main: #ffffff;
  --text-muted: #8e8e93;
  --sys: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
html, body { background: var(--bg-dark); color: var(--text-main); font-family: var(--sys); min-height: 100vh; overflow: hidden; touch-action: none; }
.stage { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px; }
.card { width: 100%; max-width: 360px; background: var(--card-bg); border-radius: 12px; padding: 10px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 10px 30px rgba(0,0,0,0.8); }

/* Header */
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.header__title { font-size: 16px; font-weight: 800; color: var(--accent-red); display: flex; align-items: center; gap: 4px; }
.balance-val { font-size: 15px; font-weight: 800; color: #fff; }

/* Multiplier History Pills */
.history-bar { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 8px; padding-bottom: 2px; scrollbar-width: none; }
.history-bar::-webkit-scrollbar { display: none; }
.pill { background: #1c2230; color: #5c84ff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; white-space: nowrap; }
.pill.purple { color: #c05cff; }

/* Display Area */
.display-area { position: relative; width: 100%; aspect-ratio: 16/11; background: radial-gradient(circle at center, #131924 0%, #080a0f 100%); border-radius: 8px; overflow: hidden; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05); }
canvas { width: 100%; height: 100%; display: block; }
.mult-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 42px; font-weight: 900; color: #fff; pointer-events: none; }
.mult-overlay.crashed { color: var(--accent-red); font-size: 20px; }

/* Bet Controls Panel */
.bet-panel { background: var(--panel-bg); border-radius: 12px; padding: 10px; }
.tabs { display: flex; justify-content: center; gap: 16px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; }
.tab { font-size: 12px; font-weight: 700; color: var(--text-muted); cursor: pointer; position: relative; padding-bottom: 2px; }
.tab.active { color: #fff; }
.tab.active::after { content: ''; position: absolute; bottom: -6px; left: 0; width: 100%; height: 2px; background: var(--accent-red); }

.controls-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

/* Left Input Box */
.input-box { background: var(--input-bg); border-radius: 8px; padding: 6px; display: flex; flex-direction: column; justify-content: space-between; gap: 6px; border: 1px solid rgba(255,255,255,0.1); }
.stepper { display: flex; align-items: center; justify-content: space-between; }
.step-btn { background: #22262c; color: #fff; border: none; border-radius: 50%; width: 22px; height: 22px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.bet-val-display { font-size: 14px; font-weight: 800; color: #fff; }
.preset-btns { display: flex; gap: 4px; }
.preset-btn { flex: 1; background: #22262c; color: var(--text-muted); border: none; border-radius: 4px; font-size: 9px; font-weight: 700; padding: 4px 0; cursor: pointer; text-align: center; }

/* Right Big Bet Button */
.main-bet-btn { background: var(--accent-green); border: none; border-radius: 10px; color: #fff; font-weight: 800; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px; cursor: pointer; transition: opacity 0.2s; }
.main-bet-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.main-bet-btn.cashout { background: var(--accent-gold); color: #000; }
.btn-title { font-size: 15px; }
.btn-sub { font-size: 12px; opacity: 0.9; }

.msg { text-align: center; font-size: 11px; font-weight: 600; margin-top: 6px; min-height: 14px; color: var(--accent-gold); }
</style>

<div class='stage'>
  <div class='card'>
    <div class='header'>
      <span class='header__title'>✈️ Sila Aviator</span>
      <div class='balance-val' id='balance'>10,000.00 TZS</div>
    </div>

    <div class='history-bar' id='historyBar'>
      <span class='pill'>1.03x</span>
      <span class='pill purple'>2.53x</span>
      <span class='pill'>1.72x</span>
      <span class='pill'>1.11x</span>
      <span class='pill purple'>4.55x</span>
      <span class='pill'>1.75x</span>
    </div>

    <div class='display-area'>
      <canvas id='skyCanvas'></canvas>
      <div class='mult-overlay' id='multDisplay'>1.00x</div>
    </div>

    <div class='bet-panel'>
      <div class='tabs'>
        <span class='tab active'>Place Bet</span>
        <span class='tab'>Auto</span>
      </div>

      <div class='controls-grid'>
        <div class='input-box'>
          <div class='stepper'>
            <button class='step-btn' id='minus-btn'>-</button>
            <span class='bet-val-display' id='bet-display'>5,000.00</span>
            <button class='step-btn' id='plus-btn'>+</button>
          </div>
          <div class='preset-btns'>
            <button class='preset-btn' data-val='1000'>1,000</button>
            <button class='preset-btn' data-val='5000'>5,000</button>
            <button class='preset-btn' data-val='10000'>10,000</button>
          </div>
        </div>

        <button class='main-bet-btn' id='main-btn'>
          <span class='btn-title'>Place Bet</span>
          <span class='btn-sub' id='btn-sub-val'>5,000.00 TZS</span>
        </button>
      </div>
    </div>

    <div class='msg' id='msg'>Place your bet to start!</div>
  </div>
</div>

<script>
(function() {
  const canvas = document.getElementById('skyCanvas');
  const ctx = canvas.getContext('2d');
  const balanceEl = document.getElementById('balance');
  const betDisplay = document.getElementById('bet-display');
  const btnSubVal = document.getElementById('btn-sub-val');
  const mainBtn = document.getElementById('main-btn');
  const multDisplay = document.getElementById('multDisplay');
  const msgEl = document.getElementById('msg');
  const historyBar = document.getElementById('historyBar');

  let width, height;
  function resize() {
    width = canvas.width = canvas.parentElement.clientWidth;
    height = canvas.height = canvas.parentElement.clientHeight;
  }
  resize();

  let balance = 10000;
  let betAmount = 5000;
  let multiplier = 1.00;
  let crashPoint = 0;
  let gameInterval = null;
  let isFlying = false;
  let cashedOut = false;
  let planeProgress = 0;

  function updateUI() {
    balanceEl.textContent = balance.toLocaleString('en-US', {minimumFractionDigits: 2}) + ' TZS';
    betDisplay.textContent = betAmount.toLocaleString('en-US', {minimumFractionDigits: 2});
    if (!isFlying) {
      btnSubVal.textContent = betAmount.toLocaleString('en-US', {minimumFractionDigits: 2}) + ' TZS';
    }
  }

  function drawScene(progress, crashed = false) {
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 25) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    if (!isFlying && progress === 0) return;

    let startX = 10;
    let startY = height - 10;
    let currentX = startX + (width - 40) * Math.min(progress, 1);
    let currentY = startY - (height - 30) * Math.min(progress, 1);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(startX + (currentX - startX) / 2, startY, currentX, currentY);
    ctx.strokeStyle = crashed ? '#e50914' : '#e50914';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.lineTo(currentX, height);
    ctx.lineTo(startX, height);
    ctx.fillStyle = crashed ? 'rgba(229, 9, 20, 0.1)' : 'rgba(229, 9, 20, 0.2)';
    ctx.fill();

    if (!crashed) {
      ctx.font = '18px serif';
      ctx.fillText('✈️', currentX - 10, currentY + 5);
    }
  }

  function startFlight() {
    if (betAmount > balance) {
      msgEl.textContent = 'Insufficient balance!';
      msgEl.style.color = 'var(--accent-red)';
      return;
    }

    balance -= betAmount;
    updateUI();

    let rand = Math.random();
    crashPoint = rand < 0.1 ? 1.00 : parseFloat((1 + Math.pow(Math.random(), 2.5) * 8).toFixed(2));

    multiplier = 1.00;
    planeProgress = 0;
    isFlying = true;
    cashedOut = false;

    multDisplay.classList.remove('crashed');
    multDisplay.textContent = '1.00x';
    msgEl.textContent = 'Plane taking off...';
    msgEl.style.color = 'var(--accent-gold)';

    mainBtn.className = 'main-bet-btn cashout';
    mainBtn.querySelector('.btn-title').textContent = 'Cash Out';

    gameInterval = setInterval(() => {
      planeProgress += 0.012;
      multiplier += 0.01 + (multiplier * 0.01);

      if (multiplier >= crashPoint) {
        crashGame();
      } else {
        multDisplay.textContent = multiplier.toFixed(2) + 'x';
        if (!cashedOut) {
          let currentWin = (betAmount * multiplier).toFixed(2);
          btnSubVal.textContent = parseFloat(currentWin).toLocaleString() + ' TZS';
        }
        drawScene(planeProgress, false);
      }
    }, 70);
  }

  function cashOut() {
    if (!isFlying || cashedOut) return;

    cashedOut = true;
    let winAmount = Math.floor(betAmount * multiplier);
    balance += winAmount;
    updateUI();

    msgEl.textContent = '🎉 Cashed out ' + winAmount.toLocaleString() + ' TZS';
    msgEl.style.color = 'var(--accent-green)';

    mainBtn.disabled = true;
    mainBtn.querySelector('.btn-title').textContent = 'Cashed Out';
  }

  function crashGame() {
    clearInterval(gameInterval);
    isFlying = false;

    multDisplay.classList.add('crashed');
    multDisplay.textContent = 'FLEW AWAY @ ' + crashPoint.toFixed(2) + 'x';

    drawScene(planeProgress, true);

    if (!cashedOut) {
      msgEl.textContent = '💥 Flew Away!';
      msgEl.style.color = 'var(--accent-red)';
    }

    // Add to history
    const pill = document.createElement('span');
    pill.className = 'pill' + (crashPoint >= 2.0 ? ' purple' : '');
    pill.textContent = crashPoint.toFixed(2) + 'x';
    historyBar.prepend(pill);

    resetControls();
  }

  function resetControls() {
    mainBtn.disabled = false;
    mainBtn.className = 'main-bet-btn';
    mainBtn.querySelector('.btn-title').textContent = 'Place Bet';
    updateUI();
  }

  // Event Listeners
  document.getElementById('minus-btn').onclick = () => {
    if (isFlying) return;
    if (betAmount > 1000) betAmount -= 1000;
    updateUI();
  };
  document.getElementById('plus-btn').onclick = () => {
    if (isFlying) return;
    betAmount += 1000;
    updateUI();
  };

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = () => {
      if (isFlying) return;
      betAmount = parseInt(btn.dataset.val);
      updateUI();
    };
  });

  mainBtn.onclick = () => {
    if (!isFlying) startFlight();
    else if (!cashedOut) cashOut();
  };

  updateUI();
  drawScene(0);
})();
</script>`
}, {
  title: "Strike Ops",
  html: `<!DOCTYPE html>
<html lang='en'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
<style>
:root{--card-2:#2a3942;--ink:#e9edef;--muted:#8696a0;--accent:#00a884;--line:#2a3942;--cell-bg:#111b21;
--sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow:hidden;touch-action:none;}
.stage{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;}
.card{width:100%;max-width:360px;}
.header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);}
.header__title{font-size:17px;font-weight:600;}
.header__sub{font-size:12px;color:var(--muted);}
.bars{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.barwrap{flex:1;height:10px;background:var(--cell-bg);border:1px solid var(--line);border-radius:6px;overflow:hidden;}
.bar{height:100%;width:100%;background:var(--accent);transition:width .15s ease;}
.tag{font-size:11px;color:var(--muted);width:30px;}
.stats{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:10px;}
.stats b{color:var(--ink);font-weight:600;margin-left:4px;}
.wrap{position:relative;background:#141c14;border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 10px 30px -10px rgba(0,0,0,.6);}
canvas{display:block;width:100%;}
.overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:rgba(11,20,26,0.82);}
.overlay h2{font-size:19px;text-align:center;padding:0 16px;}
.overlay p{font-size:12px;color:var(--muted);text-align:center;padding:0 20px;}
.overlay button{background:var(--accent);border:none;border-radius:8px;color:#0b141a;font-weight:700;font-family:inherit;padding:10px 22px;font-size:14px;cursor:pointer;}
.controls{display:grid;grid-template-columns:repeat(3,1fr) auto auto;gap:6px;margin-top:12px;align-items:center;}
.pad{display:grid;grid-template-columns:repeat(3,36px);grid-template-rows:repeat(3,36px);gap:3px;grid-column:span 3;}
.pad button{background:var(--card-2);border:1px solid #374248;border-radius:6px;color:var(--ink);font-size:13px;cursor:pointer;}
.pad button:active{background:var(--accent);}
.actions{display:flex;flex-direction:column;gap:6px;grid-column:span 2;}
.fire{background:#e05c5c;border:none;border-radius:8px;color:#fff;font-weight:700;font-family:inherit;padding:12px 0;font-size:13px;cursor:pointer;}
.fire:active{background:#b84444;}
.reload{background:var(--card-2);border:1px solid #374248;border-radius:8px;color:var(--ink);font-family:inherit;padding:8px 0;font-size:11px;cursor:pointer;}
.hint{font-size:10px;color:var(--muted);text-align:center;margin-top:8px;}
</style>
</head>
<body>
<main class='stage'>
  <div class='card'>
    <div class='header'>
      <div class='header__title'>SILA Strike Ops</div>
      <div class='header__sub'>Wave defense</div>
    </div>
    <div class='bars'>
      <span class='tag'>HP</span>
      <div class='barwrap'><div class='bar' id='hp'></div></div>
    </div>
    <div class='stats'>
      <span>Score<b id='score'>0</b></span>
      <span>Wave<b id='wave'>1</b></span>
      <span>Ammo<b id='ammo'>12/12</b></span>
      <span>Best<b id='best'>0</b></span>
    </div>
    <div class='wrap' id='wrap'>
      <canvas id='canvas' width='320' height='340'></canvas>
      <div class='overlay' id='overlay'>
        <h2 id='ov-title'>SILA Strike Ops</h2>
        <p id='ov-sub'>Hold enemies off as long as you can. Auto-aims at the nearest target.</p>
        <button id='ov-btn'>Deploy</button>
      </div>
    </div>
    <div class='controls'>
      <div class='pad'>
        <span></span><button id='up'>▲</button><span></span>
        <button id='left'>◀</button><span></span><button id='right'>▶</button>
        <span></span><button id='down'>▼</button><span></span>
      </div>
      <div class='actions'>
        <button class='fire' id='fire'>🔫 FIRE</button>
        <button class='reload' id='reload'>RELOAD</button>
      </div>
    </div>
    <div class='hint'>Move with the pad, hold FIRE to shoot the nearest enemy</div>
  </div>
</main>
<script>
(function(){
const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const overlay=document.getElementById('overlay');
const ovTitle=document.getElementById('ov-title');
const ovSub=document.getElementById('ov-sub');
const ovBtn=document.getElementById('ov-btn');
const hpEl=document.getElementById('hp');
const scoreEl=document.getElementById('score');
const waveEl=document.getElementById('wave');
const ammoEl=document.getElementById('ammo');
const bestEl=document.getElementById('best');
const MAG=12;
let player,enemies,bullets,particles,move,firing,reloading,best=0,running=false,frame=0;
let score,wave,killsThisWave,ammo,reloadTimer;

function reset(){
  player={x:W/2,y:H/2,r:11,hp:100,speed:2.4,fireCd:0,ang:0,walkPhase:0,hitFlash:0};
  enemies=[];bullets=[];particles=[];
  move={x:0,y:0};firing=false;reloading=false;
  score=0;wave=1;killsThisWave=0;ammo=MAG;reloadTimer=0;frame=0;
  updateHUD();
}
function updateHUD(){
  hpEl.style.width=Math.max(0,player.hp)+'%';
  scoreEl.textContent=score;
  waveEl.textContent=wave;
  ammoEl.textContent=(reloading?'...':ammo)+'/'+MAG;
}
function start(){
  reset();running=true;overlay.style.display='none';loop();
}
function gameOver(){
  running=false;
  if(score>best) best=score;
  bestEl.textContent=best;
  ovTitle.textContent='Overrun! Score '+score;
  ovSub.textContent='Wave '+wave+' — kills: '+score;
  ovBtn.textContent='Redeploy';
  overlay.style.display='flex';
}
function spawnEnemy(){
  const side=Math.floor(Math.random()*4);
  let x,y;
  if(side===0){x=Math.random()*W;y=-20;}
  else if(side===1){x=Math.random()*W;y=H+20;}
  else if(side===2){x=-20;y=Math.random()*H;}
  else {x=W+20;y=Math.random()*H;}
  const hard=Math.random()<Math.min(0.5,0.1+wave*0.04);
  enemies.push({x,y,r:hard?13:10,hp:hard?3:1,maxHp:hard?3:1,speed:hard?1.0:1.4+Math.random()*0.4,hard,ang:0,walkPhase:Math.random()*10,hitFlash:0});
}
function nearestEnemy(){
  let best=null,bd=Infinity;
  for(const e of enemies){
    const d=Math.hypot(e.x-player.x,e.y-player.y);
    if(d<bd){bd=d;best=e;}
  }
  return best;
}
function tryFire(){
  if(reloading||ammo<=0||player.fireCd>0) return;
  const target=nearestEnemy();
  if(!target) return;
  const dx=target.x-player.x,dy=target.y-player.y;
  const len=Math.hypot(dx,dy)||1;
  bullets.push({x:player.x,y:player.y,vx:dx/len*7,vy:dy/len*7,life:60});
  ammo--;
  player.fireCd=8;
  player.ang=Math.atan2(dy,dx);
  updateHUD();
  particles.push({x:player.x+dx/len*20,y:player.y+dy/len*20,r:7,life:1,type:'flash'});
  if(ammo<=0) startReload();
}
function startReload(){
  if(reloading) return;
  reloading=true;
  updateHUD();
  reloadTimer=90;
}
function update(){
  frame++;
  if(player.fireCd>0) player.fireCd--;
  if(player.hitFlash>0) player.hitFlash--;
  if(reloading){
    reloadTimer--;
    if(reloadTimer<=0){ reloading=false; ammo=MAG; updateHUD(); }
  }
  if(firing) tryFire();
  const movingMag=Math.hypot(move.x,move.y);
  player.x+=move.x*player.speed;
  player.y+=move.y*player.speed;
  player.x=Math.max(player.r,Math.min(W-player.r,player.x));
  player.y=Math.max(player.r,Math.min(H-player.r,player.y));
  if(movingMag>0){
    player.walkPhase+=0.35;
    const target0=nearestEnemy();
    if(!target0) player.ang=Math.atan2(move.y,move.x);
  }
  const spawnRate=Math.max(22,60-wave*4);
  if(frame%spawnRate===0) spawnEnemy();
  enemies.forEach(e=>{
    const dx=player.x-e.x,dy=player.y-e.y;
    const len=Math.hypot(dx,dy)||1;
    e.x+=dx/len*e.speed;
    e.y+=dy/len*e.speed;
    e.ang=Math.atan2(dy,dx);
    e.walkPhase+=e.speed*0.32;
    if(e.hitFlash>0) e.hitFlash--;
  });
  bullets.forEach(b=>{b.x+=b.vx;b.y+=b.vy;b.life--;});
  bullets=bullets.filter(b=>b.life>0&&b.x>-10&&b.x<W+10&&b.y>-10&&b.y<H+10);
  for(const b of bullets){
    for(const e of enemies){
      if(Math.hypot(b.x-e.x,b.y-e.y)<e.r){
        e.hp--;
        e.hitFlash=6;
        b.life=0;
        for(let i=0;i<4;i++) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*2.2,vy:(Math.random()-0.5)*2.2,r:2+Math.random()*2,life:1,type:'blood'});
        break;
      }
    }
  }
  bullets=bullets.filter(b=>b.life>0);
  const before=enemies.length;
  enemies.forEach(e=>{ if(e.hp<=0){ score+=e.hard?3:1; killsThisWave++; } });
  enemies=enemies.filter(e=>e.hp>0);
  if(before!==enemies.length) updateHUD();
  for(const e of enemies){
    if(Math.hypot(e.x-player.x,e.y-player.y)<e.r+player.r){
      player.hp-=e.hard?0.7:0.4;
      player.hitFlash=8;
      e.hp=0;
      for(let i=0;i<4;i++) particles.push({x:player.x,y:player.y,vx:(Math.random()-0.5)*2.2,vy:(Math.random()-0.5)*2.2,r:2+Math.random()*2,life:1,type:'blood'});
    }
  }
  enemies=enemies.filter(e=>e.hp>0);
  if(player.hp<=0){ updateHUD(); return gameOver(); }
  if(killsThisWave>=8+wave*2){
    wave++;killsThisWave=0;updateHUD();
  }
  particles.forEach(p=>{
    p.life-=0.06;
    if(p.type==='blood'){ p.x+=p.vx; p.y+=p.vy; p.vx*=0.9; p.vy*=0.9; }
  });
  particles=particles.filter(p=>p.life>0);
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function drawSoldier(x,y,ang,walkPhase,r,vestLight,vestDark,helmet,hitFlash){
  ctx.save();
  ctx.translate(x,y);
  ctx.globalAlpha=0.32;
  ctx.fillStyle='#000';
  ctx.beginPath();ctx.ellipse(0,r*0.55,r*1.05,r*0.42,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;
  ctx.rotate(ang);
  const swing=Math.sin(walkPhase)*r*0.55;
  ctx.strokeStyle='#20261f';
  ctx.lineWidth=r*0.34;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-r*0.18,r*0.1);ctx.lineTo(-r*0.18+swing*0.25,r*1.0+Math.abs(swing)*0.2);
  ctx.moveTo(r*0.18,r*0.1);ctx.lineTo(r*0.18-swing*0.25,r*1.0+Math.abs(swing)*0.2);
  ctx.stroke();
  ctx.strokeStyle=vestDark;
  ctx.lineWidth=r*0.34;ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(0,-r*0.05);ctx.lineTo(r*1.35,r*0.05);
  ctx.stroke();
  ctx.strokeStyle='#3a4046';ctx.lineWidth=r*0.16;
  ctx.beginPath();ctx.moveTo(r*0.55,r*0.02);ctx.lineTo(r*1.55,r*0.02);ctx.stroke();
  ctx.strokeStyle=vestDark;ctx.lineWidth=r*0.3;
  ctx.beginPath();ctx.moveTo(0,r*0.1);ctx.lineTo(r*0.35,r*0.55);ctx.stroke();
  const torsoGrad=ctx.createLinearGradient(-r*0.62,-r*0.5,r*0.62,r*0.5);
  torsoGrad.addColorStop(0,vestLight);
  torsoGrad.addColorStop(1,vestDark);
  ctx.fillStyle=hitFlash>0?'#ffffff':torsoGrad;
  roundRect(-r*0.6,-r*0.48,r*1.2,r*1.0,r*0.28);
  ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.25)';ctx.lineWidth=1;
  ctx.stroke();
  ctx.fillStyle='#e0b892';
  ctx.beginPath();ctx.arc(0,0,r*0.001,0,0);
  ctx.beginPath();ctx.arc(-r*0.02,-r*0.86,r*0.4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=helmet;
  ctx.beginPath();ctx.arc(-r*0.02,-r*0.9,r*0.46,Math.PI*0.85,Math.PI*2.15);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath();ctx.ellipse(r*0.18,-r*0.86,r*0.14,r*0.08,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function draw(){
  ctx.fillStyle='#151f16';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
  for(let x=0;x<W;x+=28){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
  for(let y=0;y<H;y+=28){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
  bullets.forEach(b=>{
    ctx.strokeStyle='#fff6c8';
    ctx.lineWidth=2;
    ctx.shadowColor='#f2c265';ctx.shadowBlur=5;
    ctx.beginPath();
    ctx.moveTo(b.x,b.y);
    ctx.lineTo(b.x-b.vx*1.8,b.y-b.vy*1.8);
    ctx.stroke();
    ctx.shadowBlur=0;
  });
  enemies.forEach(e=>{
    const dark=e.hard?'#7a1f1f':'#8a2a2a';
    const light=e.hard?'#c1473f':'#d9564d';
    drawSoldier(e.x,e.y,e.ang,e.walkPhase,e.r,light,dark,'#2b2b2b',e.hitFlash);
    if(e.maxHp>1){
      ctx.fillStyle='#0b141a';
      ctx.fillRect(e.x-e.r,e.y-e.r-12,e.r*2,3);
      ctx.fillStyle='#f2c265';
      ctx.fillRect(e.x-e.r,e.y-e.r-12,e.r*2*(e.hp/e.maxHp),3);
    }
  });
  particles.forEach(p=>{
    ctx.globalAlpha=Math.max(0,p.life);
    if(p.type==='flash'){
      ctx.fillStyle='#fff6c8';
      ctx.shadowColor='#fff6c8';ctx.shadowBlur=10;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
    } else {
      ctx.fillStyle='#c1473f';
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  });
  drawSoldier(player.x,player.y,player.ang,player.walkPhase,player.r,'#00e0b3','#00453a','#123c33',player.hitFlash);
}
function loop(){
  if(!running) return;
  update();
  if(running){draw();requestAnimationFrame(loop);}
}
function setMove(x,y){ move.x=x;move.y=y; }
const upB=document.getElementById('up'),downB=document.getElementById('down');
const leftB=document.getElementById('left'),rightB=document.getElementById('right');
function bindHold(el,fn,release){
  el.addEventListener('pointerdown',fn);
  el.addEventListener('pointerup',release);
  el.addEventListener('pointerleave',release);
}
bindHold(upB,()=>setMove(move.x,-1),()=>setMove(move.x,move.y<0?0:move.y));
bindHold(downB,()=>setMove(move.x,1),()=>setMove(move.x,move.y>0?0:move.y));
bindHold(leftB,()=>setMove(-1,move.y),()=>setMove(move.x<0?0:move.x,move.y));
bindHold(rightB,()=>setMove(1,move.y),()=>setMove(move.x>0?0:move.x,move.y));
document.addEventListener('keydown',(e)=>{
  if(e.key==='ArrowUp') move.y=-1;
  if(e.key==='ArrowDown') move.y=1;
  if(e.key==='ArrowLeft') move.x=-1;
  if(e.key==='ArrowRight') move.x=1;
  if(e.code==='Space') firing=true;
});
document.addEventListener('keyup',(e)=>{
  if(e.key==='ArrowUp'&&move.y<0) move.y=0;
  if(e.key==='ArrowDown'&&move.y>0) move.y=0;
  if(e.key==='ArrowLeft'&&move.x<0) move.x=0;
  if(e.key==='ArrowRight'&&move.x>0) move.x=0;
  if(e.code==='Space') firing=false;
});
const fireB=document.getElementById('fire');
fireB.addEventListener('pointerdown',()=>{firing=true;});
fireB.addEventListener('pointerup',()=>{firing=false;});
fireB.addEventListener('pointerleave',()=>{firing=false;});
document.getElementById('reload').addEventListener('click',startReload);
ovBtn.addEventListener('click',start);
reset();
draw();
})();
</script>
</body>
</html>`
}, {
  title: "Highway",
  html: `<!DOCTYPE html>
<html lang='en'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
<style>
:root{--card-2:#2a3942;--ink:#e9edef;--muted:#8696a0;--accent:#00a884;--line:#2a3942;--cell-bg:#111b21;
--sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow:hidden;touch-action:none;}
.stage{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;}
.card{width:100%;max-width:360px;}
.header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);}
.header__title{font-size:17px;font-weight:600;}
.header__sub{font-size:12px;color:var(--muted);}
.stats{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:14px;}
.stats b{color:var(--ink);font-weight:600;margin-left:4px;}
.wrap{position:relative;background:#0b141a;border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 10px 30px -10px rgba(0,0,0,.6);}
canvas{display:block;width:100%;}
.overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:rgba(11,20,26,0.78);}
.overlay h2{font-size:19px;text-align:center;padding:0 16px;}
.overlay button{background:var(--accent);border:none;border-radius:8px;color:#0b141a;font-weight:700;font-family:inherit;padding:10px 22px;font-size:14px;cursor:pointer;}
.controls{display:flex;justify-content:space-between;margin-top:12px;gap:10px;}
.ctrl{flex:1;background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:14px 0;text-align:center;font-size:20px;color:var(--ink);cursor:pointer;}
.ctrl:active{background:var(--accent);}
.ctrl-fs{flex:0 0 52px;background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:14px 0;text-align:center;font-size:18px;color:var(--ink);cursor:pointer;}
.ctrl-fs:active{background:var(--accent);}
.hint{font-size:11px;color:var(--muted);text-align:center;margin-top:8px;}

/* Fullscreen mode */
.stage.is-fullscreen{
  position:fixed;inset:0;z-index:9999;background:#0b141a;padding:12px;
  display:flex;align-items:center;justify-content:center;
}
.stage.is-fullscreen .card{max-width:480px;}
.stage.is-fullscreen .wrap{width:100%;}
.stage.is-fullscreen canvas{width:100%;height:auto;}
</style>
</head>
<body>
<main class='stage' id='stage'>
  <div class='card'>
    <div class='header'>
      <div class='header__title'>SILA Highway Racer</div>
      <div class='header__sub'>Dodge traffic</div>
    </div>
    <div class='stats'><span>Score<b id='score'>0</b></span><span>Best<b id='best'>0</b></span><span>Speed<b id='spd'>1x</b></span></div>
    <div class='wrap' id='wrap'>
      <canvas id='canvas' width='320' height='440'></canvas>
      <div class='overlay' id='overlay'>
        <h2 id='ov-title'>SILA Highway Racer</h2>
        <button id='ov-btn'>Start Engine</button>
      </div>
    </div>
    <div class='controls'>
      <div class='ctrl' id='left'>◀</div>
      <div class='ctrl-fs' id='fullscreen' title='Fullscreen'>⛶</div>
      <div class='ctrl' id='right'>▶</div>
    </div>
    <div class='hint'>Swipe or tap arrows to change lane · Tap ⛶ for fullscreen</div>
  </div>
</main>
<script>
(function(){
const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const overlay=document.getElementById('overlay');
const ovTitle=document.getElementById('ov-title');
const ovBtn=document.getElementById('ov-btn');
const stage=document.getElementById('stage');
const fsBtn=document.getElementById('fullscreen');
const roadL=W*0.14,roadR=W*0.86,roadW=roadR-roadL,lanes=3,laneW=roadW/lanes;
let player,traffic,particles,score,best=0,running=false,frame=0,speed=5,dashOffset=0;
const CARCOLORS=['#e05c5c','#f2c265','#5b8def','#c17cf2','#f2a13f'];

function laneX(i){return roadL+laneW*i+laneW/2;}

function reset(){
  player={lane:1,x:laneX(1),y:H-90,w:34,h:56,targetLane:1};
  traffic=[];particles=[];score=0;frame=0;speed=5;
  document.getElementById('score').textContent='0';
  document.getElementById('spd').textContent='1x';
}
function start(){
  reset();running=true;overlay.style.display='none';loop();
}
function gameOver(){
  running=false;
  if(score>best) best=score;
  document.getElementById('best').textContent=best;
  ovTitle.textContent='Crashed! Score '+score;
  ovBtn.textContent='Try again';
  overlay.style.display='flex';
}
function moveLane(dir){
  if(!running) return;
  player.targetLane=Math.max(0,Math.min(lanes-1,player.targetLane+dir));
}
function spawnTraffic(){
  const lane=Math.floor(Math.random()*lanes);
  traffic.push({lane,x:laneX(lane),y:-70,w:32,h:54,color:CARCOLORS[Math.floor(Math.random()*CARCOLORS.length)],passed:false});
}
function spawnParticle(){
  particles.push({x:roadL+Math.random()*roadW,y:-10,len:14+Math.random()*18,speed:speed*1.6});
}
function update(){
  frame++;
  score=Math.floor(frame/6);
  document.getElementById('score').textContent=score;
  speed=5+Math.min(6,score*0.02);
  document.getElementById('spd').textContent=(speed/5).toFixed(1)+'x';
  dashOffset=(dashOffset+speed)%40;
  player.x+=(laneX(player.targetLane)-player.x)*0.25;
  if(frame%Math.max(28,55-Math.floor(score/2))===0) spawnTraffic();
  if(frame%4===0) spawnParticle();
  traffic.forEach(t=>t.y+=speed);
  traffic=traffic.filter(t=>t.y<H+70);
  particles.forEach(p=>p.y+=p.speed);
  particles=particles.filter(p=>p.y<H+20);
  for(const t of traffic){
    if(!t.passed&&t.y>player.y){t.passed=true;score+=5;}
    if(Math.abs(t.x-player.x)<(t.w+player.w)/2-6&&Math.abs(t.y-player.y)<(t.h+player.h)/2-8){
      return gameOver();
    }
  }
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function drawCar(x,y,w,h,color,glow){
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.5)';
  ctx.shadowBlur=8;ctx.shadowOffsetY=4;
  const grad=ctx.createLinearGradient(x-w/2,y-h/2,x+w/2,y+h/2);
  grad.addColorStop(0,color);
  grad.addColorStop(1,'#0b141a');
  ctx.fillStyle=grad;
  roundRect(x-w/2,y-h/2,w,h,8);
  ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.fillStyle='rgba(20,30,38,0.85)';
  roundRect(x-w/2+4,y-h/2+8,w-8,h*0.35,4);
  ctx.fill();
  if(glow){
    ctx.fillStyle='#fff6c8';
    ctx.shadowColor='#fff6c8';ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(x-w/2+5,y-h/2+4,2.6,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(x+w/2-5,y-h/2+4,2.6,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
  }
  ctx.restore();
}
function draw(){
  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#1b2a4a');
  sky.addColorStop(0.45,'#3a3a6e');
  sky.addColorStop(0.55,'#2c1f3f');
  sky.addColorStop(1,'#111b21');
  ctx.fillStyle=sky;
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#1a1f26';
  ctx.beginPath();
  ctx.moveTo(0,0);ctx.lineTo(roadL,0);ctx.lineTo(roadL*0.55,H);ctx.lineTo(0,H);
  ctx.closePath();ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W,0);ctx.lineTo(roadR,0);ctx.lineTo(roadR+ (W-roadR)*1.7,H);ctx.lineTo(W,H);
  ctx.closePath();ctx.fill();
  const road=ctx.createLinearGradient(0,0,0,H);
  road.addColorStop(0,'#20262c');
  road.addColorStop(1,'#161d22');
  ctx.fillStyle=road;
  ctx.fillRect(roadL,0,roadW,H);
  ctx.strokeStyle='#f2c265';
  ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(roadL,0);ctx.lineTo(roadL,H);ctx.stroke();
  ctx.beginPath();ctx.moveTo(roadR,0);ctx.lineTo(roadR,H);ctx.stroke();
  ctx.strokeStyle='rgba(233,237,239,0.55)';
  ctx.lineWidth=3;
  ctx.setLineDash([18,18]);
  ctx.lineDashOffset=-dashOffset;
  for(let i=1;i<lanes;i++){
    const x=roadL+laneW*i;
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle='rgba(255,255,255,0.5)';
  ctx.lineWidth=2;
  particles.forEach(p=>{
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    ctx.lineTo(p.x,p.y-p.len);
    ctx.globalAlpha=0.5;
    ctx.stroke();
  });
  ctx.globalAlpha=1;
  traffic.forEach(t=>drawCar(t.x,t.y,t.w,t.h,t.color,false));
  drawCar(player.x,player.y,player.w,player.h,'#00c2a0',true);
}
function loop(){
  if(!running) return;
  update();
  if(running){draw();requestAnimationFrame(loop);}
}
document.getElementById('left').addEventListener('click',()=>moveLane(-1));
document.getElementById('right').addEventListener('click',()=>moveLane(1));
document.addEventListener('keydown',(e)=>{
  if(e.key==='ArrowLeft') moveLane(-1);
  if(e.key==='ArrowRight') moveLane(1);
  if(e.key==='f'||e.key==='F') toggleFullscreen();
});
let sx=0;
document.getElementById('wrap').addEventListener('touchstart',(e)=>{sx=e.touches[0].clientX;});
document.getElementById('wrap').addEventListener('touchend',(e)=>{
  const dx=e.changedTouches[0].clientX-sx;
  if(Math.abs(dx)>30) moveLane(dx>0?1:-1);
});

/* ---- Fullscreen handling ---- */
function isFsSupported(){
  return !!(stage.requestFullscreen||stage.webkitRequestFullscreen||stage.mozRequestFullScreen||stage.msRequestFullscreen);
}
function isFsActive(){
  return !!(document.fullscreenElement||document.webkitFullscreenElement||document.mozFullScreenElement||document.msFullscreenElement);
}
function enterNativeFullscreen(){
  const req=stage.requestFullscreen||stage.webkitRequestFullscreen||stage.mozRequestFullScreen||stage.msRequestFullscreen;
  if(req) return req.call(stage);
}
function exitNativeFullscreen(){
  const exit=document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen||document.msExitFullscreen;
  if(exit) return exit.call(document);
}
function applyFullscreenClass(on){
  stage.classList.toggle('is-fullscreen',on);
  fsBtn.textContent=on?'✕':'⛶';
}
function toggleFullscreen(){
  const wantOn=!stage.classList.contains('is-fullscreen');
  if(isFsSupported()){
    if(wantOn) enterNativeFullscreen().catch(()=>applyFullscreenClass(true));
    else exitNativeFullscreen();
  }else{
    // Fallback: CSS-only fullscreen overlay for embedded/WebView contexts
    applyFullscreenClass(wantOn);
  }
}
document.addEventListener('fullscreenchange',()=>applyFullscreenClass(isFsActive()));
document.addEventListener('webkitfullscreenchange',()=>applyFullscreenClass(isFsActive()));
fsBtn.addEventListener('click',toggleFullscreen);

ovBtn.addEventListener('click',start);
draw();
})();
</script>
</body>
</html>`
}, {
  title: "Piano",
  html: `<!DOCTYPE html>
<html lang='en'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>

<style>
:root{
--accent:#00a884;
--bg:#080d12;
--card:#111b21;
--ink:#e9edef;
--muted:#8696a0;
--line:#2a3942;
--tile:#e9edef;
--danger:#ef4444;
--sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
}

*{
margin:0;
padding:0;
box-sizing:border-box;
-webkit-tap-highlight-color:transparent;
user-select:none;
}

html,body{
background:transparent;
color:var(--ink);
font-family:var(--sys);
min-height:100vh;
overflow-x:hidden;
touch-action:manipulation;
}

.stage{
min-height:100vh;
display:flex;
flex-direction:column;
align-items:center;
justify-content:center;
padding:20px 12px;
}

.card{
width:100%;
max-width:380px;
}

.header{
display:flex;
align-items:center;
justify-content:space-between;
padding-bottom:14px;
margin-bottom:14px;
border-bottom:1px solid var(--line);
}

.title{
font-size:18px;
font-weight:700;
}

.sub{
font-size:11px;
color:var(--muted);
}

.stats{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:8px;
margin-bottom:14px;
}

.stat{
background:rgba(42,57,66,.3);
border:1px solid var(--line);
border-radius:10px;
padding:10px 6px;
text-align:center;
}

.stat-label{
font-size:10px;
color:var(--muted);
margin-bottom:4px;
}

.stat-value{
font-size:18px;
font-weight:700;
}

.game{
position:relative;
width:100%;
aspect-ratio:4/5;
max-height:520px;
overflow:hidden;
border-radius:12px;
border:1px solid var(--line);
background:var(--bg);
touch-action:manipulation;
}

.lanes{
position:absolute;
inset:0;
display:grid;
grid-template-columns:repeat(4,1fr);
}

.lane{
border-right:1px solid rgba(55,66,72,.6);
}

.lane:last-child{
border-right:none;
}

.tiles{
position:absolute;
inset:0;
overflow:hidden;
}

.tile{
position:absolute;
height:110px;
background:linear-gradient(180deg,#f4f6f7,#aebbc2);
border:1px solid rgba(255,255,255,.3);
border-radius:5px;
box-shadow:0 4px 12px rgba(0,0,0,.3);
cursor:pointer;
touch-action:manipulation;
}

.tile.hit{
background:var(--accent);
opacity:.75;
}

.tile.missed{
background:var(--danger);
}

.hit-zone{
position:absolute;
bottom:0;
left:0;
right:0;
height:14%;
border-top:2px solid rgba(0,168,132,.8);
background:linear-gradient(0deg,rgba(0,168,132,.1),transparent);
pointer-events:none;
}

.progress{
position:absolute;
top:0;
left:0;
height:3px;
width:100%;
background:var(--accent);
z-index:5;
}

.speed-label{
position:absolute;
top:12px;
right:12px;
z-index:10;
font-size:10px;
padding:6px 9px;
border-radius:15px;
background:rgba(0,0,0,.5);
color:var(--ink);
}

.controls{
margin-top:14px;
}

.label{
font-size:11px;
color:var(--muted);
margin-bottom:8px;
}

.levels{
display:flex;
gap:8px;
overflow-x:auto;
scrollbar-width:none;
padding:2px 2px 6px;
}

.levels::-webkit-scrollbar{
display:none;
}

.level{
flex-shrink:0;
padding:10px 16px;
border-radius:20px;
border:1px solid var(--line);
background:transparent;
color:var(--muted);
font-family:inherit;
font-size:12px;
cursor:pointer;
}

.level.active{
background:var(--accent);
color:#06110f;
border-color:var(--accent);
font-weight:700;
}

.actions{
display:flex;
gap:8px;
margin-top:12px;
}

.btn{
flex:1;
border:1px solid var(--line);
background:transparent;
color:var(--ink);
border-radius:9px;
padding:12px;
font-family:inherit;
font-size:13px;
font-weight:600;
cursor:pointer;
}

.btn.primary{
background:var(--accent);
color:#06110f;
border-color:var(--accent);
}

.btn:disabled{
opacity:.6;
cursor:default;
}

.message{
text-align:center;
color:var(--muted);
font-size:11px;
margin-top:10px;
}

.modal{
position:fixed;
inset:0;
z-index:50;
display:flex;
align-items:center;
justify-content:center;
padding:22px;
background:rgba(8,13,18,.8);
opacity:0;
pointer-events:none;
transition:opacity .2s ease;
}

.modal.open{
opacity:1;
pointer-events:auto;
}

.modal-card{
width:100%;
max-width:310px;
background:#2a3942;
border-radius:14px;
padding:26px 22px 0;
text-align:center;
overflow:hidden;
}

.modal-title{
font-size:22px;
font-weight:800;
margin-bottom:8px;
}

.modal-sub{
font-size:13px;
line-height:1.5;
color:#aebac1;
margin-bottom:20px;
}

.modal-btn{
width:100%;
border:none;
border-top:1px solid #374248;
background:transparent;
color:var(--accent);
padding:15px;
font-family:inherit;
font-size:15px;
font-weight:700;
cursor:pointer;
}
</style>
</head>

<body>

<main class='stage'>
<div class='card'>

<div class='header'>
<div class='title'>SILA Piano Tiles</div>
<div class='sub'>MUSIC EDITION</div>
</div>

<div class='stats'>
<div class='stat'>
<div class='stat-label'>SCORE</div>
<div class='stat-value' id='score'>0</div>
</div>

<div class='stat'>
<div class='stat-label'>COMBO</div>
<div class='stat-value' id='combo'>0</div>
</div>

<div class='stat'>
<div class='stat-label'>SPEED</div>
<div class='stat-value' id='speed'>1.0x</div>
</div>
</div>

<div class='game' id='game'>

<div class='progress' id='progress'></div>

<div class='speed-label' id='speed-label'>1.0x SPEED</div>

<div class='lanes'>
<div class='lane'></div>
<div class='lane'></div>
<div class='lane'></div>
<div class='lane'></div>
</div>

<div class='tiles' id='tiles'></div>

<div class='hit-zone'></div>

</div>

<div class='controls'>

<div class='label'>DIFFICULTY</div>

<div class='levels' id='levels'>
<button class='level active' data-level='0'>Easy</button>
<button class='level' data-level='1'>Normal</button>
<button class='level' data-level='2'>Hard</button>
<button class='level' data-level='3'>Master</button>
</div>

</div>

<div class='actions'>
<button class='btn primary' id='start'>Start Game</button>
<button class='btn' id='reset'>Reset</button>
</div>

<div class='message' id='message'>
Press Start Game to begin
</div>

</div>
</main>

<div class='modal' id='modal'>

<div class='modal-card'>

<div class='modal-title' id='modal-title'>Game Over</div>

<div class='modal-sub' id='modal-sub'></div>

<button class='modal-btn' id='retry'>Play Again</button>

</div>

</div>

<script>
(function(){

'use strict';

// ============================================
// LICENSED MUSIC CONFIGURATION
// ============================================

// Replace this with your own licensed audio URL.
const MUSIC_URL='https://h.uguu.se/EMksfecC.mp3';

const $=id=>document.getElementById(id);

const game=$('game');
const tilesEl=$('tiles');
const scoreEl=$('score');
const comboEl=$('combo');
const speedEl=$('speed');
const speedLabel=$('speed-label');
const progressEl=$('progress');
const messageEl=$('message');
const modal=$('modal');
const modalTitle=$('modal-title');
const modalSub=$('modal-sub');
const startBtn=$('start');

let music=null;

// ============================================
// AUDIO ENGINE
// ============================================

let audioContext=null;
let masterGain=null;

const notes=[
261.63,293.66,329.63,349.23,
392.00,440.00,493.88,523.25
];

function initAudio(){

if(!audioContext){
audioContext=new (window.AudioContext||window.webkitAudioContext)();

masterGain=audioContext.createGain();
masterGain.gain.value=0.16;
masterGain.connect(audioContext.destination);
}

if(audioContext.state==='suspended'){
audioContext.resume();
}

}

function playPianoNote(index){

if(!audioContext||!masterGain)return;

const now=audioContext.currentTime;
const oscillator=audioContext.createOscillator();
const gain=audioContext.createGain();

oscillator.type='triangle';
oscillator.frequency.value=notes[index%notes.length];

gain.gain.setValueAtTime(.0001,now);
gain.gain.exponentialRampToValueAtTime(.20,now+.008);
gain.gain.exponentialRampToValueAtTime(.0001,now+.35);

oscillator.connect(gain);
gain.connect(masterGain);

oscillator.start(now);
oscillator.stop(now+.4);

}

// ============================================
// GAME STATE
// ============================================

const LEVELS=[
{name:'Easy',baseSpeed:155,interval:800,duration:70000},
{name:'Normal',baseSpeed:190,interval:680,duration:60000},
{name:'Hard',baseSpeed:235,interval:560,duration:55000},
{name:'Master',baseSpeed:280,interval:440,duration:50000}
];

const state={
running:false,
level:0,
score:0,
combo:0,
best:0,
misses:0,
maxMisses:3,
elapsed:0,
spawnTimer:0,
lastTime:0,
animationId:null,
tiles:[],
tileId:0,
music:null,
musicStarted:false
};

// ============================================
// MUSIC
// ============================================

function prepareMusic(){

if(!MUSIC_URL||MUSIC_URL.includes('YOUR_LICENSED')){
return;
}

if(!music){
music=new Audio(MUSIC_URL);
music.preload='auto';
music.loop=true;
music.volume=.32;
music.setAttribute('playsinline','');
}

}

function startMusic(){

prepareMusic();

if(!music)return;

const result=music.play();

if(result&&typeof result.catch==='function'){
result.catch(()=>{
messageEl.textContent='Tap Start again to enable music';
});
}

}

function stopMusic(){

if(!music)return;

music.pause();
music.currentTime=0;

}

// ============================================
// STATS
// ============================================

function updateStats(){

scoreEl.textContent=state.score;
comboEl.textContent=state.combo;

const multiplier=getSpeedMultiplier();

speedEl.textContent=multiplier.toFixed(1)+'x';
speedLabel.textContent=multiplier.toFixed(1)+'x SPEED';

}

// ============================================
// DYNAMIC SPEED
// ============================================

function getSpeedMultiplier(){

// Speed increases gradually as the song progresses.
const progress=state.elapsed/LEVELS[state.level].duration;

const multiplier=1+Math.min(progress,1)*1.8;

return multiplier;

}

function getCurrentSpeed(){

return LEVELS[state.level].baseSpeed*getSpeedMultiplier();

}

function getCurrentInterval(){

const base=LEVELS[state.level].interval;

// Spawn interval decreases as speed rises.
return Math.max(220,base/getSpeedMultiplier());

}

// ============================================
// TILE SYSTEM
// ============================================

function clearTiles(){

tilesEl.innerHTML='';
state.tiles=[];

}

function createTile(){

const lane=Math.floor(Math.random()*4);

const tileEl=document.createElement('button');

tileEl.className='tile';
tileEl.type='button';
tileEl.setAttribute('aria-label','Piano tile');

tileEl.style.left=(lane*25+1)+'%';
tileEl.style.width='23%';

const tile={
id:state.tileId++,
lane,
y:-115,
hit:false,
missed:false,
el:tileEl,
note:Math.floor(Math.random()*notes.length)
};

tileEl.addEventListener('pointerdown',(e)=>{
e.preventDefault();
hitTile(tile);
});

tilesEl.appendChild(tileEl);
state.tiles.push(tile);

renderTile(tile);

}

function renderTile(tile){

tile.el.style.transform='translateY('+tile.y+'px)';

}

// ============================================
// HIT / MISS
// ============================================

function hitTile(tile){

if(!state.running||tile.hit||tile.missed)return;

const rect=game.getBoundingClientRect();
const zoneTop=rect.height*.86;

// Prevent tapping tiles that are too high.
if(tile.y+110<zoneTop-95)return;

tile.hit=true;
tile.el.classList.add('hit');

playPianoNote(tile.note);

state.score+=10+state.combo;
state.combo++;
state.best=Math.max(state.best,state.combo);

updateStats();

setTimeout(()=>{
if(tile.el.parentNode)tile.el.remove();
},70);

}

function missTile(tile){

if(tile.hit||tile.missed)return;

tile.missed=true;
tile.el.classList.add('missed');

state.combo=0;
state.misses++;

updateStats();

setTimeout(()=>{
if(tile.el.parentNode)tile.el.remove();
},80);

if(state.misses>=state.maxMisses){
endGame('miss');
}

}

// ============================================
// GAME LOOP
// ============================================

function updateTiles(delta){

const bottom=game.getBoundingClientRect().height;
const speed=getCurrentSpeed();

for(let i=state.tiles.length-1;i>=0;i--){

const tile=state.tiles[i];

if(tile.hit||tile.missed){
state.tiles.splice(i,1);
continue;
}

tile.y+=speed*delta/1000;

renderTile(tile);

if(tile.y>bottom){

missTile(tile);
state.tiles.splice(i,1);

}

}

}

function loop(timestamp){

if(!state.running)return;

const delta=Math.min(timestamp-state.lastTime,50);

state.lastTime=timestamp;
state.elapsed+=delta;
state.spawnTimer+=delta;

if(state.spawnTimer>=getCurrentInterval()){

state.spawnTimer=0;
createTile();

}

updateTiles(delta);

const duration=LEVELS[state.level].duration;
const remaining=Math.max(0,duration-state.elapsed);

progressEl.style.width=(remaining/duration*100)+'%';

updateStats();

if(state.elapsed>=duration){

endGame('time');
return;

}

state.animationId=requestAnimationFrame(loop);

}

// ============================================
// START / END / RESET
// ============================================

function startGame(){

if(state.running)return;

closeModal();
clearTiles();

initAudio();
startMusic();

state.running=true;
state.score=0;
state.combo=0;
state.best=0;
state.misses=0;
state.elapsed=0;
state.spawnTimer=0;
state.lastTime=performance.now();

startBtn.textContent='Playing...';
startBtn.disabled=true;

messageEl.textContent='Tap the tiles with the music';

progressEl.style.width='100%';

updateStats();

createTile();

state.animationId=requestAnimationFrame(loop);

}

function endGame(reason){

if(!state.running)return;

state.running=false;

if(state.animationId){
cancelAnimationFrame(state.animationId);
state.animationId=null;
}

stopMusic();

startBtn.disabled=false;
startBtn.textContent='Start Game';

modalTitle.textContent=reason==='time'
?'Song Complete!'
:'Game Over';

modalSub.textContent=
'Score: '+state.score+
' | Best Combo: '+state.best;

modal.classList.add('open');

messageEl.textContent='Round finished';

}

function closeModal(){

modal.classList.remove('open');

}

function resetGame(){

if(state.animationId){
cancelAnimationFrame(state.animationId);
state.animationId=null;
}

stopMusic();

state.running=false;
state.score=0;
state.combo=0;
state.best=0;
state.misses=0;
state.elapsed=0;
state.spawnTimer=0;

clearTiles();

startBtn.disabled=false;
startBtn.textContent='Start Game';

progressEl.style.width='100%';

messageEl.textContent='Press Start Game to begin';

closeModal();
updateStats();

}

// ============================================
// EVENTS
// ============================================

document.querySelectorAll('.level').forEach(el=>{

el.addEventListener('click',()=>{

if(state.running)return;

state.level=Number(el.dataset.level);

document.querySelectorAll('.level').forEach(btn=>{
btn.classList.toggle('active',btn===el);
});

messageEl.textContent='Difficulty: '+LEVELS[state.level].name;

});

});

startBtn.addEventListener('click',startGame);

$('reset').addEventListener('click',resetGame);

$('retry').addEventListener('click',()=>{
closeModal();
startGame();
});

modal.addEventListener('click',(e)=>{
if(e.target===modal)closeModal();
});

updateStats();

})();
</script>

</body>
</html>`
}, {
  title: "Stickman",
  html: `<!DOCTYPE html>
<html lang='en'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
<style>
:root{--card-2:#2a3942;--ink:#e9edef;--muted:#8696a0;--accent:#00a884;--line:#2a3942;--cell-bg:#111b21;
--sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow:hidden;touch-action:none;}
.stage{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;}
.card{width:100%;max-width:360px;}
.header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);}
.header__title{font-size:17px;font-weight:600;}
.header__sub{font-size:12px;color:var(--muted);}
.bars{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.barwrap{flex:1;height:10px;background:var(--cell-bg);border:1px solid var(--line);border-radius:6px;overflow:hidden;}
.bar{height:100%;width:100%;background:var(--accent);transition:width .2s ease;}
.bar.ai{background:#e05c5c;}
.tag{font-size:11px;color:var(--muted);width:34px;}
.wrap{position:relative;background:#111b21;border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 10px 30px -10px rgba(0,0,0,.6);}
canvas{display:block;width:100%;}
.overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:rgba(11,20,26,0.8);}
.overlay h2{font-size:19px;text-align:center;padding:0 16px;}
.overlay button{background:var(--accent);border:none;border-radius:8px;color:#0b141a;font-weight:700;font-family:inherit;padding:10px 22px;font-size:14px;cursor:pointer;}
.controls{display:flex;justify-content:space-between;margin-top:12px;gap:8px;}
.ctrl{flex:1;background:var(--card-2);border:1px solid var(--line-strong,#374248);border-radius:10px;padding:12px 0;text-align:center;font-size:13px;font-weight:600;color:var(--ink);cursor:pointer;}
.ctrl:active{background:var(--accent);color:#0b141a;}
.hint{font-size:11px;color:var(--muted);text-align:center;margin-top:8px;}
</style>
</head>
<body>
<main class='stage'>
  <div class='card'>
    <div class='header'>
      <div class='header__title'>SILA Stickman Fighter</div>
      <div class='header__sub'>VS AI</div>
    </div>
    <div class='bars'>
      <span class='tag'>You</span>
      <div class='barwrap'><div class='bar' id='hp-you'></div></div>
    </div>
    <div class='bars'>
      <span class='tag'>AI</span>
      <div class='barwrap'><div class='bar ai' id='hp-ai'></div></div>
    </div>
    <div class='wrap' id='wrap'>
      <canvas id='canvas' width='320' height='300'></canvas>
      <div class='overlay' id='overlay'>
        <h2 id='ov-title'>SILA Stickman Fighter</h2>
        <button id='ov-btn'>Fight</button>
      </div>
    </div>
    <div class='controls'>
      <div class='ctrl' id='back'>◀ BACK</div>
      <div class='ctrl' id='fwd'>FWD ▶</div>
      <div class='ctrl' id='punch'>👊 PUNCH</div>
      <div class='ctrl' id='kick'>🦵 KICK</div>
      <div class='ctrl' id='block'>🛡️ BLOCK</div>
    </div>
    <div class='hint'>Get close, then Punch/Kick. Block reduces damage.</div>
  </div>
</main>
<script>
(function(){
const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const groundY=H-40;
const overlay=document.getElementById('overlay');
const ovTitle=document.getElementById('ov-title');
const ovBtn=document.getElementById('ov-btn');
const hpYouEl=document.getElementById('hp-you');
const hpAiEl=document.getElementById('hp-ai');
let you,ai,running=false,frame=0;
const MAXHP=100;
const REACH=54;

function newFighter(x,facing,color){
  return {x,y:groundY,facing,color,hp:MAXHP,state:'idle',stateTimer:0,vx:0,blocking:false,hitFlash:0};
}
function reset(){
  you=newFighter(90,1,'#00c2a0');
  ai=newFighter(230,-1,'#e05c5c');
  frame=0;
  updateBars();
}
function updateBars(){
  hpYouEl.style.width=Math.max(0,you.hp)+'%';
  hpAiEl.style.width=Math.max(0,ai.hp)+'%';
}
function start(){
  reset();running=true;overlay.style.display='none';loop();
}
function endGame(){
  running=false;
  const won=ai.hp<=0;
  ovTitle.textContent=won?'You win! 🏆':'You lost!';
  ovBtn.textContent='Fight again';
  overlay.style.display='flex';
}
function distBetween(){ return Math.abs(you.x-ai.x); }
function setState(f,state,dur){
  f.state=state;f.stateTimer=dur;
}
function tryAttack(f,type){
  if(!running) return;
  if(f.state==='punch'||f.state==='kick'||f.stateTimer>0) return;
  setState(f,type,type==='punch'?16:22);
}
function move(dir){
  if(!running) return;
  if(you.state==='punch'||you.state==='kick') return;
  you.vx=dir*2.4;
  setTimeout(()=>{ you.vx=0; },140);
}
function setBlock(on){
  if(!running) return;
  you.blocking=on;
  you.state=on?'block':'idle';
}
function applyHit(attacker,defender,dmg){
  if(distBetween()>REACH) return false;
  const facingRight=attacker.x<defender.x;
  if((facingRight&&attacker.facing!==1)||(!facingRight&&attacker.facing!==-1)) return false;
  let d=dmg;
  if(defender.blocking) d*=0.3;
  defender.hp-=d;
  defender.hitFlash=8;
  updateBars();
  if(defender.hp<=0){ endGame(); }
  return true;
}
function aiThink(){
  if(!running) return;
  const d=distBetween();
  if(ai.state==='hitstun'||ai.stateTimer>0) return;
  if(d>REACH+10){
    ai.vx=(you.x<ai.x?-1:1)*2.0;
  } else {
    ai.vx=0;
    const r=Math.random();
    if(r<0.35){ setState(ai,'punch',16); }
    else if(r<0.55){ setState(ai,'kick',22); }
    else if(r<0.75){ ai.blocking=true; ai.state='block'; setTimeout(()=>{ if(running){ai.blocking=false; if(ai.state==='block') ai.state='idle';} },500); }
    else { ai.vx=(Math.random()<0.5?-1:1)*2.0; setTimeout(()=>{ ai.vx=0; },200); }
  }
}
function update(){
  frame++;
  if(frame%40===0) aiThink();
  [you,ai].forEach(f=>{
    if(f.stateTimer>0){
      f.stateTimer--;
      if(f.stateTimer===0){
        if(f.state==='punch'||f.state==='kick') f.state='idle';
      }
    }
    f.x+=f.vx;
    f.x=Math.max(30,Math.min(W-30,f.x));
    if(f.hitFlash>0) f.hitFlash--;
  });
  you.facing=you.x<ai.x?1:-1;
  ai.facing=ai.x<you.x?1:-1;
  if(you.state==='punch'&&you.stateTimer===10) applyHit(you,ai,10);
  if(you.state==='kick'&&you.stateTimer===14) applyHit(you,ai,16);
  if(ai.state==='punch'&&ai.stateTimer===10) applyHit(ai,you,8);
  if(ai.state==='kick'&&ai.stateTimer===14) applyHit(ai,you,13);
}
function drawStick(f){
  ctx.save();
  ctx.translate(f.x,f.y);
  ctx.strokeStyle=f.hitFlash>0?'#fff':f.color;
  ctx.lineWidth=4;
  ctx.lineCap='round';
  const punch=f.state==='punch';
  const kick=f.state==='kick';
  const block=f.state==='block';
  const armSwing=punch?18*f.facing:0;
  const legKick=kick?20*f.facing:0;
  ctx.beginPath();ctx.arc(0,-58,10,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-48);ctx.lineTo(0,-14);ctx.stroke();
  ctx.beginPath();
  if(block){
    ctx.moveTo(0,-42);ctx.lineTo(10*f.facing,-40);
    ctx.moveTo(0,-42);ctx.lineTo(-6*f.facing,-30);
  } else {
    ctx.moveTo(0,-42);ctx.lineTo(10*f.facing+armSwing,-30);
    ctx.moveTo(0,-42);ctx.lineTo(-8*f.facing,-30);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0,-14);ctx.lineTo(8*f.facing+legKick,0);
  ctx.moveTo(0,-14);ctx.lineTo(-7*f.facing,0);
  ctx.stroke();
  ctx.restore();
}
function draw(){
  ctx.fillStyle='#0e3a5f';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#2a3942';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,groundY);ctx.lineTo(W,groundY);ctx.stroke();
  drawStick(you);
  drawStick(ai);
}
function loop(){
  if(!running) return;
  update();
  draw();
  requestAnimationFrame(loop);
}
document.getElementById('back').addEventListener('click',()=>move(-1));
document.getElementById('fwd').addEventListener('click',()=>move(1));
document.getElementById('punch').addEventListener('click',()=>tryAttack(you,'punch'));
document.getElementById('kick').addEventListener('click',()=>tryAttack(you,'kick'));
document.getElementById('block').addEventListener('pointerdown',()=>setBlock(true));
document.getElementById('block').addEventListener('pointerup',()=>setBlock(false));
document.getElementById('block').addEventListener('pointerleave',()=>setBlock(false));
ovBtn.addEventListener('click',start);
reset();
draw();
})();
</script>
</body>
</html>`
}, {
  title: "Chess",
  html: `<!DOCTYPE html>
<html lang='id'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
<title>CHESS MASTER</title>
<style>
* {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
}
html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    min-width: 0;
}
body {
    width: 100%;
    min-height: 100vh;
    padding: 10px 8px 18px;
    background: radial-gradient(circle at top, #211536 0%, #09070e 55%, #050509 100%);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: center;
    overflow-x: hidden;
}
.container {
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
}
.brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #bc13fe;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 2px;
    margin: 4px 0 2px;
}
.title {
    margin: 0;
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 900;
    text-shadow: 0 0 12px rgba(188, 19, 254, 0.6);
}
.subtitle {
    margin: 4px 0 10px;
    color: #a489cc;
    font-size: 12px;
}
.status {
    width: 100%;
    min-height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    margin: 0 0 10px;
    border: 1px solid rgba(188, 19, 254, 0.35);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    color: #00ffcc;
    font-size: 13px;
    font-weight: 700;
}
.board-wrap {
    width: 100%;
    padding: 6px;
    border: 1px solid rgba(188, 19, 254, 0.4);
    border-radius: 16px;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
}
.board {
    width: 100%;
    aspect-ratio: 1 / 1;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-template-rows: repeat(8, 1fr);
    overflow: hidden;
    border-radius: 10px;
}
.square {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(28px, 8.5vw, 42px);
    line-height: 1;
    cursor: pointer;
    transition: transform 0.08s ease;
}
.square:active {
    transform: scale(0.92);
}
.light { background: #f0d9b5; color: #111; }
.dark { background: #b58863; color: #111; }
.selected { outline: 4px solid #bc13fe; outline-offset: -4px; }
.possible { box-shadow: inset 0 0 0 999px rgba(0, 255, 204, 0.35); }
.last { box-shadow: inset 0 0 0 999px rgba(255, 220, 0, 0.28); }
.check { box-shadow: inset 0 0 0 999px rgba(255, 40, 40, 0.5); }

.coord {
    position: absolute;
    right: 2px;
    bottom: 2px;
    font-size: 8px;
    font-weight: 800;
    color: rgba(0,0,0,0.45);
    pointer-events: none;
}
.captured {
    width: 100%;
    min-height: 26px;
    padding: 4px 2px;
    color: #ddd;
    font-size: 18px;
    letter-spacing: 2px;
}
.controls {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}
button {
    flex: 1;
    min-height: 42px;
    padding: 8px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #7c32dc, #bc13fe);
    color: #fff;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(188, 19, 254, 0.3);
}
button.secondary {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: none;
}
button:active {
    transform: scale(0.96);
}
.info {
    margin-top: 10px;
    color: #88858f;
    font-size: 11px;
    line-height: 1.4;
}
</style>
</head>
<body>

<div class='container'>
    <div class='brand'><span>●</span><span>CHESS GAME</span></div>
    <div class='title'>Chess Master ♟️</div>
    <div class='subtitle'>Kamu ♔ (Putih) vs AI ♚ (Hitam)</div>

    <div id='status' class='status'>🎯 Giliran kamu — pilih bidak putih.</div>

    <div class='board-wrap'>
        <div id='board' class='board'></div>
    </div>

    <div id='captured' class='captured'></div>

    <div class='controls'>
        <button onclick='newGame()'>🔄 Game Baru</button>
        <button class='secondary' onclick='undoMove()'>↩️ Undo</button>
    </div>

    <div class='info'>
        Klik bidak putih lalu klik kotak tujuan.<br>
        Pion di baris akhir otomatis promosi menjadi Queen.
    </div>
</div>

<script>
const PIECES = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

const START_BOARD = [
    ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
    ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
    ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
];

let board = START_BOARD.map(row => [...row]);
let turn = 'w';
let selected = null;
let possible = [];
let history = [];
let lastMove = null;
let captured = [];
let gameOver = false;

function cloneBoard(b) { return b.map(row => [...row]); }
function inside(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function colorOf(p) { return p ? p[0] : null; }
function typeOf(p) { return p ? p[1] : null; }
function opponent(c) { return c === 'w' ? 'b' : 'w'; }

function findKing(b, col) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] === col + 'k') return { r, c };
        }
    }
    return null;
}

function attacked(b, r, c, byColor) {
    const pawnRow = byColor === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) {
        const pc = c + dc;
        if (inside(pawnRow, pc) && b[pawnRow][pc] === byColor + 'p') return true;
    }

    const knights = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knights) {
        const nr = r + dr, nc = c + dc;
        if (inside(nr, nc) && b[nr][nc] === byColor + 'n') return true;
    }

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = c + dc;
            if (inside(nr, nc) && b[nr][nc] === byColor + 'k') return true;
        }
    }

    const straight = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of straight) {
        let nr = r + dr, nc = c + dc;
        while (inside(nr, nc)) {
            const p = b[nr][nc];
            if (p) {
                if (colorOf(p) === byColor && (typeOf(p) === 'r' || typeOf(p) === 'q')) return true;
                break;
            }
            nr += dr; nc += dc;
        }
    }

    const diagonal = [[-1,-1],[-1,1],[1,-1],[1,1]];
    for (const [dr, dc] of diagonal) {
        let nr = r + dr, nc = c + dc;
        while (inside(nr, nc)) {
            const p = b[nr][nc];
            if (p) {
                if (colorOf(p) === byColor && (typeOf(p) === 'b' || typeOf(p) === 'q')) return true;
                break;
            }
            nr += dr; nc += dc;
        }
    }
    return false;
}

function inCheck(b, col) {
    const k = findKing(b, col);
    return k ? attacked(b, k.r, k.c, opponent(col)) : true;
}

function pseudo(b, r, c) {
    const piece = b[r][c];
    if (!piece) return [];
    const color = colorOf(piece), type = typeOf(piece), res = [];

    function add(nr, nc, prom = null) {
        if (!inside(nr, nc)) return;
        const target = b[nr][nc];
        if (target && colorOf(target) === color) return;
        if (target && typeOf(target) === 'k') return;
        res.push({ from: { r, c }, to: { r: nr, c: nc }, promotion: prom });
    }

    if (type === 'p') {
        const dir = color === 'w' ? -1 : 1;
        const start = color === 'w' ? 6 : 1;
        const prom = color === 'w' ? 0 : 7;
        const nr = r + dir;
        if (inside(nr, c) && !b[nr][c]) {
            add(nr, c, nr === prom ? 'q' : null);
            if (r === start && !b[r + dir * 2][c]) add(r + dir * 2, c);
        }
        for (const dc of [-1, 1]) {
            const nc = c + dc;
            if (inside(nr, nc) && b[nr][nc] && colorOf(b[nr][nc]) !== color && typeOf(b[nr][nc]) !== 'k') {
                add(nr, nc, nr === prom ? 'q' : null);
            }
        }
        return res;
    }

    if (type === 'n') {
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => add(r + dr, c + dc));
        return res;
    }

    if (type === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr || dc) add(r + dr, c + dc);
            }
        }
        return res;
    }

    const dirs = [];
    if (type === 'r' || type === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
    if (type === 'b' || type === 'q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);

    for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (inside(nr, nc)) {
            if (!b[nr][nc]) {
                add(nr, nc);
            } else {
                if (colorOf(b[nr][nc]) !== color && typeOf(b[nr][nc]) !== 'k') add(nr, nc);
                break;
            }
            nr += dr; nc += dc;
        }
    }
    return res;
}

function apply(b, m) {
    const next = cloneBoard(b);
    const piece = next[m.from.r][m.from.c];
    next[m.from.r][m.from.c] = null;
    next[m.to.r][m.to.c] = m.promotion ? colorOf(piece) + m.promotion : piece;
    return next;
}

function legal(b, col) {
    const res = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] && colorOf(b[r][c]) === col) {
                pseudo(b, r, c).forEach(m => {
                    if (!inCheck(apply(b, m), col)) res.push(m);
                });
            }
        }
    }
    return res;
}

function render() {
    const root = document.getElementById('board');
    root.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

            if (selected && selected.r === r && selected.c === c) sq.classList.add('selected');
            if (possible.some(m => m.to.r === r && m.to.c === c)) sq.classList.add('possible');
            if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) sq.classList.add('last');

            const cur = board[r][c];
            if (cur && typeOf(cur) === 'k' && inCheck(board, colorOf(cur))) sq.classList.add('check');
            if (cur) sq.textContent = PIECES[colorOf(cur)][typeOf(cur)];

            const coord = document.createElement('span');
            coord.className = 'coord';
            coord.textContent = String.fromCharCode(97 + c) + (8 - r);
            sq.appendChild(coord);

            sq.onclick = () => clickSquare(r, c);
            root.appendChild(sq);
        }
    }

    document.getElementById('captured').textContent = captured.length
        ? '♟️ ' + captured.map(p => PIECES[p[0]][p[1]]).join(' ') : '';
    checkGame();
}

function setStatus(txt) { document.getElementById('status').textContent = txt; }

function clickSquare(r, c) {
    if (gameOver || turn !== 'w') return;
    const piece = board[r][c];

    if (selected) {
        const move = possible.find(m => m.to.r === r && m.to.c === c);
        if (move) { playerMove(move); return; }
        if (piece && colorOf(piece) === 'w') {
            selected = { r, c };
            possible = legal(board, 'w').filter(m => m.from.r === r && m.from.c === c);
            render();
            return;
        }
        selected = null; possible = [];
        render();
        return;
    }

    if (piece && colorOf(piece) === 'w') {
        selected = { r, c };
        possible = legal(board, 'w').filter(m => m.from.r === r && m.from.c === c);
        render();
    }
}

function playerMove(move) {
    history.push({ board: cloneBoard(board), captured: [...captured], lastMove, turn });
    const target = board[move.to.r][move.to.c];
    if (target) captured.push(target);

    board = apply(board, move);
    lastMove = move;
    selected = null;
    possible = [];
    turn = 'b';
    render();

    if (gameOver) return;
    setStatus('🤖 AI sedang berpikir...');
    setTimeout(aiMove, 450);
}

function aiMove() {
    if (gameOver) return;
    const moves = legal(board, 'b');
    if (!moves.length) { checkGame(); return; }

    let best = null, bestScore = -Infinity;
    const vals = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

    for (const m of moves) {
        const next = apply(board, m);
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = next[r][c];
                if (!p) continue;
                score += (colorOf(p) === 'b' ? 1 : -1) * (vals[typeOf(p)] || 0);
            }
        }
        if (board[m.to.r][m.to.c]) score += 40;
        score += Math.random() * 10;
        if (score > bestScore) { bestScore = score; best = m; }
    }

    if (!best) return;
    const target = board[best.to.r][best.to.c];
    if (target) captured.push(target);

    board = apply(board, best);
    lastMove = best;
    turn = 'w';
    render();

    if (!gameOver) setStatus('🎯 Giliran kamu — pilih bidak putih.');
}

function checkGame() {
    const moves = legal(board, turn);
    const check = inCheck(board, turn);

    if (moves.length === 0) {
        gameOver = true;
        setStatus(check ? (turn === 'w' ? '♚ CHECKMATE — AI MENANG!' : '♔ CHECKMATE — KAMU MENANG!') : '🤝 STALEMATE — SERI!');
        return;
    }
    if (check) setStatus(turn === 'w' ? '⚠️ CHECK! Rajamu diserang!' : '🔥 AI sedang CHECK!');
}

function undoMove() {
    if (!history.length) { setStatus('❌ Belum ada langkah untuk di-undo.'); return; }
    const prev = history.pop();
    board = cloneBoard(prev.board);
    captured = [...prev.captured];
    lastMove = prev.lastMove;
    turn = 'w'; selected = null; possible = []; gameOver = false;
    render();
    setStatus('🎯 Giliran kamu — pilih bidak putih.');
}

function newGame() {
    board = START_BOARD.map(row => [...row]);
    turn = 'w'; selected = null; possible = []; history = []; lastMove = null; captured = []; gameOver = false;
    render();
    setStatus('🎯 Giliran kamu — pilih bidak putih.');
}

render();
</script>
</body>
</html>`
}, {
  title: "Billiard",
  html: `<!DOCTYPE html>
<html lang='id'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
<title>PRO BILLIARD MASTER VS AI</title>
<style>
* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
}
body {
  width: 100%;
  min-height: 100vh;
  padding: 8px 6px 20px;
  background: radial-gradient(circle at top, #191207 0%, #0c0803 55%, #050301 100%);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  text-align: center;
  overflow-x: hidden;
}
.container {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}
.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #d4af37;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 2px;
  margin: 2px 0;
}
.title {
  margin: 0;
  font-size: clamp(22px, 6vw, 28px);
  font-weight: 900;
  color: #fce8a2;
  text-shadow: 0 0 14px rgba(212, 175, 55, 0.6);
}
.subtitle {
  margin: 2px 0 8px;
  color: #a89a84;
  font-size: 11px;
}

/* SCOREBOARD HUD */
.score-board {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.score-card {
  flex: 1;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(212, 175, 55, 0.35);
  border-radius: 10px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
}
.score-card.active-turn {
  border-color: #2ecc71;
  box-shadow: 0 0 10px rgba(46, 204, 113, 0.4);
  background: rgba(46, 204, 113, 0.12);
}
.score-name {
  font-size: 11px;
  font-weight: 800;
  color: #d4af37;
}
.score-num {
  font-size: 15px;
  font-weight: 900;
  color: #fff;
}

.status {
  width: 100%;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  margin: 0 0 8px;
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: #ffd966;
  font-size: 12px;
  font-weight: 800;
}

/* TABLE FRAME */
.table-wrap {
  width: 100%;
  padding: 4px;
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 14px;
  background: #120b05;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
}
canvas#poolCanvas {
  width: 100%;
  aspect-ratio: 1 / 1.46;
  background: #0d4a22;
  border-radius: 10px;
  display: block;
}

/* DASHBOARD CONTROLS */
.dashboard {
  width: 100%;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: opacity 0.2s;
}
.dashboard.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.panel-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(212, 175, 55, 0.25);
  border-radius: 10px;
  padding: 8px;
}
.panel-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #d4af37;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.btn-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}
button {
  min-height: 38px;
  padding: 6px 4px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
button:active {
  transform: scale(0.95);
  background: rgba(212, 175, 55, 0.3);
}

/* POWER SLIDER */
.power-box {
  display: flex;
  align-items: center;
  gap: 8px;
}
input[type=range] {
  flex: 1;
  accent-color: #ffd966;
  height: 6px;
  cursor: pointer;
}
.power-val {
  font-size: 12px;
  font-weight: 900;
  color: #ffd966;
  min-width: 45px;
  text-align: right;
}

/* ACTION BUTTON */
.btn-shoot {
  width: 100%;
  min-height: 44px;
  background: linear-gradient(135deg, #1b8a47, #2ecc71);
  color: #032410;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 1px;
  border-radius: 10px;
  border: none;
  box-shadow: 0 4px 15px rgba(46, 204, 113, 0.4);
}
.btn-shoot:active {
  background: #27ae60;
}

/* SPIN CUE BALL CONTROLLER */
.spin-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.spin-preview {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffffff 0%, #d8d8d8 60%, #888888 100%);
  box-shadow: inset 0 0 8px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.6);
  border: 2px solid #d4af37;
  flex: none;
}
.spin-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff0044;
  box-shadow: 0 0 6px #ff0044;
  transform: translate(-50%, -50%);
  top: 50%;
  left: 50%;
  pointer-events: none;
}
.spin-btns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  flex: 1;
}

.info {
  margin-top: 8px;
  color: #8f8577;
  font-size: 10.5px;
  line-height: 1.4;
}
</style>
</head>
<body>

<div class='container'>
  <div class='brand'><span>●</span><span>PRO BILLIARD SIMULATOR</span></div>
  <div class='title'>Billiard vs AI 🎱</div>
  <div class='subtitle'>Kamu 👤 vs Komputer 🤖 • 8-Ball Rules</div>

  <!-- SCOREBOARD -->
  <div class='score-board'>
    <div class='score-card active-turn' id='cardPlayer'>
      <span class='score-name'>👤 KAMU:</span>
      <span class='score-num' id='scorePlayer'>0</span>
    </div>
    <div class='score-card' id='cardAI'>
      <span class='score-name'>🤖 BOT AI:</span>
      <span class='score-num' id='scoreAI'>0</span>
    </div>
  </div>

  <div id='status' class='status'>🎯 Giliran KAMU — bidik dan pukul bola!</div>

  <div class='table-wrap'>
    <canvas id='poolCanvas' width='320' height='465'></canvas>
  </div>

  <div class='dashboard' id='dashboard'>
    <!-- 1. AIM CONTROLLER -->
    <div class='panel-card'>
      <div class='panel-label'>
        <span>SUDUT BIDIKAN</span>
        <span id='angleTxt'>0.0°</span>
      </div>
      <div class='btn-grid'>
        <button id='bFastLeft'>⏪ -5°</button>
        <button id='bLeft'>◀ -1°</button>
        <button style='background:rgba(212,175,55,0.2); border-color:#d4af37;' onclick='autoAim()'>🎯 AUTO</button>
        <button id='bRight'>+1° ▶</button>
        <button id='bFastRight'>+5° ⏩</button>
      </div>
    </div>

    <!-- 2. POWER SLIDER -->
    <div class='panel-card'>
      <div class='panel-label'>
        <span>KEKUATAN PUKULAN (POWER)</span>
        <span class='power-val' id='powerTxt'>65%</span>
      </div>
      <div class='power-box'>
        <button style='min-height:30px; padding:2px 8px;' onclick='addPower(-5)'>-5%</button>
        <input type='range' id='powerRange' min='10' max='100' value='65' oninput='onPowerChange(this.value)'>
        <button style='min-height:30px; padding:2px 8px;' onclick='addPower(5)'>+5%</button>
      </div>
    </div>

    <!-- 3. TOMBOL AKSI UTAMA -->
    <button class='btn-shoot' id='btnShoot' onclick='playerShoot()'>💥 PUKUL BOLA SEKARANG</button>
    
    <div style='display: flex; gap: 6px;'>
      <button style='flex: 1; background:rgba(255,255,255,0.06);' onclick='initGame()'>🔄 RESET / GAME BARU</button>
    </div>

    <!-- 4. TITIK PUKUL BOLA / SPIN -->
    <div class='panel-card'>
      <div class='panel-label'>
        <span>TITIK PUKUL BOLA (SPIN / ENGLISH)</span>
        <span id='spinName'>CENTER</span>
      </div>
      <div class='spin-wrap'>
        <div class='spin-preview' id='spinBall'>
          <div class='spin-dot' id='spinDot'></div>
        </div>
        <div class='spin-btns'>
          <div></div>
          <button onclick='setSpin(0, -0.75, 'TOP / JUMP')'>⬆ TOP</button>
          <div></div>
          <button onclick='setSpin(-0.65, 0, 'LEFT SPIN')'>⬅ LEFT</button>
          <button onclick='setSpin(0, 0, 'CENTER')' style='color:#ffd966;'>⦿ MID</button>
          <button onclick='setSpin(0.65, 0, 'RIGHT SPIN')'>RIGHT ➡</button>
          <div></div>
          <button onclick='setSpin(0, 0.75, 'BACK / DRAW')'>⬇ BACK</button>
          <div></div>
        </div>
      </div>
    </div>
  </div>

  <div class='info'>
    Masukkan bola untuk mendapatkan bonus giliran.<br>
    Jika terjadi <b>Foul</b> (bola putih masuk), giliran langsung berpindah ke lawan!
  </div>
</div>

<script>
const canvas = document.getElementById('poolCanvas');
const ctx = canvas.getContext('2d');

let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playBallHit(spd) {
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, ac.currentTime);

    const vol = Math.min(0.35, Math.max(0.02, spd * 0.04));
    osc.frequency.setValueAtTime(360 + Math.random() * 80, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ac.currentTime + 0.06);

    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    osc.start(); osc.stop(ac.currentTime + 0.06);
  } catch(e) {}
}

function playJumpLand() {
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.setValueAtTime(110, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + 0.08);
  } catch(e) {}
}

function playPocketSound() {
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.setValueAtTime(180, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ac.currentTime + 0.16);
    gain.gain.setValueAtTime(0.2, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + 0.16);
  } catch(e) {}
}

const BALL_RADIUS = 9.5;
const FRICTION = 0.986;
const GRAVITY_Z = 0.42;

const POCKET_RADIUS = 20;
const POCKET_MOUTH_RADIUS = 34;

const pockets = [
  { x: 18, y: 18 },
  { x: 302, y: 18 },
  { x: 13, y: 232 },
  { x: 307, y: 232 },
  { x: 18, y: 447 },
  { x: 302, y: 447 }
];

let balls = [];
let cueBall = null;
let aimAngle = -Math.PI / 2;
let powerPercent = 65;
let spinX = 0;
let spinY = 0;

// GAME STATE & FOUL HANDLERS
let currentTurn = 'player'; // 'player' | 'ai'
let scorePlayer = 0;
let scoreAI = 0;
let ballPottedThisTurn = false;
let cueFoulOccurred = false;
let isShotInProgress = false;
let isRespawningCue = false;

const BALL_DATA = [
  { num: 0, col: '#ffffff' }, // Cue
  { num: 1, col: '#f1c40f' },
  { num: 2, col: '#2980b9' },
  { num: 3, col: '#e74c3c' },
  { num: 4, col: '#8e44ad' },
  { num: 5, col: '#e67e22' },
  { num: 6, col: '#27ae60' },
  { num: 7, col: '#8b1e1e' },
  { num: 8, col: '#111111' }
];

function initGame() {
  getAudio();
  balls = [];
  scorePlayer = 0;
  scoreAI = 0;
  currentTurn = 'player';
  isShotInProgress = false;
  isRespawningCue = false;
  ballPottedThisTurn = false;
  cueFoulOccurred = false;
  aimAngle = -Math.PI / 2;

  updateScoreUI();

  cueBall = {
    x: 160, y: 350, z: 0,
    vx: 0, vy: 0, vz: 0,
    rotX: 0, rotY: 0,
    r: BALL_RADIUS, data: BALL_DATA[0],
    isCue: true, sunk: false,
    spinX: 0, spinY: 0
  };
  balls.push(cueBall);

  const startX = 160, startY = 140;
  let idx = 1;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c <= r; c++) {
      const ox = (c - r / 2) * (BALL_RADIUS * 2 + 1.2);
      const oy = r * (BALL_RADIUS * 1.8);
      balls.push({
        x: startX + ox, y: startY - oy, z: 0,
        vx: 0, vy: 0, vz: 0,
        rotX: Math.random() * Math.PI,
        rotY: Math.random() * Math.PI,
        r: BALL_RADIUS,
        data: BALL_DATA[idx % BALL_DATA.length],
        isCue: false, sunk: false
      });
      idx++;
    }
  }

  updateAngleUI();
  setStatus('🎯 Giliran KAMU — bidik & pukul bola!');
}

function setStatus(txt) { document.getElementById('status').innerText = txt; }

function updateScoreUI() {
  document.getElementById('scorePlayer').innerText = scorePlayer;
  document.getElementById('scoreAI').innerText = scoreAI;
  
  const cP = document.getElementById('cardPlayer');
  const cAI = document.getElementById('cardAI');
  const dash = document.getElementById('dashboard');

  if (currentTurn === 'player') {
    cP.classList.add('active-turn');
    cAI.classList.remove('active-turn');
    dash.classList.remove('disabled');
  } else {
    cAI.classList.add('active-turn');
    cP.classList.remove('active-turn');
    dash.classList.add('disabled');
  }
}

function areBallsMoving() {
  return balls.some(b => !b.sunk && (Math.hypot(b.vx, b.vy) > 0.08 || b.z > 0 || Math.abs(b.vz) > 0.1));
}

function onPowerChange(val) {
  powerPercent = parseInt(val);
  document.getElementById('powerTxt').innerText = powerPercent + '%';
}

function addPower(delta) {
  const el = document.getElementById('powerRange');
  el.value = Math.min(100, Math.max(10, parseInt(el.value) + delta));
  onPowerChange(el.value);
}

function setSpin(x, y, name) {
  spinX = x;
  spinY = y;
  document.getElementById('spinName').innerText = name;
  const dot = document.getElementById('spinDot');
  dot.style.left = (50 + x * 35) + '%';
  dot.style.top = (50 + y * 35) + '%';
}

function updateAngleUI() {
  let deg = ((aimAngle * 180 / Math.PI) % 360);
  if (deg < 0) deg += 360;
  document.getElementById('angleTxt').innerText = deg.toFixed(1) + '°';
}

function autoAim() {
  if (!cueBall || cueBall.sunk || currentTurn !== 'player' || isShotInProgress) return;
  let closest = null, minDist = Infinity;
  balls.forEach(b => {
    if (!b.isCue && !b.sunk) {
      const d = Math.hypot(b.x - cueBall.x, b.y - cueBall.y);
      if (d < minDist) { minDist = d; closest = b; }
    }
  });
  if (closest) {
    aimAngle = Math.atan2(closest.y - cueBall.y, closest.x - cueBall.x);
    updateAngleUI();
  }
}

function playerShoot() {
  if (currentTurn !== 'player' || areBallsMoving() || isShotInProgress || isRespawningCue || !cueBall || cueBall.sunk) return;
  executeShot(aimAngle, powerPercent, spinX, spinY);
}

function executeShot(angle, pwr, sx, sy) {
  getAudio();
  isShotInProgress = true;
  ballPottedThisTurn = false;
  cueFoulOccurred = false;

  const power = (pwr / 100) * 14.5 + 1.5;
  cueBall.vx = Math.cos(angle) * power;
  cueBall.vy = Math.sin(angle) * power;

  cueBall.spinX = sx * (power * 0.4);
  cueBall.spinY = sy * (power * 0.4);

  if (pwr > 80 && Math.abs(sy) > 0.5) {
    cueBall.vz = (pwr / 100) * 3.5;
  }

  playBallHit(power);
}

/* ============================================================
 * AI THINKING & AIMING LOGIC
 * ============================================================
 */
function aiTurn() {
  if (currentTurn !== 'ai' || isShotInProgress || isRespawningCue || cueBall.sunk) return;
  setStatus('🤖 AI sedang menghitung sudut & lintasan bola...');

  setTimeout(() => {
    if (currentTurn !== 'ai' || cueBall.sunk) return;

    let bestShot = null;
    let highestScore = -Infinity;

    const activeBalls = balls.filter(b => !b.isCue && !b.sunk);
    if (!activeBalls.length) return;

    activeBalls.forEach(b => {
      pockets.forEach(p => {
        const tpX = p.x - b.x;
        const tpY = p.y - b.y;
        const tpDist = Math.hypot(tpX, tpY);
        const normTpX = tpX / tpDist;
        const normTpY = tpY / tpDist;

        const ghostX = b.x - normTpX * (BALL_RADIUS * 2);
        const ghostY = b.y - normTpY * (BALL_RADIUS * 2);

        const cgX = ghostX - cueBall.x;
        const cgY = ghostY - cueBall.y;
        const cgDist = Math.hypot(cgX, cgY);
        const normCgX = cgX / cgDist;
        const normCgY = cgY / cgDist;

        const dot = normCgX * normTpX + normCgY * normTpY;

        if (dot > 0.1) {
          const score = dot * 100 - tpDist * 0.15 - cgDist * 0.1;
          if (score > highestScore) {
            highestScore = score;
            bestShot = {
              angle: Math.atan2(cgY, cgX),
              power: Math.min(85, Math.max(45, (tpDist + cgDist) * 0.2 + 35))
            };
          }
        }
      });
    });

    if (!bestShot) {
      const target = activeBalls[0];
      bestShot = {
        angle: Math.atan2(target.y - cueBall.y, target.x - cueBall.x),
        power: 60
      };
    }

    bestShot.angle += (Math.random() - 0.5) * 0.04;
    aimAngle = bestShot.angle;
    updateAngleUI();
    setStatus('🤖 AI mengeksekusi tembakan!');

    setTimeout(() => {
      if (currentTurn === 'ai' && !cueBall.sunk) {
        executeShot(bestShot.angle, bestShot.power, 0, 0);
      }
    }, 500);
  }, 800);
}

/* ============================================================
 * TURN RESOLUTION & FOUL RECOVERY
 * ============================================================
 */
function checkTurnEnd() {
  if (!isShotInProgress || areBallsMoving() || isRespawningCue) return;

  isShotInProgress = false;
  const totalRemaining = balls.filter(b => !b.isCue && !b.sunk).length;

  if (totalRemaining === 0) {
    if (scorePlayer > scoreAI) {
      setStatus('🏆 SELAMAT! KAMU MENANG! (' + scorePlayer + ' vs ' + scoreAI + ')');
    } else if (scoreAI > scorePlayer) {
      setStatus('🤖 AI MENANG! (' + scoreAI + ' vs ' + scorePlayer + ')');
    } else {
      setStatus('🤝 PERTANDINGAN SERI! (' + scorePlayer + ' vs ' + scoreAI + ')');
    }
    return;
  }

  // 1. KASUS FOUL (Bola putih masuk lubang)
  if (cueFoulOccurred) {
    cueFoulOccurred = false;
    currentTurn = currentTurn === 'player' ? 'ai' : 'player';
    updateScoreUI();

    if (currentTurn === 'player') {
      setStatus('⚠️ AI FOUL! Bola putih masuk. Giliran KAMU!');
    } else {
      setStatus('⚠️ FOUL! Bola putih masuk. Giliran BOT AI!');
      setTimeout(aiTurn, 600);
    }
    return;
  }

  // 2. KASUS BOLA MASUK (BONUS TURN)
  if (ballPottedThisTurn) {
    if (currentTurn === 'player') {
      setStatus('🎉 Bola masuk! Kamu dapat giliran bonus!');
    } else {
      setStatus('🤖 AI berhasil memasukkan bola & lanjut menembak!');
      setTimeout(aiTurn, 600);
    }
    return;
  }

  // 3. GANTI GILIRAN NORMAL (MISS)
  currentTurn = currentTurn === 'player' ? 'ai' : 'player';
  updateScoreUI();

  if (currentTurn === 'player') {
    setStatus('🎯 Giliran KAMU — bidik dan pukul bola!');
  } else {
    aiTurn();
  }
}

function resolveCollisions() {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const b1 = balls[i];
      const b2 = balls[j];
      if (b1.sunk || b2.sunk) continue;

      const dx = b2.x - b1.x;
      const dy = b2.y - b1.y;
      const dist = Math.hypot(dx, dy);

      if (dist < b1.r + b2.r && dist > 0 && Math.abs(b1.z - b2.z) < 8) {
        const nx = dx / dist;
        const ny = dy / dist;

        const overlap = (b1.r + b2.r - dist) / 2;
        b1.x -= nx * overlap;
        b1.y -= ny * overlap;
        b2.x += nx * overlap;
        b2.y += ny * overlap;

        const tx = -ny;
        const ty = nx;

        const dpTan1 = b1.vx * tx + b1.vy * ty;
        const dpTan2 = b2.vx * tx + b2.vy * ty;
        const dpNorm1 = b1.vx * nx + b1.vy * ny;
        const dpNorm2 = b2.vx * nx + b2.vy * ny;

        b1.vx = tx * dpTan1 + nx * dpNorm2;
        b1.vy = ty * dpTan1 + ny * dpNorm2;
        b2.vx = tx * dpTan2 + nx * dpNorm1;
        b2.vy = ty * dpTan2 + ny * dpNorm1;

        if (b1.isCue && (b1.spinY !== 0 || b1.spinX !== 0)) {
          b1.vx -= nx * b1.spinY * 1.5;
          b1.vy -= ny * b1.spinY * 1.5;
          b1.vx += tx * b1.spinX * 0.8;
          b1.vy += ty * b1.spinX * 0.8;
          b1.spinY *= 0.2;
          b1.spinX *= 0.2;
        }

        const impact = Math.abs(dpNorm1 - dpNorm2);
        if (impact > 6.5) b2.vz = impact * 0.22;
        if (impact > 0.4) playBallHit(impact);
      }
    }
  }
}

function updatePhysics() {
  balls.forEach(b => {
    if (b.sunk) return;

    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;

    b.rotX += b.vy / (b.r * 1.1);
    b.rotY += b.vx / (b.r * 1.1);

    if (b.z > 0 || b.vz !== 0) {
      b.z += b.vz;
      b.vz -= GRAVITY_Z;

      if (b.z <= 0) {
        b.z = 0;
        if (Math.abs(b.vz) > 1.2) {
          b.vz = -b.vz * 0.35;
          playJumpLand();
        } else {
          b.vz = 0;
        }
      }
    }

    if (Math.hypot(b.vx, b.vy) < 0.05 && b.z === 0) {
      b.vx = 0; b.vy = 0;
    }

    // POCKET VACUUM & ENTRY
    let inPocketZone = false;
    for (let p of pockets) {
      const dist = Math.hypot(b.x - p.x, b.y - p.y);

      if (dist < POCKET_MOUTH_RADIUS && b.z < 6) {
        inPocketZone = true;
        const pull = 0.55;
        b.vx += ((p.x - b.x) / dist) * pull;
        b.vy += ((p.y - b.y) / dist) * pull;

        if (Math.hypot(b.vx, b.vy) < 0.35) {
          b.vx = ((p.x - b.x) / dist) * 1.8;
          b.vy = ((p.y - b.y) / dist) * 1.8;
        }

        if (dist < POCKET_RADIUS) {
          b.sunk = true;
          b.vx = 0; b.vy = 0; b.z = 0;
          playPocketSound();

          // FIX FOUL & RESPAWN SYNCHRONIZATION
          if (b.isCue) {
            cueFoulOccurred = true;
            isRespawningCue = true;
            setStatus('⚠️ FOUL! Bola putih masuk lubang...');

            setTimeout(() => {
              b.x = 160;
              b.y = 350;
              b.vx = 0;
              b.vy = 0;
              b.z = 0;
              b.sunk = false;
              isRespawningCue = false;
            }, 700);
          } else {
            ballPottedThisTurn = true;
            if (currentTurn === 'player') {
              scorePlayer++;
            } else {
              scoreAI++;
            }
            updateScoreUI();
          }
        }
        break;
      }
    }

    // CUSHION BOUNCE
    if (!inPocketZone && b.z < 5) {
      const minX = 22, maxX = 298, minY = 22, maxY = 443;
      if (b.x - b.r < minX) {
        b.x = minX + b.r; b.vx = -b.vx * 0.84;
        if (b.isCue && b.spinX) b.vy += b.spinX * 0.8;
        playBallHit(Math.abs(b.vx));
      }
      if (b.x + b.r > maxX) {
        b.x = maxX - b.r; b.vx = -b.vx * 0.84;
        if (b.isCue && b.spinX) b.vy += b.spinX * 0.8;
        playBallHit(Math.abs(b.vx));
      }
      if (b.y - b.r < minY) {
        b.y = minY + b.r; b.vy = -b.vy * 0.84;
        if (b.isCue && b.spinX) b.vy += b.spinX * 0.8;
        playBallHit(Math.abs(b.vy));
      }
      if (b.y + b.r > maxY) {
        b.y = maxY - b.r; b.vy = -b.vy * 0.84;
        if (b.isCue && b.spinX) b.vy += b.spinX * 0.8;
        playBallHit(Math.abs(b.vy));
      }
    }
  });

  resolveCollisions();
  checkTurnEnd();
}

function drawRealisticTable() {
  ctx.fillStyle = '#26140a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1c5e31';
  ctx.fillRect(14, 14, canvas.width - 28, canvas.height - 28);

  ctx.fillStyle = '#0f4f26';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = '#d4af37';
  [80, 160, 240].forEach(x => {
    ctx.beginPath(); ctx.arc(x, 7, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, 458, 2, 0, Math.PI*2); ctx.fill();
  });
  [116, 232, 348].forEach(y => {
    ctx.beginPath(); ctx.arc(7, y, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(313, y, 2, 0, Math.PI*2); ctx.fill();
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(22, 350); ctx.lineTo(298, 350);
  ctx.stroke();

  pockets.forEach(p => {
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#120a05';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  });
}

function drawBall(b) {
  if (b.sunk) return;

  const drawY = b.y - b.z;
  const scale = 1 + (b.z / 35);
  const curRadius = b.r * scale;

  // Drop Shadow
  ctx.save();
  const shadowAlpha = Math.max(0.08, 0.35 - (b.z / 40));
  const shadowSize = b.r * (1 + b.z / 25);
  ctx.fillStyle = 'rgba(0,0,0,' + shadowAlpha + ')';
  ctx.beginPath();
  ctx.ellipse(b.x + 2 + b.z * 0.3, b.y + 3 + b.z * 0.5, shadowSize * 0.9, shadowSize * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3D Sphere Body
  ctx.save();
  ctx.beginPath();
  ctx.arc(b.x, drawY, curRadius, 0, Math.PI * 2);
  ctx.clip();

  const grad = ctx.createRadialGradient(
    b.x - curRadius * 0.35, drawY - curRadius * 0.35, curRadius * 0.1,
    b.x, drawY, curRadius
  );
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, b.data.col);
  grad.addColorStop(1, '#050505');

  ctx.fillStyle = grad;
  ctx.fillRect(b.x - curRadius, drawY - curRadius, curRadius * 2, curRadius * 2);

  // FIX NOMOR CRISP & 3D ROLLING PROJECTION
  if (!b.isCue) {
    const projX = Math.sin(b.rotY);
    const projY = Math.sin(b.rotX);
    const visibleZ = Math.cos(b.rotY) * Math.cos(b.rotX);

    const numX = b.x + projX * (curRadius * 0.52);
    const numY = drawY + projY * (curRadius * 0.52);
    const spotScale = Math.max(0.3, (visibleZ + 1.2) * 0.45);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(numX, numY, curRadius * 0.46 * spotScale, curRadius * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold ' + Math.max(7, Math.floor(8 * spotScale * scale)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.data.num, numX, numY + 0.5);
  }

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRealisticTable();

  // Draw Balls
  balls.forEach(drawBall);

  // Cue Stick & Trajectory Guide (Hanya saat giliran Player & bola diam)
  if (!areBallsMoving() && cueBall && !cueBall.sunk && !isShotInProgress && !isRespawningCue && currentTurn === 'player') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cueBall.x, cueBall.y);
    const targetX = cueBall.x + Math.cos(aimAngle) * 165;
    const targetY = cueBall.y + Math.sin(aimAngle) * 165;
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    const stickDist = 24 + (powerPercent / 100) * 12;
    const sx = cueBall.x - Math.cos(aimAngle) * stickDist;
    const sy = cueBall.y - Math.sin(aimAngle) * stickDist;

    ctx.strokeStyle = '#c68a4c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - Math.cos(aimAngle) * 135, sy - Math.sin(aimAngle) * 135);
    ctx.stroke();

    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - Math.cos(aimAngle) * 5, sy - Math.sin(aimAngle) * 5);
    ctx.stroke();
  }

  updatePhysics();
  requestAnimationFrame(draw);
}

// Aim button rotation
let rotInterval = null;
function startRot(delta) {
  if (currentTurn !== 'player' || isShotInProgress || isRespawningCue) return;
  aimAngle += delta;
  updateAngleUI();
  rotInterval = setInterval(() => {
    aimAngle += delta;
    updateAngleUI();
  }, 40);
}
function stopRot() { clearInterval(rotInterval); }

function bindBtn(id, delta) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', () => startRot(delta));
  el.addEventListener('pointerup', stopRot);
  el.addEventListener('pointerleave', stopRot);
}

bindBtn('bFastLeft', -0.087);
bindBtn('bLeft', -0.0174);
bindBtn('bRight', 0.0174);
bindBtn('bFastRight', 0.087);

initGame();
draw();
</script>
</body>
</html>`
}, {
  title: "Snake",
  html: `<!DOCTYPE html>
<html lang='id'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
    <title>Minimal Smooth Snake</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            user-select: none;
            -webkit-user-select: none;
        }

        body {
            background: #0f172a;
            color: #f8fafc;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 16px;
        }

        #app {
            width: 100%;
            max-width: 380px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        /* Top Header / Scoreboard */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 6px;
        }

        .brand {
            display: flex;
            flex-direction: column;
        }

        .brand h1 {
            font-size: 18px;
            font-weight: 800;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #4ade80, #22c55e);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .brand span {
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        .scores {
            display: flex;
            gap: 8px;
        }

        .score-card {
            background: #1e293b;
            border: 1px solid #334155;
            padding: 6px 12px;
            border-radius: 10px;
            text-align: center;
            min-width: 60px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .score-card small {
            display: block;
            font-size: 9px;
            font-weight: 700;
            color: #94a3b8;
            letter-spacing: 0.5px;
        }

        .score-card span {
            font-size: 15px;
            font-weight: 800;
            color: #f8fafc;
        }

        /* Canvas Arena */
        .arena-wrapper {
            position: relative;
            width: 100%;
            aspect-ratio: 1 / 1;
            background: #020617;
            border-radius: 20px;
            border: 1.5px solid #1e293b;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(34, 197, 94, 0.05);
        }

        canvas {
            width: 100%;
            height: 100%;
            display: block;
        }

        /* Modal Overlay */
        .overlay {
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(6px);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 24px;
            transition: all 0.3s ease;
            z-index: 10;
        }

        .overlay.hidden {
            opacity: 0;
            pointer-events: none;
        }

        .overlay h2 {
            font-size: 22px;
            font-weight: 800;
            margin-bottom: 6px;
            color: #f8fafc;
        }

        .overlay p {
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 20px;
            max-width: 200px;
            line-height: 1.4;
        }

        .play-btn {
            background: #22c55e;
            color: #020617;
            border: none;
            padding: 12px 28px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(34, 197, 94, 0.35);
            transition: transform 0.15s ease, background 0.2s ease;
        }

        .play-btn:active {
            transform: scale(0.95);
            background: #16a34a;
        }

        /* Responsive Controls */
        .controls {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-top: 4px;
            justify-items: center;
        }

        .ctrl-btn {
            width: 58px;
            height: 52px;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 14px;
            color: #cbd5e1;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.1s ease;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
            -webkit-tap-highlight-color: transparent;
        }

        .ctrl-btn:active {
            background: #334155;
            color: #22c55e;
            transform: scale(0.92);
        }
    </style>
</head>
<body>

<div id='app'>
    <!-- Header -->
    <div class='header'>
        <div class='brand'>
            <h1>SNAKE</h1>
            <span>No Wall Limits</span>
        </div>
        <div class='scores'>
            <div class='score-card'>
                <small>SKOR</small>
                <span id='sc'>0</span>
            </div>
            <div class='score-card'>
                <small>TERBAIK</small>
                <span id='bs'>0</span>
            </div>
        </div>
    </div>

    <!-- Arena Game -->
    <div class='arena-wrapper'>
        <canvas id='cv' width='360' height='360'></canvas>
        
        <!-- Modal Menu / Game Over -->
        <div id='modal' class='overlay'>
            <h2 id='modalTitle'>Snake Game</h2>
            <p id='modalDesc'>Dinding bisa ditembus! Jangan gigit badan sendiri.</p>
            <button id='startBtn' class='play-btn'>Main Sekarang</button>
        </div>
    </div>

    <!-- D-Pad Controls -->
    <div class='controls'>
        <div></div>
        <button class='ctrl-btn' id='upBtn'>▲</button>
        <div></div>
        <button class='ctrl-btn' id='leftBtn'>◀</button>
        <button class='ctrl-btn' id='downBtn'>▼</button>
        <button class='ctrl-btn' id='rightBtn'>▶</button>
    </div>
</div>

<script>
(function() {
    const cv = document.getElementById('cv');
    const ctx = cv.getContext('2d');
    const scEl = document.getElementById('sc');
    const bsEl = document.getElementById('bs');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDesc = document.getElementById('modalDesc');
    const startBtn = document.getElementById('startBtn');

    const grid = 20;
    const tileCount = 18; // 360 / 20 = 18

    let snake = [];
    let food = { x: 0, y: 0 };
    let dx = 1, dy = 0;
    let nextDx = 1, nextDy = 0;
    let score = 0;
    let best = 0;
    let isPlay = false;
    let gameLoop = null;

    // Load High Score
    try {
        best = parseInt(localStorage.getItem('snake_wrap_best') || '0', 10);
    } catch(e) {}
    bsEl.textContent = best;

    function startGame() {
        modal.classList.add('hidden');
        snake = [
            { x: 5, y: 9 },
            { x: 4, y: 9 },
            { x: 3, y: 9 }
        ];
        dx = 1; dy = 0;
        nextDx = 1; nextDy = 0;
        score = 0;
        scEl.textContent = '0';
        spawnFood();
        isPlay = true;

        if (gameLoop) clearInterval(gameLoop);
        gameLoop = setInterval(update, 115);
    }

    function spawnFood() {
        let valid = false;
        while (!valid) {
            food.x = Math.floor(Math.random() * tileCount);
            food.y = Math.floor(Math.random() * tileCount);
            valid = !snake.some(seg => seg.x === food.x && seg.y === food.y);
        }
    }

    function setDirection(newDx, newDy) {
        // Mencegah berbalik arah ke diri sendiri secara instan
        if ((newDx === -dx && newDx !== 0) || (newDy === -dy && newDy !== 0)) return;
        nextDx = newDx;
        nextDy = newDy;
    }

    // Controls: Touch Button
    document.getElementById('upBtn').addEventListener('click', () => setDirection(0, -1));
    document.getElementById('downBtn').addEventListener('click', () => setDirection(0, 1));
    document.getElementById('leftBtn').addEventListener('click', () => setDirection(-1, 0));
    document.getElementById('rightBtn').addEventListener('click', () => setDirection(1, 0));

    // Controls: Keyboard
    window.addEventListener('keydown', (e) => {
        if (!isPlay && (e.code === 'Space' || e.key === 'Enter')) {
            startGame();
            return;
        }
        switch(e.key.toLowerCase()) {
            case 'arrowup':
            case 'w': setDirection(0, -1); break;
            case 'arrowdown':
            case 's': setDirection(0, 1); break;
            case 'arrowleft':
            case 'a': setDirection(-1, 0); break;
            case 'arrowright':
            case 'd': setDirection(1, 0); break;
        }
    });

    // Controls: Swipe Gestures on Canvas
    let touchStartX = 0, touchStartY = 0;
    cv.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    cv.addEventListener('touchend', (e) => {
        if (!isPlay) return;
        let deltaX = e.changedTouches[0].clientX - touchStartX;
        let deltaY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
            setDirection(deltaX > 0 ? 1 : -1, 0);
        } else if (Math.abs(deltaY) > 20) {
            setDirection(0, deltaY > 0 ? 1 : -1);
        }
    }, { passive: true });

    startBtn.addEventListener('click', startGame);

    function update() {
        if (!isPlay) return;

        dx = nextDx;
        dy = nextDy;

        // Tembus Dinding (Wrap Around logic)
        let head = {
            x: (snake[0].x + dx + tileCount) % tileCount,
            y: (snake[0].y + dy + tileCount) % tileCount
        };

        // Tabrak Badan Sendiri
        for (let i = 0; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                gameOver();
                return;
            }
        }

        snake.unshift(head);

        // Makan Apel
        if (head.x === food.x && head.y === food.y) {
            score++;
            scEl.textContent = score;
            if (score > best) {
                best = score;
                bsEl.textContent = best;
                try { localStorage.setItem('snake_wrap_best', best); } catch(e) {}
            }
            spawnFood();
        } else {
            snake.pop();
        }

        render();
    }

    function render() {
        // Clear background
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, cv.width, cv.height);

        // Grid dots halus untuk estetika
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let x = 0; x < tileCount; x++) {
            for (let y = 0; y < tileCount; y++) {
                ctx.beginPath();
                ctx.arc(x * grid + grid / 2, y * grid + grid / 2, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Render Apple (Juicy & Glowing)
        let fx = food.x * grid + grid / 2;
        let fy = food.y * grid + grid / 2;
        
        ctx.save();
        ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
        ctx.shadowBlur = 10;

        let appleGrad = ctx.createRadialGradient(fx - 2, fy - 2, 2, fx, fy, 8);
        appleGrad.addColorStop(0, '#f87171');
        appleGrad.addColorStop(1, '#dc2626');
        ctx.fillStyle = appleGrad;
        ctx.beginPath();
        ctx.arc(fx, fy + 1, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Apple Leaf
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.ellipse(fx + 2, fy - 7, 3, 1.5, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        // Render Snake
        for (let i = 0; i < snake.length; i++) {
            let seg = snake[i];
            let sx = seg.x * grid;
            let sy = seg.y * grid;
            let pad = 1.5;

            if (i === 0) {
                // Head
                ctx.save();
                ctx.shadowColor = 'rgba(34, 197, 94, 0.35)';
                ctx.shadowBlur = 8;
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.roundRect(sx + pad, sy + pad, grid - pad * 2, grid - pad * 2, 7);
                ctx.fill();
                ctx.restore();

                // Eyes Logic (Mata melirik ke arah gerak)
                ctx.fillStyle = '#0f172a';
                let eyeOffsetX = dx !== 0 ? (dx > 0 ? 4 : -4) : 0;
                let eyeOffsetY = dy !== 0 ? (dy > 0 ? 4 : -4) : 0;
                let e1x = sx + 6 + (dy !== 0 ? -2 : 0) + eyeOffsetX;
                let e1y = sy + 6 + (dx !== 0 ? -2 : 0) + eyeOffsetY;
                let e2x = sx + 14 + (dy !== 0 ? 2 : 0) + eyeOffsetX;
                let e2y = sy + 14 + (dx !== 0 ? 2 : 0) + eyeOffsetY;

                ctx.beginPath();
                ctx.arc(e1x, e1y, 2, 0, Math.PI * 2);
                ctx.arc(e2x, e2y, 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Body dengan gradasi warna mengecil halus
                let alpha = Math.max(0.35, 1 - (i / snake.length) * 0.65);
                ctx.fillStyle = 'rgba(34, 197, 94, ' + alpha + ')';
                ctx.beginPath();
                ctx.roundRect(sx + pad + 1, sy + pad + 1, grid - (pad * 2 + 2), grid - (pad * 2 + 2), 5);
                ctx.fill();
            }
        }
    }

    function gameOver() {
        isPlay = false;
        clearInterval(gameLoop);
        modalTitle.textContent = 'Game Over!';
        modalDesc.innerHTML = 'Skor kamu: <b style='color:#22c55e'>' + score + '</b><br>Jangan senggol ekor sendiri ya!';
        startBtn.textContent = 'Main Lagi';
        modal.classList.remove('hidden');
    }

    render();
})();
</script>
</body>
</html>`
}, {
  title: "War Zone",
  html: `<!DOCTYPE html>
<html lang='id'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
<title>War Zone 3D FPS</title>
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  body {
    background: #090d16;
    color: #f1f5f9;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 12px;
  }

  .game-card {
    width: 100%;
    max-width: 380px;
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 20px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .header .title {
    color: #f59e0b;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .header .engine-badge {
    background: #1f2937;
    color: #94a3b8;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 9px;
  }

  .viewport-container {
    position: relative;
    width: 100%;
    height: 230px;
    background: #030712;
    border-radius: 14px;
    overflow: hidden;
    border: 1.5px solid #374151;
    box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
    touch-action: none;
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* HUD Modern Badges */
  .hud-stats {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: space-between;
    z-index: 10;
    pointer-events: none;
  }

  .hud-pill {
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(4px);
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .hud-hp { color: #10b981; }
  .hud-ammo { color: #f59e0b; }
  .hud-score { color: #38bdf8; }

  /* Scope Overlay Sci-Fi */
  .scope-overlay {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, transparent 40%, rgba(5, 10, 20, 0.95) 75%);
    pointer-events: none;
    display: none;
    z-index: 9;
  }

  .scope-overlay::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 10%;
    right: 10%;
    height: 1px;
    background: rgba(239, 68, 68, 0.6);
    box-shadow: 0 0 4px #ef4444;
  }

  .scope-overlay::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 10%;
    bottom: 10%;
    width: 1px;
    background: rgba(239, 68, 68, 0.6);
    box-shadow: 0 0 4px #ef4444;
  }

  .scope-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 110px;
    height: 110px;
    transform: translate(-50%, -50%);
    border: 1px dashed rgba(239, 68, 68, 0.7);
    border-radius: 50%;
  }

  /* Controls */
  .controls-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
  }

  .btn {
    background: #1f2937;
    border: 1px solid #374151;
    color: #e2e8f0;
    padding: 10px 0;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: transform 0.08s ease, background 0.15s ease;
  }

  .btn:active {
    transform: scale(0.92);
    background: #374151;
  }

  .btn-action {
    font-size: 11px;
    letter-spacing: 0.3px;
  }

  .btn-scope { background: #312e81; border-color: #4338ca; color: #a5b4fc; }
  .btn-reload { background: #78350f; border-color: #b45309; color: #fde68a; }
  .btn-turn { background: #1e3a8a; border-color: #2563eb; color: #93c5fd; }

  .btn-fire {
    grid-column: span 3;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    border: none;
    color: #fff;
    font-size: 15px;
    padding: 12px 0;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);
  }

  .btn-fire:active {
    background: #b91c1c;
    transform: scale(0.95);
  }

  .footer-brand {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
  }
</style>
</head>
<body>

<div class='game-card'>
  <div class='header'>
    <div class='title'>⚔️ WAR ZONE 3D</div>
    <div class='engine-badge'>RAYCAST v2.0</div>
  </div>

  <div class='viewport-container' id='viewport'>
    <div class='hud-stats'>
      <div class='hud-pill hud-hp'>❤️ <span id='hp'>100</span></div>
      <div class='hud-pill hud-ammo'>⚡ <span id='ammo'>30</span>/30</div>
      <div class='hud-pill hud-score'>🎯 <span id='score'>0</span></div>
    </div>
    
    <div class='scope-overlay' id='scopeView'>
      <div class='scope-ring'></div>
    </div>
    
    <canvas id='gameCanvas' width='320' height='230'></canvas>
  </div>

  <div class='controls-grid'>
    <div></div>
    <button class='btn' id='btnW'>▲</button>
    <div></div>
    <button class='btn' id='btnA'>◀</button>
    <button class='btn' id='btnS'>▼</button>
    <button class='btn' id='btnD'>▶</button>
    <button class='btn btn-action btn-scope' id='btnScope'>🎯 KEKER</button>
    <button class='btn btn-action btn-reload' id='btnReload'>🔄 RELOAD</button>
    <button class='btn btn-action btn-turn' id='btnTurn'>↺ PUTAR</button>
    <button class='btn btn-fire' id='btnFire'>🔥 TEMBAK</button>
  </div>

  <div class='footer-brand'>
    <span>TOUCH & SWIPE SUPPORT</span>
    <span>FPS MINI ENGINE</span>
  </div>
</div>

<script>
(function(){
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('viewport');

let posX = 2.0, posY = 2.0;
let dirX = 1, dirY = 0;
let planeX = 0, planeY = 0.66;
let hp = 100, ammo = 30, score = 0;
let isScoped = false, isReloading = false;
let muzzleFlash = 0, gunRecoil = 0;
let hitMarkerTimer = 0;

const map = [
  [1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1],
  [1,0,0,1,1,0,0,1],
  [1,0,0,1,1,0,0,1],
  [1,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1]
];

const spawnPoints = [
  {x: 5.5, y: 1.5},
  {x: 6.5, y: 5.5},
  {x: 1.5, y: 6.5},
  {x: 5.5, y: 6.5},
  {x: 2.5, y: 5.5}
];

let enemies = [
  { x: 5.5, y: 1.5, dirX: 0.02, dirY: 0.015, alive: true, hitEffect: 0 },
  { x: 2.5, y: 5.5, dirX: -0.015, dirY: 0.02, alive: true, hitEffect: 0 },
  { x: 6.5, y: 3.5, dirX: 0.015, dirY: -0.015, alive: true, hitEffect: 0 }
];

function drawSoldier(x, bottomY, scale, isHit) {
  let h = Math.min(190, 140 / scale);
  let w = h * 0.45;

  ctx.save();
  ctx.translate(x, bottomY);

  if (isHit > 0) {
    ctx.filter = 'brightness(2) drop-shadow(0 0 5px red)';
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-w * 0.35, -h * 0.32, w * 0.28, h * 0.32);
  ctx.fillRect(w * 0.07, -h * 0.32, w * 0.28, h * 0.32);

  // Body/Armor
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-w * 0.4, -h * 0.75, w * 0.8, h * 0.45);

  // Tactical Vest
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-w * 0.3, -h * 0.7, w * 0.6, h * 0.16);

  // Head/Helmet
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(0, -h * 0.88, w * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Visor (Glowing)
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-w * 0.2, -h * 0.9, w * 0.4, h * 0.06);

  // Gun
  ctx.fillStyle = '#020617';
  ctx.fillRect(-w * 0.55, -h * 0.55, w * 0.65, h * 0.08);

  ctx.restore();
}

function drawGun() {
  if (isScoped) return; // Sembunyikan senjata saat mode keker

  let gx = canvas.width / 2 + 35;
  let gy = canvas.height - 20 + gunRecoil;

  ctx.save();
  // Gun Body
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(gx - 20, gy - 45, 30, 60, 4);
  ctx.fill();

  // Gun Barrel & Top
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(gx - 15, gy - 65, 12, 35);
  ctx.fillStyle = '#334155';
  ctx.fillRect(gx - 13, gy - 68, 8, 8);

  // Muzzle Flash Effect
  if (muzzleFlash > 0) {
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(gx - 9, gy - 74, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(gx - 9, gy - 74, 6, 0, Math.PI * 2);
    ctx.fill();
    muzzleFlash--;
  }

  if (gunRecoil > 0) gunRecoil -= 2;
  ctx.restore();
}

function updateEnemies() {
  enemies.forEach(en => {
    if(!en.alive) return;
    if(en.hitEffect > 0) en.hitEffect--;

    let nextX = en.x + en.dirX;
    let nextY = en.y + en.dirY;

    if(map[Math.floor(nextY)] && map[Math.floor(nextY)][Math.floor(nextX)] === 0) {
      en.x = nextX;
      en.y = nextY;
    } else {
      en.dirX = -en.dirX;
      en.dirY = -en.dirY;
    }
  });
}

function render() {
  updateEnemies();

  // Sky Gradient
  let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height/2);
  skyGrad.addColorStop(0, '#030712');
  skyGrad.addColorStop(1, '#111827');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height/2);
  
  // Floor Gradient
  let floorGrad = ctx.createLinearGradient(0, canvas.height/2, 0, canvas.height);
  floorGrad.addColorStop(0, '#1f2937');
  floorGrad.addColorStop(1, '#0b0f19');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, canvas.height/2, canvas.width, canvas.height/2);

  let zBuffer = [];

  // Raycasting Loop
  for(let x = 0; x < canvas.width; x++) {
    let cameraX = 2 * x / canvas.width - 1;
    let rayDirX = dirX + planeX * cameraX;
    let rayDirY = dirY + planeY * cameraX;

    let mapX = Math.floor(posX);
    let mapY = Math.floor(posY);

    let deltaDistX = Math.abs(1 / (rayDirX || 1e-30));
    let deltaDistY = Math.abs(1 / (rayDirY || 1e-30));

    let stepX, stepY, sideDistX, sideDistY;

    if (rayDirX < 0) { stepX = -1; sideDistX = (posX - mapX) * deltaDistX; }
    else { stepX = 1; sideDistX = (mapX + 1.0 - posX) * deltaDistX; }
    if (rayDirY < 0) { stepY = -1; sideDistY = (posY - mapY) * deltaDistY; }
    else { stepY = 1; sideDistY = (mapY + 1.0 - posY) * deltaDistY; }

    let hit = 0, side = 0;
    while (hit === 0) {
      if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
      else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
      if (map[mapY] && map[mapY][mapX] > 0) hit = 1;
    }

    let perpWallDist = side === 0 ? (mapX - posX + (1 - stepX) / 2) / rayDirX : (mapY - posY + (1 - stepY) / 2) / rayDirY;
    zBuffer[x] = perpWallDist;

    let lineHeight = Math.floor(canvas.height / (perpWallDist || 0.1));
    let drawStart = -lineHeight / 2 + canvas.height / 2;
    let drawEnd = lineHeight / 2 + canvas.height / 2;

    // Depth Fog Shading
    let fog = Math.max(0.12, 1 - (perpWallDist / 6.5));
    let r = Math.floor((side === 1 ? 50 : 70) * fog);
    let g = Math.floor((side === 1 ? 80 : 110) * fog);
    let b = Math.floor((side === 1 ? 140 : 180) * fog);

    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fillRect(x, Math.max(0, drawStart), 1, Math.min(canvas.height, drawEnd) - Math.max(0, drawStart));
  }

  // Draw Enemies Sorted by Distance
  let sortedEnemies = enemies.map((en, idx) => {
    let dist = ((posX - en.x) ** 2 + (posY - en.y) ** 2);
    return { en, dist, idx };
  }).sort((a,b) => b.dist - a.dist);

  sortedEnemies.forEach(({en}) => {
    if(!en.alive) return;
    let sx = en.x - posX, sy = en.y - posY;
    let invDet = 1.0 / (planeX * dirY - dirX * planeY);
    let transformX = invDet * (dirY * sx - dirX * sy);
    let transformY = invDet * (-planeY * sx + planeX * sy);

    if(transformY > 0.2) {
      let screenX = Math.floor((canvas.width / 2) * (1 + transformX / transformY));
      if(screenX >= -40 && screenX < canvas.width + 40 && transformY < zBuffer[Math.max(0, Math.min(canvas.width-1, screenX))]) {
        let lineHeight = Math.floor(canvas.height / transformY);
        let bottomY = lineHeight / 2 + canvas.height / 2;
        drawSoldier(screenX, bottomY, transformY, en.hitEffect);
      }
    }
  });

  drawGun();

  // Crosshair Modern
  let cx = canvas.width / 2, cy = canvas.height / 2;
  if (!isScoped) {
    ctx.strokeStyle = hitMarkerTimer > 0 ? '#ef4444' : '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.stroke();

    if(hitMarkerTimer > 0) {
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx + 6, cy + 6);
      ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx - 6, cy + 6);
      ctx.stroke();
      hitMarkerTimer--;
    }
  }
}

setInterval(render, 1000/35);

function move(dir) {
  let speed = 0.22;
  let nx = posX, ny = posY;
  if(dir === 'W') { nx += dirX * speed; ny += dirY * speed; }
  if(dir === 'S') { nx -= dirX * speed; ny -= dirY * speed; }
  if(dir === 'A') { nx -= planeX * speed; ny -= planeY * speed; }
  if(dir === 'D') { nx += planeX * speed; ny += planeY * speed; }

  let gridX = Math.floor(nx);
  let gridY = Math.floor(ny);
  if(map[gridY] && map[gridY][gridX] === 0) {
    posX = nx; posY = ny;
  }
}

function rotate(angle) {
  let oldDirX = dirX;
  dirX = dirX * Math.cos(angle) - dirY * Math.sin(angle);
  dirY = oldDirX * Math.sin(angle) + dirY * Math.cos(angle);
  let oldPlaneX = planeX;
  planeX = planeX * Math.cos(angle) - planeY * Math.sin(angle);
  planeY = oldPlaneX * Math.sin(angle) + planeY * Math.cos(angle);
}

// Swipe look control
let lastTouchX = null;
viewport.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) lastTouchX = e.touches[0].clientX;
}, { passive: true });

viewport.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && lastTouchX !== null) {
    let deltaX = e.touches[0].clientX - lastTouchX;
    if (Math.abs(deltaX) > 0.5) {
      rotate(deltaX * 0.007);
      lastTouchX = e.touches[0].clientX;
    }
  }
}, { passive: true });

viewport.addEventListener('touchend', () => { lastTouchX = null; });

function respawnEnemy(en) {
  let p = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
  en.x = p.x;
  en.y = p.y;
  en.dirX = (Math.random() - 0.5) * 0.035;
  en.dirY = (Math.random() - 0.5) * 0.035;
  en.alive = true;
  en.hitEffect = 0;
}

function bindAction(id, fn) {
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
}

bindAction('btnW', () => move('W'));
bindAction('btnS', () => move('S'));
bindAction('btnA', () => move('A'));
bindAction('btnD', () => move('D'));
bindAction('btnTurn', () => rotate(Math.PI / 4));

bindAction('btnScope', () => {
  isScoped = !isScoped;
  document.getElementById('scopeView').style.display = isScoped ? 'block' : 'none';
});

bindAction('btnReload', () => {
  if(isReloading) return;
  isReloading = true;
  document.getElementById('ammo').textContent = '...';
  setTimeout(() => {
    ammo = 30;
    document.getElementById('ammo').textContent = ammo;
    isReloading = false;
  }, 900);
});

function shoot() {
  if(ammo <= 0 || isReloading) return;
  ammo--;
  document.getElementById('ammo').textContent = ammo;
  muzzleFlash = 2;
  gunRecoil = 8;

  // Akurat: Hanya tembak musuh yang tepat berada di crosshair tengah layar
  let hitFound = false;
  enemies.forEach(en => {
    if(!en.alive || hitFound) return;
    let sx = en.x - posX, sy = en.y - posY;
    let invDet = 1.0 / (planeX * dirY - dirX * planeY);
    let transformX = invDet * (dirY * sx - dirX * sy);
    let transformY = invDet * (-planeY * sx + planeX * sy);

    if(transformY > 0) {
      let screenX = Math.floor((canvas.width / 2) * (1 + transformX / transformY));
      let tolerance = isScoped ? 40 : 25; // Mode keker lebih presisi & mudah mengenai sasaran

      if(Math.abs(screenX - canvas.width / 2) < tolerance) {
        en.hitEffect = 4;
        hitMarkerTimer = 4;
        hitFound = true;
        setTimeout(() => {
          en.alive = false;
          score += 100;
          document.getElementById('score').textContent = score;
          setTimeout(() => respawnEnemy(en), 1200);
        }, 80);
      }
    }
  });
}

bindAction('btnFire', shoot);

// Keyboard Listeners
window.addEventListener('keydown', (e) => {
  switch(e.key.toLowerCase()) {
    case 'w': case 'arrowup': move('W'); break;
    case 's': case 'arrowdown': move('S'); break;
    case 'a': case 'arrowleft': rotate(-0.1); break;
    case 'd': case 'arrowright': rotate(0.1); break;
    case ' ': shoot(); break;
    case 'r': document.getElementById('btnReload').click(); break;
    case 'f': document.getElementById('btnScope').click(); break;
  }
});
})();
</script>
</body>
</html>`
}, {
  title: "XOX",
  html: `<style>
*{
  box-sizing:border-box;
  -webkit-tap-highlight-color:transparent;
  user-select:none;
}

body{
  margin:0;
  background:transparent;
  color:#fff;
  font-family:Arial,sans-serif;
  touch-action:manipulation;
}

.wrap{
  width:100%;
  max-width:500px;
  margin:auto;
  padding:14px;
}

.card{
  padding:18px;
  border-radius:22px;
  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,.09),
      rgba(255,255,255,.025)
    );
  border:1px solid rgba(255,255,255,.13);
  box-shadow:
    0 20px 60px rgba(0,0,0,.55);
}

.header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:15px;
}

.brand small{
  display:block;
  color:rgba(255,255,255,.38);
  font-size:8px;
  letter-spacing:3px;
}

.brand b{
  display:block;
  margin-top:4px;
  font-size:21px;
  letter-spacing:.5px;
}

.status{
  text-align:right;
  font-size:10px;
  color:rgba(255,255,255,.55);
}

.score{
  margin-top:4px;
  color:#fff;
  font-size:13px;
}

.controls{
  display:flex;
  gap:8px;
  margin-bottom:14px;
}

select,
button{
  flex:1;
  min-width:0;
  border:1px solid rgba(255,255,255,.13);
  border-radius:11px;
  padding:11px;
  background:#111116;
  color:#fff;
  font-weight:bold;
  outline:none;
}

button{
  cursor:pointer;
}

button:active{
  transform:scale(.95);
}

.board{
  position:relative;
  width:100%;
  aspect-ratio:1;
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:7px;
  padding:7px;
  border-radius:17px;
  background:#07070b;
  border:1px solid rgba(255,255,255,.09);
}

.cell{
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:13px;
  background:rgba(255,255,255,.045);
  border:1px solid rgba(255,255,255,.065);
  font-size:52px;
  font-weight:900;
  cursor:pointer;
  transition:
    transform .12s,
    background .12s;
}

.cell:active{
  transform:scale(.92);
}

.cell.x{
  color:#fff;
  text-shadow:
    0 0 12px rgba(255,255,255,.8),
    0 0 28px rgba(255,255,255,.35);
}

.cell.o{
  color:#8d7cff;
  text-shadow:
    0 0 12px rgba(141,124,255,.9),
    0 0 28px rgba(141,124,255,.45);
}

.cell.win{
  animation:win .55s infinite alternate;
}

@keyframes win{
  from{
    transform:scale(1);
    background:rgba(255,255,255,.06);
  }
  to{
    transform:scale(1.06);
    background:rgba(255,255,255,.17);
    box-shadow:
      0 0 25px rgba(255,255,255,.35);
  }
}

.win-line{
  position:absolute;
  height:5px;
  border-radius:10px;
  background:#fff;
  box-shadow:
    0 0 10px #fff,
    0 0 25px rgba(141,124,255,.9);
  transform-origin:left center;
  transform:scaleX(0);
  transition:
    transform .5s cubic-bezier(.2,.8,.2,1);
  z-index:10;
  pointer-events:none;
}

.info{
  margin-top:12px;
  text-align:center;
  color:rgba(255,255,255,.42);
  font-size:10px;
}

.overlay{
  position:fixed;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  background:rgba(0,0,0,.76);
  backdrop-filter:blur(7px);
  opacity:0;
  pointer-events:none;
  transition:.25s;
  z-index:99;
}

.overlay.show{
  opacity:1;
  pointer-events:auto;
}

.result{
  width:min(88%,340px);
  padding:27px 20px;
  text-align:center;
  border-radius:22px;
  background:#111116;
  border:1px solid rgba(255,255,255,.15);
  box-shadow:
    0 25px 70px rgba(0,0,0,.8);
  transform:scale(.7);
  transition:
    transform .35s cubic-bezier(.2,.8,.2,1);
}

.overlay.show .result{
  transform:scale(1);
}

.icon{
  font-size:52px;
  margin-bottom:7px;
  animation:pop .5s;
}

@keyframes pop{
  0%{
    transform:scale(.2);
  }
  70%{
    transform:scale(1.2);
  }
  100%{
    transform:scale(1);
  }
}

.result h1{
  margin:0;
  font-size:28px;
  letter-spacing:2px;
}

.result p{
  margin:9px 0 20px;
  color:rgba(255,255,255,.45);
  font-size:12px;
}

.result button{
  width:100%;
  background:#fff;
  color:#111;
}
</style>

<div class='wrap'>
  <div class='card'>
    <div class='header'>
      <div class='brand'>
        <small>MINI ARCADE</small>
        <b>TIC TAC TOE</b>
      </div>
      <div class='status'>
        <div id='turn'>GILIRAN KAMU</div>
        <div class='score'>
          <span id='wins'>0</span> - <span id='losses'>0</span> - <span id='draws'>0</span>
        </div>
      </div>
    </div>

    <div class='controls'>
      <select id='difficulty'>
        <option value='easy'>MUDAH</option>
        <option value='normal' selected>NORMAL</option>
        <option value='hard'>SULIT</option>
      </select>
      <button id='reset'>RESET</button>
    </div>

    <div id='board' class='board'>
      <div id='winLine' class='win-line'></div>
      <div class='cell' data-i='0'></div>
      <div class='cell' data-i='1'></div>
      <div class='cell' data-i='2'></div>
      <div class='cell' data-i='3'></div>
      <div class='cell' data-i='4'></div>
      <div class='cell' data-i='5'></div>
      <div class='cell' data-i='6'></div>
      <div class='cell' data-i='7'></div>
      <div class='cell' data-i='8'></div>
    </div>

    <div class='info' id='info'>KAMU = X • BOT = O</div>
  </div>
</div>

<div id='overlay' class='overlay'>
  <div class='result'>
    <div class='icon' id='resultIcon'>🏆</div>
    <h1 id='resultTitle'>KAMU MENANG</h1>
    <p id='resultText'>Permainan yang luar biasa!</p>
    <button id='playAgain'>MAIN LAGI</button>
  </div>
</div>

<script>
const cells = [...document.querySelectorAll('.cell')];
const boardEl = document.getElementById('board');
const difficulty = document.getElementById('difficulty');
const resetBtn = document.getElementById('reset');
const turnEl = document.getElementById('turn');
const infoEl = document.getElementById('info');
const overlay = document.getElementById('overlay');
const resultIcon = document.getElementById('resultIcon');
const resultTitle = document.getElementById('resultTitle');
const resultText = document.getElementById('resultText');
const playAgain = document.getElementById('playAgain');
const winLine = document.getElementById('winLine');
const winsEl = document.getElementById('wins');
const lossesEl = document.getElementById('losses');
const drawsEl = document.getElementById('draws');

let board = Array(9).fill('');
let gameOver = false;
let playerTurn = true;
let wins = 0;
let losses = 0;
let draws = 0;

let audioCtx = null;
function audio(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if(audioCtx.state === 'suspended'){
    audioCtx.resume();
  }
  return audioCtx;
}

function tone(frequency, duration, type='sine', volume=.05){
  const ctx = audio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function clickSound(){ tone(520, .07, 'square', .035); }
function moveSound(){ tone(650, .09, 'sine', .05); }
function errorSound(){ tone(130, .15, 'sawtooth', .05); }
function winSound(){
  tone(523, .15, 'sine', .06);
  setTimeout(() => tone(659, .15, 'sine', .06), 120);
  setTimeout(() => tone(784, .25, 'sine', .07), 240);
}
function loseSound(){
  tone(330, .18, 'sawtooth', .05);
  setTimeout(() => tone(220, .3, 'sawtooth', .05), 180);
}
function drawSound(){
  tone(440, .12, 'square', .04);
  setTimeout(() => tone(440, .18, 'square', .04), 150);
}

const combinations = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

function checkWinner(b){
  for(const combo of combinations){
    const [a,c,d] = combo;
    if(b[a] && b[a] === b[c] && b[a] === b[d]){
      return { winner: b[a], combo: combo };
    }
  }
  if(b.every(cell => cell !== '')){
    return { winner: 'draw', combo: null };
  }
  return null;
}

function render(){
  cells.forEach((cell, i) => {
    cell.textContent = board[i];
    cell.classList.remove('x', 'o');
    if(board[i]){
      cell.classList.add(board[i].toLowerCase());
    }
  });
}

function showWinLine(combo){
  if(!combo) return;
  const first = cells[combo[0]];
  const last = cells[combo[2]];
  const boardRect = boardEl.getBoundingClientRect();
  const firstRect = first.getBoundingClientRect();
  const lastRect = last.getBoundingClientRect();

  const x1 = firstRect.left + firstRect.width/2 - boardRect.left;
  const y1 = firstRect.top + firstRect.height/2 - boardRect.top;
  const x2 = lastRect.left + lastRect.width/2 - boardRect.left;
  const y2 = lastRect.top + lastRect.height/2 - boardRect.top;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx*dx + dy*dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  winLine.style.left = x1 + 'px';
  winLine.style.top = y1 + 'px';
  winLine.style.width = length + 'px';
  winLine.style.transform = 'rotate(' + angle + 'deg) scaleX(1)';

  combo.forEach(i => cells[i].classList.add('win'));
}

function resetLine(){
  winLine.style.transform = 'rotate(0deg) scaleX(0)';
  cells.forEach(cell => cell.classList.remove('win'));
}

function finish(result){
  gameOver = true;
  if(result.winner === 'X'){
    wins++;
    winsEl.textContent = wins;
    turnEl.textContent = 'KAMU MENANG';
    resultIcon.textContent = '🏆';
    resultTitle.textContent = 'KAMU MENANG';
    resultText.textContent = 'Luar biasa! Taktik yang sangat bagus 🔥';
    winSound();
  } else if(result.winner === 'O'){
    losses++;
    lossesEl.textContent = losses;
    turnEl.textContent = 'KAMU KALAH';
    resultIcon.textContent = '💔';
    resultTitle.textContent = 'KAMU KALAH';
    resultText.textContent = 'Bot memenangkan permainan kali ini!';
    loseSound();
  } else {
    draws++;
    drawsEl.textContent = draws;
    turnEl.textContent = 'SERI';
    resultIcon.textContent = '🤝';
    resultTitle.textContent = 'SERI';
    resultText.textContent = 'Permainan berakhir imbang!';
    drawSound();
  }

  if(result.combo) showWinLine(result.combo);

  setTimeout(() => {
    overlay.classList.add('show');
  }, 650);
}

function playerMove(index){
  if(gameOver || !playerTurn || board[index]){
    if(!gameOver && board[index]) errorSound();
    return;
  }

  audio();
  board[index] = 'X';
  playerTurn = false;
  moveSound();
  render();

  const result = checkWinner(board);
  if(result){
    finish(result);
    return;
  }

  turnEl.textContent = 'BOT BERPIKIR...';
  infoEl.textContent = 'Giliran Bot...';
  setTimeout(cpuMove, 350 + Math.random() * 350);
}

function emptyCells(b){
  const arr = [];
  b.forEach((v, i) => { if(!v) arr.push(i); });
  return arr;
}

function randomMove(){
  const available = emptyCells(board);
  return available[Math.floor(Math.random() * available.length)];
}

function winningMove(symbol){
  for(const index of emptyCells(board)){
    board[index] = symbol;
    const result = checkWinner(board);
    board[index] = '';
    if(result && result.winner === symbol) return index;
  }
  return null;
}

function mediumMove(){
  let move = winningMove('O');
  if(move !== null) return move;
  move = winningMove('X');
  if(move !== null) return move;
  if(!board[4]) return 4;
  const corners = [0, 2, 6, 8].filter(i => !board[i]);
  if(corners.length){
    return corners[Math.floor(Math.random() * corners.length)];
  }
  return randomMove();
}

function minimax(b, maximizing){
  const result = checkWinner(b);
  if(result){
    if(result.winner === 'O') return 10;
    if(result.winner === 'X') return -10;
    return 0;
  }

  if(maximizing){
    let best = -Infinity;
    for(const i of emptyCells(b)){
      b[i] = 'O';
      const value = minimax(b, false);
      b[i] = '';
      best = Math.max(best, value);
    }
    return best;
  }

  let best = Infinity;
  for(const i of emptyCells(b)){
    b[i] = 'X';
    const value = minimax(b, true);
    b[i] = '';
    best = Math.min(best, value);
  }
  return best;
}

function hardMove(){
  let bestScore = -Infinity;
  let move = null;
  for(const i of emptyCells(board)){
    board[i] = 'O';
    const score = minimax(board, false);
    board[i] = '';
    if(score > bestScore){
      bestScore = score;
      move = i;
    }
  }
  return move;
}

function cpuMove(){
  if(gameOver) return;
  let move;
  if(difficulty.value === 'easy') move = randomMove();
  else if(difficulty.value === 'normal') move = mediumMove();
  else move = hardMove();

  if(move === undefined || move === null) move = randomMove();

  board[move] = 'O';
  moveSound();
  render();

  const result = checkWinner(board);
  if(result){
    finish(result);
    return;
  }

  playerTurn = true;
  turnEl.textContent = 'GILIRAN KAMU';
  infoEl.textContent = 'Pilih kotak kosong';
}

function startGame(){
  board = Array(9).fill('');
  gameOver = false;
  playerTurn = true;
  overlay.classList.remove('show');
  resetLine();
  turnEl.textContent = 'GILIRAN KAMU';
  infoEl.textContent = 'KAMU = X • BOT = O';
  render();
}

cells.forEach((cell, i) => {
  cell.addEventListener('pointerdown', e => {
    e.preventDefault();
    playerMove(i);
  });
});

resetBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  clickSound();
  startGame();
});

playAgain.addEventListener('pointerdown', e => {
  e.preventDefault();
  clickSound();
  startGame();
});

difficulty.addEventListener('change', () => {
  clickSound();
  startGame();
});

window.addEventListener('resize', () => {
  const result = checkWinner(board);
  if(result && result.combo && gameOver){
    showWinLine(result.combo);
  }
});

startGame();
</script>`
}, {
  title: "Mario",
  html: `<!DOCTYPE html>
<html lang='id'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
<title>Super Mario Endless</title>
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  body {
    background: #090d16;
    color: #f8fafc;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 12px;
  }

  #app {
    width: 100%;
    max-width: 400px;
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 20px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
  }

  /* Header & Scoreboard */
  .hdr {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .brand h1 {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #f59e0b, #ef4444);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .brand span {
    font-size: 9px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.5px;
  }

  .scores {
    display: flex;
    gap: 6px;
  }

  .pill {
    background: #1e293b;
    border: 1px solid #334155;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pill-score { color: #f8fafc; }
  .pill-coin { color: #fbbf24; }

  /* Canvas Arena */
  .gw {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    border-radius: 14px;
    overflow: hidden;
    border: 1.5px solid #334155;
    background: #38bdf8;
    box-shadow: inset 0 0 20px rgba(0,0,0,0.15);
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
  }

  /* Overlay Modal */
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 16px;
    transition: opacity 0.2s ease;
    z-index: 10;
  }

  .overlay.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .overlay h2 {
    font-size: 22px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 4px;
  }

  .overlay p {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 16px;
  }

  .play-btn {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #020617;
    border: none;
    padding: 10px 24px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);
  }

  /* Game Controls Layout (Ergonomic Split) */
  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
  }

  .d-pad {
    display: flex;
    gap: 8px;
  }

  .btn {
    background: #1e293b;
    border: 1px solid #334155;
    color: #f8fafc;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.08s ease, background 0.15s ease;
  }

  .btn:active, .btn.active {
    transform: scale(0.92);
    background: #334155;
  }

  .btn-move {
    width: 58px;
    height: 50px;
  }

  .btn-jump {
    flex: 1;
    height: 50px;
    background: linear-gradient(135deg, #eab308, #ca8a04);
    border: none;
    color: #0f172a;
    font-size: 14px;
    font-weight: 800;
    box-shadow: 0 4px 12px rgba(202, 138, 4, 0.3);
  }

  .btn-jump:active {
    background: #a16207;
  }

  .hint {
    text-align: center;
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
  }
</style>
</head>
<body>

<div id='app'>
  <div class='hdr'>
    <div class='brand'>
      <h1>MARIO RUN</h1>
      <span>ENDLESS ENGINE</span>
    </div>
    <div class='scores'>
      <div class='pill pill-score'>🎯 <span id='sc'>0</span></div>
      <div class='pill pill-coin'>🪙 <span id='cn'>0</span></div>
    </div>
  </div>

  <div class='gw'>
    <canvas id='cv' width='400' height='250'></canvas>
    
    <div id='overlay' class='overlay'>
      <h2 id='modalTitle'>Super Mario</h2>
      <p id='modalDesc'>Injak monster, kumpulkan koin & lari sejauh mungkin!</p>
      <button id='startBtn' class='play-btn'>Mulai Main</button>
    </div>
  </div>

  <div class='controls'>
    <div class='d-pad'>
      <button class='btn btn-move' id='leftB'>◀</button>
      <button class='btn btn-move' id='rightB'>▶</button>
    </div>
    <button class='btn btn-jump' id='jumpB'>⬆ LOMPAT</button>
  </div>

  <div class='hint'>Keyboard: [A / D / Spasi] atau [Panah / Spasi]</div>
</div>

<script>
(function(){
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const scEl = document.getElementById('sc');
  const cnEl = document.getElementById('cn');
  const overlay = document.getElementById('overlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const startBtn = document.getElementById('startBtn');

  const W = 400, H = 250;
  let score = 0, coins = 0;
  let state = 'ready';
  let cameraX = 0, animTick = 0;

  const mario = {
    x: 60, y: 176, w: 20, h: 26,
    vx: 0, vy: 0,
    speed: 3.2,
    facing: 1,
    grounded: false
  };

  const keys = { left: false, right: false };
  let obstacles = [], platforms = [], items = [], enemies = [];
  let nextGenX = 500;

  function resetGame() {
    score = 0; coins = 0;
    mario.x = 60; mario.y = 176; mario.vx = 0; mario.vy = 0;
    mario.facing = 1; mario.grounded = false;
    cameraX = 0; nextGenX = 500;
    obstacles = []; platforms = []; items = []; enemies = [];

    for (let i = 1; i <= 4; i++) {
      generateChunk(i * 320);
    }
    scEl.textContent = '0';
    cnEl.textContent = '0';
    state = 'play';
    overlay.classList.add('hidden');
  }

  function generateChunk(startX) {
    let obsX = startX + Math.random() * 80;
    obstacles.push({ x: obsX, y: 172, w: 26, h: 30 });

    let pfX = startX + 70 + Math.random() * 40;
    let pfY = 115 + Math.random() * 30;
    let pfW = 75 + Math.random() * 30;
    platforms.push({ x: pfX, y: pfY, w: pfW, h: 12 });

    // Coins on platform & air
    items.push({ x: pfX + pfW/2 - 6, y: pfY - 22, w: 12, h: 12, taken: false });

    if (Math.random() > 0.35) {
      let enX = startX + 160;
      enemies.push({ x: enX, y: 180, w: 20, h: 20, vx: 1.1, minX: startX, maxX: startX + 280, alive: true });
    }
  }

  function jump() {
    if (state !== 'play') return;
    if (mario.grounded) {
      mario.vy = -10.5;
      mario.grounded = false;
    }
  }

  // Smooth Input Handling
  function setupButton(btn, keyName) {
    const start = (e) => { e.preventDefault(); keys[keyName] = true; btn.classList.add('active'); };
    const end = (e) => { e.preventDefault(); keys[keyName] = false; btn.classList.remove('active'); };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', end);
  }

  setupButton(document.getElementById('leftB'), 'left');
  setupButton(document.getElementById('rightB'), 'right');

  const jumpB = document.getElementById('jumpB');
  jumpB.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });

  startBtn.addEventListener('click', resetGame);

  window.addEventListener('keydown', (e) => {
    if (state !== 'play' && (e.code === 'Space' || e.key === 'Enter')) { resetGame(); return; }
    if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'Space' || e.key === 'w' || e.key === 'W') jump();
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  function update() {
    if (state !== 'play') return;
    animTick += 0.2;
    score++;
    scEl.textContent = score;

    // Movement Horizontal Fluid
    if (keys.right) {
      mario.vx = mario.speed;
      mario.facing = 1;
    } else if (keys.left) {
      mario.vx = -mario.speed;
      mario.facing = -1;
    } else {
      mario.vx *= 0.7; // Smooth Deceleration
      if (Math.abs(mario.vx) < 0.1) mario.vx = 0;
    }

    mario.x += mario.vx;
    mario.vy += 0.48; // Gravity
    mario.y += mario.vy;

    // Chunk generation
    if (mario.x + 500 > nextGenX) {
      generateChunk(nextGenX);
      nextGenX += 320;
    }

    let onGround = false;

    // Main Ground Collision
    if (mario.y >= 174) {
      mario.y = 174;
      mario.vy = 0;
      onGround = true;
    }

    // Platforms Collision
    platforms.forEach(pf => {
      if (mario.x + mario.w > pf.x && mario.x < pf.x + pf.w) {
        if (mario.y + mario.h >= pf.y && mario.y + mario.h <= pf.y + 12 && mario.vy >= 0) {
          mario.y = pf.y - mario.h;
          mario.vy = 0;
          onGround = true;
        }
      }
    });

    // Pipes (Obstacles) Collision
    obstacles.forEach(obs => {
      if (mario.x + mario.w > obs.x && mario.x < obs.x + obs.w && mario.y + mario.h >= obs.y && mario.y + mario.h <= obs.y + 10 && mario.vy >= 0) {
        mario.y = obs.y - mario.h;
        mario.vy = 0;
        onGround = true;
      } else if (mario.y + mario.h > obs.y && mario.y < obs.y + obs.h) {
        if (mario.vx > 0 && mario.x + mario.w >= obs.x && mario.x < obs.x) mario.x = obs.x - mario.w;
        if (mario.vx < 0 && mario.x <= obs.x + obs.w && mario.x + mario.w > obs.x + obs.w) mario.x = obs.x + obs.w;
      }
    });

    mario.grounded = onGround;
    if (mario.x < 10) mario.x = 10;

    // Smooth Camera Follow
    cameraX += (mario.x - W / 3 - cameraX) * 0.1;
    if (cameraX < 0) cameraX = 0;

    // Coins Collect
    items.forEach(it => {
      if (!it.taken && mario.x + mario.w > it.x && mario.x < it.x + it.w && mario.y + mario.h > it.y && mario.y < it.y + it.h) {
        it.taken = true;
        coins++;
        cnEl.textContent = coins;
        score += 50;
      }
    });

    // Enemies Logic
    enemies.forEach(en => {
      if (!en.alive) return;
      en.x += en.vx;
      if (en.x <= en.minX || en.x >= en.maxX) en.vx *= -1;

      // Stomp / Hit Test
      if (mario.x + mario.w > en.x && mario.x < en.x + en.w && mario.y + mario.h > en.y && mario.y < en.y + en.h) {
        if (mario.vy > 0 && mario.y + mario.h - mario.vy <= en.y + 8) {
          en.alive = false;
          mario.vy = -7.5; // Bounce up
          score += 150;
        } else {
          gameOver();
        }
      }
    });
  }

  function gameOver() {
    state = 'dead';
    modalTitle.textContent = 'Game Over!';
    modalDesc.innerHTML = 'Skor: <b style='color:#f59e0b'>' + score + '</b> | Koin: <b style='color:#fbbf24'>' + coins + '</b>';
    startBtn.textContent = 'Main Lagi';
    overlay.classList.remove('hidden');
  }

  function draw() {
    // 1. Sky Gradient
    let sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#38bdf8');
    sky.addColorStop(0.7, '#bae6fd');
    sky.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // 2. Parallax Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 5; i++) {
      let cx = ((i * 180) - cameraX * 0.2) % (W + 200);
      if (cx < -100) cx += W + 200;
      ctx.beginPath();
      ctx.arc(cx, 45, 16, 0, Math.PI * 2);
      ctx.arc(cx + 15, 40, 20, 0, Math.PI * 2);
      ctx.arc(cx + 32, 45, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Parallax Hills
    ctx.fillStyle = '#86efac';
    for (let i = 0; i < 4; i++) {
      let hx = ((i * 220) - cameraX * 0.4) % (W + 220);
      if (hx < -100) hx += W + 220;
      ctx.beginPath();
      ctx.arc(hx, 220, 60, Math.PI, 0);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(-Math.round(cameraX), 0);

    // Ground
    let gX = Math.floor(cameraX / 400) * 400;
    ctx.fillStyle = '#b45309';
    ctx.fillRect(gX, 202, W + 500, 48);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(gX, 202, W + 500, 8);

    // Platforms (Modern Wood/Brick style)
    platforms.forEach(pf => {
      if (pf.x + pf.w > cameraX && pf.x < cameraX + W + 50) {
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.roundRect(pf.x, pf.y, pf.w, pf.h, 4);
        ctx.fill();
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(pf.x + 2, pf.y + 2, pf.w - 4, 2);
      }
    });

    // Pipes (Obstacles with cylindrical gradient)
    obstacles.forEach(obs => {
      if (obs.x + obs.w > cameraX && obs.x < cameraX + W + 50) {
        let pGrad = ctx.createLinearGradient(obs.x, 0, obs.x + obs.w, 0);
        pGrad.addColorStop(0, '#15803d');
        pGrad.addColorStop(0.3, '#4ade80');
        pGrad.addColorStop(1, '#166534');
        ctx.fillStyle = pGrad;
        ctx.fillRect(obs.x, obs.y + 6, obs.w, obs.h - 6);
        ctx.fillRect(obs.x - 2, obs.y, obs.w + 4, 8);
      }
    });

    // Coins (Spinning 3D Animation)
    items.forEach(it => {
      if (!it.taken && it.x + it.w > cameraX && it.x < cameraX + W + 50) {
        let scaleX = Math.abs(Math.cos(animTick));
        let cx = it.x + 6, cy = it.y + 6;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scaleX, 1);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    });

    // Enemies (Goomba)
    enemies.forEach(en => {
      if (en.alive && en.x + en.w > cameraX && en.x < cameraX + W + 50) {
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(en.x + 10, en.y + 8, 9, Math.PI, 0);
        ctx.lineTo(en.x + 18, en.y + 16);
        ctx.lineTo(en.x + 2, en.y + 16);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(en.x + 4, en.y + 6, 3, 5);
        ctx.fillRect(en.x + 13, en.y + 6, 3, 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(en.x + 5, en.y + 8, 2, 3);
        ctx.fillRect(en.x + 13, en.y + 8, 2, 3);

        // Feet animation
        ctx.fillStyle = '#000';
        let fOff = Math.sin(animTick * 2) * 2;
        ctx.fillRect(en.x + 2, en.y + 16 + fOff, 5, 4);
        ctx.fillRect(en.x + 13, en.y + 16 - fOff, 5, 4);
      }
    });

    // Render Mario
    ctx.save();
    ctx.translate(mario.x + mario.w / 2, mario.y + mario.h / 2);
    ctx.scale(mario.facing, 1);

    // Hat
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-8, -13, 16, 6);
    ctx.fillRect(-2, -15, 10, 4);

    // Face
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(-6, -7, 12, 7);

    // Mustache & Eye
    ctx.fillStyle = '#451a03';
    ctx.fillRect(1, -6, 3, 3); // eye
    ctx.fillRect(0, -3, 8, 3);  // mustache

    // Overall / Body
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-6, 0, 12, 7);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(-6, 3, 12, 7);

    // Feet Running
    ctx.fillStyle = '#78350f';
    if (!mario.grounded) {
      ctx.fillRect(-8, 9, 6, 4);
      ctx.fillRect(2, 6, 6, 4);
    } else if (Math.abs(mario.vx) > 0.1) {
      let leg = Math.sin(animTick * 2.5) * 4;
      ctx.fillRect(-7, 10 + leg, 5, 3);
      ctx.fillRect(2, 10 - leg, 5, 3);
    } else {
      ctx.fillRect(-7, 10, 5, 3);
      ctx.fillRect(2, 10, 5, 3);
    }

    ctx.restore();
    ctx.restore();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>`
}, {
  title: "Dino Run",
  html: `<!DOCTYPE html>
<html lang='id'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
<title>Cyber Dino Runner</title>
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  body {
    background: #090d16;
    color: #f1f5f9;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 12px;
  }

  #app {
    width: 100%;
    max-width: 400px;
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 20px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
  }

  /* Header & Scoreboard */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .brand h1 {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #38bdf8, #0ea5e9);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .brand span {
    font-size: 9px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.5px;
  }

  .scores {
    display: flex;
    gap: 6px;
  }

  .pill {
    background: #1e293b;
    border: 1px solid #334155;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pill-main { color: #38bdf8; }
  .pill-best { color: #94a3b8; }

  /* Arena Viewport */
  .game-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 8.5;
    background: #030712;
    border-radius: 14px;
    border: 1.5px solid #334155;
    overflow: hidden;
    cursor: pointer;
    box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
  }

  /* Modal Overlay */
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    gap: 8px;
    transition: opacity 0.2s ease;
    z-index: 10;
  }

  .overlay.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .overlay h2 {
    font-size: 20px;
    font-weight: 800;
    color: #f8fafc;
  }

  .overlay p {
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 8px;
  }

  .play-btn {
    background: linear-gradient(135deg, #0ea5e9, #0284c7);
    color: #ffffff;
    border: none;
    padding: 10px 24px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.35);
  }

  /* Tactical Buttons */
  .controls {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 10px;
    margin-top: 2px;
  }

  .btn {
    height: 48px;
    background: #1e293b;
    border: 1px solid #334155;
    color: #f8fafc;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    transition: transform 0.08s ease, background 0.15s ease;
  }

  .btn:active, .btn.active {
    transform: scale(0.94);
    background: #334155;
  }

  .btn-duck {
    background: #1e293b;
    color: #94a3b8;
  }

  .btn-jump {
    background: linear-gradient(135deg, #38bdf8, #0ea5e9);
    border: none;
    color: #030712;
    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
  }

  .footer-info {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 700;
    color: #64748b;
    padding: 0 2px;
  }
</style>
</head>
<body>

<div id='app'>
  <div class='header'>
    <div class='brand'>
      <h1>CYBER DINO</h1>
      <span>ENDLESS RUNNER</span>
    </div>
    <div class='scores'>
      <div class='pill pill-main'>🎯 <span id='score'>00000</span></div>
      <div class='pill pill-best'>🏆 <span id='best'>00000</span></div>
    </div>
  </div>

  <div class='game-container' id='gameBox'>
    <canvas id='canvas' width='600' height='300'></canvas>
    
    <div class='overlay' id='overlay'>
      <h2 id='modalTitle'>DINO RUNNER</h2>
      <p id='modalDesc'>Lompati kaktus & nunduk saat ada burung!</p>
      <button class='play-btn' id='startBtn'>Mulai Lari</button>
    </div>
  </div>

  <div class='controls'>
    <button class='btn btn-duck' id='duckBtn'>⬇ NUNDUK</button>
    <button class='btn btn-jump' id='jumpBtn'>⬆ LOMPAT</button>
  </div>

  <div class='footer-info'>
    <span id='speed'>Speed: 1.0x</span>
    <span>KEYBOARD: [W / SPASI] & [S / PANAH BAWAH]</span>
  </div>
</div>

<script>
(function(){
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const gameBox = document.getElementById('gameBox');
  const overlay = document.getElementById('overlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const startBtn = document.getElementById('startBtn');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const speedEl = document.getElementById('speed');

  const W = 600, H = 300;
  const groundY = H - 45;

  let state = 'START';
  let score = 0, best = 0;
  let speed = 6.5;
  let frame = 0;

  try { best = parseInt(localStorage.getItem('cyber_dino_best') || '0', 10) || 0; } catch(e){}
  
  function formatScore(n){ return String(Math.floor(n)).padStart(5, '0'); }
  bestEl.textContent = formatScore(best);

  const dino = {
    x: 60,
    y: groundY - 44,
    w: 40,
    h: 44,
    vy: 0,
    gravity: 0.98,
    jumpForce: -16.5,
    grounded: true,
    isDucking: false
  };

  let obstacles = [];
  let particles = [];
  let clouds = [
    { x: 120, y: 50, s: 0.8 },
    { x: 380, y: 70, s: 1.2 },
    { x: 550, y: 40, s: 0.6 }
  ];

  function resetGame() {
    score = 0;
    speed = 6.5;
    obstacles = [];
    particles = [];
    dino.y = groundY - 44;
    dino.vy = 0;
    dino.grounded = true;
    dino.isDucking = false;
    frame = 0;
    state = 'PLAYING';
    overlay.classList.add('hidden');
  }

  function jump() {
    if (state !== 'PLAYING') { resetGame(); return; }
    if (dino.grounded) {
      dino.vy = dino.jumpForce;
      dino.grounded = false;
      createDust(dino.x + 10, groundY, 8);
    }
  }

  function setDuck(ducking) {
    if (state !== 'PLAYING') return;
    dino.isDucking = ducking;
    if (ducking && !dino.grounded) {
      dino.vy += 6; // Quick fall
    }
  }

  // Dust Particle Creator
  function createDust(x, y, count = 1) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y - Math.random() * 4,
        vx: -(speed * 0.4) - Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        size: 3 + Math.random() * 3,
        alpha: 0.7
      });
    }
  }

  function spawnObstacle() {
    let canSpawnBird = score > 200 && Math.random() < 0.4;

    if (canSpawnBird) {
      // 2 Ketinggian: Atas (bisa dilewati dengan nunduk) atau Bawah (harus lompat)
      let birdY = Math.random() > 0.5 ? groundY - 32 : groundY - 58;
      obstacles.push({
        x: W + 30,
        y: birdY,
        w: 38,
        h: 24,
        type: 'bird'
      });
    } else {
      let isDouble = Math.random() > 0.6;
      let h = 38 + Math.random() * 8;
      obstacles.push({
        x: W + 30,
        y: groundY - h,
        w: isDouble ? 36 : 22,
        h: h,
        type: 'cactus'
      });
    }
  }

  // Input Listeners
  startBtn.addEventListener('click', resetGame);

  const jumpBtn = document.getElementById('jumpBtn');
  const duckBtn = document.getElementById('duckBtn');

  jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });

  duckBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); setDuck(true); duckBtn.classList.add('active'); });
  duckBtn.addEventListener('pointerup', (e) => { e.preventDefault(); setDuck(false); duckBtn.classList.remove('active'); });
  duckBtn.addEventListener('pointerleave', (e) => { setDuck(false); duckBtn.classList.remove('active'); });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      jump();
    }
    if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      setDuck(true);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      setDuck(false);
    }
  });

  function update() {
    if (state !== 'PLAYING') return;

    frame++;
    score += 0.15;
    speed = 6.5 + (score / 250);

    scoreEl.textContent = formatScore(score);
    speedEl.textContent = 'Speed: ' + (speed / 6.5).toFixed(1) + 'x';

    // Dino Physics
    dino.vy += dino.gravity;
    dino.y += dino.vy;

    let targetH = dino.isDucking && dino.grounded ? 26 : 44;
    let targetW = dino.isDucking && dino.grounded ? 50 : 40;
    dino.h = targetH;
    dino.w = targetW;

    if (dino.y >= groundY - dino.h) {
      if (!dino.grounded) createDust(dino.x + 15, groundY, 5); // Landing dust
      dino.y = groundY - dino.h;
      dino.vy = 0;
      dino.grounded = true;
    }

    // Running dust
    if (dino.grounded && frame % 6 === 0) {
      createDust(dino.x + 2, groundY);
    }

    // Clouds
    clouds.forEach(c => {
      c.x -= speed * 0.15 * c.s;
      if (c.x < -80) { c.x = W + 50; c.y = 30 + Math.random() * 50; }
    });

    // Particles Update
    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    // Spawn Obstacles with dynamic safe distance
    let lastObs = obstacles[obstacles.length - 1];
    if (!lastObs || (W - lastObs.x > 180 + Math.random() * 150 + speed * 6)) {
      spawnObstacle();
    }

    // Obstacles Collision & Move
    for (let i = obstacles.length - 1; i >= 0; i--) {
      let obs = obstacles[i];
      obs.x -= speed;

      // Hitbox with inner margin padding for fair gameplay
      let pad = 6;
      if (
        dino.x + pad < obs.x + obs.w - pad &&
        dino.x + dino.w - pad > obs.x + pad &&
        dino.y + pad < obs.y + obs.h - pad &&
        dino.y + dino.h - pad > obs.y + pad
      ) {
        gameOver();
      }

      if (obs.x + obs.w < -30) obstacles.splice(i, 1);
    }
  }

  function gameOver() {
    state = 'GAMEOVER';
    if (score > best) {
      best = score;
      try { localStorage.setItem('cyber_dino_best', String(Math.floor(best))); } catch(e){}
      bestEl.textContent = formatScore(best);
    }
    modalTitle.textContent = 'CRASHED!';
    modalDesc.innerHTML = 'Skor Akhir: <b style='color:#38bdf8'>' + formatScore(score) + '</b>';
    startBtn.textContent = 'Lari Lagi';
    overlay.classList.remove('hidden');
  }

  function draw() {
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, W, H);

    // Stars / Background Ambience
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < 20; i++) {
      let sx = (i * 35 + frame * 0.2) % W;
      let sy = (i * 27) % (groundY - 60);
      ctx.fillRect(W - sx, sy, 1.5, 1.5);
    }

    // Soft Clouds
    ctx.fillStyle = 'rgba(51, 65, 85, 0.35)';
    clouds.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 16 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 18 * c.s, c.y - 6 * c.s, 22 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 38 * c.s, c.y, 14 * c.s, 0, Math.PI * 2);
      ctx.fill();
    });

    // Ground Line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    // Moving Ground Dots
    ctx.fillStyle = '#1e293b';
    for (let x = 0; x < W; x += 30) {
      let gx = (x - (frame * speed) % 30 + W) % W;
      ctx.fillRect(gx, groundY + 8, 8, 2);
      ctx.fillRect((gx + 15) % W, groundY + 16, 4, 2);
    }

    // Dust Particles
    particles.forEach(p => {
      ctx.fillStyle = 'rgba(148, 163, 184, ' + p.alpha + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Obstacles
    obstacles.forEach(obs => {
      if (obs.type === 'bird') {
        // Pterodactyl with flapping wings
        let wing = Math.sin(frame * 0.35) * 10;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.ellipse(obs.x + 18, obs.y + 12, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(obs.x + 4, obs.y + 12);
        ctx.lineTo(obs.x - 6, obs.y + 14);
        ctx.lineTo(obs.x + 4, obs.y + 16);
        ctx.fill();

        // Wing
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(obs.x + 14, obs.y + 12);
        ctx.lineTo(obs.x + 22, obs.y + 12 - wing);
        ctx.lineTo(obs.x + 28, obs.y + 12);
        ctx.fill();
      } else {
        // Cactus Smooth Neon
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.roundRect(obs.x + 6, obs.y, obs.w - 12, obs.h, 4);
        ctx.fill();

        // Branches
        ctx.fillRect(obs.x, obs.y + 10, obs.w, 5);
        ctx.fillRect(obs.x, obs.y + 4, 5, 10);
        ctx.fillRect(obs.x + obs.w - 5, obs.y + 6, 5, 10);
      }
    });

    // Draw Dino (Smooth Cyber Style)
    ctx.save();
    ctx.translate(dino.x, dino.y);

    ctx.fillStyle = '#38bdf8';

    if (dino.isDucking && dino.grounded) {
      // Ducking Frame
      ctx.beginPath();
      ctx.roundRect(0, 8, dino.w - 6, dino.h - 8, 8);
      ctx.fill();
      // Head low
      ctx.beginPath();
      ctx.roundRect(dino.w - 16, 2, 16, 14, 4);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#030712';
      ctx.fillRect(dino.w - 8, 5, 3, 3);
    } else {
      // Standing/Running Body
      ctx.beginPath();
      ctx.roundRect(4, 10, dino.w - 14, dino.h - 20, 8);
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.roundRect(dino.w - 20, 0, 20, 18, 5);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#030712';
      ctx.fillRect(dino.w - 10, 4, 4, 4);

      // Tail
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(4, 18);
      ctx.lineTo(-6, 24);
      ctx.lineTo(4, 28);
      ctx.fill();

      // Legs Animation
      ctx.fillStyle = '#38bdf8';
      if (!dino.grounded) {
        ctx.fillRect(10, dino.h - 10, 5, 8);
        ctx.fillRect(22, dino.h - 14, 5, 6);
      } else {
        let legStep = Math.floor(frame * (speed * 0.05)) % 2;
        if (legStep === 0) {
          ctx.fillRect(10, dino.h - 10, 5, 10);
          ctx.fillRect(22, dino.h - 6, 5, 6);
        } else {
          ctx.fillRect(10, dino.h - 6, 5, 6);
          ctx.fillRect(22, dino.h - 10, 5, 10);
        }
      }
    }
    ctx.restore();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>`
}, {
  title: "Angry Bird",
  html: `<!DOCTYPE html>
<html lang='id'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>
<title>Angry Birds - Multi Level Random Edition</title>
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  body {
    background: #090d16;
    color: #f8fafc;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 12px;
  }

  #app {
    width: 100%;
    max-width: 420px;
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 20px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7);
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .brand h1 {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #ef4444, #f97316);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .brand span {
    font-size: 9px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.5px;
  }

  .scores {
    display: flex;
    gap: 6px;
  }

  .pill {
    background: #1e293b;
    border: 1px solid #334155;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pill-lvl { color: #38bdf8; }
  .pill-bird { color: #ef4444; }
  .pill-score { color: #f59e0b; }

  /* Arena Viewport */
  .game-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #0f172a;
    border-radius: 14px;
    border: 1.5px solid #334155;
    overflow: hidden;
    cursor: crosshair;
    box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.4);
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
  }

  /* Controls */
  .controls-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sliders-wrap {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .slider-box {
    background: #1e293b;
    border: 1px solid #334155;
    padding: 6px 10px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 700;
    color: #94a3b8;
  }

  .slider-header span:last-child {
    color: #f59e0b;
    font-family: monospace;
  }

  input[type='range'] {
    width: 100%;
    accent-color: #ef4444;
    cursor: pointer;
  }

  .launch-btn {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    border: none;
    color: #fff;
    border-radius: 12px;
    padding: 11px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 1px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: transform 0.08s ease, filter 0.15s ease;
  }

  .launch-btn:active {
    transform: scale(0.97);
    filter: brightness(1.15);
  }

  /* Modal Overlay */
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(6px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    text-align: center;
    transition: opacity 0.2s ease;
    z-index: 10;
  }

  .overlay.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .stars {
    font-size: 26px;
    margin-bottom: 4px;
    letter-spacing: 4px;
  }

  .overlay h2 {
    font-size: 20px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 4px;
  }

  .overlay p {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 14px;
    line-height: 1.4;
  }

  .btn-group {
    display: flex;
    gap: 8px;
  }

  .play-btn {
    background: linear-gradient(135deg, #ef4444, #f97316);
    color: #fff;
    border: none;
    padding: 10px 22px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
  }

  .hint-text {
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
  }
</style>
</head>
<body>

<div id='app'>
  <div class='header'>
    <div class='brand'>
      <h1>ANGRY BIRDS</h1>
      <span id='levelName'>LEVEL 1: LATIHAN PERTAMA</span>
    </div>
    <div class='scores'>
      <div class='pill pill-lvl'>🏆 <span id='lvlDisplay'>1/5</span></div>
      <div class='pill pill-bird'>🔴 <span id='birdCount'>3</span></div>
      <div class='pill pill-score'>🎯 <span id='scoreVal'>0</span></div>
    </div>
  </div>

  <div class='game-container' id='gameBox'>
    <canvas id='birdCanvas' width='400' height='225'></canvas>
    
    <div class='overlay' id='overlay'>
      <div class='stars' id='starRating'>⭐⭐⭐</div>
      <h2 id='modalTitle'>ANGRY BIRDS</h2>
      <p id='modalDesc'>Tarik ketapel langsung atau gunakan tombol peluncur di bawah!</p>
      <div class='btn-group'>
        <button class='play-btn' id='startBtn'>Main Sekarang 🎯</button>
      </div>
    </div>
  </div>

  <div class='controls-bar'>
    <div class='sliders-wrap'>
      <div class='slider-box'>
        <div class='slider-header'>
          <span>SUDUT</span>
          <span id='angleVal'>45°</span>
        </div>
        <input type='range' id='angleSlider' min='10' max='85' value='45'>
      </div>
      <div class='slider-box'>
        <div class='slider-header'>
          <span>KEKUATAN</span>
          <span id='powerVal'>75%</span>
        </div>
        <input type='range' id='powerSlider' min='30' max='100' value='75'>
      </div>
    </div>
    <button class='launch-btn' id='fireBtn'>🚀 TEMBAK BURUNG</button>
  </div>

  <div class='hint-text'>🎲 Posisi babi teracak secara dinamis di setiap permainan!</div>
</div>

<script>
(function(){
  const canvas = document.getElementById('birdCanvas');
  const ctx = canvas.getContext('2d');
  const birdCountEl = document.getElementById('birdCount');
  const scoreValEl = document.getElementById('scoreVal');
  const lvlDisplay = document.getElementById('lvlDisplay');
  const levelNameEl = document.getElementById('levelName');
  const angleSlider = document.getElementById('angleSlider');
  const powerSlider = document.getElementById('powerSlider');
  const angleVal = document.getElementById('angleVal');
  const powerVal = document.getElementById('powerVal');
  const overlay = document.getElementById('overlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const starRating = document.getElementById('starRating');
  const startBtn = document.getElementById('startBtn');
  const fireBtn = document.getElementById('fireBtn');

  // Audio FX Synthesizer
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playSound(type) {
    try {
      const ac = getAudio();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);

      if (type === 'launch') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(750, ac.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ac.currentTime + 0.15);
        osc.start(); osc.stop(ac.currentTime + 0.15);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.18);
        gain.gain.setValueAtTime(0.12, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ac.currentTime + 0.18);
        osc.start(); osc.stop(ac.currentTime + 0.18);
      } else if (type === 'tnt') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(25, ac.currentTime + 0.35);
        gain.gain.setValueAtTime(0.2, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ac.currentTime + 0.35);
        osc.start(); osc.stop(ac.currentTime + 0.35);
      }
    } catch(e){}
  }

  const groundY = 180;
  const slingX = 65;
  const slingY = 145;

  let currentLevelIdx = 0;
  let bird = { x: slingX, y: slingY, r: 10, vx: 0, vy: 0, flying: false };
  let dragPos = { x: slingX, y: slingY };
  let isDragging = false;
  let remainingBirds = 3;
  let score = 0;
  let blocks = [];
  let pigs = [];
  let tnts = [];
  let particles = [];
  let trails = [];
  let isPlaying = false;
  let screenShake = 0;

  // DATA LEVEL DASAR
  const levelDatabase = [
    {
      name: 'LEVEL 1: LATIHAN PERTAMA',
      birds: 3,
      pigCount: 2,
      blocks: [
        { x: 280, y: 135, w: 12, h: 45, hp: 2, type: 'wood' },
        { x: 335, y: 135, w: 12, h: 45, hp: 2, type: 'wood' },
        { x: 275, y: 125, w: 78, h: 10, hp: 2, type: 'wood' }
      ],
      tnts: []
    },
    {
      name: 'LEVEL 2: BUNKER TNT',
      birds: 3,
      pigCount: 2,
      blocks: [
        { x: 275, y: 135, w: 14, h: 45, hp: 4, type: 'stone' },
        { x: 345, y: 135, w: 14, h: 45, hp: 4, type: 'stone' },
        { x: 268, y: 122, w: 98, h: 12, hp: 4, type: 'stone' }
      ],
      tnts: [
        { x: 302, y: 158, w: 22, h: 22 }
      ]
    },
    {
      name: 'LEVEL 3: MENARA KEMBAR',
      birds: 3,
      pigCount: 3,
      blocks: [
        { x: 255, y: 110, w: 12, h: 70, hp: 2, type: 'wood' },
        { x: 290, y: 110, w: 12, h: 70, hp: 2, type: 'wood' },
        { x: 250, y: 100, w: 58, h: 10, hp: 2, type: 'wood' },

        { x: 325, y: 110, w: 12, h: 70, hp: 2, type: 'wood' },
        { x: 360, y: 110, w: 12, h: 70, hp: 2, type: 'wood' },
        { x: 320, y: 100, w: 58, h: 10, hp: 2, type: 'wood' }
      ],
      tnts: [
        { x: 265, y: 80, w: 20, h: 20 }
      ]
    },
    {
      name: 'LEVEL 4: BENTENG BATU KOKOH',
      birds: 4,
      pigCount: 3,
      blocks: [
        { x: 270, y: 130, w: 16, h: 50, hp: 5, type: 'stone' },
        { x: 350, y: 130, w: 16, h: 50, hp: 5, type: 'stone' },
        { x: 265, y: 115, w: 108, h: 14, hp: 5, type: 'stone' },
        { x: 295, y: 70, w: 14, h: 45, hp: 4, type: 'wood' },
        { x: 330, y: 70, w: 14, h: 45, hp: 4, type: 'wood' },
        { x: 290, y: 60, w: 60, h: 10, hp: 4, type: 'wood' }
      ],
      tnts: [
        { x: 308, y: 160, w: 20, h: 20 }
      ]
    },
    {
      name: 'LEVEL 5: ISTANA RAJA BABI',
      birds: 4,
      pigCount: 4,
      blocks: [
        { x: 260, y: 125, w: 16, h: 55, hp: 5, type: 'stone' },
        { x: 360, y: 125, w: 16, h: 55, hp: 5, type: 'stone' },
        { x: 255, y: 112, w: 128, h: 12, hp: 5, type: 'stone' },

        { x: 280, y: 65, w: 14, h: 46, hp: 3, type: 'wood' },
        { x: 340, y: 65, w: 14, h: 46, hp: 3, type: 'wood' },
        { x: 275, y: 55, w: 86, h: 10, hp: 3, type: 'wood' }
      ],
      tnts: [
        { x: 290, y: 100, w: 20, h: 20 },
        { x: 330, y: 100, w: 20, h: 20 }
      ]
    }
  ];

  // FUNGSI SPAWN BABI DENGAN POSISI RANDOM
  function generateRandomPigs(count, isBossLevel) {
    let generated = [];
    const heights = [
      groundY - 14,             // Lantai dasar
      groundY - 50,             // Atas lantai 1
      groundY - 95              // Puncak menara
    ];

    for (let i = 0; i < count; i++) {
      let isBoss = isBossLevel && i === 0;
      let radius = isBoss ? 14 : (9 + Math.floor(Math.random() * 3));
      
      // Acak posisi X di zona sasaran (antara 250 s/d 365)
      let randomX = 250 + Math.random() * 115;
      let randomY = heights[Math.floor(Math.random() * heights.length)] - (radius - 10);

      generated.push({
        x: Math.round(randomX),
        y: Math.round(randomY),
        r: radius,
        hp: isBoss ? 3 : 1,
        boss: isBoss,
        alive: true
      });
    }
    return generated;
  }

  function loadLevel(idx) {
    currentLevelIdx = idx;
    const lvl = levelDatabase[idx];
    levelNameEl.textContent = lvl.name;
    lvlDisplay.textContent = idx + 1 + '/' + levelDatabase.length;
    remainingBirds = lvl.birds;

    // Deep clone blocks & tnts
    blocks = JSON.parse(JSON.stringify(lvl.blocks));
    tnts = JSON.parse(JSON.stringify(lvl.tnts));

    // Spawn babi di posisi acak baru
    pigs = generateRandomPigs(lvl.pigCount, idx === 4);

    bird = { x: slingX, y: slingY, r: 10, vx: 0, vy: 0, flying: false };
    dragPos = { x: slingX, y: slingY };
    particles = [];
    trails = [];
    updateStats();
  }

  function startCurrentGame() {
    getAudio();
    loadLevel(currentLevelIdx);
    isPlaying = true;
    overlay.classList.add('hidden');
  }

  function updateStats() {
    birdCountEl.textContent = remainingBirds;
    scoreValEl.textContent = score;
  }

  function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        color: color || '#ef4444',
        life: 1.0,
        size: 2 + Math.random() * 3
      });
    }
  }

  function triggerExplosion(tx, ty) {
    playSound('tnt');
    screenShake = 8;
    spawnParticles(tx, ty, '#f59e0b', 24);
    spawnParticles(tx, ty, '#ef4444', 20);

    const blastRadius = 75;

    // Damage blocks in radius
    blocks.forEach(b => {
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      if (Math.hypot(bx - tx, by - ty) < blastRadius) {
        b.hp -= 3;
        score += 80;
      }
    });
    blocks = blocks.filter(b => b.hp > 0);

    // Pop pigs in radius
    pigs.forEach(p => {
      if (!p.alive) return;
      if (Math.hypot(p.x - tx, p.y - ty) < blastRadius) {
        p.hp -= 3;
        if (p.hp <= 0) {
          p.alive = false;
          score += 300;
          spawnParticles(p.x, p.y, '#22c55e', 16);
        }
      }
    });

    updateStats();
    if (pigs.filter(pig => pig.alive).length === 0) {
      setTimeout(winLevel, 600);
    }
  }

  function fireWithVectors(vx, vy) {
    if (!isPlaying || bird.flying || remainingBirds <= 0) return;
    bird.vx = vx;
    bird.vy = vy;
    bird.flying = true;
    remainingBirds--;
    updateStats();
    playSound('launch');
  }

  function launchFromSliders() {
    if (bird.flying) return;
    const angle = parseFloat(angleSlider.value) * (Math.PI / 180);
    const power = parseFloat(powerSlider.value) * 0.135;
    fireWithVectors(Math.cos(angle) * power, -Math.sin(angle) * power);
  }

  function resetBirdPosition() {
    if (pigs.filter(p => p.alive).length === 0) {
      winLevel();
      return;
    }
    if (remainingBirds <= 0) {
      gameOver();
      return;
    }
    bird = { x: slingX, y: slingY, r: 10, vx: 0, vy: 0, flying: false };
    dragPos = { x: slingX, y: slingY };
  }

  function winLevel() {
    isPlaying = false;
    let stars = remainingBirds >= 2 ? '⭐⭐⭐' : (remainingBirds === 1 ? '⭐⭐' : '⭐');
    starRating.textContent = stars;

    if (currentLevelIdx < levelDatabase.length - 1) {
      modalTitle.textContent = 'LEVEL CLEARED! 🏆';
      modalDesc.innerHTML = 'Babi berhasil dimusnahkan!<br>Skor Sekarang: <b style='color:#f59e0b'>' + score + '</b>';
      startBtn.textContent = 'Lanjut Level ' + (currentLevelIdx + 2) + ' ➡️';
      startBtn.onclick = () => {
        currentLevelIdx++;
        startCurrentGame();
      };
    } else {
      modalTitle.textContent = 'SELAMAT! KAMU TAMAT! 👑';
      modalDesc.innerHTML = 'Kamu telah menaklukkan seluruh level!<br>Total Skor: <b style='color:#f59e0b'>' + score + '</b>';
      startBtn.textContent = 'Main dari Awal 🔄';
      startBtn.onclick = () => {
        score = 0;
        currentLevelIdx = 0;
        startCurrentGame();
      };
    }
    overlay.classList.remove('hidden');
  }

  function gameOver() {
    isPlaying = false;
    starRating.textContent = '💀💀💀';
    modalTitle.textContent = 'LEVEL GAGAL!';
    modalDesc.innerHTML = 'Burung ketapel habis!<br>Skor: <b style='color:#f59e0b'>' + score + '</b>';
    startBtn.textContent = 'Coba Lagi 🔄';
    startBtn.onclick = startCurrentGame;
    overlay.classList.remove('hidden');
  }

  // Pointer Drag Slingshot Logic
  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!isPlaying || bird.flying || remainingBirds <= 0) return;
    const pos = getCanvasPos(e);
    if (Math.hypot(pos.x - slingX, pos.y - slingY) < 42) {
      isDragging = true;
      dragPos = pos;
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const pos = getCanvasPos(e);
    let dx = pos.x - slingX;
    let dy = pos.y - slingY;
    let d = Math.hypot(dx, dy);
    const maxDrag = 52;
    if (d > maxDrag) {
      dx = (dx / d) * maxDrag;
      dy = (dy / d) * maxDrag;
    }
    dragPos = { x: slingX + dx, y: slingY + dy };
  });

  window.addEventListener('pointerup', () => {
    if (!isDragging) return;
    isDragging = false;
    const dx = slingX - dragPos.x;
    const dy = slingY - dragPos.y;
    if (Math.hypot(dx, dy) > 8) {
      fireWithVectors(dx * 0.22, dy * 0.22);
    } else {
      dragPos = { x: slingX, y: slingY };
    }
  });

  angleSlider.addEventListener('input', () => { angleVal.textContent = angleSlider.value + '°'; });
  powerSlider.addEventListener('input', () => { powerVal.textContent = powerSlider.value + '%'; });
  fireBtn.addEventListener('click', launchFromSliders);
  startBtn.addEventListener('click', startCurrentGame);

  // Physics Loop
  function updatePhysics() {
    if (!isPlaying) return;

    if (bird.flying) {
      trails.push({ x: bird.x, y: bird.y, alpha: 0.6 });
      bird.x += bird.vx;
      bird.vy += 0.22;
      bird.y += bird.vy;

      // Ground
      if (bird.y >= groundY - bird.r) {
        bird.y = groundY - bird.r;
        bird.vx *= 0.55;
        bird.vy = -bird.vy * 0.25;
        if (Math.abs(bird.vx) < 0.2 && Math.abs(bird.vy) < 0.3) {
          setTimeout(resetBirdPosition, 400);
          bird.flying = false;
        }
      }

      // Hit TNT Crates
      for (let ti = tnts.length - 1; ti >= 0; ti--) {
        let t = tnts[ti];
        if (
          bird.x + bird.r > t.x && bird.x - bird.r < t.x + t.w &&
          bird.y + bird.r > t.y && bird.y - bird.r < t.y + t.h
        ) {
          let cx = t.x + t.w / 2, cy = t.y + t.h / 2;
          tnts.splice(ti, 1);
          triggerExplosion(cx, cy);
        }
      }

      // Hit Blocks
      blocks.forEach((b, bi) => {
        if (
          bird.x + bird.r > b.x && bird.x - bird.r < b.x + b.w &&
          bird.y + bird.r > b.y && bird.y - bird.r < b.y + b.h
        ) {
          spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.type === 'stone' ? '#94a3b8' : '#b45309', 8);
          b.hp--;
          bird.vx *= 0.6;
          score += 40;
          playSound('hit');
          if (b.hp <= 0) blocks.splice(bi, 1);
        }
      });

      // Hit Pigs
      pigs.forEach(p => {
        if (!p.alive) return;
        if (Math.hypot(bird.x - p.x, bird.y - p.y) < bird.r + p.r) {
          p.hp--;
          playSound('hit');
          if (p.hp <= 0) {
            p.alive = false;
            spawnParticles(p.x, p.y, '#22c55e', 14);
            score += p.boss ? 500 : 200;
            if (pigs.filter(pig => pig.alive).length === 0) {
              setTimeout(winLevel, 500);
            }
          }
          updateStats();
        }
      });

      // Out of bounds
      if (bird.x > canvas.width + 30 || bird.x < -30) {
        setTimeout(resetBirdPosition, 300);
        bird.flying = false;
      }
    }

    // Update Trails & Particles
    for (let i = trails.length - 1; i >= 0; i--) {
      trails[i].alpha -= 0.025;
      if (trails[i].alpha <= 0) trails.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // Render Loop
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
      screenShake *= 0.85;
      if (screenShake < 0.2) screenShake = 0;
    }

    // Sky & Hills
    let sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#1e293b');
    sky.addColorStop(1, '#0f172a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, groundY);

    ctx.fillStyle = '#1e3a29';
    ctx.beginPath();
    ctx.arc(180, 240, 110, Math.PI, 0);
    ctx.arc(350, 240, 100, Math.PI, 0);
    ctx.fill();

    // Ground
    let gGrad = ctx.createLinearGradient(0, groundY, 0, canvas.height);
    gGrad.addColorStop(0, '#22c55e');
    gGrad.addColorStop(0.2, '#15803d');
    gGrad.addColorStop(1, '#052e16');
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

    // Smoke Trails
    trails.forEach(t => {
      ctx.fillStyle = 'rgba(241, 245, 249, ' + t.alpha + ')';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Predictive Arc
    if (!bird.flying && isPlaying) {
      let testVx, testVy;
      if (isDragging) {
        testVx = (slingX - dragPos.x) * 0.22;
        testVy = (slingY - dragPos.y) * 0.22;
      } else {
        const angle = parseFloat(angleSlider.value) * (Math.PI / 180);
        const power = parseFloat(powerSlider.value) * 0.135;
        testVx = Math.cos(angle) * power;
        testVy = -Math.sin(angle) * power;
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let t = 0; t < 24; t += 1.8) {
        let tx = slingX + testVx * t;
        let ty = slingY + testVy * t + 0.5 * 0.22 * (t * t);
        if (ty > groundY) break;
        ctx.beginPath();
        ctx.arc(tx, ty, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const activeBirdX = isDragging ? dragPos.x : (bird.flying ? bird.x : slingX);
    const activeBirdY = isDragging ? dragPos.y : (bird.flying ? bird.y : slingY);

    // Back Rubber Band
    if (!bird.flying) {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(slingX - 6, slingY - 8);
      ctx.lineTo(activeBirdX, activeBirdY);
      ctx.stroke();
    }

    // Slingshot Fork
    ctx.fillStyle = '#92400e';
    ctx.fillRect(slingX - 4, slingY - 4, 8, groundY - slingY + 4);
    ctx.beginPath();
    ctx.arc(slingX - 6, slingY - 8, 4, 0, Math.PI * 2);
    ctx.arc(slingX + 6, slingY - 8, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw Blocks (Wood & Stone)
    blocks.forEach(b => {
      if (b.type === 'stone') {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      } else {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
    });

    // Draw TNT Boxes
    tnts.forEach(t => {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(t.x, t.y + t.h * 0.35, t.w, t.h * 0.3);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TNT', t.x + t.w / 2, t.y + t.h * 0.6);
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x, t.y, t.w, t.h);
    });

    // Draw Pigs
    pigs.forEach(p => {
      if (!p.alive) return;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      // Snout & Eyes
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 2, p.r * 0.45, p.r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.fillRect(p.x - 3, p.y - 2, 2, 2);
      ctx.fillRect(p.x + 2, p.y - 2, 2, 2);

      // King Pig Crown
      if (p.boss) {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(p.x - 8, p.y - p.r + 2);
        ctx.lineTo(p.x - 10, p.y - p.r - 8);
        ctx.lineTo(p.x - 4, p.y - p.r - 4);
        ctx.lineTo(p.x, p.y - p.r - 10);
        ctx.lineTo(p.x + 4, p.y - p.r - 4);
        ctx.lineTo(p.x + 10, p.y - p.r - 8);
        ctx.lineTo(p.x + 8, p.y - p.r + 2);
        ctx.fill();
      }
    });

    // Angry Red Bird
    const bx = activeBirdX;
    const by = activeBirdY;

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(bx, by, bird.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.arc(bx - 6, by - 8, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by - 4);
    ctx.lineTo(bx + 7, by - 2);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bx + 3, by - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(bx + 3.5, by - 2.5, 1.5, 1.5);

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(bx + bird.r - 2, by - 2);
    ctx.lineTo(bx + bird.r + 5, by);
    ctx.lineTo(bx + bird.r - 2, by + 2);
    ctx.fill();

    // Front Rubber Band
    if (!bird.flying) {
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(slingX + 6, slingY - 8);
      ctx.lineTo(activeBirdX, activeBirdY);
      ctx.stroke();
    }

    // Particles
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    updatePhysics();
    requestAnimationFrame(draw);
  }

  loadLevel(0);
  draw();
})();
</script>
</body>
</html>`
}, {
  title: "Hill Climb Racing",
  html: `<!DOCTYPE html>
<html lang='id'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'>
<title>Hill Climb Racing — Ultra Realistic HD v2</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{
    width:100%;height:100%;overflow:hidden;background:#03070d;
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;
    touch-action:none;
  }
  canvas{display:block;position:absolute;inset:0;width:100%;height:100%;}

  /* PEDAL KENDALI REALISTIS */
  .pedal-wrapper{
    position:absolute;bottom:max(20px, env(safe-area-inset-bottom));
    display:flex;gap:20px;z-index:10;pointer-events:none;
  }
  .pedal-left{left:max(20px, env(safe-area-inset-left));}
  .pedal-right{right:max(20px, env(safe-area-inset-right));}

  .pedal{
    pointer-events:auto;cursor:pointer;
    width:94px;height:136px;border-radius:20px;
    background:linear-gradient(175deg, #323946 0%, #171a21 65%, #0d0f14 100%);
    border:2px solid rgba(255,255,255,0.18);
    box-shadow:
      0 14px 28px rgba(0,0,0,0.7),
      inset 0 2px 4px rgba(255,255,255,0.25),
      inset 0 -4px 8px rgba(0,0,0,0.8);
    display:flex;flex-direction:column;align-items:center;justify-content:space-between;
    padding:16px 8px;color:#fff;
    backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    transition:transform .06s ease, border-color .1s, box-shadow .1s;
    transform-origin:bottom center;
  }
  .pedal:active, .pedal.active{
    transform:perspective(400px) rotateX(16deg) scale(0.95);
    box-shadow:
      0 6px 14px rgba(0,0,0,0.8),
      inset 0 1px 2px rgba(255,255,255,0.1);
  }
  #pedalBrake.active{border-color:#ff4757;box-shadow:0 0 25px rgba(255,71,87,0.45);}
  #pedalGas.active{border-color:#2ed573;box-shadow:0 0 25px rgba(46,213,115,0.45);}

  /* Grid Karet Pedal */
  .tread{
    width:70%;height:6px;background:#0c0e12;
    border-radius:3px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.9), 0 1px 1px rgba(255,255,255,0.15);
  }
  .pedal-title{font-size:12px;font-weight:900;letter-spacing:1.5px;opacity:0.8;}
  .pedal-sub{font-size:10px;font-weight:600;opacity:0.5;letter-spacing:0.5px;}

  /* HUD ATAS (GLASSMORPHISM) */
  #hud{
    position:absolute;top:max(16px, env(safe-area-inset-top));left:0;right:0;
    padding:0 max(20px, env(safe-area-inset-right)) 0 max(20px, env(safe-area-inset-left));
    display:flex;justify-content:space-between;align-items:flex-start;
    pointer-events:none;z-index:8;
  }
  .hud-card{
    background:rgba(10,18,30,0.65);
    border:1px solid rgba(255,255,255,0.14);
    border-radius:18px;padding:10px 18px;
    box-shadow:0 10px 24px rgba(0,0,0,0.4);
    backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    display:flex;flex-direction:column;gap:3px;
  }
  .hud-label{font-size:11px;font-weight:700;letter-spacing:1px;color:#8ba2bd;text-transform:uppercase;}
  .hud-val{font-size:22px;font-weight:900;color:#fff;letter-spacing:0.5px;}
  .hud-val span{font-size:15px;color:#ffd32a;margin-left:8px;}

  .fuel-box{width:min(240px, 45vw);}
  .fuel-bar-bg{
    width:100%;height:14px;background:rgba(255,255,255,0.1);
    border-radius:7px;overflow:hidden;margin-top:4px;border:1px solid rgba(255,255,255,0.08);
  }
  .fuel-bar-fill{
    height:100%;width:100%;
    background:linear-gradient(90deg, #2ed573, #7bed9f);
    border-radius:7px;transition:width 0.1s linear, background 0.3s;
  }
  .fuel-bar-fill.low{
    background:linear-gradient(90deg, #ff4757, #ff6b81);
    animation:blink 0.6s infinite alternate;
  }
  @keyframes blink{0%{opacity:0.6;} 100%{opacity:1;}}

  /* GAME OVER MODAL */
  #overlay{
    position:absolute;inset:0;z-index:30;
    display:none;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(circle at center, rgba(16,24,38,0.85), rgba(4,8,14,0.96));
    backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
    color:#fff;text-align:center;padding:24px;
  }
  #overlay.show{display:flex;}
  #overlay h1{
    font-size:clamp(32px, 8vw, 54px);font-weight:900;letter-spacing:1px;
    background:linear-gradient(180deg,#fff,#ff6b81);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px;
  }
  #overlay p#reason{font-size:18px;color:#a4b0be;margin-bottom:18px;}
  .score-grid{
    display:flex;gap:28px;background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.12);padding:16px 32px;border-radius:20px;
    margin-bottom:28px;
  }
  .score-item{display:flex;flex-direction:column;}
  .score-item .num{font-size:26px;font-weight:900;color:#ffd32a;}
  .score-item .lbl{font-size:11px;font-weight:700;color:#747d8c;letter-spacing:1px;}
  #restartBtn{
    cursor:pointer;pointer-events:auto;border:none;
    padding:16px 52px;border-radius:999px;
    font-size:18px;font-weight:900;letter-spacing:1px;color:#0b190f;
    background:linear-gradient(180deg, #2ed573, #26af5f);
    box-shadow:0 10px 26px rgba(46,213,115,0.45);
    transition:transform .08s, filter .08s;
  }
  #restartBtn:hover{filter:brightness(1.1);}
  #restartBtn:active{transform:scale(0.95);}
</style>
</head>
<body>

<canvas id='canvas'></canvas>

<!-- HUD Real-time -->
<div id='hud'>
  <div class='hud-card'>
    <span class='hud-label'>JARAK &amp; KOIN</span>
    <div class='hud-val' id='hudDistance'>0 m <span id='hudCoins'>★ 0</span></div>
  </div>
  <div class='hud-card fuel-box'>
    <div style='display:flex;justify-content:space-between;'>
      <span class='hud-label'>BENSIN</span>
      <span class='hud-label' id='fuelText'>100%</span>
    </div>
    <div class='fuel-bar-bg'>
      <div class='fuel-bar-fill' id='fuelBar'></div>
    </div>
  </div>
</div>

<!-- Pedal Kontrol Fisik -->
<div class='pedal-wrapper pedal-left'>
  <div class='pedal' id='pedalBrake'>
    <div class='pedal-title'>REM</div>
    <div class='tread'></div>
    <div class='tread'></div>
    <div class='tread'></div>
    <div class='pedal-sub'>MUNDUR</div>
  </div>
</div>

<div class='pedal-wrapper pedal-right'>
  <div class='pedal' id='pedalGas'>
    <div class='pedal-title'>GAS</div>
    <div class='tread'></div>
    <div class='tread'></div>
    <div class='tread'></div>
    <div class='pedal-sub'>MAJU</div>
  </div>
</div>

<!-- Modal Game Over -->
<div id='overlay'>
  <h1>GAME OVER</h1>
  <p id='reason'>Mobil Terbalik!</p>
  <div class='score-grid'>
    <div class='score-item'><span class='num' id='resDist'>0 m</span><span class='lbl'>JARAK</span></div>
    <div class='score-item'><span class='num' id='resCoins'>0</span><span class='lbl'>KOIN</span></div>
    <div class='score-item'><span class='num' id='resTotal'>0</span><span class='lbl'>TOTAL SKOR</span></div>
  </div>
  <button id='restartBtn'>MAIN LAGI</button>
</div>

<script>
(function(){
'use strict';

/* ============================================================
   1. REALISTIC AUDIO SYNTHESIZER (HD PROCEDURAL WEB AUDIO)
============================================================ */
class SoundEngine {
  constructor(){
    this.ctx = null;
    this.ready = false;
    this.engineGain = null;
    this.osc1 = null;
    this.osc2 = null;
    this.filter = null;
    this.skidGain = null;
    this.lowFuelWarningTime = 0;
  }
  init(){
    if(this.ready) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return;
    this.ctx = new AudioCtx();

    // Master bus & Limiter
    this.master = this.ctx.createDynamicsCompressor();
    this.master.threshold.setValueAtTime(-10, this.ctx.currentTime);
    this.master.knee.setValueAtTime(24, this.ctx.currentTime);
    this.master.ratio.setValueAtTime(10, this.ctx.currentTime);
    this.master.connect(this.ctx.destination);

    /* --- SUARA MESIN V8 OFFROAD --- */
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.24, this.ctx.currentTime);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.setValueAtTime(45, this.ctx.currentTime);

    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.setValueAtTime(22.5, this.ctx.currentTime);

    // Knalpot Rumble
    const bufLen = this.ctx.sampleRate * 1.5;
    const nBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const nData = nBuf.getChannelData(0);
    for(let i=0; i<bufLen; i++) nData[i] = (Math.random()*2 - 1) * 0.4;
    const noise = this.ctx.createBufferSource();
    noise.buffer = nBuf;
    noise.loop = true;

    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(120, this.ctx.currentTime);
    nFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.engineGain);
    noise.start();

    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.filter.connect(this.engineGain);
    this.engineGain.connect(this.master);

    this.osc1.start();
    this.osc2.start();

    /* --- DECITAN BAN (TIRE SKID) --- */
    const skidBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const sData = skidBuf.getChannelData(0);
    for(let i=0; i<bufLen; i++) sData[i] = Math.random()*2 - 1;
    const skidSource = this.ctx.createBufferSource();
    skidSource.buffer = skidBuf;
    skidSource.loop = true;

    const skidFilter = this.ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.setValueAtTime(1250, this.ctx.currentTime);
    skidFilter.Q.setValueAtTime(5, this.ctx.currentTime);

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);

    skidSource.connect(skidFilter);
    skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.master);
    skidSource.start();

    this.ready = true;
  }
  ensureResume(){
    if(this.ctx && this.ctx.state === 'suspended'){
      this.ctx.resume();
    }
  }
  updateEngine(rpmRatio, throttleActive){
    if(!this.ready) return;
    const t = this.ctx.currentTime;
    const freq = 42 + rpmRatio * 170;
    this.osc1.frequency.setTargetAtTime(freq, t, 0.05);
    this.osc2.frequency.setTargetAtTime(freq * 0.5, t, 0.05);

    const cutoff = 260 + rpmRatio * 1500 + (throttleActive ? 350 : 0);
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.06);

    const vol = 0.2 + (throttleActive ? 0.12 : 0.04) + rpmRatio * 0.12;
    this.engineGain.gain.setTargetAtTime(vol, t, 0.05);
  }
  setSkid(intensity){
    if(!this.ready) return;
    const target = Math.min(Math.max((intensity - 0.28) * 1.6, 0), 0.35);
    this.skidGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }
  popExhaust(){
    if(!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.08);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.1);
  }
  playImpact(intensity){
    if(!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const power = Math.min(Math.max(intensity, 0.1), 1.0);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120 * power, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.28);
    g.gain.setValueAtTime(0.5 * power, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.32);
  }
  playCoin(){
    if(!this.ready) return;
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc1.type = 'sine'; osc2.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, t); // C6
    osc2.frequency.setValueAtTime(2093.0, t); // C7
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc1.connect(g); osc2.connect(g); g.connect(this.master);
    osc1.start(t); osc2.start(t);
    osc1.stop(t + 0.4); osc2.stop(t + 0.4);
  }
  playFuel(){
    if(!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(640, t + 0.28);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.36);
  }
  playLowFuelWarning(){
    if(!this.ready) return;
    const now = performance.now();
    if(now - this.lowFuelWarningTime < 1100) return;
    this.lowFuelWarningTime = now;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.15);
  }
  playCrash(){
    if(!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.8);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.9);
  }
}
const sfx = new SoundEngine();

/* ============================================================
   2. FULL CANVAS RESIZE & HI-DPI
============================================================ */
const cvs = document.getElementById('canvas');
const ctx = cvs.getContext('2d');
let W = 0, H = 0, DPR = 1;

function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  cvs.width = Math.floor(W * DPR);
  cvs.height = Math.floor(H * DPR);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));
resize();

/* ============================================================
   3. TERRAIN SEAMLESS PROCEDURAL
============================================================ */
const SEED = [Math.random()*10, Math.random()*10, Math.random()*10];
function terrainY(x){
  if(x < 120) return 0;
  const ramp = Math.min(1, Math.max(0, (x - 120) / 380));
  const diff = 1 + Math.min(1.35, x / 15000);

  let y = Math.sin(x * 0.00115 + SEED[0]) * 115 * diff
        + Math.sin(x * 0.00310 + SEED[1]) * 58 * diff
        + Math.sin(x * 0.00850 + SEED[2]) * 24
        + Math.sin(x * 0.02400) * 7;
  return y * ramp;
}

function terrainNormal(x){
  const e = 2.0;
  const s = (terrainY(x + e) - terrainY(x - e)) / (2 * e);
  const inv = 1 / Math.hypot(s, 1);
  return { nx: s * inv, ny: -inv, tx: inv, ty: s * inv };
}

/* ============================================================
   4. SISTEM PARTIKEL & FLOATING TEXT POP-UP
============================================================ */
const particles = [];
const popups = [];

function addParticle(x, y, vx, vy, type){
  if(particles.length > 240) particles.shift();
  particles.push({
    x, y, vx, vy, type,
    life: 1.0,
    decay: type === 'smoke' ? 0.75 : 1.3,
    size: type === 'smoke' ? 4 + Math.random()*4 : 3 + Math.random()*3
  });
}

function addPopup(x, y, text, color){
  popups.push({ x, y, text, color, life: 1.0 });
}

/* ============================================================
   5. FISIKA MOBIL (SUSPENSI INDEPENDEN + TRAKSI KARET)
============================================================ */
const WHEEL_R = 17;
const car = {
  x: 200, y: -45,
  vx: 0, vy: 0,
  angle: 0, omega: 0,
  mass: 1.25,
  inertia: 560,
  head: { lx: -4, ly: -38, curX: -4, curY: -38 }
};

const wheels = [
  { lx: -40, ly: 6, ext: 10, rest: 10, spin: 0, grounded: false, slip: 0 },
  { lx:  40, ly: 6, ext: 10, rest: 10, spin: 0, grounded: false, slip: 0 }
];

let inputGas = false;
let inputBrake = false;
let fuel = 100;
let coins = 0;
let score = 0;
let state = 'play';
let screenShake = 0;
let airborneAccum = 0;
let inAirFlipCounter = 0;

/* ============================================================
   6. REALISTIS PEDAL INPUT (MULTI-TOUCH SAFE)
============================================================ */
function initControls(){
  const pGas = document.getElementById('pedalGas');
  const pBrake = document.getElementById('pedalBrake');

  const touches = new Map();

  function updateTouchState(){
    inputGas = false;
    inputBrake = false;
    for(const id of touches.values()){
      if(id === 'gas') inputGas = true;
      if(id === 'brake') inputBrake = true;
    }
    pGas.classList.toggle('active', inputGas);
    pBrake.classList.toggle('active', inputBrake);
  }

  function bindPedal(el, name){
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      sfx.init();
      sfx.ensureResume();
      el.setPointerCapture(e.pointerId);
      touches.set(e.pointerId, name);
      updateTouchState();
    });
    const release = e => {
      e.preventDefault();
      if(touches.has(e.pointerId)){
        touches.delete(e.pointerId);
        updateTouchState();
      }
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  }

  bindPedal(pGas, 'gas');
  bindPedal(pBrake, 'brake');

  // Keyboard support
  window.addEventListener('keydown', e => {
    sfx.init(); sfx.ensureResume();
    const k = e.key.toLowerCase();
    if(k === 'arrowright' || k === 'd') inputGas = true;
    if(k === 'arrowleft'  || k === 'a') inputBrake = true;
    if((k === ' ' || k === 'enter') && state === 'over') restartGame();
    pGas.classList.toggle('active', inputGas);
    pBrake.classList.toggle('active', inputBrake);
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if(k === 'arrowright' || k === 'd') inputGas = false;
    if(k === 'arrowleft'  || k === 'a') inputBrake = false;
    pGas.classList.toggle('active', inputGas);
    pBrake.classList.toggle('active', inputBrake);
  });
}
initControls();

/* ============================================================
   7. ITEM PROCEDURAL (KOIN & JERIGEN BENSIN)
============================================================ */
let items = [];
let nextItemSpawnX = 500;

function updateItems(dt){
  while(nextItemSpawnX < car.x + 2800){
    const x = nextItemSpawnX;
    if(Math.random() < 0.22){
      items.push({ x, y: terrainY(x) - 46, type: 'fuel', taken: false });
    } else {
      const count = 2 + Math.floor(Math.random()*4);
      for(let i=0; i<count; i++){
        const cx = x + i*42;
        items.push({ x: cx, y: terrainY(cx) - 48, type: 'coin', taken: false });
      }
    }
    nextItemSpawnX += 280 + Math.random()*340;
  }

  for(const it of items){
    if(it.taken) continue;
    const dx = it.x - car.x;
    const dy = it.y - car.y;
    if(dx*dx + dy*dy < 54*54){
      it.taken = true;
      if(it.type === 'coin'){
        coins++; score += 10;
        sfx.playCoin();
        addPopup(it.x, it.y, '+10', '#ffd32a');
      } else {
        fuel = Math.min(100, fuel + 42);
        sfx.playFuel();
        addPopup(it.x, it.y, '+BENSIN!', '#2ed573');
      }
    }
  }
  if(items.length > 200){
    items = items.filter(it => !it.taken && it.x > car.x - 1200);
  }
}

/* ============================================================
   8. UPDATE FISIKA (SUSPENSION & REALISTIC DRIVING DYNAMICS)
============================================================ */
const K_SPRING = 920;
const D_DAMPER = 48;
const MU_TIRE  = 1.6;
const ENGINE_POWER = 820;

let prevGas = false;

function updatePhysics(dt){
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);

  let totalFx = 0;
  let totalFy = 1680 * car.mass; // Gravitasi
  let totalTorque = 0;
  let groundedCount = 0;
  let maxSlip = 0;

  // Letupan knalpot saat melepas pedal gas di kecepatan tinggi
  if(prevGas && !inputGas && Math.abs(car.vx) > 300){
    sfx.popExhaust();
  }
  prevGas = inputGas;

  wheels.forEach(w => {
    const ax = car.x + w.lx * cos - w.ly * sin;
    const ay = car.y + w.lx * sin + w.ly * cos;
    const downX = -sin, downY = cos;

    const wx = ax + downX * w.ext;
    const wy = ay + downY * w.ext;

    const gy = terrainY(wx);
    const pen = (wy + WHEEL_R) - gy;

    if(pen > 0){
      groundedCount++;
      w.grounded = true;
      w.ext = Math.max(1, w.ext - pen);

      // Titik kontak
      const rX = wx - car.x;
      const rY = (wy + WHEEL_R) - car.y;
      const vX = car.vx - car.omega * rY;
      const vY = car.vy + car.omega * rX;

      const norm = terrainNormal(wx);
      const vNorm = vX * norm.nx + vY * norm.ny;
      const vTan  = vX * norm.tx + vY * norm.ty;

      // Gaya suspensi
      const comp = (w.rest + 12) - w.ext;
      let fNorm = Math.max(0, K_SPRING * comp - D_DAMPER * vNorm);
      if(fNorm > 8000) fNorm = 8000;

      // Logika Pedal Gas vs Rem/Mundur Realistis
      let driveTorque = 0;
      if(inputGas) driveTorque += ENGINE_POWER;
      if(inputBrake){
        if(vTan > 25){
          // Pengereman cakram kuat saat melaju maju
          driveTorque -= ENGINE_POWER * 1.35;
        } else {
          // Gigi mundur aktif saat diam / perlahan
          driveTorque -= ENGINE_POWER * 0.75;
        }
      }

      // Gesekan traksi
      let fTan = driveTorque - vTan * 3.8;
      const maxFriction = MU_TIRE * fNorm;
      w.slip = Math.abs(fTan) / (maxFriction + 1e-4);
      if(w.slip > maxSlip) maxSlip = w.slip;

      if(Math.abs(fTan) > maxFriction){
        fTan = Math.sign(fTan) * maxFriction;
        // Efek ban mencakar tanah
        addParticle(wx, wy + WHEEL_R, -norm.tx*190 + (Math.random()-0.5)*70, -norm.ty*190 - Math.random()*120, 'dirt');
      }

      const fx = norm.nx * fNorm + norm.tx * fTan;
      const fy = norm.ny * fNorm + norm.ty * fTan;

      totalFx += fx;
      totalFy += fy;
      totalTorque += rX * fy - rY * fx;

      w.spin += (vTan / WHEEL_R) * dt;

      if(pen > 7 && Math.abs(vNorm) > 130){
        sfx.playImpact(Math.abs(vNorm) / 450);
        screenShake = Math.min(screenShake + 4, 14);
      }
    } else {
      w.grounded = false;
      w.slip = 0;
      w.ext += (w.rest - w.ext) * 12 * dt;
      w.spin += (car.vx / WHEEL_R) * 0.4 * dt;
    }
  });

  sfx.setSkid(maxSlip);

  // Udara & Hambatan Angin
  const speed = Math.hypot(car.vx, car.vy);
  totalFx -= 0.0016 * car.vx * speed;
  totalFy -= 0.0016 * car.vy * speed;

  // Kontrol kemiringan mobil di udara (Air Pitch)
  if(groundedCount === 0){
    airborneAccum += dt;
    inAirFlipCounter += car.omega * dt;
    if(inputGas)   totalTorque += 2600;
    if(inputBrake) totalTorque -= 2600;

    // Hadiah bonus backflip / frontflip
    if(Math.abs(inAirFlipCounter) > Math.PI * 1.8){
      inAirFlipCounter = 0;
      score += 50; coins += 5;
      sfx.playCoin();
      addPopup(car.x, car.y - 40, 'FLIP BONUS! +50', '#2ed573');
    }
  } else {
    airborneAccum = 0;
    inAirFlipCounter = 0;
  }

  // Integrasi
  car.vx += (totalFx / car.mass) * dt;
  car.vy += (totalFy / car.mass) * dt;
  car.omega += (totalTorque / car.inertia) * dt;

  car.vx *= (1 - 0.07 * dt);
  car.vy *= (1 - 0.07 * dt);
  car.omega *= (1 - 0.32 * dt);

  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.angle += car.omega * dt;

  // Asap Knalpot saat digas
  if(inputGas && Math.random() < 0.65){
    const exX = car.x - 46 * cos - 6 * (-sin);
    const exY = car.y - 46 * sin - 6 * cos;
    addParticle(exX, exY, -cos*80 + (Math.random()-0.5)*20, -sin*80 - 15, 'smoke');
  }

  // Gerak Inersia Kepala Pengemudi
  const headTargetX = car.head.lx - (car.vx * 0.014);
  const headTargetY = car.head.ly - (car.vy * 0.014);
  car.head.curX += (headTargetX - car.head.curX) * 16 * dt;
  car.head.curY += (headTargetY - car.head.curY) * 16 * dt;

  // Suara Mesin
  const rpm = Math.min(1, Math.max(0.1, (Math.abs(car.vx) / 850) + (inputGas ? 0.4 : 0)));
  sfx.updateEngine(rpm, inputGas);
}

/* ============================================================
   9. DETEKSI TABRAKAN KEPALA (CRASH ACCURATE)
============================================================ */
function checkCrash(){
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);

  const headWX = car.x + car.head.curX * cos - car.head.curY * sin;
  const headWY = car.y + car.head.curX * sin + car.head.curY * cos;

  // Terbalik tajam dan kepala membentur bukit
  const groundY = terrainY(headWX);
  const tilt = Math.abs(Math.sin(car.angle));
  if(headWY + 4 > groundY && tilt > 0.45){
    gameOver('Kepala Pengemudi Membentur Aspal/Tanah!');
  }
}

function gameOver(reason){
  if(state !== 'play') return;
  state = 'over';
  sfx.playCrash();
  screenShake = 18;

  for(let i=0; i<35; i++){
    addParticle(car.x, car.y, (Math.random()-0.5)*500, -Math.random()*450, 'dirt');
  }

  const meters = Math.max(0, Math.floor((car.x - 200) / 45));
  document.getElementById('reason').textContent = reason;
  document.getElementById('resDist').textContent = meters + ' m';
  document.getElementById('resCoins').textContent = coins;
  document.getElementById('resTotal').textContent = score + meters;
  document.getElementById('overlay').classList.add('show');
}

function restartGame(){
  car.x = 200;
  car.y = terrainY(200) - 45;
  car.vx = 0; car.vy = 0;
  car.angle = 0; car.omega = 0;
  wheels.forEach(w => { w.ext = w.rest; w.spin = 0; });
  fuel = 100;
  coins = 0;
  score = 0;
  items = [];
  nextItemSpawnX = 500;
  state = 'play';
  document.getElementById('overlay').classList.remove('show');
}
document.getElementById('restartBtn').addEventListener('click', restartGame);

/* ============================================================
   10. KAMERA HALUS (PANORAMIC AUTO-FOLLOW)
============================================================ */
const camera = { x: 200, y: 0, zoom: 1.0 };

function updateCamera(dt){
  const targetX = car.x + car.vx * 0.26;
  const targetY = car.y + car.vy * 0.12 - 40;

  camera.x += (targetX - camera.x) * (1 - Math.exp(-6.5 * dt));
  camera.y += (targetY - camera.y) * (1 - Math.exp(-5.0 * dt));

  const speed = Math.hypot(car.vx, car.vy);
  const targetZoom = Math.max(0.72, 1.0 - (speed / 2400) * 0.24);
  camera.zoom += (targetZoom - camera.zoom) * 2.5 * dt;

  if(screenShake > 0){
    screenShake -= 32 * dt;
    if(screenShake < 0) screenShake = 0;
  }
}

/* ============================================================
   11. RENDER GRAFIS HD LENGKAP TANPA BATAS (FULL VIEW)
============================================================ */
function drawSkyAtmosphere(){
  // Langit Gradien Penuh
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a3d62');
  sky.addColorStop(0.4, '#1e6091');
  sky.addColorStop(0.75, '#52b69a');
  sky.addColorStop(1, '#b5e48c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Matahari Terang & Cahaya Korona
  const sunX = W * 0.8;
  const sunY = H * 0.18;
  const sGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 220);
  sGrad.addColorStop(0, 'rgba(255,255,240,1)');
  sGrad.addColorStop(0.2, 'rgba(255,240,170,0.5)');
  sGrad.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = sGrad;
  ctx.beginPath(); ctx.arc(sunX, sunY, 220, 0, Math.PI*2); ctx.fill();

  // 3 Lapis Pegunungan Paralaks Berurutan
  drawMountains(0.06, '#3a7ca5', 180, 0.0003, H * 0.48, true);
  drawMountains(0.18, '#2a6f8f', 120, 0.0008, H * 0.62, false);
  drawMountains(0.38, '#1b4d3e', 80, 0.0018, H * 0.74, false);
}

function drawMountains(parallax, color, amp, freq, baseH, snowCaps){
  ctx.beginPath();
  ctx.moveTo(0, H);
  for(let sx = 0; sx <= W + 20; sx += 20){
    const wx = (sx - W*0.5) / camera.zoom + camera.x * parallax;
    const y = baseH + Math.sin(wx * freq) * amp + Math.sin(wx * freq * 2.6) * (amp * 0.4);
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTerrainFull(){
  const leftX  = camera.x - (W / camera.zoom) * 0.65;
  const rightX = camera.x + (W / camera.zoom) * 0.65;
  const step = 7;

  // Poligon Tanah Sangat Dalam (Menghilangkan Semua Celah Bawah)
  ctx.beginPath();
  ctx.moveTo(leftX, terrainY(leftX));
  for(let wx = leftX; wx <= rightX; wx += step){
    ctx.lineTo(wx, terrainY(wx));
  }
  const deepBottom = camera.y + (H / camera.zoom) + 1200;
  ctx.lineTo(rightX, deepBottom);
  ctx.lineTo(leftX, deepBottom);
  ctx.closePath();

  // Gradien Lapisan Bumi (Tanah Subur -> Batuan Padat)
  const dirtGrad = ctx.createLinearGradient(0, camera.y - 150, 0, camera.y + 800);
  dirtGrad.addColorStop(0, '#5a3d28');
  dirtGrad.addColorStop(0.15, '#422c1d');
  dirtGrad.addColorStop(0.5, '#2b1b10');
  dirtGrad.addColorStop(1, '#110b06');
  ctx.fillStyle = dirtGrad;
  ctx.fill();

  // Rumput Atas Berwarna Segar
  ctx.beginPath();
  ctx.moveTo(leftX, terrainY(leftX));
  for(let wx = leftX; wx <= rightX; wx += step){
    ctx.lineTo(wx, terrainY(wx));
  }
  ctx.strokeStyle = '#27ae60';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth = 5;
  ctx.stroke();
}

function drawWorldItems(){
  for(const it of items){
    if(it.taken) continue;
    if(it.type === 'coin'){
      const bob = Math.sin(Date.now()*0.006 + it.x) * 5;
      ctx.save();
      ctx.translate(it.x, it.y + bob);
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI*2);
      const cg = ctx.createRadialGradient(-3, -3, 2, 0, 0, 13);
      cg.addColorStop(0, '#fff6a2');
      cg.addColorStop(0.6, '#ffd32a');
      cg.addColorStop(1, '#d48806');
      ctx.fillStyle = cg; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#874d00'; ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.fillStyle = '#eb4d4b';
      ctx.beginPath();
      ctx.roundRect(-12, -15, 24, 30, 4);
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#b33939'; ctx.stroke();

      ctx.fillStyle = '#222';
      ctx.fillRect(-6, -19, 12, 5);

      ctx.fillStyle = '#fff';
      ctx.font = '900 10px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('GAS', 0, 2);
      ctx.restore();
    }
  }
}

function drawRealisticWheel(w, cos, sin){
  const ax = car.x + w.lx * cos - w.ly * sin;
  const ay = car.y + w.lx * sin + w.ly * cos;
  const downX = -sin, downY = cos;
  const wx = ax + downX * w.ext;
  const wy = ay + downY * w.ext;

  // Pegas Spiral Suspensi
  ctx.save();
  ctx.strokeStyle = '#718093';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  const turns = 5;
  for(let i=1; i<=turns; i++){
    const r = i / turns;
    const px = ax + downX * (w.ext * r) + (i%2===0 ? 5 : -5) * cos;
    const py = ay + downY * (w.ext * r) + (i%2===0 ? 5 : -5) * sin;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(wx, wy);
  ctx.stroke();
  ctx.restore();

  // Roda
  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(w.spin);

  // Karet Ban Luar
  ctx.beginPath();
  ctx.arc(0, 0, WHEEL_R, 0, Math.PI*2);
  ctx.fillStyle = '#1e272e'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#0f1418'; ctx.stroke();

  // Velg Logam
  ctx.beginPath();
  ctx.arc(0, 0, WHEEL_R * 0.58, 0, Math.PI*2);
  const velg = ctx.createLinearGradient(-10, -10, 10, 10);
  velg.addColorStop(0, '#f1f2f6');
  velg.addColorStop(1, '#a4b0be');
  ctx.fillStyle = velg; ctx.fill();

  // Palang Velg (Spokes)
  ctx.strokeStyle = '#2f3542';
  ctx.lineWidth = 2.4;
  for(let a=0; a<Math.PI*2; a += Math.PI/3){
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.lineTo(Math.cos(a)*WHEEL_R*0.54, Math.sin(a)*WHEEL_R*0.54);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVehicleBody(){
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Sasis Baja
  ctx.fillStyle = '#2f3542';
  ctx.beginPath();
  ctx.roundRect(-44, 4, 88, 8, 3);
  ctx.fill();

  // Bodi Off-Road Merah Api
  const bg = ctx.createLinearGradient(0, -32, 0, 10);
  bg.addColorStop(0, '#ff4757');
  bg.addColorStop(0.6, '#ee5253');
  bg.addColorStop(1, '#b33939');
  ctx.fillStyle = bg;

  ctx.beginPath();
  ctx.moveTo(-45, 4);
  ctx.lineTo(-42, -16);
  ctx.lineTo(-15, -18);
  ctx.lineTo( 14, -18);
  ctx.lineTo( 32, -6);
  ctx.lineTo( 46,  2);
  ctx.lineTo( 46,  8);
  ctx.lineTo(-45,  8);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#7f1d1d'; ctx.stroke();

  // Kaca Angin Biru Es
  ctx.fillStyle = 'rgba(206, 240, 253, 0.7)';
  ctx.beginPath();
  ctx.moveTo(-11, -18);
  ctx.lineTo( 12, -18);
  ctx.lineTo( 28, -7);
  ctx.lineTo(-11, -7);
  ctx.closePath();
  ctx.fill();

  // Roll-Cage Tubular
  ctx.strokeStyle = '#353b48';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-20, -16);
  ctx.lineTo(-15, -42);
  ctx.lineTo(  8, -42);
  ctx.lineTo( 16, -18);
  ctx.stroke();

  // Pengemudi dengan Inersia Kepala
  ctx.save();
  ctx.translate(car.head.curX, car.head.curY);

  // Tubuh
  ctx.fillStyle = '#2e86de';
  ctx.fillRect(-5, 8, 10, 13);

  // Helm
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI*2);
  const helm = ctx.createRadialGradient(-3, -3, 2, 0, 0, 10);
  helm.addColorStop(0, '#ffffff');
  helm.addColorStop(0.7, '#0abde3');
  helm.addColorStop(1, '#10ac84');
  ctx.fillStyle = helm; ctx.fill();

  // Kaca Helm
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(3, 0, 6.5, -Math.PI*0.35, Math.PI*0.35); ctx.fill();
  ctx.restore();

  // Lampu Depan Menyala Terang
  ctx.fillStyle = '#f9ca24';
  ctx.beginPath(); ctx.arc(45, 2, 4.5, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

function drawPopups(dt){
  for(let i=popups.length-1; i>=0; i--){
    const p = popups[i];
    p.life -= dt * 1.3;
    p.y -= 25 * dt;
    if(p.life <= 0){
      popups.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.font = '900 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }
}

function updateHUD(){
  const meters = Math.max(0, Math.floor((car.x - 200) / 45));
  document.getElementById('hudDistance').innerHTML = meters + ' m <span>★ '+ coins + '</span>';

  const fuelRatio = Math.max(0, fuel / 100);
  const fuelBar = document.getElementById('fuelBar');
  fuelBar.style.width = (fuelRatio * 100) + '%';
  document.getElementById('fuelText').textContent = Math.round(fuelRatio * 100) + '%';

  if(fuelRatio < 0.25){
    fuelBar.classList.add('low');
    if(state === 'play') sfx.playLowFuelWarning();
  } else {
    fuelBar.classList.remove('low');
  }
}

/* ============================================================
   12. MAIN LOOP (HIGH REFRESH 180HZ TICK ENGINE)
============================================================ */
let lastNow = performance.now();
const SUB_STEP = 1 / 180;
let accTime = 0;

function mainLoop(now){
  requestAnimationFrame(mainLoop);

  let dt = (now - lastNow) / 1000;
  lastNow = now;
  if(dt > 0.1) dt = 0.1;

  if(state === 'play'){
    accTime += dt;
    while(accTime >= SUB_STEP){
      updatePhysics(SUB_STEP);
      accTime -= SUB_STEP;
    }

    fuel -= (1.6 + (inputGas ? 2.8 : 0)) * dt;
    if(fuel <= 0){
      fuel = 0;
      gameOver('Bahan Bakar Habis!');
    }

    checkCrash();
    updateItems(dt);
  }

  updateCamera(dt);
  updateHUD();

  /* --- RENDER FRAME PENUH --- */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  drawSkyAtmosphere();

  // Kamera Dunia
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.save();
  const shakeX = (Math.random() - 0.5) * screenShake;
  const shakeY = (Math.random() - 0.5) * screenShake;

  ctx.translate(W * 0.38 + shakeX, H * 0.55 + shakeY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  drawTerrainFull();
  drawWorldItems();

  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  wheels.forEach(w => drawRealisticWheel(w, cos, sin));
  drawVehicleBody();

  // Partikel
  for(let i=particles.length-1; i>=0; i--){
    const p = particles[i];
    p.life -= p.decay * dt;
    if(p.life <= 0){ particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;

    if(p.type === 'smoke'){
      p.size += 20 * dt; p.vy -= 20 * dt;
      ctx.fillStyle = 'rgba(220, 230, 240, ' + p.life * 0.4 + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    } else {
      p.vy += 800 * dt;
      ctx.fillStyle = 'rgba(130, 80, 40, ' + p.life + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    }
  }

  drawPopups(dt);

  ctx.restore();
}

restartGame();
requestAnimationFrame(mainLoop);

})();
</script>
</body>
</html>`
}];