var GRAMMAR_EXERCISES = {

// ============================================================
// A1
// ============================================================

'a1_to_be': {
  category:'tense', name: 'To be', level: 'A1',
  exercises: [
    {type:'fill', hu:'Manager vagyok.', pre:'I', post:'a manager.', answer:'am', hint:'am/is/are'},
    {type:'fill', hu:'Ő nem elérhető most.', pre:'She', post:'available right now.', answer:"isn't", hint:"isn't/aren't"},
    {type:'fill', hu:'Te vagy az ügyvezető?', pre:'', post:'you the CEO?', answer:'Are', hint:'Am/Is/Are'},
    {type:'error', sentence:'He are the team leader.', answer:'is', explanation:'He/She/It → is'},
    {type:'choice', question:'Melyik helyes?', options:['They is ready','They are ready','They am ready','They be ready'], correct:1}
  ]
},

'a1_present_simple': {
  category:'tense', name: 'Present Simple', level: 'A1',
  exercises: [
    {type:'fill', hu:'Az ügyfelünk minden héten küld egy jelentést.', pre:'Our client', post:'a report every week.', answer:'sends', hint:'send'},
    {type:'fill', hu:'A cég nem fogad el késői fizetéseket.', pre:'The company', post:'late payments.', answer:"doesn't accept", hint:'accept'},
    {type:'error', sentence:'She work in IT security.', answer:'works', explanation:'He/She/It esetén +s végzés kell'},
    {type:'choice', question:'Melyik a helyes kérdésforma?', options:['Does she works here?','Does she work here?','Do she work here?','Is she work here?'], correct:1},
    {type:'transform', instruction:'Alakítsd tagadóvá:', source:'We use this software every day.', answer:"We don't use this software every day.", hint:"don't/doesn't"}
  ]
},

'a1_present_continuous': {
  category:'tense', name: 'Present Continuous', level: 'A1',
  exercises: [
    {type:'fill', hu:'Épp a prezentáción dolgozom.', pre:'I', post:'on the presentation.', answer:'am working', hint:'work'},
    {type:'fill', hu:'A csapat most az új rendszert teszteli.', pre:'The team', post:'the new system right now.', answer:'is testing', hint:'test'},
    {type:'error', sentence:'She is work on the project.', answer:'is working', explanation:'Present Continuous: am/is/are + V-ing'},
    {type:'choice', question:'Melyik igét NEM használjuk Present Continuous-ban?', options:['work','run','know','speak'], correct:2},
    {type:'transform', instruction:'Alakítsd Present Continuous-ra:', source:'She reads the report.', answer:'She is reading the report.', hint:'is/are + -ing'}
  ]
},

'a1_articles': {
  name: 'Articles: a/an/the', level: 'A1',
  exercises: [
    {type:'fill', hu:'Háromkor megbeszélésem van.', pre:'I have', post:'meeting at 3.', answer:'a', hint:'a/an/the'},
    {type:'fill', hu:'A jelentés kész.', pre:'', post:'report is ready.', answer:'The', hint:'a/an/the'},
    {type:'fill', hu:'Küldött egy e-mailt.', pre:'She sent', post:'email.', answer:'an', hint:'a/an'},
    {type:'error', sentence:'I have meeting at 3 o\'clock.', answer:'a meeting', explanation:'Számolható főnév előtt kell a névelő: a meeting'},
    {type:'choice', question:'Melyik helyes?', options:['She is an CEO','She is a CEO','She is the CEO of our company','Both B and C are correct'], correct:3}
  ]
},

'a1_there_is': {
  name: 'There is / There are', level: 'A1',
  exercises: [
    {type:'fill', hu:'Probléma van a rendszerrel.', pre:'', post:'a problem with the system.', answer:'There is', hint:'There is/are'},
    {type:'fill', hu:'Három lehetőség van.', pre:'', post:'three options.', answer:'There are', hint:'There is/are'},
    {type:'error', sentence:'There are a solution to this problem.', answer:'There is', explanation:'Egyes szám → There is'},
    {type:'choice', question:'Melyik helyes?', options:['There is many options','There are many options','There have many options','There is many option'], correct:1},
    {type:'transform', instruction:'Alakítsd kérdéssé:', source:'There is a problem with the system.', answer:'Is there a problem with the system?', hint:'Is/Are there...?'}
  ]
},

'a1_imperatives': {
  name: 'Imperatives', level: 'A1',
  exercises: [
    {type:'fill', hu:'Kérem küldje el a jelentést.', pre:'Please', post:'me the report.', answer:'send', hint:'send/sends/sent'},
    {type:'fill', hu:'Ne ossza meg ezt az információt.', pre:'', post:'share this information.', answer:"Don't", hint:"Don't/Doesn't"},
    {type:'error', sentence:'Please to send the document by Friday.', answer:'Please send', explanation:'Imperative után nem kell "to" + infinitive'},
    {type:'choice', question:'Melyik udvariasabb?', options:['Send it now!','You send it!','Could you please send it?','Please send it.'], correct:2},
    {type:'transform', instruction:'Alakítsd tagadó felszólítóvá:', source:'Open the attachment.', answer:"Don't open the attachment.", hint:"Don't + ige"}
  ]
},

// ============================================================
// A2
// ============================================================

'a2_past_simple': {
  category:'tense', name: 'Past Simple', level: 'A2',
  exercises: [
    {type:'fill', hu:'Tegnap aláírtuk a szerződést.', pre:'We', post:'the contract yesterday.', answer:'signed', hint:'sign'},
    {type:'fill', hu:'Mikor küldted el a számlát?', pre:'When', post:'you send the invoice?', answer:'did', hint:'did/does'},
    {type:'fill', hu:'Nem vett részt a megbeszélésen.', pre:'She', post:'attend the meeting.', answer:"didn't", hint:"didn't/doesn't"},
    {type:'error', sentence:'We did signed the contract last week.', answer:'signed', explanation:'Did + V1 (alapalak): did signed → signed'},
    {type:'choice', question:'Melyik a "go" Past Simple alakja?', options:['goed','gone','went','goes'], correct:2}
  ]
},

'a2_past_continuous': {
  category:'tense', name: 'Past Continuous', level: 'A2',
  exercises: [
    {type:'fill', hu:'Épp a prezentáción dolgoztam, amikor hívott.', pre:'I', post:'on the presentation when she called.', answer:'was working', hint:'work'},
    {type:'fill', hu:'Egész délután tárgyaltunk.', pre:'We', post:'all afternoon.', answer:'were negotiating', hint:'negotiate'},
    {type:'error', sentence:'She was work on the report when I arrived.', answer:'was working', explanation:'Past Continuous: was/were + V-ing'},
    {type:'choice', question:'Melyik fejezi ki a háttér cselekvést?', options:['I worked when she called','I was working when she called','I work when she called','I have worked when she called'], correct:1},
    {type:'transform', instruction:'Kombinálj Past Continuous + Past Simple-t:', source:'She read emails. The phone rang.', answer:'She was reading emails when the phone rang.', hint:'was/were + -ing ... when ...'}
  ]
},

'a2_future_will': {
  category:'tense', name: 'Future: will', level: 'A2',
  exercises: [
    {type:'fill', hu:'Péntekig küldöm az ajánlatot.', pre:'I', post:'you the proposal by Friday.', answer:"'ll send", hint:'will send'},
    {type:'fill', hu:'Nem fognak részt venni a konferencián.', pre:'They', post:'attend the conference.', answer:"won't", hint:"won't/will not"},
    {type:'error', sentence:'I will to send the report tomorrow.', answer:'will send', explanation:'Will + V1 (to nélkül): will to send → will send'},
    {type:'choice', question:'Mikor használjuk a "will"-t?', options:['Előre tervezett eseménynél','Spontán döntésnél','Múltbeli szokásnál','Folyamatban lévő cselekvésnél'], correct:1},
    {type:'transform', instruction:'Alakítsd "will"-es jövővé:', source:'I send the report tomorrow.', answer:'I will send the report tomorrow.', hint:'will + V1'}
  ]
},

'a2_future_going_to': {
  category:'tense', name: 'Future: going to', level: 'A2',
  exercises: [
    {type:'fill', hu:'Jövő negyedévben átszervezzük a csapatot.', pre:'We', post:'restructure the team next quarter.', answer:'are going to', hint:'going to'},
    {type:'fill', hu:'Nem fogja megújítani a szerződést.', pre:'She', post:'renew the contract.', answer:"isn't going to", hint:'going to'},
    {type:'error', sentence:'We are go to launch the product next month.', answer:'are going to launch', explanation:'going to + V1 alapalak'},
    {type:'choice', question:'Will vs going to — melyik helyes itt? "Look at those clouds — it ___ rain."', options:['will','is going to','rains','rained'], correct:1},
    {type:'transform', instruction:'Alakítsd "going to"-ra:', source:'We plan to expand the team in Q1.', answer:"We're going to expand the team in Q1.", hint:"am/is/are + going to"}
  ]
},

'a2_modal_can': {
  name: 'Modal: can/could', level: 'A2',
  exercises: [
    {type:'fill', hu:'El tudom végezni a prezentációt.', pre:'I', post:'handle the presentation.', answer:'can', hint:'can/could'},
    {type:'fill', hu:'Tudná átnézni ezt a dokumentumot?', pre:'', post:'you review this document?', answer:'Could', hint:'Can/Could'},
    {type:'error', sentence:'I can to speak English fluently.', answer:'can speak', explanation:'Can + V1 (to nélkül): can to speak → can speak'},
    {type:'choice', question:'Can vs Could — melyik udvariasabb kéréshez?', options:['Can you help me?','Could you help me?','Mindkettő egyformán udvarias','Egyik sem udvarias'], correct:1},
    {type:'transform', instruction:'Alakítsd múltbeli képességgé (could):', source:'She can attend the meeting.', answer:"She could attend the meeting.", hint:'could + V1'}
  ]
},

'a2_modal_must_should': {
  name: 'Modal: must/should/have to', level: 'A2',
  exercises: [
    {type:'fill', hu:'Hétfőig be kell adnod a jelentést.', pre:'You', post:'submit the report by Monday.', answer:'must', hint:'must/should/have to'},
    {type:'fill', hu:'Érdemes tartaléktervet készíteni.', pre:'You', post:'prepare a backup plan.', answer:'should', hint:'should/must'},
    {type:'fill', hu:'Nem kell eljönnöd — nem kötelező.', pre:'You', post:'come — it\'s optional.', answer:"don't have to", hint:"don't have to/mustn't"},
    {type:'error', sentence:'You mustn\'t to attend — it\'s optional.', answer:"don't have to attend", explanation:'Mustn\'t = tilos. Nem kötelező = don\'t have to'},
    {type:'choice', question:'Melyik fejezi ki hogy TILOS?', options:["don't have to",'should not','mustn\'t','needn\'t'], correct:2}
  ]
},

'a2_comparatives': {
  name: 'Comparatives & Superlatives', level: 'A2',
  exercises: [
    {type:'fill', hu:'Ez a megoldás gazdaságosabb.', pre:'This solution is', post:'cost-effective.', answer:'more', hint:'more/less/most'},
    {type:'fill', hu:'A termékünk jobb a versenytársnál.', pre:'Our product is', post:'the competition.', answer:'better than', hint:'better than/more than'},
    {type:'error', sentence:'This is the most good option we have.', answer:'the best', explanation:'Good → better → best (szabálytalan)'},
    {type:'choice', question:'Melyik helyes?', options:['more faster','most fastest','faster','more fast'], correct:2},
    {type:'transform', instruction:'Alakítsd felsőfokúvá:', source:'This is an important decision.', answer:'This is the most important decision.', hint:'the most + hosszú melléknév'}
  ]
},

'a2_present_perfect_intro': {
  category:'tense', name: 'Present Perfect (intro)', level: 'A2',
  exercises: [
    {type:'fill', hu:'Már elküldtem a jelentést.', pre:'I have already', post:'the report.', answer:'sent', hint:'send → sent'},
    {type:'fill', hu:'Még nem válaszolt.', pre:'She', post:'replied yet.', answer:"hasn't", hint:"hasn't/haven't"},
    {type:'error', sentence:'I have already sended the email.', answer:'sent', explanation:'Send szabálytalan ige: send → sent → sent'},
    {type:'choice', question:'Past Simple vs Present Perfect — melyik helyes?', options:['I have seen him yesterday','I saw him yesterday','I have saw him yesterday','I see him yesterday'], correct:1},
    {type:'transform', instruction:'Alakítsd Present Perfect-re (just):', source:'She finished the report.', answer:"She has just finished the report.", hint:'have/has + just + PP'}
  ]
},

// ============================================================
// B1
// ============================================================

'b1_present_perfect': {
  category:'tense', name: 'Present Perfect', level: 'B1',
  exercises: [
    {type:'fill', hu:'Öt éve dolgozom itt.', pre:'I', post:'here for five years.', answer:'have worked', hint:'work'},
    {type:'fill', hu:'Januártól tárgyalunk.', pre:'We', post:'since January.', answer:'have been negotiating', hint:'negotiate'},
    {type:'error', sentence:'I have worked here since five years.', answer:'for five years', explanation:'Időtartam → for. Időpont → since'},
    {type:'choice', question:'For vs Since — "I\'ve been here ___ Monday."', options:['for','since','during','from'], correct:1},
    {type:'transform', instruction:'Alakítsd Present Perfect-re (for/since):', source:'She started working here in 2020. She still works here.', answer:'She has worked here since 2020.', hint:'have/has + PP + since'}
  ]
},

'b1_past_perfect': {
  category:'tense', name: 'Past Perfect', level: 'B1',
  exercises: [
    {type:'fill', hu:'Mire megérkeztem, a megbeszélés már elkezdődött.', pre:'By the time I arrived, the meeting', post:'already started.', answer:'had', hint:'had/have'},
    {type:'fill', hu:'Még nem láttam az e-mailt, amikor felhívtál.', pre:'I', post:'the email when you called.', answer:"hadn't seen", hint:'see'},
    {type:'error', sentence:'By the time she arrived, we finished the report.', answer:'had finished', explanation:'Korábbi múlt esemény → Past Perfect (had + PP)'},
    {type:'choice', question:'Melyik esemény történt előbb?', options:['She arrived — we finished','We finished — she arrived','Egyszerre','Nem tudni'], correct:1},
    {type:'transform', instruction:'Kombináld Past Perfect + Past Simple:', source:'First: sign the contract. Then: send the invoice.', answer:'After we had signed the contract, we sent the invoice.', hint:'After + had + PP, Past Simple'}
  ]
},

'b1_passive_voice': {
  category:'tense', name: 'Passive Voice', level: 'B1',
  exercises: [
    {type:'fill', hu:'A szerződést tegnap írták alá.', pre:'The contract', post:'yesterday.', answer:'was signed', hint:'sign'},
    {type:'fill', hu:'A döntéseket az igazgatóság hozza.', pre:'Decisions', post:'by the board.', answer:'are made', hint:'make'},
    {type:'fill', hu:'A projektet jövő héten indítják el.', pre:'The project', post:'next week.', answer:'will be launched', hint:'launch'},
    {type:'error', sentence:'The report was wrote by the team.', answer:'was written', explanation:'Write szabálytalan: write → wrote → written'},
    {type:'transform', instruction:'Alakítsd passzívvá:', source:'The manager approved the budget.', answer:'The budget was approved by the manager.', hint:'was/were + PP (+ by)'}
  ]
},

'b1_conditionals_1_2': {
  category:'tense', name: 'Conditionals 1 & 2', level: 'B1',
  exercises: [
    {type:'fill', hu:'Ha csökkentjük a költségeket, teljesítjük a célt.', pre:'If we reduce costs, we', post:'the target.', answer:'will meet', hint:'meet'},
    {type:'fill', hu:'Ha én lennék az ügyvezető, átszervezném a csapatot.', pre:'If I were the CEO, I', post:'the team.', answer:'would restructure', hint:'restructure'},
    {type:'error', sentence:'If I would be the manager, I would change this.', answer:'If I were', explanation:'2nd conditional: If + Past Simple (were, nem would be)'},
    {type:'choice', question:'1st vs 2nd conditional — "If it ___ tomorrow, we\'ll cancel the meeting."', options:['rained','rains','would rain','rain'], correct:1},
    {type:'transform', instruction:'Alakítsd 2nd conditional-lá:', source:'I don\'t have time, so I can\'t attend.', answer:"If I had time, I would attend.", hint:'If + Past Simple, would + V1'}
  ]
},

'b1_reported_speech': {
  name: 'Reported Speech', level: 'B1',
  exercises: [
    {type:'fill', hu:'Azt mondta, elküldi a jelentést.', pre:'She said she', post:'the report.', answer:'would send', hint:'send → would send'},
    {type:'fill', hu:'Megkérdezték, tudnánk-e csökkenteni az árat.', pre:'They asked if we', post:'the price.', answer:'could reduce', hint:'can → could'},
    {type:'error', sentence:'He said me that the meeting was cancelled.', answer:'He told me', explanation:'Say + that (no object). Tell + object + that: told me'},
    {type:'choice', question:'"I will attend" reported speech-ben:', options:['She said she will attend','She said she would attend','She said she attended','She said she has attended'], correct:1},
    {type:'transform', instruction:'Alakítsd reported speech-re:', source:'"We are working on a solution," the manager said.', answer:'The manager said they were working on a solution.', hint:'said + that + tense backshift'}
  ]
},

'b1_modal_advanced': {
  name: 'Modal Verbs Advanced', level: 'B1',
  exercises: [
    {type:'fill', hu:'Biztosan nem kapta meg az e-mailt.', pre:'She', post:'received the email.', answer:"can't have", hint:"can't have / must have"},
    {type:'fill', hu:'Korábban kellett volna tájékoztatnod.', pre:'You', post:'me earlier.', answer:'should have told', hint:'tell'},
    {type:'fill', hu:'Lehet, hogy félreértette a feladatot.', pre:'He', post:'the task.', answer:'might have misunderstood', hint:'misunderstand'},
    {type:'error', sentence:'She must have not received the email.', answer:"She can't have received", explanation:'Biztosan NEM → can\'t have (nem must have not)'},
    {type:'choice', question:'Melyik fejez ki sajnálatot?', options:['must have','could have','should have','might have'], correct:2}
  ]
},

'b1_future_continuous_perfect': {
  category:'tense', name: 'Future Continuous & Perfect', level: 'B1',
  exercises: [
    {type:'fill', hu:'Holnap ilyenkor épp az igazgatóságnak prezentálok.', pre:'This time tomorrow I', post:'to the board.', answer:'will be presenting', hint:'present'},
    {type:'fill', hu:'Péntekre befejezem az elemzést.', pre:'By Friday, I', post:'the analysis.', answer:'will have completed', hint:'complete'},
    {type:'error', sentence:'By the time she arrives, I will finish the report.', answer:'will have finished', explanation:'By the time + jövő → Future Perfect (will have + PP)'},
    {type:'choice', question:'Future Continuous vs Perfect — "By 5pm, she ___ the proposal."', options:['will write','will be writing','will have written','writes'], correct:2},
    {type:'transform', instruction:'Alakítsd Future Perfect-re:', source:'I finish the report before the meeting.', answer:'I will have finished the report before the meeting.', hint:'will have + PP'}
  ]
},

'b1_relative_clauses': {
  name: 'Relative Clauses', level: 'B1',
  exercises: [
    {type:'fill', hu:'Az ügyfél, aki tegnap hívott, visszatérítést kér.', pre:'The client', post:'called yesterday wants a refund.', answer:'who', hint:'who/which/that'},
    {type:'fill', hu:'A cég, amelynek az ügyvezetőjével találkoztunk, bővül.', pre:'The company', post:'CEO we met is expanding.', answer:'whose', hint:'who/whose/which'},
    {type:'error', sentence:'The report which I sent it this morning has an error.', answer:'The report which I sent this morning', explanation:'Relative clause-ban nem kell ismételt névmás: sent it → sent'},
    {type:'choice', question:'Defining vs non-defining — melyikhez kell vessző?', options:['Defining','Non-defining','Mindkettőhöz','Egyikhez sem'], correct:1},
    {type:'transform', instruction:'Kapcsold össze relative clause-szal:', source:'The manager called. She is our IT director.', answer:'The manager who called is our IT director.', hint:'who/which/that'}
  ]
},

'b1_gerund_infinitive': {
  name: 'Gerund & Infinitive', level: 'B1',
  exercises: [
    {type:'fill', hu:'Javaslom, hogy nézzük át újra a szerződést.', pre:'I suggest', post:'the contract again.', answer:'reviewing', hint:'review → reviewing'},
    {type:'fill', hu:'Úgy döntöttünk, elhalasztjuk az indítást.', pre:'We decided', post:'the launch.', answer:'to postpone', hint:'postpone'},
    {type:'error', sentence:'I suggest to review the contract again.', answer:'suggest reviewing', explanation:'Suggest + gerund (-ing), nem suggest + to infinitive'},
    {type:'choice', question:'Remember + -ing vs to — "I remember ___ the email." (= Emlékszem, hogy elküldtem)', options:['to send','sending','send','sent'], correct:1},
    {type:'transform', instruction:'Javítsd a gerund/infinitive használatot:', source:'We decided reviewing the contract.', answer:'We decided to review the contract.', hint:'decide + to + infinitive'}
  ]
},

'b1_connectors': {
  name: 'Connectors & Cohesion', level: 'B1',
  exercises: [
    {type:'fill', hu:'A projekt késett; azonban időben teljesítettünk.', pre:'The project was delayed;', post:', we delivered on time.', answer:'however', hint:'however/therefore/moreover'},
    {type:'fill', hu:'A késés ellenére teljesítettük a határidőt.', pre:'', post:'the delay, we met the deadline.', answer:'Despite', hint:'Despite/Although/Because'},
    {type:'error', sentence:'Although the costs increased, but the quality improved.', answer:'Although the costs increased, the quality improved.', explanation:'Although és but nem használhatók ugyanabban a mondatban'},
    {type:'choice', question:'Melyik fejez ki okozatot?', options:['however','although','therefore','despite'], correct:2},
    {type:'transform', instruction:'Kapcsold össze a mondatokat (contrast):', source:'The budget was cut. The team delivered excellent results.', answer:'Although the budget was cut, the team delivered excellent results.', hint:'Although/Despite/However'}
  ]
},

// ============================================================
// B2
// ============================================================

'b2_narrative_tenses': {
  category:'tense', name: 'Narrative Tenses', level: 'B2',
  exercises: [
    {type:'fill', hu:'Amikor beléptem a cégbe, a csapat már hónapok óta dolgozott a projekten.', pre:'When I joined the company, the team', post:'on the project for months.', answer:'had already been working', hint:'work'},
    {type:'fill', hu:'Korábban minden héten utazott, de most távolról dolgozik.', pre:'She', post:'every week, but now she works remotely.', answer:'used to travel', hint:'used to'},
    {type:'error', sentence:'When I arrived, the meeting already started.', answer:'had already started', explanation:'A meeting korábban kezdődött → Past Perfect (had started)'},
    {type:'choice', question:'Melyik fejezi ki a múltbeli szokást?', options:['would','used to','both A and B','neither'], correct:2},
    {type:'transform', instruction:'Építs összetett elbeszélő mondatot:', source:'Background: team was working. Main event: manager arrived. Earlier: they had prepared everything.', answer:'The team was working when the manager arrived. They had already prepared everything.', hint:'Past Perfect + Past Simple + Past Continuous'}
  ]
},

'b2_passive_advanced': {
  name: 'Passive Voice Advanced', level: 'B2',
  exercises: [
    {type:'fill', hu:'Széles körben hiszik, hogy az AI átalakítja az üzletet.', pre:'It', post:'that AI will transform business.', answer:'is widely believed', hint:'believe'},
    {type:'fill', hu:'A jelentést hétfőig kell benyújtani.', pre:'The report', post:'by Monday.', answer:'needs to be submitted', hint:'submit'},
    {type:'fill', hu:'Ügyvéddel néztettük át a szerződést.', pre:'We had the contract', post:'by a lawyer.', answer:'reviewed', hint:'review'},
    {type:'error', sentence:'The CEO is said to being in negotiations.', answer:'is said to be', explanation:'Passive reporting: is said to be (nem being)'},
    {type:'transform', instruction:'Alakítsd személytelen passzívvá:', source:'People believe the company will merge next year.', answer:'It is believed that the company will merge next year.', hint:'It is believed/reported/said that...'}
  ]
},

'b2_conditionals_3': {
  category:'tense', name: 'Conditional 3 & Mixed', level: 'B2',
  exercises: [
    {type:'fill', hu:'Ha korábban fektettünk volna be, uraltuk volna a piacot.', pre:'If we had invested earlier, we', post:'the market.', answer:'would have dominated', hint:'dominate'},
    {type:'fill', hu:'Ha a csapat felkészült volna, az indítás sikeres lett volna.', pre:'Had the team been prepared, the launch', post:'succeeded.', answer:'would have', hint:'would have'},
    {type:'error', sentence:'If I would have known, I would have acted differently.', answer:'If I had known', explanation:'3rd conditional: If + Past Perfect (had known), NEM would have known'},
    {type:'choice', question:'Mixed conditional — "If she had taken the job, she ___ in London now."', options:['would live','would have lived','will live','lived'], correct:0},
    {type:'transform', instruction:'Alakítsd inverted conditional-lá (formális):', source:'If you had informed us earlier, we could have helped.', answer:'Had you informed us earlier, we could have helped.', hint:'Had + subject + PP, ...'}
  ]
},

'b2_wish_regret': {
  category:'tense', name: 'Wish / If only', level: 'B2',
  exercises: [
    {type:'fill', hu:'Bárcsak több időm lenne felkészülni.', pre:'I wish I', post:'more time to prepare.', answer:'had', hint:'had/have'},
    {type:'fill', hu:'Bárcsak korábban biztosítottuk volna a szerződést.', pre:'If only we', post:'the contract earlier.', answer:'had secured', hint:'secure'},
    {type:'fill', hu:'Bárcsak egyértelműbben kommunikálna.', pre:'I wish he', post:'more clearly.', answer:'would communicate', hint:'communicate'},
    {type:'error', sentence:'I wish I would have more time.', answer:'I wish I had more time', explanation:'Jelenbeli kívánság: Wish + Past Simple (nem would have)'},
    {type:'choice', question:'Wish + would — mire használjuk?', options:['Múltbeli sajnálat','Jelenbeli kívánság','Bosszankodás / változtatás kérése','Jövőbeli terv'], correct:2}
  ]
},

'b2_inversion': {
  name: 'Inversion', level: 'B2',
  exercises: [
    {type:'transform', instruction:'Alakítsd inverzióval (Never):', source:'I have never seen such a compelling business case.', answer:'Never have I seen such a compelling business case.', hint:'Never + segédige + alany'},
    {type:'fill', hu:'Nem csak teljesítettük a célt, de csökkentettük a költségeket is.', pre:'Not only', post:'we exceed the target, but we also reduced costs.', answer:'did', hint:'did/have/were'},
    {type:'error', sentence:'Rarely I have seen such dedication.', answer:'Rarely have I seen', explanation:'Negatív határozóval inverzió kötelező: Rarely have I...'},
    {type:'choice', question:'Melyik mondat helyes inverzióval?', options:['Under no circumstances I will share this','Under no circumstances will I share this','Under no circumstances I would share this','Under no circumstances share I this'], correct:1},
    {type:'transform', instruction:'Alakítsd inverzióval (Not only):', source:'We reduced costs. We also improved quality.', answer:'Not only did we reduce costs, but we also improved quality.', hint:'Not only did + alany + V1'}
  ]
},

'b2_future_advanced': {
  category:'tense', name: 'Future Forms Advanced', level: 'B2',
  exercises: [
    {type:'fill', hu:'A cég hamarosan bejelent egy nagy felvásárlást.', pre:'The company is', post:'announce a major acquisition.', answer:'about to', hint:'about to / due to / set to'},
    {type:'fill', hu:'A termék jövő negyedévben indul.', pre:'The product is', post:'launch next quarter.', answer:'due to', hint:'due to / about to'},
    {type:'fill', hu:'A piac 15%-kal várhatóan növekszik.', pre:'The market is', post:'grow by 15%.', answer:'set to', hint:'set to / about to'},
    {type:'error', sentence:'The CEO is about to announcing the merger.', answer:'is about to announce', explanation:'be about to + V1 (infinitive, nem -ing)'},
    {type:'choice', question:'Melyik fejezi ki a menetrend szerinti jövőt?', options:['is about to','is set to','is due to','is on the verge of'], correct:2}
  ]
},

'b2_relative_advanced': {
  name: 'Relative Clauses Advanced', level: 'B2',
  exercises: [
    {type:'fill', hu:'A csapat által benyújtott javaslat kiváló volt.', pre:'The proposal', post:'by the team was excellent.', answer:'submitted', hint:'submitted / submitting'},
    {type:'fill', hu:'Az értékesítés növekedett, ezért bővítettük a csapatot.', pre:'Sales increased,', post:'why we expanded the team.', answer:'which is', hint:'which is / that is'},
    {type:'error', sentence:'The client which we signed the contract called today.', answer:'with whom we signed', explanation:'Személyre whom (formális), prepozíció elé: with whom'},
    {type:'choice', question:'Sentential relative — "She was late, ___ surprised everyone."', options:['that','which','who','what'], correct:1},
    {type:'transform', instruction:'Redukáld a relative clause-t:', source:'The report that was submitted last week has an error.', answer:'The report submitted last week has an error.', hint:'that was + PP → csak PP'}
  ]
},

'b2_word_formation': {
  name: 'Word Formation', level: 'B2',
  exercises: [
    {type:'fill', hu:'Az új stratégia bevezetése hat hónapig tartott.', pre:'The', post:'of the new strategy took six months.', answer:'implementation', hint:'implement → ?'},
    {type:'fill', hu:'Javítani kell a költséghatékonyságon.', pre:'We need to improve', post:'.', answer:'cost-effectiveness', hint:'cost + effective → ?'},
    {type:'error', sentence:'The decide was made by the board.', answer:'decision', explanation:'decide (ige) → decision (főnév)'},
    {type:'choice', question:'Melyik a helyes szóképzés? "achieve → ?"', options:['achievion','achievement','achievment','achieving'], correct:1},
    {type:'transform', instruction:'Alakítsd nominalizált formává:', source:'We decided to implement the strategy. This took six months.', answer:'The implementation of the strategy took six months.', hint:'V → -tion/-ment noun'}
  ]
},

'b2_phrasal_verbs': {
  name: 'Phrasal Verbs (Business)', level: 'B2',
  exercises: [
    {type:'fill', hu:'Fel kell keresnünk az ügyfelet.', pre:'We need to', post:'with the client.', answer:'follow up', hint:'follow up / follow on'},
    {type:'fill', hu:'Tervezik a régi termékcsalád kivonását.', pre:"They're planning to", post:'the old product line.', answer:'phase out', hint:'phase out / pull out'},
    {type:'error', sentence:'Let\'s look the proposal over carefully.', answer:'look over the proposal', explanation:'Look over (separable): look over it / look the proposal over — de formálisan: look over the proposal'},
    {type:'choice', question:'"To discontinue a product" phrasal verb-ként:', options:['phase in','phase out','carry out','roll out'], correct:1},
    {type:'transform', instruction:'Cseréld formális szóra:', source:"We need to follow up on this issue.", answer:'We need to pursue this issue.', hint:'follow up → pursue, phase out → discontinue'}
  ]
},

// ============================================================
// C1
// ============================================================

'c1_cleft': {
  name: 'Cleft Sentences', level: 'C1',
  exercises: [
    {type:'transform', instruction:'Alakítsd it-cleft mondattá (kiemelve: the pricing):', source:'The pricing caused the problem.', answer:'It was the pricing that caused the problem.', hint:'It was ... that/who ...'},
    {type:'fill', hu:'Amire szükségünk van, az egy egyértelmű stratégia.', pre:'', post:'we need is a clear strategy.', answer:'What', hint:'What/It'},
    {type:'fill', hu:'Mindössze egy egyszerű magyarázatot kértek.', pre:'', post:'they asked for was a simple explanation.', answer:'All', hint:'All/What'},
    {type:'error', sentence:'What we need it is a better system.', answer:'What we need is', explanation:'Wh-cleft: What + clause + is/was (nincs extra "it")'},
    {type:'choice', question:'It-cleft — melyik helyes?', options:['It is John who send the email','It was John who sent the email','It was John that send the email','It is John that sent the email'], correct:1}
  ]
},

'c1_inversion_advanced': {
  name: 'Inversion Advanced', level: 'C1',
  exercises: [
    {type:'transform', instruction:'Alakítsd inverted conditional-lá:', source:'If you should require further information, please contact us.', answer:'Should you require further information, please contact us.', hint:'Should + subject + V1'},
    {type:'transform', instruction:'Alakítsd inverted conditional-lá (3rd):', source:'If we had known about the issue, we would have acted sooner.', answer:'Had we known about the issue, we would have acted sooner.', hint:'Had + subject + PP'},
    {type:'fill', hu:'Ha a cég egyesülne, sok munkahely veszélybe kerülne.', pre:'', post:'the company to merge, many jobs would be at risk.', answer:'Were', hint:'Were/Had/Should'},
    {type:'error', sentence:'Little I did know that the market would collapse.', answer:'Little did I know', explanation:'Inverzió: Little did + subject + V1'},
    {type:'choice', question:'"___ I known the result, I would have decided differently."', options:['If','Had','Should','Were'], correct:1}
  ]
},

'c1_subjunctive': {
  category:'tense', name: 'Subjunctive', level: 'C1',
  exercises: [
    {type:'fill', hu:'Javaslom, hogy az igazgatóság vizsgálja felül a javaslatot.', pre:'I suggest that the board', post:'the proposal.', answer:'review', hint:'review (not reviews)'},
    {type:'fill', hu:'Elengedhetetlen, hogy minden jelentés időben kerüljön benyújtásra.', pre:'It is essential that all reports', post:'on time.', answer:'be submitted', hint:'be/is submitted'},
    {type:'error', sentence:'I recommend that he reviews the contract immediately.', answer:'he review', explanation:'Subjunctive: recommend/suggest/insist that + alany + V1 (no -s)'},
    {type:'choice', question:'Melyik helyes subjunctive-val?', options:['They demanded that she signs','They demanded that she sign','They demanded that she signed','They demanded that she is signing'], correct:1},
    {type:'transform', instruction:'Alakítsd subjunctive-ra:', source:'It is important. The CEO should approve this personally.', answer:'It is important that the CEO approve this personally.', hint:'It is essential/important that + subject + V1'}
  ]
},

'c1_hedging': {
  name: 'Hedging Language', level: 'C1',
  exercises: [
    {type:'transform', instruction:'Tedd határozatlanabbá (hedge):', source:'The project is behind schedule.', answer:'It would appear that the project is behind schedule.', hint:'It would appear / seem / tend to'},
    {type:'fill', hu:'Az eredmények némileg pozitív tendenciát jeleznek.', pre:'The results suggest a', post:'positive trend.', answer:'somewhat', hint:'somewhat/rather/fairly'},
    {type:'error', sentence:'Arguably this is clearly the best solution.', answer:'Arguably, this is the best solution.', explanation:'"Arguably" és "clearly" ellentmondanak — hedging és certainty nem párosítható'},
    {type:'choice', question:'Melyik a legerősebb hedging kifejezés?', options:['It is certain that','It would appear that','It is obvious that','There is no doubt that'], correct:1},
    {type:'transform', instruction:'Fogalmazd diplomatikusabbra:', source:'This approach is wrong.', answer:'This approach may not be the most effective.', hint:'may/might not + positive framing'}
  ]
},

'c1_discourse_markers': {
  name: 'Discourse Markers', level: 'C1',
  exercises: [
    {type:'fill', hu:'A projekt kihívással teli volt; mindazonáltal időben teljesítettünk.', pre:'The project was challenging;', post:', we delivered on time.', answer:'nevertheless', hint:'nevertheless/therefore/furthermore'},
    {type:'fill', hu:'Az összeolvadás következtében a csapatot átszervezték.', pre:'', post:'the merger, the team was restructured.', answer:'As a consequence of', hint:'As a result of / Due to / As a consequence of'},
    {type:'error', sentence:'Furthermore, the results were poor. Despite, we continued.', answer:'Nevertheless', explanation:'"Despite" prepozíció, nem discourse marker mondatkezdésre — kell: Nevertheless/However'},
    {type:'choice', question:'Melyik fejezi ki az összefoglalást?', options:['Furthermore','Nevertheless','All things considered','As a consequence'], correct:2},
    {type:'transform', instruction:'Kösd össze megfelelő discourse markerrel:', source:'The budget was limited. The team achieved outstanding results.', answer:'Although the budget was limited, the team achieved outstanding results. / The budget was limited; nevertheless, the team achieved outstanding results.', hint:'nevertheless/although/despite'}
  ]
},

'c1_nominalisation': {
  name: 'Nominalisation', level: 'C1',
  exercises: [
    {type:'transform', instruction:'Nominalizáld az igét:', source:'We decided to implement the strategy. This led to growth.', answer:'The implementation of the strategy led to growth.', hint:'implement → implementation'},
    {type:'fill', hu:'A hatékony döntéshozatal egyértelmű kommunikációt igényel.', pre:'Effective', post:'requires clear communication.', answer:'decision-making', hint:'decide → decision-making'},
    {type:'error', sentence:'The improve of performance was significant.', answer:'The improvement', explanation:'improve (ige) → improvement (főnév)'},
    {type:'choice', question:'Melyik a "develop" helyes nominalizációja?', options:['developion','development','developing','developness'], correct:1},
    {type:'transform', instruction:'Alakítsd formálisabbá nominalizációval:', source:'We achieved significant results. This shows our team works well.', answer:'The achievement of significant results demonstrates our team\'s effectiveness.', hint:'achieve → achievement, demonstrate → noun form'}
  ]
},

'c1_emphasis_fronting': {
  name: 'Emphasis & Fronting', level: 'C1',
  exercises: [
    {type:'transform', instruction:'Emeld ki wh-klefttel:', source:'Their commitment to quality impresses me most.', answer:'What impresses me most is their commitment to quality.', hint:'What + clause + is/was + ...'},
    {type:'fill', hu:'Valóban hiszem, hogy elérhetjük ezt a célt.', pre:'I', post:'believe we can achieve this target.', answer:'do', hint:'do/did/does (emphatic)'},
    {type:'error', sentence:'What I find it most impressive is their dedication.', answer:'What I find most impressive is', explanation:'Wh-cleft: What + clause + is (nincs extra "it")'},
    {type:'choice', question:'Melyik hangsúlyoz legjobban?', options:['I believe this is right','I do believe this is right','I really believe this is right','I certainly believe this is right'], correct:1},
    {type:'transform', instruction:'Emeld ki fronting-gal:', source:'I find this strategy particularly interesting.', answer:'This strategy I find particularly interesting.', hint:'Object/Adjunct + Subject + Verb'}
  ]
},

'c1_register': {
  name: 'Register & Style', level: 'C1',
  exercises: [
    {type:'transform', instruction:'Alakítsd formálissá:', source:"I'm sorry but we can't go ahead with this.", answer:'I regret to inform you that we are unable to proceed.', hint:'Latintőből eredő igék: regret, inform, unable, proceed'},
    {type:'fill', hu:'Sajnálom, de a jelenlegi ajánlattal nem tudunk továbblépni.', pre:"I'm afraid we are", post:'to proceed with the current offer.', answer:'unable', hint:'unable/not able'},
    {type:'error', sentence:'We would like to commence to discuss the terms.', answer:'commence discussing', explanation:'Commence + gerund (-ing), nem commence + to + infinitive'},
    {type:'choice', question:'Melyik a legformálisabb?', options:['We need to end the contract','We have to finish the contract','We are obliged to terminate the agreement','We should stop the contract'], correct:2},
    {type:'transform', instruction:'Alakítsd diplomatikussá (eufemizmus):', source:'We are firing 20 employees.', answer:'We are letting 20 employees go. / We are restructuring the team.', hint:'let go / restructure / downsize'}
  ]
}

};


