// --- AUDIO ENGINE -------------------------------------------------------------
type SoundName =
  | 'tileClick' | 'tileCycle' | 'wordCorrect' | 'wordWrong' | 'roundEnd'
  | 'gameStart' | 'timeUp' | 'timerTick' | 'modeSelect' | 'menuClick'
  | 'modalOpen' | 'modalClose' | 'backToMenu' | 'dealTiles' | 'hintReveal'
  | 'resetGame' | 'sessionEnd';

export interface AudioEngineAPI {
  unlock(): void;
  play(name: SoundName): void;
  startMusic(): void;
  stopMusic(): void;
  setSfxVolume(v: number): void;
  setMusicVolume(v: number): void;
}

export const AudioEngine: AudioEngineAPI = (() => {
  // -------------------------------------------------------------------------
  // Browser autoplay policy: AudioContext MUST be created inside a user
  // gesture handler (click / keydown).  We defer everything until unlock().
  // Stackblitz iframes are extra-strict - we also play a silent buffer on
  // first interaction to force the context out of "suspended" state.
  // -------------------------------------------------------------------------
  let ctx: AudioContext | null          = null;
  let sfxBus: GainNode | null          = null;
  let musicNodes: { master: GainNode; intervalId: ReturnType<typeof setInterval> } | null = null;
  let musicRunning = false;
  let unlocked     = false;
  let pendingMusic = false;  // startMusic() called before unlock?
  let sfxVol       = 0.5;
  let musicVol     = 0.5;

  // -- Create / resume context (only ever called post-gesture) ---------------
  const boot = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch(e) { return false; }
    // Build SFX bus
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVol;
    sfxBus.connect(ctx.destination);
    // Play a zero-length silent buffer - forces "suspended→running" in Chrome
    const sil = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = sil; src.connect(ctx.destination); src.start(0);
    return true;
  };

  // -- Public: call on first click anywhere in the app -----------------------
  const unlock = () => {
    if (unlocked) return;
    if (!boot()) return;
    ctx!.resume().then(() => {
      unlocked = true;
      if (pendingMusic && musicVol > 0) { pendingMusic = false; _startMusicNow(); }
    });
  };

  // -- Primitive builders (safe - return early if not ready) -----------------
  const oscNote = (freq: number, type: OscillatorType, t0: number, dur: number, vol: number) => {
    if (!unlocked || !ctx || !sfxBus) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
    g.connect(sfxBus);
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime + t0);
    o.connect(g); o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.06);
  };

  const noiseBlip = (t0: number, dur: number, vol: number) => {
    if (!unlocked || !ctx || !sfxBus) return;
    const len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
    s.connect(g); g.connect(sfxBus);
    s.start(ctx.currentTime + t0); s.stop(ctx.currentTime + t0 + dur + 0.06);
  };

  const sweep = (f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine') => {
    if (!unlocked || !ctx || !sfxBus) return;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f1, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur + 0.04);
    o.connect(g); g.connect(sfxBus);
    o.start(); o.stop(ctx.currentTime + dur + 0.08);
  };

  // -- Sound library ----------------------------------------------------------
  const sounds = {
    tileClick()   { noiseBlip(0,0.035,0.22); oscNote(240,'sine',0,0.065,0.12); },
    tileCycle()   { oscNote(880,'sine',0,0.10,0.13); oscNote(1100,'sine',0.06,0.09,0.09); },
    wordCorrect() { [523,659,784,1047,1319].forEach((f,i)=>oscNote(f,'sine',i*0.07,0.30,0.20)); noiseBlip(0.08,0.25,0.06); },
    wordWrong()   { oscNote(130,'sawtooth',0,0.14,0.26); oscNote(95,'square',0.05,0.12,0.16); noiseBlip(0,0.09,0.13); },
    roundEnd()    { [[523,0],[659,.09],[784,.18],[1047,.27],[784,.40],[1047,.49],[1319,.58]].forEach(([f,t])=>oscNote(f,'sine',t,0.40,0.20)); },
    gameStart()   { [392,523,659].forEach((f,i)=>oscNote(f,'sine',i*0.13,0.34,0.16)); },
    timeUp()      { sweep(660,220,0.65,0.24); },
    timerTick()   { oscNote(900,'square',0,0.05,0.07); },
    modeSelect()  { oscNote(523,'sine',0,0.14,0.18); oscNote(784,'sine',0.08,0.18,0.20); oscNote(1047,'sine',0.18,0.22,0.16); noiseBlip(0.15,0.14,0.05); },
    menuClick()   { oscNote(440,'sine',0,0.08,0.14); oscNote(550,'sine',0.05,0.07,0.10); },
    modalOpen()   { sweep(200,600,0.22,0.10); noiseBlip(0,0.18,0.04); },
    modalClose()  { sweep(600,280,0.16,0.09); },
    backToMenu()  { oscNote(523,'sine',0,0.14,0.14); oscNote(392,'sine',0.10,0.18,0.12); },
    dealTiles()   { for(let i=0;i<6;i++){ noiseBlip(i*0.055,0.04,0.12); oscNote(300+i*30,'sine',i*0.055,0.05,0.07); } },
    hintReveal()  { sweep(300,900,0.30,0.14); },
    resetGame()   { oscNote(392,'sine',0,0.12,0.14); oscNote(330,'sine',0.10,0.12,0.11); oscNote(261,'sine',0.20,0.15,0.09); },
    sessionEnd()  { [392,494,523,659,784].forEach((f,i)=>oscNote(f,'sine',i*0.10,0.45,0.18)); noiseBlip(0.35,0.30,0.06); },
  };

  // -- Ambient music ----------------------------------------------------------
  const PENTA = [261.63,293.66,329.63,392.00,440.00,523.25,587.33,659.26];
  const BASS  = [65.41,73.42,82.41,98.00];

  const _startMusicNow = () => {
    if (musicRunning || !ctx) return;
    musicRunning = true;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(musicVol * 0.12, ctx.currentTime + 2.5);
    master.connect(ctx.destination);
    const dly = ctx.createDelay(0.5); dly.delayTime.value = 0.28;
    const fb  = ctx.createGain(); fb.gain.value = 0.32;
    const wet = ctx.createGain(); wet.gain.value = 0.38;
    dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(master);
    const pn = (freq: number, time: number, dur: number, vol: number, type: OscillatorType = 'sine') => {
      if (!musicRunning || !ctx) return;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime+time);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime+time+0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+time+dur);
      g.connect(master); g.connect(dly);
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.connect(g);
      o.start(ctx.currentTime+time); o.stop(ctx.currentTime+time+dur+0.1);
    };
    let beat = 0; const BAR = 1.9;
    const sched = () => {
      if (!musicRunning) return;
      const mel = [0,1,2,3,4,5,6,7].sort(()=>Math.random()-0.5).slice(0,5);
      mel.forEach((idx,i)=>{ const t=beat+i*(BAR/5)+Math.random()*0.04; pn(PENTA[idx]*(Math.random()<0.3?2:1),t,BAR*0.44,0.20+Math.random()*0.07); });
      const bi=Math.floor(Math.random()*BASS.length);
      pn(BASS[bi],beat,BAR*0.8,0.17,'triangle');
      if(Math.random()<0.5) pn(BASS[bi]*1.5,beat+BAR*0.5,BAR*0.38,0.09,'triangle');
      if(Math.floor(beat/BAR)%2===0) [261.63,329.63,392.00].forEach((f,i)=>pn(f,beat+i*0.04,BAR*1.55,0.06));
      beat+=BAR;
    };
    sched();
    musicNodes = { master, intervalId: setInterval(sched, BAR*1000) };
  };

  const startMusic = () => {
    if (musicVol <= 0) return;          // slider is at 0, don't start
    if (!unlocked) { pendingMusic = true; return; }
    _startMusicNow();
  };

  const stopMusic = () => {
    pendingMusic = false;
    if (!musicNodes) { musicRunning = false; return; }
    musicRunning = false;
    clearInterval(musicNodes.intervalId);
    try { musicNodes.master.gain.linearRampToValueAtTime(0, ctx!.currentTime + 1.8); } catch(e){}
    musicNodes = null;
  };

  // -- Public API -------------------------------------------------------------
  return {
    unlock,
    play(name) { try { if (sfxVol > 0) sounds[name]?.(); } catch(e){} },
    startMusic,
    stopMusic,
    setSfxVolume(v) {
      sfxVol = v;
      if (sfxBus && ctx) sfxBus.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.1);
    },
    setMusicVolume(v) {
      musicVol = v;
      if (!unlocked) return;
      if (v <= 0) { stopMusic(); return; }
      if (!musicRunning) { startMusic(); return; }
      if (musicNodes?.master && ctx)
        musicNodes.master.gain.linearRampToValueAtTime(v * 0.12, ctx.currentTime + 0.3);
    },
  };
})();
