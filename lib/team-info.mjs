// Public team facts used by the optional Q&A bot. Unknown values stay [FILL IN].
export const TEAM_INFO = {
  basics: {
    name: 'Peppers #19044',
    location: 'Iași, Iași County, Romania',
    school: 'Liceul Teoretic de Informatică „Grigore Moisil" Iași (Theoretical High School of Computer Science "Grigore Moisil")',
    rookieYear: '2020',
    website: 'peppers-robotics.ro',
    slogan: 'More than robots, we\'re building tomorrow.',
    meetingDaysTimes: 'Tuesdays, 8 PM',
    meetingLocation: 'At school, and online',
    contactEmail: 'contact@peppers-robotics.ro',
    howToJoin: 'Email contact@peppers-robotics.ro to ask about joining. Recruitment announcements and the application form are shared through team channels when available.',
    currentSeasonGame: '[FILL IN]', // "BIOBUZ SEASON 11" doesn't match a real FTC season name; per team history the most recent listed season is DECODE (2025-26)
    socials: 'Instagram: https://www.instagram.com/cyliispepp/; Facebook: https://www.facebook.com/cyliispepp/; YouTube: https://youtube.com/@cyliispepp',
    fundraisingInfo: 'Email contact@peppers-robotics.ro to discuss sponsorship, materials, equipment, workshop space, or mentoring.',
  },

  // One entry per notable achievement/award. Add or remove freely.
  achievements: [
    { season: '2022', title: 'Motivate Award, 2nd Place — FIRST Championship, Houston (Franklin Division)' },
    { season: '2022', title: 'Inspire Award, 2nd Place — Romanian National Championship' },
    { season: '2022', title: 'Finalist Alliance, 1st Team Selected — Romanian National Championship' },
    { season: '2022', title: 'Winning Alliance, 1st Team Selected — Bucharest Qualifying Tournament' },
    { season: '2022', title: 'Innovate Award (sponsored by Raytheon Technologies), 2nd Place — Bucharest Qualifying Tournament' },
    { season: '2023', title: 'Semifinalist, Franklin Division — FIRST Championship, Houston' },
    { season: '2024', title: 'Winning Alliance, 1st Team Selected — East Romania League Tournament' },
    { season: '2024', title: 'Connect Award, 3rd Place — East Romania League Tournament' },
    { season: '2025-26', title: 'Sustain Award — Romania East League Tournament' },
    { season: '2025-26', title: 'Sustain Award — Istanbul Premier Event, Rumeli Division' },
  ],

  // One entry per sponsor. Add or remove freely.
  sponsors: [
    // { name: 'Local Foundry Co', note: 'Provides machining time' },
  ],

  // One entry per team member you want the bot to be able to talk about.
  // Keep this only as detailed as you're comfortable with a public bot
  // repeating to strangers.
  roster: [
    // { name: 'Jane Doe', role: 'Mechanical Lead' },
  ],

  // One entry per season, oldest or newest first — your call, order here
  // doesn't matter to the model.
  seasons: [
    { years: '2020', tag: 'Rookie season', summary: 'Competed in ULTIMATE GOAL.' },
    { years: '2021', tag: '', summary: 'Competed in FREIGHT FRENZY.' },
    { years: '2022', tag: 'Standout season', summary: 'Competed in POWERPLAY — Motivate Award 2nd Place at FIRST Championship (Franklin Division), Inspire Award 2nd Place and Finalist Alliance at Romanian National Championship, Winning Alliance and Innovate Award 2nd Place at Bucharest Qualifying Tournament.' },
    { years: '2023', tag: '', summary: 'Competed in CENTERSTAGE — reached the semifinals of the Franklin Division at the FIRST Championship in Houston.' },
    { years: '2024', tag: '', summary: 'Competed in INTO THE DEEP — Winning Alliance (1st team selected) and Connect Award 3rd Place at the East Romania League Tournament.' },
    { years: '2025-26', tag: 'Current season', summary: 'Competing in DECODE — Sustain Award at the Romania East League Tournament and at the Istanbul Premier Event (Rumeli Division). Finished 16th of 31 in qualifications at the Romania East League Tournament and 16th of 48 in the VLAICU Division at the 2026 Romania Championship.' },
  ],

  // Freeform Q&A pairs. The most specific and complete these are, the
  // better the bot's answers — this is the highest-value section to fill in.
  faq: [
    { q: 'When and where do you meet?', a: 'Tuesdays at 8 PM, at school and online.' },
    { q: 'How can I join the team?', a: 'Email contact@peppers-robotics.ro to ask about joining; follow our social channels for recruitment updates.' },
    { q: 'How can we sponsor or donate?', a: 'Email contact@peppers-robotics.ro to discuss supporting the team.' },
    { q: 'What is Peppers\' FTC team number?', a: '19044.' },
    { q: 'Where is the team based?', a: 'Iași, Romania, at Liceul Teoretic de Informatică „Grigore Moisil" (Theoretical High School of Computer Science "Grigore Moisil").' },
    { q: 'What is Peppers\' rookie year?', a: '2020, per FIRST\'s official team record. The team\'s own materials describe having existed for about 7 years with 120+ student contributors, so treat both figures as context rather than a single exact founding date.' },
    { q: 'What outreach or community programs does Peppers run?', a: 'Several, including Peppers STEM Special (STEM demos for younger students), Dăruiește un robot (robotics/electronics/programming education for under-resourced schools), RoboReach (STEM outreach for students with disabilities), LIIS STEM Junior (Arduino education for middle schoolers), House of Rookies (recruitment and intro training), PeppQuest (CAD/mechanics/programming training plus an Arduino build challenge), PeppTalks (interviews with students and mentors), PeppStrike (a recreational Counter-Strike 2 tournament among Romanian FTC teams), and AI vs Human Art (an event exploring technology, creativity and AI).' },
    { q: 'Is Peppers only a competition team?', a: 'No — Peppers describes itself as a student-and-alumni STEM community as much as a competitive FTC team, with a strong focus on outreach, education and mentoring alongside robot-building.' },
  ],
};
