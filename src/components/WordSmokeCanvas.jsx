import { useState, useEffect } from 'react';
import { WORD_LIST } from '../data/words.js';

export const EXTRA_SOUND_WORDS = {
  "ness":  ["kindness","darkness","sadness","fitness","madness","illness","boldness","fullness","softness","fairness","witness","calmness","oddness","richness","wetness","gladness"],
  "eur":   ["neur","ateur","grandeur","liqueur","chauffeur","entrepreneur","connoisseur","saboteur","raconteur","masseur","pasteur","voyeur"],
  "eer":   ["beer","deer","peer","seer","veer","cheer","sheer","steer","career","pioneer","volunteer","engineer","sincere","appear","casheer"],
  "ier":   ["tier","pier","cashier","frontier","soldier","barrier","carrier","warrior","premier","elier","earlier","heavier","merrier","stormier"],
  "oor":   ["door","floor","poor","moor","boor","spoor","outdoor","indoor","hardcore","overlook","overlord","folklore","sophomore"],
  "oar":   ["oar","boar","soar","roar","board","hoard","hoarse","coarse","aboard","cupboard"],
  "tch":   ["watch","catch","match","patch","scratch","stretch","ditch","witch","fetch","sketch","notch","latch","hutch","Dutch","stitch","switch","batch","hatch","snatch","wretch"],
  "ck":    ["back","black","block","brick","check","click","clock","crack","deck","dock","duck","flick","flock","hack","kick","knock","lock","luck","neck","nick","pack","pick","puck","rack","rick","rock","sack","sick","slack","slick","smack","snack","sock","stack","stick","stock","stuck","thick","tick","track","trick","truck","tuck","whack","wreck"],
  "tch":   ["catch","fetch","hatch","latch","match","notch","patch","pitch","ratch","sketch","snatch","stitch","stretch","switch","watch","witch","wretch"],
  "wh":    ["what","when","where","which","while","whip","whirl","whisper","whistle","white","whole","whom","whose","why","wheel","wheat","whack","whale","whine","whiff"],
  "ph":    ["phone","photo","phrase","graph","alpha","elephant","orphan","trophy","triumph","dolphin","phantom","prophet","typhoon","nephew","sphere","alphabet","emphasis","philosophy","physician","pharmacy","phenomenon","physique","symphony"],
  "ng":    ["ring","sing","king","wing","thing","bring","string","spring","swing","fling","cling","along","among","belong","strong","tongue","young","song","long","wrong","gang","hang","rang","sang","bang","rang","clang","slang","tong","prong","gong","throng","sponge","plunge","lunge","cringe","fringe","hinge","singe","tinge"],
  "nk":    ["bank","blank","blink","brink","chunk","clank","clink","clunk","crank","drink","dunk","flank","flunk","frank","funk","hunk","ink","junk","link","mink","monk","pink","plank","plunk","prank","rank","rink","sank","shrink","shrunk","sink","skunk","skank","slunk","slink","spank","spunk","stank","stink","stunk","sunk","tank","think","think","thank","trunk","wink"],
  "al":    ["also","almost","always","already","although","alert","allow","alter","alcohol","album","algebra","alien","alley","almond","alone","along","aloud","altar","alternative","altogether","balance","call","fall","hall","tall","wall","shall","small","install","recall","stall"],
  "ol":    ["old","bold","cold","fold","gold","hold","mold","sold","told","bolt","colt","jolt","molt","volt","folk","yolk","colonel","alcohol","dolphin","evolve","revolve","solve","involve","dissolve","abolish","polish","solid","volume","column","control","enroll","scroll","roll","stroll","toll"],
  "ge":    ["age","cage","page","rage","sage","stage","large","surge","merge","gorge","forge","urge","charge","change","strange","grange","fringe","cringe","budge","fudge","judge","lodge","nudge","smudge","trudge","wedge","hedge","ledge","pledge","edge","bridge","ridge","fridge","grudge","sludge"],
  "qu":    ["queen","quest","queue","quick","quiet","quit","quite","quiz","quack","quake","quart","quartz","query","quill","quota","quote","square","squash","squeak","squeeze","squid","squint","squirm","squirt","squish","liquid","unique","sequel","equal","frequent","request","require","quarter","qualify"],
  "cy":    ["icy","juicy","spicy","fancy","ancy","mercy","percy","policy","agency","legacy","privacy","vacancy","urgency","currency","frequency","democracy","accuracy","pharmacy","pregnancy","tendency","efficiency"],
  "eu":    ["feud","neutral","neuron","neutron","Europe","eureka","pneumonia","reunion","beautiful","museum","leukemia","rheumatism","lieutenant","therapeutic","pharmaceutical","euphoria","euthanasia","eulogy","euphemism","Europe"],
  "ew":    ["new","few","dew","sew","blew","brew","chew","clew","crew","drew","flew","grew","knew","slew","stew","threw","view","anew","renew","review","cashew","nephew","curfew","Hebrew","preview","interview"],
  "gu":    ["guess","guest","guide","guild","guilt","guitar","guise","gust","gun","gum","gut","guy","guard","guarantee","guardian","guerrilla","language","vague","league","plague","rogue","ogue","ogue","plague"],
  "dr":    ["drag","drain","draw","dream","dress","drift","drink","drive","drop","drum","dry","drab","draft","drake","drape","drastic","drizzle","drone","drool","droop","drove","drown","drudge","drug","drunk","dusk"],
  "tr":    ["trace","track","trade","trail","train","trap","trash","tray","tree","trim","trip","trot","truck","true","trust","try","trace","trance","transfer","transform","translate","transport","travel","treasure","treat","tremble","tremendous","trend","triangle","tribe","trick","trigger","triumph","trouble","trout","trunk","trust"],
  "suffix":["-ing","-ed","-ly","-ness","-ment","-ful","-less","-tion","-sion","-ous","-ious","-ious","-al","-ial","-able","-ible","-ize","-ise","-ify","-fy","-en","-er","-est","-th","-ward","-wards","-wise","-hood","-dom","-ship","-ism","-ist","-ity","-ty","-age"],
  "pre":   ["prefix","predict","prepare","prevent","previous","preview","precede","prefer","prefer","present","preserve","pretend","pretty","prevent","previous","price","pride","print","prison","private","prize","problem","process","produce","progress","project","promise","protect","provide","prove"],
  "un":    ["unable","uncle","under","undo","unfair","unhappy","unkind","unless","until","unusual","unwell","unzip","unlock","unload","unite","unique","universe","unknown","unlikely","undo","unfold","uncover","unpack","unreal","unsafe","untrue"],
  "re":    ["read","real","ready","recent","record","reduce","refer","relax","remain","remind","remove","repair","repeat","replace","reply","report","resist","result","return","reveal","reward","rewind","rewrite","reuse","rebuild","refresh","refund","refuse","regard","relate","release","rely","remark","rent","rescue","resolve","respect","rest","review"],
  "mis":   ["mistake","misplace","misread","mislead","misuse","misguide","miscount","misbehave","mishap","misprint","misquote","misshapen","misspell","mistime","misunderstand","misjudge","mishandle","misfire","misfit"],
  "dis":   ["discover","disease","dislike","dismiss","display","distance","disturb","divide","dizzy","disagree","disappear","disappoint","discard","disconnect","discourage","discuss","displace","disrupt","dissolve","distinct","distract","distribute","district","distrust","disturb"],
  "ing":   ["ring","sing","king","wing","bring","spring","string","swing","thing","fling","cling","sting","sling","along","among","doing","going","being","saying","making","taking","coming","finding","getting","giving","having","keeping","knowing","living","looking","moving","playing","putting","reading","seeing","standing","thinking","trying","using","working"],
  "tion":  ["action","addition","caution","condition","direction","education","election","emotion","fraction","function","mention","motion","nation","notion","option","portion","question","section","solution","station","tradition","vacation"],
  "ful":   ["awful","careful","cheerful","colorful","doubtful","dreadful","faithful","fearful","forceful","fruitful","graceful","grateful","handful","harmful","hateful","helpful","hopeful","hurtful","joyful","lawful","mindful","peaceful","playful","powerful","restful","skillful","thankful","truthful","useful","watchful","wishful","wonderful","youthful"],
  "less":  ["careless","fearless","helpless","hopeless","homeless","jobless","lawless","lifeless","mindless","nameless","painless","pointless","powerless","restless","senseless","shameless","sleepless","speechless","tasteless","thankless","thoughtless","timeless","useless","voiceless","worthless"],
  "ment":  ["agreement","argument","cement","comment","department","development","document","element","employment","entertainment","environment","equipment","excitement","government","improvement","instrument","judgement","management","measurement","movement","payment","punishment","replacement","requirement","retirement","settlement","statement","treatment"],
};

