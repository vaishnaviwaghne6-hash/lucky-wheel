import { useEffect, useRef, useState } from "react";

const N = 12;
const SEG = 360 / N;
const PAYOUT = 10;
const FORCE_WIN_ON_SPIN = 2; // demo mode: this spin number always wins. Set to 0 for fair random.
const BETS = [10, 25, 50, 100];
const THEMES = [
  { id: "carnival", name: "Carnival", lvl: 1, c: ["#e8553d", "#f2b84b", "#1f9d8b", "#4c5fd5"] },
  { id: "neon", name: "Neon", lvl: 2, c: ["#ff2e93", "#00b8d9", "#7ac000", "#9b5cff"] },
  { id: "ocean", name: "Ocean", lvl: 3, c: ["#0077b6", "#00a6c4", "#3a9bb5", "#2a5d9f"] },
  { id: "royal", name: "Royal", lvl: 5, c: ["#7b2cbf", "#d99a1f", "#c9184a", "#3c1070"] },
];
const COLORS = ["var(--c0)", "var(--c1)", "var(--c2)", "var(--c3)"];
const QUIPS = {
  start: ["Spinning up the carnival lights...", "Hold your breath...", "The wheel knows. Do you?"],
  win: ["Unbelievable! The crowd goes wild!", "You called it!", "Lucky you. Drinks are on the house."],
  near: ["So close I heard the peg whisper your name.", "One slot away. That hurts."],
  loss: ["The wheel giveth, the wheel taketh.", "Next one is yours, I can feel it.", "Shake it off and spin again."],
};
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const LEVEL_XP = 100;

const load = () => {
  try { return JSON.parse(localStorage.getItem("lucky-wheel")) || null; } catch { return null; }
};
const saved = load();

// ---- tiny WebAudio helpers ----
let ctx;
function beep(freq, dur = 0.08, type = "square", vol = 0.05, delay = 0) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime + delay;
    o.start(t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.stop(t + dur);
  } catch {}
}

const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [200 + r * Math.cos(a), 200 + r * Math.sin(a)];
};

