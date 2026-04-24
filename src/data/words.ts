import { getTileSound } from './tiles';
import type { Tile } from './tiles';

// --- EMBEDDED WORD LIST (~1800 common English words) -------------------------
// Embedded directly to avoid network dependency in the artifact sandbox
export const WORD_LIST = [
  "abandon","ability","able","aboard","about","above","absence","absolute","absorb","abstract","accent","accept","access","account","accurate","acid","acknowledge","acquire","across","act","action","active","actual","actually","add",
  "addition","additional","address","adequate","adjust","admire","admit","adopt","adult","advance","advice","afford","afraid","after","afternoon","again","age","aged","ago","agree","agreement","ahead","aid","aim","air",
  "alarm","alert","alive","all","allow","almost","alone","along","already","also","alter","although","always","am","amazing","among","amount","an","and","angry","animal","announce","annoy","another","answer",
  "ant","any","anymore","anyone","anything","anyway","anywhere","ape","apologize","appeal","appear","apple","apply","approach","approve","apt","arc","arch","are","area","argue","ark","arm","army","around",
  "arrive","art","arts","as","ash","aside","ask","assign","assist","at","ate","attention","attract","available","avoid","away","awe","axe","baboon","baby","back","bad","bade","badge","bag",
  "bail","bait","bake","balance","bale","ball","balloon","ban","band","bane","bar","bare","bargain","bark","barn","base","bat","bath","bay","be","beach","bead","beak","beam","bean",
  "bear","beast","beat","because","become","bed","beef","been","beer","before","beg","began","behind","being","believe","bell","belt","bend","bent","best","bet","better","between","bid","big",
  "bike","bin","bird","bit","bite","black","bled","bless","blind","blood","bloom","blot","blow","blue","blur","boar","board","boast","boat","body","bog","bold","bolt","bone","book",
  "boon","bop","bore","born","both","bother","bought","bounce","box","boy","brag","brain","bran","brave","break","bred","brew","bright","brim","bring","broad","broil","broke","brother","brought",
  "brow","brown","buck","bud","budget","buds","bug","build","bull","bun","bunt","burn","burp","burr","burst","bus","bush","busy","but","buy","by","cab","cage","cake","calf",
  "call","calm","came","camp","can","cane","cap","cape","car","card","care","career","carry","cart","cartoon","case","cat","catch","cause","cave","cede","celebrate","cent","center","certain",
  "chain","challenge","chance","change","chap","character","charge","chase","chat","check","cheer","chef","chew","child","children","chin","chip","choice","choose","chop","city","clad","claim","clam","clan",
  "clap","class","claw","clay","clean","clear","climb","cling","clip","clock","clop","close","clot","cloth","cloud","clue","coat","cob","cod","cog","coil","cold","cole","collapse","collect",
  "color","come","comfort","command","commit","common","company","compare","complete","concern","conclude","condition","cone","connect","consider","contain","continue","control","cook","cool","cop","cope","copy","core","cork",
  "corn","cost","cot","could","count","country","coup","couple","course","court","cove","cover","cowl","coy","cram","cream","create","croon","crop","cross","crow","cub","cube","cuff","cup",
  "cure","curious","curl","cut","dab","dad","daily","dale","dam","damage","dame","dance","dare","dark","darn","dart","dash","date","dawn","day","days","dead","deaf","deal","dean",
  "dear","debt","decide","declare","decoy","deed","deem","deep","deer","defend","deft","degree","delay","deli","demand","den","dent","deny","depend","describe","desire","desk","destroy","develop","devote",
  "dew","dial","dice","did","died","diet","different","dig","dill","dim","dine","ding","dinner","dip","dire","direct","direction","directly","disappear","discover","discuss","dish","disk","distance","dive",
  "do","dock","does","dog","dome","done","door","dorm","dose","dot","dote","doubt","dove","down","draft","drag","drain","dram","draw","dream","drip","drive","drop","drug","drum",
  "duck","duel","dug","dull","dumb","dump","dunk","dupe","during","dusk","dust","each","eager","ear","earl","early","earn","earth","ease","east","easy","eat","edge","edit","educate",
  "egg","eight","either","elect","elf","elm","else","emerge","emit","empire","employ","empty","encourage","end","energy","enjoy","enough","epic","equal","era","escape","establish","evaluate","eve","even",
  "event","ever","every","evil","exactly","exam","examine","example","except","exist","expect","explain","explore","eye","face","fact","fad","fade","fail","faint","fair","faith","fall","fame","family",
  "fan","fang","far","fare","farm","fast","fat","fate","fawn","fax","fear","feast","feat","fed","feed","feel","feet","fell","felt","female","fern","few","fib","fig","fight",
  "figure","file","fill","film","final","find","fine","fink","fire","fish","fist","fit","five","fix","fizz","flag","flak","flan","flap","flat","flaw","flea","fled","flee","flex",
  "fling","flip","flit","float","floor","flop","flow","fly","foam","fobs","focus","fog","foil","fold","folk","follow","fond","font","food","fool","foot","for","force","ford","fore",
  "forget","fork","form","fort","forward","foul","found","four","fowl","fray","free","freeze","fresh","fret","friend","frog","from","front","fry","fuel","full","fume","fun","fund","funny",
  "furl","fuse","fuss","gab","gag","gain","gale","game","gap","gas","gash","gate","gave","gaze","gear","gel","geld","gem","general","generous","gentle","get","gig","gild","gill",
  "gilt","gin","girl","give","glad","gleam","glee","glen","glob","glow","glum","glut","gnat","gnu","go","goad","goat","gob","god","goes","gold","golf","gone","gong","good",
  "goof","gore","got","govern","gown","grab","grace","grain","grant","grasp","grass","gray","great","green","greet","grew","grim","grin","grip","grit","ground","group","grow","grub","guard",
  "guess","guide","guilt","gulf","gull","gun","gust","gut","guy","hack","had","hail","hale","half","hall","halo","halt","ham","hand","handle","hang","hank","happen","hard","hare",
  "harm","harp","harvest","has","hash","hat","hate","haul","have","hay","haze","he","head","heal","heap","hear","heart","heat","heavy","heed","heel","helm","help","hem","hen",
  "her","herb","herd","here","hew","hid","hide","high","hike","hill","hilt","him","hind","hint","hip","his","history","hit","hive","hoar","hoax","hob","hock","hog","hold",
  "hole","home","honor","hood","hoof","hook","hop","hope","horn","hose","host","hot","house","how","hub","hug","huge","hull","hum","human","hump","hunt","hurry","hurt","hut",
  "ice","icy","idea","idle","if","ill","imagine","imp","important","in","inch","include","increase","inform","information","ink","inn","inside","inspect","into","invite","involve","ion","ire","irk",
  "is","isolate","issue","it","its","ivy","jab","jade","jag","jail","jam","jape","jar","jest","jet","jibe","jig","jilt","jive","job","jog","join","jolt","jowl","joy",
  "judge","jug","junk","just","jut","keen","keep","keg","kelp","key","kid","kiln","kin","kind","king","kit","kite","knee","knew","knob","knock","knot","know","lab","lace",
  "lack","lad","lag","laid","lame","land","lane","lap","lard","large","lark","lash","lass","last","late","laud","laugh","law","lawn","leach","lead","leaf","leak","lean","leap",
  "learn","least","leave","led","leer","left","leg","lend","lens","lest","let","level","levy","lick","lid","lien","lieu","life","lift","light","like","lilt","lime","limit","limp",
  "line","link","lint","lip","list","listen","lit","little","live","load","loaf","loan","local","loft","log","long","look","loon","lore","lorn","lose","lost","lot","loud","lout",
  "love","low","luck","lug","lump","lure","lust","mace","mad","made","maid","mail","main","maintain","make","malt","man","manage","mane","many","map","march","mare","mark","marl",
  "mart","mast","mat","mate","math","matter","maw","may","maze","me","mead","meal","mean","measure","meat","meet","meld","melt","men","mere","mesh","mid","might","mild","mile",
  "milk","mill","mime","mind","mine","mint","mire","miss","mist","mite","mix","moat","mob","mold","mole","molt","monk","mood","moon","moor","moot","mop","more","morn","morning",
  "mort","most","moth","mother","move","much","muck","mud","mug","mugs","mule","multiply","musk","must","mute","nab","nag","nail","name","nap","nape","narrow","nation","natural","nave",
  "near","neat","need","nest","net","never","new","news","next","nice","nick","night","nil","nimble","nine","nip","no","nod","node","noon","nope","nor","norm","nose","not",
  "note","notice","now","number","nun","nut","oafs","oak","oar","oath","obey","oboe","observe","odd","odds","odes","odor","of","off","offer","often","oil","oils","old","omen",
  "on","once","one","ones","only","open","opt","or","oral","orb","order","ore","ores","organize","other","ouch","our","out","outside","oval","oven","over","owe","owl","owls",
  "own","owns","ozone","pace","pack","pad","page","paid","pail","pain","pal","palm","pan","pane","pap","paper","par","park","part","past","pat","path","pause","pave","paw",
  "pay","pea","peach","peak","peal","peat","peel","peer","peg","pelt","pen","people","perform","permit","pest","pew","phone","photo","phrase","pick","picture","pie","pier","pig","pike",
  "pile","pill","pin","pine","ping","pink","pipe","pit","place","plain","plan","play","plod","plot","plow","plug","plum","plus","ply","pod","pods","poem","point","pole","pond",
  "pool","poor","pop","pore","pose","possible","post","pot","pout","pow","power","practice","praise","pray","prefer","prepare","press","prey","pro","prod","produce","promise","promote","prop","prove",
  "provide","prude","pub","public","pug","pull","pump","pun","punt","pup","pure","pus","push","put","quail","question","quite","raccoon","race","rack","rag","rage","rail","rain","raise",
  "rake","ram","ran","rant","rap","rape","rare","rash","rat","rate","rave","raw","ray","reach","read","real","realize","really","reap","reason","receive","recycle","red","reduce","reel",
  "reflect","refuse","rein","relate","rely","remain","remember","rend","rep","repair","reply","report","reps","rescue","respond","rest","result","review","rib","rice","rich","rid","rife","rift","rig",
  "right","rim","ring","rink","riot","rip","rise","risk","rite","road","roam","roar","rob","robe","rock","rod","role","roll","romp","roof","room","root","rose","rot","rote",
  "round","rove","row","roy","rub","rude","rug","rule","rum","rump","run","rune","ruse","rush","rust","rut","rye","sac","sack","sad","safe","sag","sage","said","sail",
  "sake","sale","salt","same","sand","sane","sang","sank","sap","sash","sat","save","saw","say","scale","scan","scar","scat","school","scum","sea","seal","seam","search","seat",
  "second","secure","see","seed","seem","seen","seep","select","self","sell","send","sense","sent","set","settle","sew","sewn","sexy","shad","share","shed","shift","shin","ship","shop",
  "shot","show","shun","shut","shy","sign","silk","sill","silt","since","sing","sink","sip","sir","sit","site","size","ski","skim","skin","skip","sky","slab","slap","slat",
  "slaw","sled","sleep","slim","slip","slit","slob","slop","slot","slow","slug","slum","slur","sly","small","smile","smog","snag","snail","snap","snip","snob","snop","snow","snub",
  "so","soak","soap","soar","sob","sock","sod","soft","soil","sole","solve","some","sometimes","son","song","soon","soot","sop","sore","sorry","sort","sot","soul","sound","soup",
  "sour","south","sow","spa","span","spar","spat","speak","spend","spew","spin","spit","spoil","spoon","spot","spray","spread","sprig","spring","spun","spur","spy","stab","stain","stand",
  "star","start","stay","steam","stem","step","stew","still","stir","stob","stone","stop","store","story","straight","stray","stream","string","strong","struggle","strut","stub","stud","study","stun",
  "sty","sub","such","suds","sue","suit","sulk","sum","sump","sun","sung","sunk","sup","supply","support","suppose","sure","swam","swan","swap","swat","swig","swim","swing","swish",
  "swum","tab","table","tack","tail","take","tale","talk","tall","tame","tan","tang","tap","tar","tart","task","tat","taut","tax","taxi","teach","team","tear","tease","teem",
  "tell","ten","tend","tens","term","test","that","the","their","them","then","there","they","thin","thing","think","this","three","through","throw","thy","tide","tie","tiff","til",
  "tile","till","tilt","time","tin","tip","tire","to","toad","today","toe","together","toil","told","toll","tome","ton","too","took","tool","toot","top","tops","torn","toss",
  "tot","tote","touch","tour","tow","toward","town","toy","track","trail","train","trap","travel","tray","treat","tree","trim","trip","true","trust","try","tub","tuck","tuft","tug",
  "tun","tuna","tune","turf","turn","tusk","twig","twin","two","type","ugly","ulna","under","understand","unit","unite","until","up","upon","urge","urn","use","used","uses","vacation",
  "vain","vale","value","van","vane","vase","vast","vat","veal","veer","veil","vein","very","vest","veto","vice","view","vile","vine","visit","void","volt","volunteer","vomit","vote",
  "vow","wad","wade","wag","wage","wail","wake","wale","walk","wall","wand","wander","wane","want","war","ward","ware","warm","wart","was","watch","water","wave","way","we",
  "weak","weal","wean","weap","web","wed","weed","week","ween","weep","welcome","well","welt","went","were","wet","what","wheat","when","where","which","while","whim","whip","whir",
  "who","why","wide","wig","wile","will","wilt","wily","win","wind","wing","wink","wire","wise","wish","wisp","wit","with","woe","woke","wolf","womb","wonder","woo","wood",
  "wool","word","wore","work","world","worm","worn","worry","worship","would","wow","wrap","wren","writ","write","yak","yam","yap","yaw","year","yeast","yell","yen","yes","yet",
  "yew","yore","you","young","your","yurt","zap","zeal","zinc","zip","zit","zone","zoo","zoom",
  "absent", "achieve", "adapt", "advise", "aloud", "amid", "angel", "ankle", "annex", "apart", "arise", "arrow",
  "asleep", "atlas", "atom", "attic", "audio", "aunt", "awake", "aware", "awful", "axle", "azure", "badly",
  "bagel", "barge", "basic", "batch", "bathe", "beard", "beckon", "begin", "belly", "below", "bench", "berry",
  "birth", "blade", "bland", "blaze", "bliss", "blond", "blown", "blues", "bonus", "booth", "brake", "bread",
  "breed", "breve", "brick", "bride", "brief", "brine", "brood", "brook", "broom", "broth", "bruise", "bruit",
  "brunt", "brush", "built", "bulge", "bunch", "buyer", "cabin", "camel", "candy", "cannot", "carve", "cease",
  "cedar", "chair", "chalk", "charm", "cheap", "cheek", "chess", "chest", "chewy", "chief", "china", "chose",
  "civic", "civil", "clash", "clerk", "clown", "clump", "coast", "cobra", "cocoa", "comet", "comic", "coral",
  "cough", "craft", "crane", "crash", "crazy", "creek", "creep", "crime", "crisp", "crowd", "crown", "cruel",
  "crush", "curve", "cycle", "daddy", "dairy", "daisy", "damp", "dangle", "daring", "darken", "daughter", "daze",
  "decay", "deck", "decline", "decree", "define", "dense", "depth", "design", "detail", "devil", "devise", "differ",
  "digit", "dirty", "disco", "ditch", "diver", "divine", "dodge", "doing", "dozen", "drama", "drape", "drove",
  "drown", "dunce", "dusty", "dwarf", "dwell", "elbow", "eldest", "embed", "enter", "entry", "erase", "exact",
  "extra", "fable", "false", "fancy", "fasten", "father", "fault", "fetch", "field", "fifth", "finger", "first",
  "fixed", "flame", "flank", "flash", "flask", "flesh", "flock", "floss", "flour", "fluent", "flute", "flyby",
  "forge", "forth", "fossil", "frame", "froze", "fruit", "fully", "fuzzy", "gains", "glare", "glass", "gloom",
  "gloss", "glove", "going", "gorge", "grade", "grand", "graze", "grief", "groan", "groin", "groom", "gross",
  "grove", "grown", "gruel", "guise", "gulch", "gully", "gusto", "habit", "haven", "hedge", "heist", "hence",
  "herbs", "heron", "hinge", "hippo", "hoist", "holly", "horse", "hotel", "hover", "humid", "hyena", "icing",
  "ideal", "image", "imply", "infer", "inlet", "inner", "input", "inter", "intro", "ivory", "joint", "joust",
  "juicy", "jumpy", "kayak", "kinship", "kitty", "knack", "knave", "kneel", "knife", "knight", "known", "koala",
  "label", "lance", "laser", "later", "layer", "leafy", "lilac", "linen", "lingo", "lithe", "lodge", "login",
  "loopy", "lover", "lower", "loyal", "lucid", "lunar", "lusty", "magic", "major", "manga", "manor", "match",
  "matte", "maxim", "maybe", "melon", "mercy", "merge", "metal", "micro", "minor", "minus", "mirth", "miser",
  "model", "money", "month", "moral", "mossy", "motor", "mount", "mourn", "muddy", "multi", "music", "myrrh",
  "naive", "named", "nature", "naval", "nerve", "newly", "niece", "noble", "noise", "north", "noted", "novel",
  "nurse", "ocean", "olive", "onset", "orbit", "outer", "ovoid", "owned", "oxide", "paint", "panel", "panic",
  "paste", "patch", "pearl", "pedal", "penny", "perch", "petal", "phase", "piano", "pilot", "pinch", "pixie",
  "pizza", "plane", "plant", "plate", "plaza", "plead", "plump", "plush", "polar", "poppy", "porch", "pounce",
  "price", "prime", "print", "prism", "probe", "prune", "psalm", "pudgy", "pulse", "pupil", "purse", "quill",
  "quota", "raven", "realm", "reign", "relax", "renew", "repay", "repel", "rerun", "rider", "risky", "rival",
  "rivet", "robin", "rocky", "roman", "rouge", "rouse", "route", "rover", "rowdy", "royal", "rugby", "ruler",
  "rusty", "sable", "saint", "salad", "sandy", "savvy", "scald", "scalp", "scene", "scone", "scope", "score",
  "scorn", "scout", "scrap", "screw", "sedan", "seize", "serve", "setup", "seven", "shade", "shaft", "shake",
  "shale", "shall", "shame", "shark", "sharp", "shave", "sheep", "shelf", "shell", "shine", "shirt", "shock",
  "shore", "short", "shout", "shove", "siege", "sight", "sigma", "silky", "siren", "sixth", "sixty", "skate",
  "skill", "skimp", "skull", "slate", "slave", "sleet", "slime", "slope", "sloth", "slump", "smart", "smear",
  "smell", "smoke", "snack", "snake", "sneak", "snore", "snowy", "sober", "solar", "solid", "spark", "spawn",
  "speed", "spice", "spike", "spine", "spite", "splash", "spoke", "sport", "spout", "squad", "squat", "stage",
  "stake", "stale", "stall", "stamp", "stare", "state", "stays", "steep", "steer", "stern", "stick", "stiff",
  "stilt", "sting", "stomp", "stood", "storm", "stout", "straw", "strip", "stump", "style", "suite", "sulky",
  "sunny", "super", "surge", "swamp", "swear", "sweat", "sweet", "swept", "swerve", "swift", "sword", "swore",
  "syrup", "talon", "taste", "teeth", "tempo", "tense", "terms", "theft", "theme", "these", "thick", "third",
  "thorn", "those", "threw", "thrill", "throb", "thumb", "tidal", "tiger", "tight", "timed", "titan", "toast",
  "token", "total", "totem", "tough", "trace", "tramp", "traps", "tread", "trend", "triad", "tribe", "trice",
  "trill", "troop", "trove", "truce", "trump", "tunic", "twang", "tweet", "twice", "twirl", "twist", "tying",
  "ultra", "uncle", "unfit", "union", "upper", "upset", "urban", "usage", "usher", "using", "usual", "utter",
  "valid", "valve", "vapor", "venom", "verse", "video", "vigil", "viola", "viral", "visor", "vista", "vital",
  "vocal", "vogue", "vouch", "vowel", "vulva", "woken", "woman", "women", "worth", "wrote", "xenon", "yacht",
  "yield", "zebra", "zesty",
  // -- Animals & living creatures -----------------------------------------------
  "bee","ant","bat","cat","cow","dog","doe","eel","elk","ewe","fly","fox","gnu","hen","hog","jay","koi","owl","pig","ram","rat","yak","ape",
  "bear","bird","boar","buck","bull","calf","clam","colt","crab","crow","dart","deer","dove","duck","fawn","fish","flea","frog","gnat","goat","hare","hawk","ibis","kite","lamb","lark","lion","loon","lynx","mink","mole","moth","mule","newt","pony","prey","puma","snail","slug","swan","toad","vole","wasp","wren","worm",
  "adder","bison","cobra","coral","crane","eagle","finch","gecko","goose","grebe","heron","horse","hyena","koala","llama","leech","lemur","louse","macaw","midge","moose","otter","panda","perch","prawn","quail","raven","shark","sheep","shrew","skunk","sloth","snipe","squid","stork","swallow","tapir","tiger","trout","viper","whale","zebra",
  "badger","beaver","canary","donkey","falcon","ferret","gibbon","gopher","iguana","jaguar","lizard","locust","magpie","marten","mayfly","monkey","osprey","parrot","pigeon","plover","rabbit","reindeer","robins","salmon","seahorse","spider","stoat","thrush","toucan","turtle","walrus","weasel","condor",
  "buffalo","buzzard","cheetah","chicken","dolphin","gorilla","hamster","lobster","panther","pelican","penguin","piranha","platypus","porcupine","rooster","sparrow","termite","vulture","wildcat",
  "alligator","armadillo","chameleon","crocodile","dragonfly","flamingo","greyhound","hedgehog","jellyfish","ladybird","manatee","meerkat","mongoose","nighthawk","nightowl","octopus","opossum","parakeet","pheasant","porpoise","scorpion","starfish","stingray","tarantula","tortoise","treefrog","woodpecker",
  // -- Plants, nature, environment ----------------------------------------------
  "oak","elm","ash","fir","ivy","bay","bud","bur","fen","fen","log","bog","mop","pod","sap","sod","fen",
  "aloe","bark","bulb","bush","cane","clod","corm","dune","fern","foam","glen","gust","hail","heap","herb","hill","husk","iris","kelp","knot","lake","lava","lawn","leaf","loam","loch","loft","mare","marsh","mead","mesa","mire","mist","moor","moss","muck","mudd","peak","peat","pine","pond","pool","pore","reef","rime","root","rose","rune","rush","sage","sand","seed","shoal","silt","sloe","soil","stem","stump","surf","tarn","thorn","tide","turf","vale","vine","weed","wood",
  "acorn","algae","alder","aspen","beach","birch","bloom","bluff","bough","brook","brush","cedar","chalk","cliff","clove","clump","coast","coral","creek","daisy","delta","drift","field","fjord","flint","flora","floss","foliage","forest","frost","fungi","glade","gorge","gourd","grain","grape","grass","gravel","grove","gulch","heath","holly","inlet","knoll","lilac","lilly","loess","maple","marsh","mauve","monte","mulch","nettle","night","ozone","patch","peach","plume","pollen","poppy","prism","ridge","river","scrub","sedge","shore","shrub","slope","smoke","snowy","solar","spine","spore","sprig","spruce","stalk","swamp","thorn","thyme","tulip","tundra","water","willow","woods",
  "canyon","cavern","cobalt","cobble","coppice","crevice","fossil","fallow","fescue","flower","foxtail","fungus","geyser","ginkgo","glacial","harbor","jungle","lagoon","lichen","mangrove","meadow","mellow","millet","morass","nutmeg","orchid","pampa","pebble","pepper","petrol","planks","plover","poplar","prairie","pumice","ravine","rubble","runoff","savanna","sector","shoal","sierra","sorrel","steppe","stream","summit","sunflower","symbol","thistle","valley","walnut","warbler","willow"
];

export const WORD_SET = new Set(WORD_LIST);

export function getWordSet() {
  return Promise.resolve(WORD_SET);
}

export function buildWordFromTiles(tiles: Tile[]): string {
  return tiles.map(t => getTileSound(t)).join("").toLowerCase();
}

export function checkWordInSet(word: string): boolean {
  const w = word.toLowerCase();
  return WORD_SET.has(w) || SESSION_CUSTOM_WORDS.has(w);
}

export function addCustomWord(word: string): void {
  SESSION_CUSTOM_WORDS.add(word.toLowerCase());
}

// Session-local custom words added by the player (resets on page refresh)
export const SESSION_CUSTOM_WORDS = new Set<string>();

// --- HOVER WORD SMOKE SYSTEM -------------------------------------------------