// Build map from main word list
export const SOUND_WORDS_MAP = (() => {
  const map = {};
  // Seed with extra curated words first
  for (const [key, words] of Object.entries(EXTRA_SOUND_WORDS)) {
    map[key] = [...words];
  }
  // Then add from main word list
  for (const word of WORD_LIST) {
    for (let start = 0; start < word.length; start++) {
      for (let len = 1; len <= 4 && start + len <= word.length; len++) {
        const key = word.slice(start, start + len);
        if (!map[key]) map[key] = [];
        if (map[key].length < 40 && !map[key].includes(word)) map[key].push(word);
      }
    }
  }
  return map;
})();

export function getWordsForSound(sound) {
  const key = sound.split("/")[0].toLowerCase().replace(/-/g, "");
  return SOUND_WORDS_MAP[key] || SOUND_WORDS_MAP[sound.toLowerCase()] || [];
}

// CSS-animated smoke word — each word is a self-contained animated div
let _smokeId = 0;
export function makeSmokeWord(word, originX, originY, color) {
  const drift = (Math.random() - 0.5) * 50;      // gentle horizontal offset
  const duration = 2.8 + Math.random() * 1.6;     // 2.8s–4.4s float time
  const fontSize = 12 + Math.floor(Math.random() * 7);
  const delay = 0;
  const rise = 140 + Math.random() * 80;           // how far up it travels (px)
  return { id: _smokeId++, word, originX, originY, drift, duration, fontSize, color, rise, delay, born: Date.now() };
}

export function SmokeWord({ p, onDone }) {
  // Remove from DOM after animation completes
  useEffect(() => {
    const t = setTimeout(onDone, (p.duration + 0.3) * 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: "fixed",
      left: p.originX + p.drift,
      top: p.originY - 8,
      transform: "translateX(-50%)",
      color: p.color,
      fontSize: p.fontSize,
      fontFamily: "'Noto Serif SC', serif",
      fontWeight: 700,
      letterSpacing: "0.05em",
      whiteSpace: "nowrap",
      textShadow: `0 0 12px ${p.color}88`,
      pointerEvents: "none",
      userSelect: "none",
      animation: `smokeRise ${p.duration}s ease-out forwards`,
      zIndex: 9999,
    }}>
      {p.word}
    </div>
  );
}

export function WordSmokeCanvas({ words, onWordDone }) {
  if (words.length === 0) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {words.map(p => <SmokeWord key={p.id} p={p} onDone={() => onWordDone(p.id)} />)}
    </div>
  );
}