function Wheel({ rotation, spinning, duration, wheelRef, glow }) {
  return (
    <div className={`wheel-wrap ${glow || ""} ${spinning ? "fast" : ""}`}>
      <div className={`pointer ${spinning ? "wiggle" : ""}`} />
      <svg ref={wheelRef} viewBox="0 0 400 400" className="wheel"
        style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${duration}s cubic-bezier(.2,.6,.25,1)` : "none" }}>
        <circle cx="200" cy="200" r="196" fill="#0a161c" />
        {Array.from({ length: N }, (_, i) => {
          const [x1, y1] = polar(185, i * SEG - SEG / 2);
          const [x2, y2] = polar(185, i * SEG + SEG / 2);
          const [tx, ty] = polar(142, i * SEG);
          const [bx, by] = polar(192, i * SEG - SEG / 2);
          return (
            <g key={i}>
              <path d={`M200 200 L${x1} ${y1} A185 185 0 0 1 ${x2} ${y2} Z`} style={{ fill: COLORS[i % 4] }} stroke="#0a161c" strokeWidth="2" />
              <text x={tx} y={ty} className="seg-num" transform={`rotate(${i * SEG} ${tx} ${ty})`}>{i + 1}</text>
              <circle cx={bx} cy={by} r="4" fill="#fff6d8" className="bulb" style={{ animationDelay: `${(i % 2) * 0.5}s` }} />
            </g>
          );
        })}
        <circle cx="200" cy="200" r="34" fill="#f2b84b" stroke="#0a161c" strokeWidth="4" />
        <text x="200" y="208" className="hub">GO</text>
      </svg>
    </div>
  );
}

function Confetti({ burst }) {
  if (!burst) return null;
  return (
    <div className="confetti" key={burst}>
      {Array.from({ length: 70 }, (_, i) => (
        <i key={i} style={{
          left: `${Math.random() * 100}%`,
          background: COLORS[i % 4],
          animationDelay: `${Math.random() * 0.4}s`,
          animationDuration: `${1.8 + Math.random() * 1.6}s`,
          "--dx": `${(Math.random() - 0.5) * 240}px`,
          "--rot": `${Math.random() * 900}deg`,
        }} />
      ))}
    </div>
  );
}

function useCountUp(target, ms = 1300) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const f = (t) => {
      t0 = t0 ?? t;
      const k = Math.min((t - t0) / ms, 1);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// Scratch-card bonus: rub the silver layer away to reveal extra coins
function Scratch({ bonus, onReveal }) {
  const ref = useRef(null);
  const down = useRef(false);
  const moves = useRef(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const c = ref.current, g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, c.width, c.height);
    gr.addColorStop(0, "#c9ced6"); gr.addColorStop(0.5, "#f4f6f9"); gr.addColorStop(1, "#a9afb9");
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#6b7280"; g.font = "800 18px Outfit, sans-serif"; g.textAlign = "center";
    g.fillText("SCRATCH HERE FOR A BONUS", c.width / 2, c.height / 2 + 6);
  }, []);
  const scratch = (e) => {
    if (!down.current || done) return;
    const c = ref.current, r = c.getBoundingClientRect(), g = c.getContext("2d");
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.arc(((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height, 20, 0, 7);
    g.fill();
    if (++moves.current % 8 === 0) {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let clear = 0;
      for (let i = 3; i < d.length; i += 16) if (!d[i]) clear++;
      if (clear / (d.length / 16) > 0.45) { setDone(true); onReveal(bonus); }
    }
  };
  return (
    <div className={`scratch ${done ? "done" : ""}`}>
      <div className="under">+{bonus} bonus coins</div>
      <canvas ref={ref} width="300" height="90"
        onPointerDown={(e) => { down.current = true; e.currentTarget.setPointerCapture(e.pointerId); scratch(e); }}
        onPointerUp={() => (down.current = false)} onPointerMove={scratch} />
    </div>
  );
}

function WinPopup({ info, onClose, onBonus }) {
  const prize = useCountUp(info.prize);
  return (
    <div className="overlay">
      <div className="rays" />
      <div className="ticket" role="dialog" aria-label="You won">
        <div className="tk-head">Golden Ticket</div>
        <div className="tk-num">{info.number}</div>
        <div className="tk-prize">+{prize} <small>coins</small></div>
        <div className="tk-meta">
          Bet {info.bet} at {info.mult.toFixed(1)}x{info.boosted ? " (comeback boost)" : ""}
          <br />Ticket {info.serial}
        </div>
        <div className="tk-cut" />
        <Scratch bonus={info.bonus} onReveal={onBonus} />
        <button className="spin" onClick={onClose}>Collect</button>
      </div>
    </div>
  );
}

const ACHIEVEMENTS = [
  { id: "first", label: "First win", test: (s) => s.wins >= 1 },
  { id: "streak3", label: "Hot hand: 3 in a row", test: (s) => s.best >= 3 },
  { id: "rich", label: "Stack of 1,000", test: (s) => s.coins >= 1000 },
  { id: "spins25", label: "25 spins", test: (s) => s.spins >= 25 },
];

export default function App() {
  const [coins, setCoins] = useState(saved?.coins ?? 200);
  const [xp, setXp] = useState(saved?.xp ?? 0);
  const [pick, setPick] = useState(null);
  const [bet, setBet] = useState(10);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [duration, setDuration] = useState(6);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(saved?.history ?? []);
  const [stats, setStats] = useState(saved?.stats ?? { wins: 0, spins: 0, streak: 0, best: 0 });
  const [burst, setBurst] = useState(0);
  const [toast, setToast] = useState(null);
  const [themeId, setThemeId] = useState(saved?.themeId ?? "carnival");
  const [shield, setShield] = useState(false);
  const [pity, setPity] = useState(0);
  const [popup, setPopup] = useState(null);
  const [quip, setQuip] = useState("Welcome, friend! Pick a number and let's see who is lucky.");
  const [sound, setSound] = useState(true);
  const [unlocked, setUnlocked] = useState(saved?.unlocked ?? []);
  const wheelRef = useRef(null);
  const raf = useRef(0);
  const sessionSpins = useRef(0);

  const level = Math.floor(xp / LEVEL_XP) + 1;
  const streakBonus = Math.min(stats.streak, 5) * 0.1; // +10% per streak, max +50%
  const cost = bet + (shield ? Math.ceil(bet * 0.2) : 0);
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const vars = Object.fromEntries(theme.c.map((c, i) => [`--c${i}`, c]));
  const canSpin = pick && !spinning && coins >= cost;

  useEffect(() => {
    localStorage.setItem("lucky-wheel", JSON.stringify({ coins, xp, history, stats, unlocked, themeId }));
  }, [coins, xp, history, stats, unlocked, themeId]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Tick sound each time a peg passes the pointer
  const watchTicks = () => {
    let last = null;
    const loop = () => {
      const m = new DOMMatrix(getComputedStyle(wheelRef.current).transform);
      const ang = (Math.atan2(m.b, m.a) * 180) / Math.PI;
      const seg = Math.floor(((ang + SEG / 2 + 3600) % 360) / SEG);
      if (last !== null && seg !== last && sound) beep(520 + (seg % 3) * 60, 0.03, "triangle", 0.04);
      last = seg;
      raf.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const spin = () => {
    if (!canSpin) return;
    sessionSpins.current += 1;
    const forced = FORCE_WIN_ON_SPIN > 0 && sessionSpins.current === FORCE_WIN_ON_SPIN;
    const winner = forced ? pick - 1 : Math.floor(Math.random() * N); // index 0..11 -> number winner+1
    const jitter = (Math.random() - 0.5) * (SEG - 8);
    const target = (360 - winner * SEG + jitter + 360) % 360;
    const delta = (target - (rotation % 360) + 360) % 360;
    const dur = 3.2 + Math.random() * 0.8;
    setCoins((c) => c - cost);
    setQuip(rnd(QUIPS.start));
    setResult(null);
    setDuration(dur);
    setSpinning(true);
    setRotation(rotation + 360 * 4 + delta);
    watchTicks();

    setTimeout(() => {
      cancelAnimationFrame(raf.current);
      setSpinning(false);
      const number = winner + 1;
      const won = number === pick;
      const boosted = pity >= 5;
      const mult = (PAYOUT + PAYOUT * streakBonus) * (boosted ? 2 : 1);
      setPity(boosted || won ? 0 : Math.min(pity + 1, 5));
      const prize = won ? Math.round(bet * mult) : 0;
      const gap = Math.abs(number - pick);
      const near = !won && (gap === 1 || gap === N - 1);
      const refund = near && shield ? bet : 0;
      const newStats = {
        spins: stats.spins + 1,
        wins: stats.wins + (won ? 1 : 0),
        streak: won ? stats.streak + 1 : 0,
        best: Math.max(stats.best, won ? stats.streak + 1 : 0),
      };
      const newCoins = coins - cost + prize + refund;
      setStats(newStats);
      setCoins(newCoins);
      setXp((x) => x + (won ? 40 : 10));
      setResult({ number, won, prize, near, refund });
      setQuip(rnd(won ? QUIPS.win : near ? QUIPS.near : QUIPS.loss));
      setHistory((h) => [{ number, won, pick }, ...h].slice(0, 12));
      if (won) {
        setBurst(Date.now());
        setTimeout(() => setPopup({
          number, prize, bet, mult, boosted,
          bonus: Math.max(5, Math.round(bet * (0.3 + Math.random() * 1.5))),
          serial: `LW-${Math.floor(1000 + Math.random() * 9000)}`,
        }), 1100);
        if (sound) [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.18, "square", 0.06, i * 0.1));
      } else if (sound) {
        beep(220, 0.25, "sawtooth", 0.05); beep(165, 0.35, "sawtooth", 0.05, 0.15);
      }
      const snapshot = { ...newStats, coins: newCoins };
      ACHIEVEMENTS.forEach((a) => {
        if (a.test(snapshot) && !unlocked.includes(a.id)) {
          setUnlocked((u) => [...u, a.id]);
          setTimeout(() => showToast(`Badge unlocked: ${a.label}`), 900);
        }
      });
      if (Math.floor((xp + (won ? 40 : 10)) / LEVEL_XP) > Math.floor(xp / LEVEL_XP)) {
        setTimeout(() => showToast(`Level up! You are level ${level + 1}${THEMES.find((t) => t.lvl === level + 1) ? ". New wheel style unlocked" : ""}`), 400);
      }
    }, dur * 1000 + 200);
  };

  const refill = () => { setCoins(100); showToast("Here are 100 free coins. Spend them well."); };
  const reset = () => {
    setCoins(200); setXp(0); setHistory([]); setUnlocked([]); setResult(null); setPick(null);
    setStats({ wins: 0, spins: 0, streak: 0, best: 0 });
  };

  return (
    <main className={`app ${result?.won ? "won" : ""}`} style={vars}>
      <Confetti burst={burst} />
      {popup && (
        <WinPopup info={popup} onClose={() => setPopup(null)}
          onBonus={(b) => { setCoins((c) => c + b); showToast(`Bonus +${b} coins`); if (sound) [660, 880].forEach((f, i) => beep(f, 0.12, "triangle", 0.06, i * 0.08)); }} />
      )}
      {toast && <div className="toast">{toast}</div>}

      <header className="top">
        <h1>Lucky Wheel</h1>
        <div className="hud">
          <div className="coins" key={coins}><span className="coin" />{coins}</div>
          <div className="lvl">
            <span>Level {level}</span>
            <div className="bar"><div style={{ width: `${((xp % LEVEL_XP) / LEVEL_XP) * 100}%` }} /></div>
          </div>
          <button className="ghost" onClick={() => setSound((s) => !s)} aria-label="Toggle sound">{sound ? "Sound on" : "Sound off"}</button>
        </div>
      </header>

      <section className="stage">
        <div className="left">
          <Wheel rotation={rotation} spinning={spinning} duration={duration} wheelRef={wheelRef}
            glow={result ? (result.won ? "glow-win" : result.near ? "glow-near" : "glow-loss") : ""} />
          <div className="result" aria-live="polite">
            {spinning && <p className="msg">Spinning…</p>}
            {!spinning && !result && <p className="msg">Pick a number and spin.</p>}
            {!spinning && result && (
              <p className={`msg ${result.won ? "good" : "bad"}`}>
                {result.won
                  ? `${result.number}! You win ${result.prize} coins`
                  : result.near
                  ? `Landed on ${result.number}, right next to ${pick}.${result.refund ? ` Shield refunded ${result.refund} coins.` : ""}`
                  : `Landed on ${result.number}. You picked ${pick}. Try again.`}
              </p>
            )}
          </div>
          <div className="host">
            <div className="mask" aria-hidden="true"><i /><i /></div>
            <p key={quip} className="bubble">{quip}</p>
          </div>
        </div>

        <div className="panel">
          <h2>Your number</h2>
          <div className="grid">
            {Array.from({ length: N }, (_, i) => (
              <button key={i} disabled={spinning}
                className={`num ${pick === i + 1 ? "sel" : ""}`}
                style={{ "--c": COLORS[i % 4] }} onClick={() => { setPick(i + 1); if (sound) beep(700, 0.05); }}>
                {i + 1}
              </button>
            ))}
          </div>

          <h2>Your bet</h2>
          <div className="bets">
            {BETS.map((b) => (
              <button key={b} disabled={spinning} className={`chip ${bet === b ? "sel" : ""}`} onClick={() => setBet(b)}>{b}</button>
            ))}
          </div>

          <div className={`meter ${pity >= 5 ? "ready" : ""}`}>
            <div className="mbar">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < pity ? "on" : ""} />)}</div>
            <span>{pity >= 5 ? "Comeback boost ready: next win pays 2x" : `Comeback meter: ${pity}/5 losses to a 2x boost`}</span>
          </div>

          <label className="shield">
            <input type="checkbox" checked={shield} disabled={spinning} onChange={(e) => setShield(e.target.checked)} />
            <span><b>Neighbor Shield</b> (+{Math.ceil(bet * 0.2)} coins). Get your bet back if the wheel lands one slot from your number.</span>
          </label>

          <p className="odds">
            Win pays <b>{(PAYOUT * (1 + streakBonus)).toFixed(1)}x</b>
            {stats.streak > 0 && <span className="fire"> Streak {stats.streak} (+{Math.round(streakBonus * 100)}%)</span>}
          </p>

          {coins < cost && !spinning
            ? <button className="spin" onClick={coins < 10 ? refill : () => setBet(BETS.filter((b) => b <= coins).pop())}>
                {coins < 10 ? "Get 100 free coins" : "Lower your bet"}
              </button>
            : <button className="spin" disabled={!canSpin} onClick={spin}>
                {spinning ? "Spinning…" : pick ? `Spin: ${cost} on #${pick}` : "Choose a number"}
              </button>}

          <div className="stats">
            <div><b>{stats.spins}</b>spins</div>
            <div><b>{stats.wins}</b>wins</div>
            <div><b>{stats.best}</b>best streak</div>
          </div>

          <div className="hist">
            {history.length === 0 && <span className="dim">Results appear here</span>}
            {history.map((h, i) => (
              <span key={i} className={`dot ${h.won ? "w" : "l"}`} title={`Picked ${h.pick}`}>{h.number}</span>
            ))}
          </div>

          <div className="badges">
            {ACHIEVEMENTS.map((a) => (
              <span key={a.id} className={`badge ${unlocked.includes(a.id) ? "on" : ""}`}>{a.label}</span>
            ))}
          </div>
          <h2>Wheel style</h2>
          <div className="themes">
            {THEMES.map((t) => {
              const locked = level < t.lvl;
              return (
                <button key={t.id} disabled={locked || spinning} className={`theme ${themeId === t.id ? "sel" : ""}`} onClick={() => setThemeId(t.id)}>
                  <span className="sw">{t.c.map((c) => <i key={c} style={{ background: c }} />)}</span>
                  {locked ? `Level ${t.lvl}` : t.name}
                </button>
              );
            })}
          </div>
          <button className="ghost small" onClick={reset}>Reset progress</button>
        </div>
      </section>
    </main>
  );
}
