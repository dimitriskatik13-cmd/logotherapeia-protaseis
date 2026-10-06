// Νέα έκδοση — ο service worker (sw.js) κατεβάζει τη νέα έκδοση στο παρασκήνιο
// και παίρνει αμέσως τον έλεγχο. Η ανοιχτή σελίδα όμως τρέχει ακόμη την παλιά.
// Εδώ: έλεγχος για ενημέρωση σε κάθε άνοιγμα, και ένα μήνυμα με ένα κουμπί που
// ξαναφορτώνει τη σελίδα. Κανένας αριθμός έκδοσης δεν εμφανίζεται.
// Ανεξάρτητο από την εκκίνηση της εφαρμογής: αν αποτύχει, η άσκηση δεν επηρεάζεται.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** Το μήνυμα «νέα έκδοση», κρυφό μέχρι να χρειαστεί. */
export function buildUpdateNote(doc, reload) {
  const note = doc.createElement('div');
  note.className = 'update-note';
  note.setAttribute('role', 'status');
  note.setAttribute('aria-live', 'polite');
  const text = doc.createElement('span');
  text.textContent = 'Υπάρχει νέα έκδοση.';
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'btn';
  button.textContent = 'Ανανέωση';
  button.addEventListener('click', reload);
  note.append(text, button);
  note.hidden = true;
  return note;
}

/**
 * Σύνδεση με τον service worker. Επιστρέφει false εκεί που δεν υπάρχει
 * (τοπική δοκιμή, παλιός browser), ώστε η εφαρμογή να τρέχει όπως πριν.
 */
export function watchUpdates(note, { serviceWorker, hostname, win, doc }) {
  if (!serviceWorker || LOCAL_HOSTS.includes(hostname)) return false;
  // Στην πρώτη εγκατάσταση δεν υπάρχει τίποτα να ανανεωθεί.
  let hadController = !!serviceWorker.controller;
  serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) note.hidden = false;
    hadController = true;
  });
  win.addEventListener('load', async () => {
    let registration;
    try { registration = await serviceWorker.register('sw.js'); } catch (_) { return; }
    // Έλεγχος σε κάθε άνοιγμα της εφαρμογής, όχι μόνο όταν το αποφασίσει ο browser.
    const check = () => registration.update().catch(() => {});
    doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') check(); });
    check();
  });
  return true;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const note = buildUpdateNote(document, () => window.location.reload());
  document.body.append(note);
  watchUpdates(note, { serviceWorker: navigator.serviceWorker, hostname: window.location.hostname, win: window, doc: document });
}
