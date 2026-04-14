/**
 * Romantic dual-POV conversation script.
 *
 * role: which device speaks this line
 *   'host'  = Boy  (Host phone speaks it aloud, Guest phone is silent)
 *   'guest' = Girl (Guest phone speaks it aloud, Host phone is silent)
 *
 * duration: seconds this line "owns" — includes speech + natural pause.
 * Host's timer advances to the next line after this many seconds.
 */

export interface ScriptLine {
  id: number;
  role: 'host' | 'guest';
  speaker: 'Boy' | 'Girl';
  text: string;
  duration: number; // seconds
}

export const SCRIPT: ScriptLine[] = [
  {
    id: 0,
    role: 'host',
    speaker: 'Boy',
    text: "Hey… can I tell you something?",
    duration: 6,
  },
  {
    id: 1,
    role: 'guest',
    speaker: 'Girl',
    text: "Hmm… only if it's something sweet.",
    duration: 6,
  },
  {
    id: 2,
    role: 'host',
    speaker: 'Boy',
    text: "Every time I look at you… it feels like the world just stops for a moment.",
    duration: 10,
  },
  {
    id: 3,
    role: 'guest',
    speaker: 'Girl',
    text: "That's a dangerous thing to say… I might start believing you.",
    duration: 8,
  },
  {
    id: 4,
    role: 'host',
    speaker: 'Boy',
    text: "Then believe me… because I've never been more sure about anything.",
    duration: 8,
  },
  {
    id: 5,
    role: 'guest',
    speaker: 'Girl',
    text: "And what exactly are you so sure about?",
    duration: 6,
  },
  {
    id: 6,
    role: 'host',
    speaker: 'Boy',
    text: "That… I don't just like you… I'm falling for you.",
    duration: 8,
  },
  {
    id: 7,
    role: 'guest',
    speaker: 'Girl',
    text: "You took your time saying that.",
    duration: 6,
  },
  {
    id: 8,
    role: 'host',
    speaker: 'Boy',
    text: "Yeah… because I wanted it to be real… not just words.",
    duration: 8,
  },
  {
    id: 9,
    role: 'guest',
    speaker: 'Girl',
    text: "And now?",
    duration: 4,
  },
  {
    id: 10,
    role: 'host',
    speaker: 'Boy',
    text: "Now… I just want to hold your hand and never let go.",
    duration: 8,
  },
  {
    id: 11,
    role: 'guest',
    speaker: 'Girl',
    text: "Then don't… because I think I've been waiting for you to say this.",
    duration: 9,
  },
];
