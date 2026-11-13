// ===================================================================
//  PARTY SETTINGS — edit these values, commit, and the site updates.
// ===================================================================
export const PARTY = {
  title: "The Frank Family Christmas Eve Party",
  hosts: "The Frank Family",
  // Start/end with explicit Eastern offset (EST = -05:00 in December).
  start: "2026-12-24T17:00:00-05:00",
  end: "2026-12-24T21:00:00-05:00",
  timeText: "Thursday, December 24 · 5:00 – 9:00 PM",
  // >>> ADDRESS: replace "TBD" with the real street address, e.g. "123 Main St, Manasquan, NJ 08736"
  address: "2374 Orchard Crest Blvd, Manasquan, NJ 08736",
  areaText: "Manasquan, NJ",
  details: "Food, drinks, cookies, carols and plenty of Christmas cheer. Kids very welcome!",
  rsvpBy: "Please RSVP by December 15",
  // Optional photo behind the gift intro, e.g. "images/photos/photo-1.jpg" (null = plain night sky)
  introPhoto: null,
  // Invite e-mails (dashboard "✉️ Email invite")
  emailSubject: "You're invited: Frank Family Christmas Eve 🎄",
  emailSignoff: "Love, David, Krissy, Brielle, Juliette & Dylan",
  // Public site address used for links + the invite picture inside e-mails (must be https)
  publicBase: "https://davefrank102-blip.github.io/frank-christmas-party/",
  inviteCard: "images/invite-card.jpg",
};

// Photos and Elf-Dance faces are listed in images/photos/photos.json and
// images/faces/faces.json (see README.md for how to add your own).

export const FIREBASE = {
  apiKey: "AIzaSyC0s5SyajHW9UFArOwfdhtMfUwKZ1FqbLs",
  authDomain: "frank-xmas-2026.firebaseapp.com",
  projectId: "frank-xmas-2026",
  storageBucket: "frank-xmas-2026.firebasestorage.app",
  messagingSenderId: "140751497864",
  appId: "1:140751497864:web:0433724f06f30a41f84d3d",
};

export const hasAddress = () => PARTY.address && !/^\s*TBD\s*$/i.test(PARTY.address);
