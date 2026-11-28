/* Dane demo: wieże, frakcje, ścieżki ulepszeń, wrogowie, mapy, trudność.
   Źródło zasad: PROJEKT-DO-AKCEPTACJI.md (wersja 2, zaakceptowana). Liczby balansu dostrojone botem tests/demo-sim.js. */
var DATA = (function () {
  'use strict';
  var TOWERS = {
    archer: { n: 'Wieża łucznicza', d: 'szybkie pojedyncze strzały', cost: 100, dmg: 20, rate: 2.0, range: 1.9, atk: 'arrow', dodge: true },
    bombard: { n: 'Bombarda', d: 'wybuch obszarowy', cost: 160, dmg: 48, rate: 0.5, range: 2.0, splash: 0.9, atk: 'ball' },
    trebuchet: { n: 'Trebusz', d: 'daleki wybuch, nie trafia z bliska', cost: 190, dmg: 80, rate: 0.25, range: 4.5, min: 1.5, splash: 1.1, atk: 'lob' },
    lookout: { n: 'Czatownia', d: 'mocny strzał w najsilniejszego', cost: 170, dmg: 112, rate: 0.3, range: 3.8, atk: 'snipe', dodge: true, strong: true },
    sawmill: { n: 'Tartak', d: 'piła toczy się drogą, tnie do 4 wrogów', cost: 160, dmg: 36, rate: 0.5, range: 2.0, atk: 'saw' },
    forge: { n: 'Kuźnia', d: 'ciężki młot z bliska, ogłusza', cost: 140, dmg: 72, rate: 0.7, range: 1.4, atk: 'hammer', stun: 0.3 },
    windmill: { n: 'Wiatrak', d: 'skrzydła biją wszystkich wokół', cost: 150, dmg: 13, rate: 1.0, range: 1.6, atk: 'pulse' },
    tavern: { n: 'Karczma', d: 'toczy beczki z prochem na drogę', cost: 150, dmg: 70, rate: 0.4, range: 2.0, splash: 0.9, atk: 'keg' }
  };

  var FACTIONS = [
    { id: 'crown', n: 'Królewska Korona', col: '#4b8fe2', tw: ['archer', 'bombard', 'lookout', 'windmill'], trait: '+20% obrażeń wież, +4 HP zamku',
      mods: { tdmg: 1.2 }, hp: 4, sk: { q: 'Salwa łuczników', e: 'Mur tarcz', r: 'Królewski rozkaz' },
      leg: { n: 'Brama Królewska', kind: 'phys', atk: 'portcullis', gate: true, range: 2.5, d: 'włócznie i opadająca krata',
        info: '3 włócznie co 0,5 s w wrogów w strefie. Co 6,5 s opada krata: zatrzymuje wrogów przed łukiem na 2 s (bossa na 0,7 s) i mocno ich rani.',
        tick: 0.5, dmg: 110, shots: 3, grate: 260, every: 6.5, hold: 2,
        m: [['teeth', 'Żelazne zęby', 'Krata rani 2 razy mocniej i przebija pancerz.'], ['winch', 'Szybki kołowrót', 'Krata opada co 4,5 s i trzyma o 0,5 s dłużej.']] } },
    { id: 'forest', n: 'Leśne Bractwo', col: '#3fa35a', tw: ['archer', 'sawmill', 'tavern', 'trebuchet'], trait: '+10% szansy na krytyk i +10% obrażeń zamku',
      mods: { crit: 0.1, hdmg: 1.1 }, hp: 0, sk: { q: 'Grad strzał', e: 'Gęsta puszcza', r: 'Pieśń wojów' },
      leg: { n: 'Brama Strzelców', kind: 'phys', atk: 'volley', gate: true, range: 2.5, d: 'łucznicy na pomoście strzelają i znaczą wrogów',
        info: 'Co 0,8 s salwa 6 strzał w wrogów w strefie. Trafiony zostaje oznaczony: do końca drogi dostaje +20% obrażeń od wież.',
        tick: 0.8, dmg: 190, shots: 6, mark: 0.2,
        m: [['brand', 'Głęboki znacznik', 'Oznaczeni dostają +35% zamiast +20%.'], ['venom', 'Zatrute strzały', 'Salwy dodatkowo trują.']] } },
    { id: 'guild', n: 'Złota Gildia', col: '#e0a526', tw: ['bombard', 'tavern', 'sawmill', 'forge'], trait: '+30% złota, wieże 15% tańsze i +8% obrażeń, -2 HP zamku',
      mods: { gold: 1.3, cost: 0.85, tdmg: 1.08 }, hp: -2, sk: { q: 'Deszcz monet', e: 'Rozlany smar', r: 'Premia dla załogi' },
      leg: { n: 'Rogatka', kind: 'phys', atk: 'toll', gate: true, range: 2.5, d: 'pobiera myto i pogania załogę wież',
        info: 'Pod szlabanem każdy płaci myto: traci 14% maks. życia (boss 5%) i daje 3 zł. Strażnicy rzucają w strefie ciężkimi sakwami. Wieże przy filarach strzelają o 25% szybciej.',
        tick: 0.7, dmg: 135, shots: 4, toll: 0.14, bossToll: 0.05, coin: 3, aura: 0.25,
        m: [['greed', 'Wysokie myto', 'Myto zabiera o połowę więcej życia i daje 2 razy więcej złota.'], ['crew', 'Zgrana załoga', 'Wieże przy filarach strzelają o 40% szybciej zamiast 25%.']] } },
    { id: 'order', n: 'Czerwony Zakon', col: '#d4473f', tw: ['forge', 'windmill', 'trebuchet', 'lookout'], trait: '+20% obrażeń zamku, +10% XP',
      mods: { hdmg: 1.2, xp: 1.1 }, hp: 0, sk: { q: 'Gniew niebios', e: 'Poświęcona ziemia', r: 'Błogosławieństwo' },
      leg: { n: 'Brama Burzy', kind: 'bolt', atk: 'storm', gate: true, range: 2.5, d: 'kurtyna piorunów',
        info: 'Co 0,5 s pioruny ranią wszystkich w strefie (co najmniej 3 uderzenia). Spowolnieni dostają 2 razy więcej; ogień zdejmuje spowolnienie.',
        tick: 0.5, dmg: 88, shots: 3, all: true,
        m: [['judge', 'Sąd', 'Dobija wrogów poniżej 12% HP.'], ['thunder', 'Grom', 'Co 4. puls ogłusza na 0,4 s (bossów na 0,15 s).']] } }
  ];
  var LEGEND_COST = 600;

  /* Ścieżki: id, nazwa, kolor obramówki, rodzaj obrażeń, opis poziomu I, 6 kart (poziomy II i III), 2 mistrzostwa. */
  var PATHS = {
    steel: { n: 'Stal', col: '#ffffff', kind: 'phys', one: '+60% obrażeń fizycznych.',
      cards: [['pierce', 'Przebicie', 'Ignoruje pancerz Opancerzonych.'], ['crit', 'Celne oko', '25% szansy na cios ×2.'], ['speed', 'Sprawna załoga', '+35% tempa.'],
        ['range', 'Dalekie oko', '+25% zasięgu.'], ['heavy', 'Ciężka amunicja', '+45% obrażeń, ale -15% tempa.'], ['breaker', 'Łamacz tarcz', '+100% obrażeń w tarcze.']],
      m: [['execute', 'Kat', 'Dobija wrogów poniżej 15% HP (bossów poniżej 5%).'], ['ram', 'Taran', 'Co 4. atak zadaje ×2 i ogłusza na 0,6 s.']] },
    fire: { n: 'Ogień', col: '#ff6a2a', kind: 'fire', one: 'Obrażenia od ognia. Trafienie podpala: +60% przez 3 s.',
      cards: [['long', 'Długi żar', 'Palenie 5 s i 90% obrażeń trafienia.'], ['ground', 'Płonąca ziemia', 'Zostawia ogień na drodze na 2 s.'], ['sparks', 'Iskry', 'Płonący przy śmierci podpala 2 sąsiadów.'],
        ['heart', 'Gorące serce', '+25% obrażeń ognia.'], ['fast', 'Szybki zapłon', 'Palenie działa 2 razy szybciej.'], ['melt', 'Topienie pancerza', 'Płonący tracą odporność na obrażenia fizyczne.']],
      m: [['stack', 'Pożoga', 'Podpalenia sumują się do 3 razy.'], ['ash', 'Wybuch popiołu', 'Płonący wybucha przy śmierci za 100% ataku wieży.']] },
    frost: { n: 'Mróz', col: '#5ec8ff', kind: 'frost', one: 'Obrażenia od mrozu +20%. Spowolnienie 25% na 1,5 s.',
      cards: [['deep', 'Głęboki chłód', 'Spowolnienie 35% na 2,5 s.'], ['patch', 'Szron', 'Zostawia lodową plamę na drodze na 1,5 s.'], ['brittle', 'Kruchy cel', '+25% obrażeń tej wieży w spowolnionych.'],
        ['hunter', 'Zimna precyzja', '+30% obrażeń w Szybkich.'], ['aura', 'Mroźna aura', 'Wrogowie w zasięgu są stale o 10% wolniejsi.'], ['shards', 'Odłamki', 'Zabity spowolniony rani sąsiadów za 60% ataku.']],
      m: [['freeze', 'Zamrożenie', 'Co 5 s zatrzymuje trafionych na 1 s (bossów na 0,4 s).'], ['crack', 'Pękający lód', 'Spowolnieni dostają +25% obrażeń od wszystkich wież.']] },
    bolt: { n: 'Piorun', col: '#ffe23f', kind: 'bolt', one: 'Obrażenia od piorunów +20%. Przeskok na 1 wroga (60%).',
      cards: [['chain', 'Dłuższy łańcuch', '+1 przeskok.'], ['overload', 'Przeciążenie', '+100% obrażeń w tarcze.'], ['shock', 'Porażenie', '10% szansy na ogłuszenie 0,4 s.'],
        ['volt', 'Wysokie napięcie', 'Przeskoki zadają 85%.'], ['giant', 'Łowca olbrzymów', '+30% obrażeń w bossów.'], ['charge', 'Ładunek', 'Co 5. atak zadaje ×2 i ma 2 dodatkowe przeskoki.']],
      m: [['storm', 'Burza', 'Co 8 s uderza wszystkich w zasięgu za 200%.'], ['conduct', 'Przewodnik', 'Sąsiednie wieże dostają przeskok za 30%.']] },
    poison: { n: 'Trucizna', col: '#7be03a', kind: 'poison', one: 'Obrażenia od trucizny, +40% przez 4 s. Cel traci połowę odporności.',
      cards: [['acid', 'Żrący kwas', 'Cel traci wszystkie odporności.'], ['cloud', 'Toksyczna chmura', 'Zostawia zatrutą plamę na drodze na 2 s.'], ['giant', 'Jad na olbrzymy', '+1% maks. HP na sekundę (bossowie 0,3%).'],
        ['long', 'Długi jad', 'Trucizna trwa 7 s.'], ['weaken', 'Osłabienie', 'Zatruci są o 10% wolniejsi.'], ['strong', 'Stężony jad', '+50% obrażeń trucizny w czasie.']],
      m: [['plague', 'Zaraza', 'Zatruty przy śmierci zatruwa 3 wrogów.'], ['rot', 'Rozkład', 'Zatruci dostają +20% obrażeń od wszystkich wież.']] }
  };
  var PATH_IDS = ['steel', 'fire', 'frost', 'bolt', 'poison'];
  /* mnożnik obrażeń za sam poziom ulepszenia (oprócz kart) */
  var LEVEL_DMG = [1, 1, 1.15, 1.3, 1.55];

  /* Klasy wrogów (wspólne dla frakcji). res: procent otrzymywanych obrażeń. */
  var UNITS = [
    { cls: 'grunt', pts: 10, hp: 100, spd: 0.85, gold: 7, xp: 5, dmg: 1, r: 0.28 },
    { cls: 'runner', pts: 12, hp: 62, spd: 1.45, gold: 6, xp: 5, dmg: 1, r: 0.26, res: { frost: 1.3 }, splashRes: 0.7 },
    { cls: 'brute', pts: 30, hp: 330, spd: 0.6, gold: 18, xp: 12, dmg: 2, r: 0.34, res: { phys: 0.6, poison: 1.3 } },
    { cls: 'swarm', pts: 4, hp: 34, spd: 1.15, gold: 3, xp: 2, dmg: 1, r: 0.2, res: { fire: 1.3, poison: 0.7 } },
    { cls: 'shield', pts: 18, hp: 190, spd: 0.72, gold: 12, xp: 8, dmg: 1, r: 0.3, res: { fire: 0.7, bolt: 1.3 }, shield: 0.35 }
  ];
  /* Bossowie w kolejności fal 5, 10, 15, 20. si = numer obrazka. */
  var BOSSES = [
    { si: 5, pts: 500, mech: 'slow', hp: 1500, spd: 0.46, gold: 70, xp: 60, dmg: 6, r: 0.5, res: { poison: 1.3 }, d: 'Spowalnia wieże w pobliżu. Słaby na truciznę.' },
    { si: 6, pts: 500, mech: 'dodge', hp: 2500, spd: 0.8, gold: 70, xp: 70, dmg: 6, r: 0.42, d: 'Unika strzał (45%). Spowolniony unika rzadziej, piorunów nie unika.' },
    { si: 7, pts: 500, mech: 'summon', hp: 6500, spd: 0.46, gold: 80, xp: 90, dmg: 8, r: 0.5, d: 'Co 4 s przywołuje rój.' },
    { si: 8, pts: 1000, mech: 'revive', hp: 11000, spd: 0.42, gold: 100, xp: 120, dmg: 12, r: 0.55, d: 'Raz wstaje z połową HP. Jeśli płonie, tylko z 25%.' }
  ];
  var ENEMY_FACTIONS = [
    { id: 'aliens', n: 'Kosmici', mech: '', hp: 1.0, d: 'Bez dodatkowej mechaniki.',
      names: ['Zielonek', 'Spodek', 'Pancernik', 'Rój', 'Tarczownik', 'Al Husain Wisimulaha', 'Skurvvinox', 'Matka Roju', 'Bóg Kosmitów'] },
    { id: 'night', n: 'Dzieci Nocy', mech: 'heal', hp: 0.73, d: 'Opancerzony leczy wrogów wokół siebie.',
      names: ['Opętany', 'Wilkołak', 'Nekromanta', 'Kościany sługa', 'Czarny rycerz', 'Zszyty Kolos', 'Hrabia', 'Pani Cieni', 'Pan Nekropolii'] },
    { id: 'horde', n: 'Dzika Horda', mech: 'rage', hp: 0.87, d: 'Poniżej połowy HP biegną 40% szybciej.',
      names: ['Jaskiniowiec', 'Ork łupieżca', 'Ork osiłek', 'Ptasi zbój', 'Dziki tarczownik', 'Lodowy Kolos', 'Zbieracz Łupów', 'Szaman Hordy', 'Wódz Hordy'] },
    { id: 'machines', n: 'Bunt Maszyn', mech: 'shield', hp: 0.86, d: 'Każdy ma dodatkową tarczę równą 20% HP.',
      names: ['Robot roboczy', 'Robot kurier', 'Kloc', 'Śrubka', 'Strażnik z rdzy', 'Mech Zagłady', 'Prototyp X', 'Kuźnik', 'Pierwsza Maszyna'] },
    { id: 'circus', n: 'Cyrk Potworów', mech: 'split', hp: 0.9, d: 'Opancerzony rozpada się na 3 małe.',
      names: ['Klaun', 'Dinuś', 'Przebieraniec', 'Mały klaun', 'Zepsuta maskotka', 'Wielki Klaun', 'Dino-Gwiazda', 'Dyrektor Cyrku', 'Zepsuty Miś'] }
  ];

  var THEMES = [
    { id: 'meadow', n: 'Królewska łąka', ground: ['#79a843', '#81b04a'], road: '#c39b66', edge: '#8a6a3c' },
    { id: 'dungeon', n: 'Lochy', ground: ['#4a5166', '#515870'], road: '#8a7358', edge: '#d9a45a' },
    { id: 'mars', n: 'Obca planeta', ground: ['#9c5f4a', '#a46651'], road: '#59606e', edge: '#39d5e8' },
    { id: 'night', n: 'Noc grozy', ground: ['#2f3a44', '#35414b'], road: '#8a735a', edge: '#c9a06a', dark: true },
    { id: 'winter', n: 'Zimowa kraina', ground: ['#bccde0', '#c7d7e7'], road: '#8398ae', edge: '#eef6ff' },
    { id: 'city', n: 'Metropolia', ground: ['#959ca4', '#9da4ac'], road: '#454b56', edge: '#d9dde2', dashes: true }
  ];

  var FIELDS = {
    hill: { n: 'Wzgórze', d: '+20% zasięgu', col: '#d6b878', ico: '▲' },
    power: { n: 'Pole mocy', d: '+15% tempa', col: '#ffd23f', ico: '✦' },
    gold: { n: 'Złoże', d: '+8 zł po każdej fali', col: '#7be0c3', ico: '◆' },
    rock: { n: 'Głaz', d: 'blokuje budowę', col: '#8c9ba7', ico: '' }
  };

  var DIFF = {
    easy: { n: 'Łatwy', hp: 0.96, gold: 360 },
    normal: { n: 'Normalny', hp: 1.33, gold: 330 },
    hard: { n: 'Trudny', hp: 1.6, gold: 320 },
    hardcore: { n: 'Hardcore', hp: 1.39, gold: 330, hc: true }
  };
  /* Wzmocnienia wrogów w Hardcore (zamek zaczyna z 1 HP; +2 HP po pokonaniu bossa). */
  var HARDCORE = {
    units: { grunt: { hp: 1.15 }, runner: { spd: 1.15 }, brute: { res: { phys: 0.5 } }, swarm: { res: { poison: 0.5 } }, shield: { shield: 0.5 } },
    bossHp: 1.15, bossResist: 0.65, bossHeal: 2,
    kinds: ['phys', 'fire', 'frost', 'bolt', 'poison'], kindName: { phys: 'Stal', fire: 'Ogień', frost: 'Mróz', bolt: 'Piorun', poison: 'Trucizna' }
  };
  /* Punkty poza zabójstwami, po każdej odpartej fali: hp za każde HP zamku, time za każdą sekundę przed limitem fali.
     Limit = czas wypuszczania wrogów + przejście całej drogi w tempie pace (kratki na sekundę), więc zależy od fali i mapy. */
  var SCORE = { hp: 10, time: 5, pace: 0.6 };
  var WAVES = 20;
  /* odblokowania: numer fali, przed którą budujesz */
  function typesAt(w) { return w >= 15 ? 5 : w >= 6 ? 4 : w >= 3 ? 3 : 2; }
  function slotsAt(w) { return w >= 15 ? 7 : w >= 10 ? 6 : w >= 6 ? 5 : w >= 3 ? 4 : 3; } /* zwykłe wieże; od fali 15 dochodzi osobne miejsce legendy */

  return { TOWERS: TOWERS, FACTIONS: FACTIONS, LEGEND_COST: LEGEND_COST, PATHS: PATHS, PATH_IDS: PATH_IDS, LEVEL_DMG: LEVEL_DMG, UNITS: UNITS, BOSSES: BOSSES,
    ENEMY_FACTIONS: ENEMY_FACTIONS, HARDCORE: HARDCORE, SCORE: SCORE, THEMES: THEMES, FIELDS: FIELDS, DIFF: DIFF, WAVES: WAVES, typesAt: typesAt, slotsAt: slotsAt };
})();
if (typeof module !== 'undefined') module.exports = DATA;
