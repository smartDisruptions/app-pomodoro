// ───────────────────────────── 10. Text: every word Patch says, and the app's data tables ─────────────────────────────
// One file for copy, so the voice stays one voice. Patch: dry, warm, short, first person. She ships hotfixes from
// a hoodie, her glasses show three terminals at once, and her headphones play lo-fi and nothing else, ever
// (her public bio on the Neo Dojo cast sheet). Never label the reader. Keep lines under ~70 characters.
// A module that truly needs a new line adds it to a NEW_TEXT object in its own closure and lists it in its report.
const TEXT = {
  app: {
    name: "Patch's Pomodoro",
    short: 'Pomodoro',
    tagline: 'Lo-fi focus with Patch, one tomato at a time.',
    credit: 'Patch is from the Neo Dojo cast by Smart Disruptions.',
    site: 'https://smartdisruptions.com',
  },

  modes: {
    focus: { label: 'Focus', short: 'Focus' },
    short: { label: 'Short break', short: 'Break' },
    long: { label: 'Long break', short: 'Long break' },
  },

  // The six rogues from the Neo Dojo cast, each standing in for one kind of distraction.
  // name/kana/cls/sig/bio are canon (Tools/neo-dojo-cast); `what` and `examples` are this app's mapping.
  rogues: [
    { id: 'bazu', name: 'Bazu', kana: 'バズ', cls: 'Hype merchant', sig: '#e6ff3d', what: 'Shiny new thing', examples: 'News, launches, a tool you want to try right now',
      bio: 'Sells the future by the slide deck. Every product is 10x, every launch is a revolution, and nothing has shipped since 2024.' },
    { id: 'fukusei', name: 'Fukusei', kana: '複製', cls: 'Deepfake', sig: '#e8f4ff', what: 'Fake urgency', examples: 'A ping that feels urgent and isn’t',
      bio: "Wears whoever you trust. Has your boss's voice, your bank's logo and your mum's smile, and gives itself away by blinking wrong." },
    { id: 'bagu', name: 'Bagu', kana: 'バグ', cls: 'Prod bug', sig: '#7dff3a', what: 'Something broke', examples: 'A bug, a problem, a fire that grabbed you',
      bio: 'Hatches at 4:59 on a Friday, splits in two every time someone patches it, and can only be beaten by a test somebody actually wrote.' },
    { id: 'kusarigumo', name: 'Kusarigumo', kana: '鎖雲', cls: 'Lock-in lord', sig: '#3d7bff', what: 'Pulled in', examples: 'Messages, meetings, someone else’s request',
      bio: 'The cloud that never lets go. Free to get in, priced per breath, and the exit costs extra. Its handshake is a three-year contract.' },
    { id: 'zatsu', name: 'Zatsu', kana: '雑', cls: 'Slop monster', sig: '#ff3d9a', what: 'The scroll', examples: 'Feeds, videos, junk you didn’t choose',
      bio: 'Grown from a million generated posts nobody read. Says "delve" a lot and loves an em dash. Count the fingers before you trust it.' },
    { id: 'kemuri', name: 'Emperor Kemuri', kana: '煙帝', cls: 'Final boss', sig: '#ff2340', what: 'Someday', examples: 'Daydreams, big plans, “I’ll start later”',
      bio: 'Rules an empire of vapourware. Nothing in it works, everything in it is "coming soon", and nobody has ever seen him ship.' },
  ],

  // Achievements are embroidered patches; unlocked ones can be sewn onto Patch's hoodie (up to 4).
  // `v1` = the old app's achievement id it replaces (the Engine carries the unlock date over on migration).
  // `rule` is the plain-words unlock rule the Engine implements (CONTRACT.md §8.1 has the exact definitions).
  patches: [
    { id: 'first_tomato', name: 'First Tomato', desc: 'Finish your first focus session.', color: '#ff4a3d', v1: 'first-session' },
    { id: 'ten_down', name: 'Ten Down', desc: 'Finish 10 focus sessions.', color: '#ff7a45', v1: 'ten-sessions' },
    { id: 'full_crate', name: 'Full Crate', desc: 'Finish 50 focus sessions.', color: '#d9a441', v1: 'fifty-sessions' },
    { id: 'hundred_club', name: 'Hundred Club', desc: 'Finish 100 focus sessions.', color: '#f5c542' },
    { id: 'hour_power', name: 'Hour Power', desc: 'Focus for one hour in total.', color: '#3dffc2', v1: 'one-hour' },
    { id: 'deep_worker', name: 'Deep Worker', desc: 'Focus for five hours in total.', color: '#39c2b0', v1: 'five-hours' },
    { id: 'hat_trick', name: 'Hat Trick', desc: 'Focus three days in a row.', color: '#ff8a3d', v1: 'streak-3' },
    { id: 'weekly_warrior', name: 'Weekly Warrior', desc: 'Focus seven days in a row.', color: '#ff5a36', v1: 'streak-7' },
    { id: 'monthly_master', name: 'Monthly Master', desc: 'Focus thirty days in a row.', color: '#e8432a', v1: 'streak-30' },
    { id: 'night_owl', name: 'Night Owl', desc: 'Finish a focus session after 10 p.m.', color: '#7f8cff', v1: 'night-owl' },
    { id: 'early_bird', name: 'Early Bird', desc: 'Finish a focus session before 7 a.m.', color: '#ffb35c', v1: 'early-bird' },
    { id: 'full_stack', name: 'Full Stack', desc: 'Finish a full cycle of focus sessions in one day, no resets.', color: '#b06bff' },
    { id: 'marathon', name: 'Marathon', desc: 'Finish eight focus sessions in one day.', color: '#ff3d9a' },
    { id: 'weekend_shift', name: 'Weekend Shift', desc: 'Focus on a Saturday and the Sunday after it.', color: '#8fd14f' },
    { id: 'clean_build', name: 'Clean Build', desc: 'Finish four focus sessions in a row without logging a rogue.', color: '#7dff3a' },
    { id: 'quarantine', name: 'Quarantine', desc: 'Log ten distractions instead of chasing them.', color: '#e6ff3d' },
    { id: 'rogues_gallery', name: "Rogues' Gallery", desc: 'Log at least one distraction for each of the six rogues.', color: '#ff2340' },
    { id: 'shipped_it', name: 'Shipped It', desc: 'Finish a task within its tomato estimate.', color: '#3d7bff' },
    { id: 'hotfix', name: 'Hotfix', desc: 'Come back after three days away and finish a tomato.', color: '#e93dff' },
    { id: 'lofi_forever', name: 'Lo-Fi Forever', desc: 'Finish ten focus sessions with the lo-fi radio on.', color: '#a9bcff' },
    { id: 'exterminator', name: 'Exterminator', desc: 'Squash 25 bugs in one Bug Hunt.', color: '#b4ff4f' },
    { id: 'breathe_easy', name: 'Breathe Easy', desc: 'Finish five breathing breaks.', color: '#8fe0ff' },
  ],

  // Break activities (Dial runs them; Patch's pose follows `pose`).
  breaks: {
    window: { id: 'window', name: 'Look out the window', icon: 'window', secs: 20, pose: 'sip',
      steps: [{ text: 'Find something far away. The city counts.', secs: 20 }] },
    breathe: { id: 'breathe', name: 'Breathe with Patch', icon: 'breathe', pose: 'breathe', rounds: 4, box: 4,
      labels: { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', rest: 'Hold' } },
    stretch: { id: 'stretch', name: 'Stretch', icon: 'stretch', pose: 'stretch_up',
      steps: [
        { text: 'Reach up. Tall as the antenna on my building.', secs: 15, pose: 'stretch_up' },
        { text: 'Roll your shoulders back. Five slow ones.', secs: 15, pose: 'shoulders' },
        { text: 'Ear to shoulder. Left, then right.', secs: 15, pose: 'neck' },
        { text: 'Shake out your hands, like you’re drying them without a towel.', secs: 10, pose: 'shake' },
      ] },
    bughunt: { id: 'bughunt', name: 'Bug Hunt', icon: 'bug', secs: 45, pose: 'cheer',
      desc: 'Tap a bug and it splits in two. Squash the small ones. A test clears the screen.' },
  },

  onboard: [
    { title: 'Meet Patch', body: 'She ships hotfixes from a hoodie, and she’ll keep you company while you work. Her headphones play lo-fi and nothing else, ever.' },
    { title: 'Wind the tomato', body: 'Drag the tomato sideways to set the time, like a real kitchen timer. Tap it to start.' },
    { title: 'Quarantine the rogues', body: 'When a distraction shows up, tap Distracted. Patch bags it for later, and you keep going.' },
    { title: 'Grow the windowsill', body: 'Every tomato you finish grows on Patch’s plant. Keep a streak, collect patches, sew them on her hoodie.' },
  ],

  ui: {
    start: 'Start', pause: 'Pause', resume: 'Resume', skip: 'Skip', reset: 'Reset',
    distracted: 'Distracted?', focusMode: 'Heads-down mode', exitFocusMode: 'Exit heads-down mode',
    tasks: 'Tasks', log: 'Changelog', patches: 'Patches', settings: 'Settings',
    workingOn: 'Working on', noTask: 'Pick a task', addTask: 'Add a task',
    today: 'Today', week: 'This week', streak: 'Streak', goal: 'Daily goal',
    quarantine: 'Quarantine', later: 'For later',
    reflectQ: 'How did that one go?',
    reflect: [{ v: 2, label: 'Rough' }, { v: 3, label: 'Fine' }, { v: 5, label: 'Locked in' }],
    captureQ: 'What tried to pull you away?', captureNote: 'Note it for later (optional)', captureGo: 'Quarantine it',
    shipped: 'Shipped', clearShipped: 'Clear shipped',
    exportJSON: 'Export backup (JSON)', exportCSV: 'Export sessions (CSV)', importJSON: 'Import backup', clearAll: 'Delete all data',
    confirmClear: 'Delete every session, task and patch on this device? This can’t be undone.',
    sewOn: 'Sew onto hoodie', unpick: 'Unpick from hoodie', hoodieFull: 'Her hoodie fits four. Unpick one first.',
    locked: 'Not yet', letsGo: 'Let’s ship',
  },

  notify: {
    focus: { title: 'Tomato’s done', body: 'Take a {min}-minute break. — Patch' },
    short: { title: 'Break’s over', body: 'Ready for the next tomato? — Patch' },
    long: { title: 'Long break’s over', body: 'Ready when you are. — Patch' },
  },

  // Patch's lines. LINE(key, vars) picks a variant (never the same one twice in a row) and fills {vars}.
  // Patch never talks during a running focus session unless she's tapped or a rogue is logged.
  lines: {
    greet_first: ['Hey. I’m Patch. I ship hotfixes. You ship whatever you came here to ship.'],
    greet_morning: [
      'Morning. Coffee’s for you, tea’s for me, the tomato’s for both of us.',
      'Fresh day, empty changelog. Let’s write one line in it.',
      'Morning. One tomato, then we’ll see who we are today.',
    ],
    greet_afternoon: [
      'Afternoon. The hard part is the first twenty-five minutes.',
      'Back at it. I kept your seat warm.',
      'Pick one thing. Just one. I’ll hold the rest.',
    ],
    greet_evening: [
      'Evening shift. Lo-fi’s already on.',
      'One more tomato before dinner? Your call.',
      'Evening. Let’s close one thing before the day closes.',
    ],
    greet_night: [
      'Late one, huh. No judgment. I’m in a hoodie at a desk too.',
      'Night owl mode. Keep it short and kind.',
      'It’s late. One tomato, then sleep. That’s the deal.',
    ],
    greet_return: [
      'There you are. No lecture. Let’s just start.',
      'Welcome back. The tomato forgot nothing and forgives everything.',
    ],
    migrated: ['I found your old timer’s history. {n} sessions. Moved in, nothing lost.'],

    start_focus: [
      'Headphones on. See you in {min}.',
      'Okay. Shipping mode.',
      'Locking the door. Rogues stay outside.',
      'Go. I’ll watch the window.',
      'Compiling focus…',
    ],
    start_focus_task: ['{task}. Let’s go.', 'On it: {task}.', 'Just {task}. Nothing else exists.'],
    start_late: ['It’s past midnight. Short one, then sleep. Deal?'],
    pause: ['Paused. The tomato waits.', 'Holding. Breathe, then come back.'],
    resume: ['Back in. Where were we.', 'Resuming. Nobody saw anything.'],
    reset: ['Scrapped it. No harm. Wind it again when you’re ready.', 'Reverted. Clean slate.'],
    skip_break: ['Skipping the break? Bold. Drink some water at least.'],

    done_focus: [
      'Tomato shipped. That’s {n} today.',
      'Done. Ripe. Picked.',
      'That one counts. Stretch something.',
      'Merged to main. Take your break.',
      '{n} down. Look at that windowsill.',
    ],
    done_focus_goal: ['That’s your goal for today. Anything else is a bonus track.'],
    done_focus_streak: ['Day {streak} in a row. I see you.'],
    start_break: [
      'Break. Eyes off the screen. Seriously, off.',
      'Five minutes. Water, window, wiggle.',
      'Step away. The bugs will still be here. They’re loyal like that.',
    ],
    start_break_long: ['Long break. You earned the whole kettle.', 'Fifteen minutes. Go outside, if outside exists.'],
    rogue_review: ['You quarantined {n} this round. Want to deal with them now?'],
    done_break: [
      'Break’s over. Ready when you are.',
      'Back to it? The tomato’s wound and waiting.',
      'Recharged? Let’s ship another.',
    ],

    rogue: ['Quarantined. Back to work.', 'Bagged it. It’ll keep.'],
    rogue_bazu: ['Bazu again. The new thing will still be new in twenty minutes.', 'Hype can wait. It’s very good at waiting.'],
    rogue_fukusei: ['Fake urgent. If it were real, it would call twice.', 'Fukusei’s wearing your inbox. Ignore the face.'],
    rogue_bagu: ['A bug. Noted. It’ll still be there. Bugs are loyal.', 'Write it down, don’t chase it. That’s how they multiply.'],
    rogue_kusarigumo: ['Someone else’s chain. Unhooked. Reply on your break.', 'Kusarigumo wants a handshake. You’re busy.'],
    rogue_zatsu: ['The feed will refill itself. It always does.', 'The scroll is bottomless. Your tomato isn’t.'],
    rogue_kemuri: ['Someday is Kemuri’s favorite day. Today’s ours.', 'Big idea, saved. It’ll be big later too.'],

    tap: [
      'Need something? I’m compiling.',
      'Three terminals. All of them say “focus”.',
      'My headphones only play lo-fi. It’s a policy.',
      'I don’t multitask. I do one thing, then tea.',
      'A tomato is twenty-five minutes. It’s also a fruit. Don’t start.',
      'If it takes two minutes, it’s not a task. It’s a sneeze.',
      'Wind the tomato. It’s oddly satisfying. I checked.',
      'The best debugger is a break.',
      'Hydrate. That’s not a tip, that’s a hotfix.',
      'I patch things. Mostly my own code.',
    ],
    tap_focus: ['Shh. Tomato’s cooking.', 'Eyes on your work. I’m fine.', 'Still here. Still focused. You too.'],
    tap_break: ['Break means break. Go look at a tree.', 'I’m sipping. You should sip.'],
    tap_spam: ['Okay, okay. I’m awake.', 'You’re procrastinating on me. I’m flattered.'],
    idle_long: [
      'The tomato won’t wind itself. Well. It could. It won’t.',
      'Whenever you’re ready. I’ll be here, nodding to this beat.',
    ],

    wind_custom: ['{min} minutes. Good number.'],
    wind_long: ['{min} minutes? Bold. I’ll bring snacks.'],
    wind_short: ['{min} minutes. A micro-tomato. Respect.'],

    task_add: ['Added. One at a time.'],
    task_done: ['Shipped: {task}. Put it in the changelog.', '{task}. Done. Feels good, right?', 'Closed the ticket. Nice.'],
    task_done_estimate: ['Right on estimate. That never happens. Screenshot it.'],
    task_active: ['{task}. Got it.'],

    patch_unlock: ['New patch: {patch}. Sewing it on.', 'Look at that. {patch}. My hoodie’s getting heavy.'],
    focusmode_on: ['Heads down. I’ll keep the lights low.'],

    breathe_start: ['Breathe with me. In for four.'],
    breathe_end: ['Better. Shoulders down? Shoulders down.'],
    stretch_start: ['Stand up. Copy me. I’m very professional at this.'],
    stretch_end: ['Nice. Your spine says thanks.'],
    window_start: ['Look at something far away for twenty seconds. The city counts.'],
    window_end: ['Eyes reset. Good.'],
    bughunt_start: ['Bagu got loose. Tap them. Careful, they split.'],
    bughunt_end: ['{score} squashed. The test suite thanks you.'],
    bughunt_test: ['A test! Somebody actually wrote one.'],

    reflect_low: ['Some tomatoes are bruised. Still counts.', 'Rough one. You finished it anyway.'],
    reflect_mid: ['Steady wins.', 'Fine is underrated.'],
    reflect_high: ['Locked in. Love that for you.', 'That’s the good stuff.'],
  },
};

// LINE('done_focus', { n: 3 }) → a line. Never the same variant twice in a row for a key.
const _lastLine = {};
function LINE(key, vars) {
  const a = TEXT.lines[key];
  if (!a || !a.length) { reportErr('LINE:' + key, new Error('no such line')); return ''; }
  let i = (Math.random() * a.length) | 0;
  if (a.length > 1 && i === _lastLine[key]) i = (i + 1) % a.length;
  _lastLine[key] = i;
  let s = a[i];
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, n) => (vars[n] !== undefined ? vars[n] : m));
  return s;
}
const ROGUE = (id) => TEXT.rogues.find((r) => r.id === id) || null;
const PATCHDEF = (id) => TEXT.patches.find((p) => p.id === id) || null;
