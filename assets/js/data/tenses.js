var TENSES = [
  {id:'present_simple',name:'Present Simple',hu:'Jelen idő egyszerű',level:'A1',business:true,
   schema:'(+) Subject + V1 (he/she/it: +s)\n(-) do not / does not + V1\n(?) Do/Does + Subject + V1?',
   uses:'Szokások, általános tények, rendszeres cselekvések.',
   exercises:[
     {hu:'Az ügyfelünk minden héten küld egy jelentést.',en_pre:'Our client',en_post:'a report every week.',verb:'sends',hint:'send'},
     {hu:'A cég nem fogad el késői fizetéseket.',en_pre:'The company',en_post:'late payments.',verb:"doesn't accept",hint:'accept'},
     {hu:'Te vezeted a heti megbeszéléseket?',en_pre:'',en_post:'you lead the weekly meetings?',verb:'Do',hint:'Do/Does'}
   ]},
  {id:'present_continuous',name:'Present Continuous',hu:'Jelen idő folyamatos',level:'A1',business:true,
   schema:'(+) Subject + am/is/are + V-ing\n(-) am/is/are not + V-ing\n(?) Am/Is/Are + Subject + V-ing?',
   uses:'Éppen zajló cselekvések, ideiglenes helyzetek, közeli jövő tervek.',
   exercises:[
     {hu:'Épp a negyedéves jelentésen dolgozom.',en_pre:'I',en_post:'on the quarterly report.',verb:'am working',hint:'work'},
     {hu:'A csapat most az új rendszert teszteli.',en_pre:'The team',en_post:'the new system.',verb:'is testing',hint:'test'},
     {hu:'Mit csinálsz most?',en_pre:'What',en_post:'you doing right now?',verb:'are',hint:'are'}
   ]},
  {id:'past_simple',name:'Past Simple',hu:'Múlt idő egyszerű',level:'A1',business:true,
   schema:'(+) Subject + V2 (szabályos: +ed)\n(-) did not + V1\n(?) Did + Subject + V1?',
   uses:'Lezárult múltbeli cselekvések, konkrét múlt időponthoz kötve.',
   exercises:[
     {hu:'Tegnap aláírtuk a szerződést.',en_pre:'We',en_post:'the contract yesterday.',verb:'signed',hint:'sign'},
     {hu:'Ő nem vett részt a megbeszélésen.',en_pre:'She',en_post:'attend the meeting.',verb:"didn't",hint:'attend'},
     {hu:'Mikor küldted el a számlát?',en_pre:'When',en_post:'you send the invoice?',verb:'did',hint:'did'}
   ]},
  {id:'past_continuous',name:'Past Continuous',hu:'Múlt idő folyamatos',level:'A2',business:false,
   schema:'(+) was/were + V-ing\n(-) was/were not + V-ing',
   uses:'Múltban zajló folyamat, amelybe másik esemény beleszakadt.',
   exercises:[
     {hu:'Épp a prezentáción dolgoztam, amikor hívott.',en_pre:'I',en_post:'on the presentation when she called.',verb:'was working',hint:'work'},
     {hu:'Egész délután tárgyaltunk.',en_pre:'We',en_post:'all afternoon.',verb:'were negotiating',hint:'negotiate'}
   ]},
  {id:'present_perfect',name:'Present Perfect',hu:'Present Perfect',level:'B1',business:true,
   schema:'(+) have/has + past participle\n(-) have/has not + PP\n(?) Have/Has + Subject + PP?',
   uses:'Múltbeli cselekvés jelenre vonatkozó eredménye. Jellemző szavak: just, already, yet, ever, never, for, since.',
   exercises:[
     {hu:'Már elküldtem a jelentést.',en_pre:'I',en_post:'already sent the report.',verb:'have',hint:'have/has'},
     {hu:'Még nem válaszolt az e-mailre.',en_pre:'She',en_post:"replied to the email yet.",verb:"hasn't",hint:'have/has'},
     {hu:'Dolgoztál már multinacionális cégnél?',en_pre:'Have you ever',en_post:'for a multinational company?',verb:'worked',hint:'work'}
   ]},
  {id:'present_perfect_continuous',name:'Present Perfect Continuous',hu:'Present Perfect folyamatos',level:'B1',business:false,
   schema:'(+) have/has + been + V-ing',
   uses:'Folyamatban lévő cselekvés, amely a múltban kezdődött és most is tart.',
   exercises:[
     {hu:'Három éve dolgozom ennél a cégnél.',en_pre:'I',en_post:'for this company for three years.',verb:'have been working',hint:'work'},
     {hu:'Januártól tárgyalunk az ügyféllel.',en_pre:'We',en_post:'with the client since January.',verb:'have been negotiating',hint:'negotiate'}
   ]},
  {id:'future_will',name:'Future: will',hu:'Jövő idő: will',level:'A2',business:true,
   schema:"(+) Subject + will + V1\n(-) will not / won't + V1\n(?) Will + Subject + V1?",
   uses:'Spontán döntések, ígéretek, általános jövőbeli előrejelzések.',
   exercises:[
     {hu:'Péntekig küldöm az ajánlatot.',en_pre:'I',en_post:'you the proposal by Friday.',verb:"'ll send",hint:'send'},
     {hu:'Nem fognak részt venni a konferencián.',en_pre:'They',en_post:'attend the conference.',verb:"won't",hint:'attend'},
     {hu:'Csatlakozol a híváshoz?',en_pre:'',en_post:'you join the call?',verb:'Will',hint:'Will'}
   ]},
  {id:'future_going_to',name:'Future: going to',hu:'Jövő idő: going to',level:'A2',business:true,
   schema:'(+) am/is/are + going to + V1\n(-) am/is/are not going to + V1',
   uses:'Előre eltervezett szándékok, látható jelekből következő előrejelzések.',
   exercises:[
     {hu:'Jövő negyedévben átszervezzük a csapatot.',en_pre:'We',en_post:'restructure the team next quarter.',verb:'are going to',hint:'going to'},
     {hu:'Nem fogja megújítani a szerződést.',en_pre:'She',en_post:'renew the contract.',verb:"isn't going to",hint:'going to'},
     {hu:'Bemutatsz az igazgatóságnak?',en_pre:'Are you',en_post:'present to the board?',verb:'going to',hint:'going to'}
   ]},
  {id:'past_perfect',name:'Past Perfect',hu:'Past Perfect',level:'B1',business:false,
   schema:'(+) had + past participle\n(-) had not + PP',
   uses:'Múltbeli esemény ELŐTT megtörtént másik esemény.',
   exercises:[
     {hu:'Mire megérkeztem, a megbeszélés már elkezdődött.',en_pre:'By the time I arrived, the meeting',en_post:'already started.',verb:'had',hint:'had'},
     {hu:'A határidő előtt elkészítette a jelentést.',en_pre:'She',en_post:'the report before the deadline.',verb:'had prepared',hint:'prepare'}
   ]},
  {id:'conditionals',name:'Conditionals 1 & 2',hu:'Feltételes mondatok 1–2',level:'B1',business:true,
   schema:'1st: If + Present Simple, will + V1\n2nd: If + Past Simple, would + V1',
   uses:'1. valós feltétel és következmény. 2. képzeletbeli helyzet.',
   exercises:[
     {hu:'Ha csökkentjük a költségeket, teljesítjük a célt.',en_pre:'If we reduce costs, we',en_post:'the target.',verb:'will meet',hint:'meet'},
     {hu:'Ha én lennék az ügyvezető, átszervezném a csapatot.',en_pre:'If I were the CEO, I',en_post:'the team.',verb:'would restructure',hint:'restructure'}
   ]}
];

