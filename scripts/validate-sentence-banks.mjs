import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const indexPath = path.join(projectDirectory, "index.html");
const html = fs.readFileSync(indexPath, "utf8");
const inlineScript = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const exportScript = `
globalThis.__sentenceAudit = {
  subjects, verbs, objects, places, reasons, state, sentenceBanks,
  sentencesForMode, sentenceFromBankEntry, isBankSentence,
  candidatesFor, makeSentenceText, buildSentence
};`;

const fakeElement = {
  innerHTML: "",
  addEventListener() {},
  classList: { add() {}, remove() {} },
  dataset: {}
};
const context = {
  console,
  Math,
  setTimeout,
  clearTimeout,
  window: { setTimeout },
  document: {
    querySelector() { return fakeElement; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    elementFromPoint() { return null; },
    body: {
      classList: { add() {}, remove() {} },
      appendChild() {}
    }
  }
};

vm.createContext(context);
vm.runInContext(`${inlineScript}\n${exportScript}`, context, { filename: "index.html" });

const audit = context.__sentenceAudit;
const expectedCounts = { 3: 88, 4: 157, 5: 164 };
const femaleSubjects = new Set(["girl", "mom", "grandma", "teacherF", "nurse", "cookF", "singer"]);
const forbiddenMode5Reasons = new Set(["dirty", "needsRepair", "newGift", "need", "helpsSomeone", "teacherExercise"]);
const errors = [];

for (const mode of [3, 4, 5]) {
  audit.state.mode = mode;
  const sentences = audit.sentencesForMode(mode);
  if (sentences.length !== expectedCounts[mode]) {
    errors.push(`Mode ${mode}: αναμένονται ${expectedCounts[mode]} προτάσεις, βρέθηκαν ${sentences.length}`);
  }

  for (let index = 0; index < 500; index += 1) {
    const sentence = audit.buildSentence();
    if (!audit.isBankSentence(sentence, mode)) {
      errors.push(`Mode ${mode}: η τυχαία παραγωγή βγήκε εκτός bank`);
      break;
    }
  }

  for (const sentence of sentences) {
    for (const key of Object.keys(sentence)) {
      for (const alternative of audit.candidatesFor(key, sentence)) {
        const changed = { ...sentence, [key]: alternative };
        if (!audit.isBankSentence(changed, mode)) {
          errors.push(`Mode ${mode}: μη ασφαλής εναλλακτική στο ${key}`);
        }
      }
    }
  }
}

for (const entry of audit.sentenceBanks[5]) {
  if (forbiddenMode5Reasons.has(entry.reason)) {
    errors.push(`${entry.id}: χρησιμοποιεί παλιά ασαφή αιτία ${entry.reason}`);
  }
  if (entry.reason === "likesBooksF" && !femaleSubjects.has(entry.subject)) {
    errors.push(`${entry.id}: το «της αρέσουν» χρειάζεται θηλυκό πρόσωπο`);
  }
  if (entry.reason === "likesBooks" && femaleSubjects.has(entry.subject)) {
    errors.push(`${entry.id}: το «του αρέσουν» δεν ταιριάζει με θηλυκό πρόσωπο`);
  }
  if (entry.reason === "ranOutF" && !femaleSubjects.has(entry.subject)) {
    errors.push(`${entry.id}: το «της τελείωσε» χρειάζεται θηλυκό πρόσωπο`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Sentence banks valid: Mode 3 = 88, Mode 4 = 157, Mode 5 = 164.");
}

if (process.argv.includes("--write-review") && !errors.length) {
  audit.state.mode = 5;
  const lines = [
    "# Έτοιμες Προτάσεις Mode 5",
    "",
    "Αυτές είναι οι 164 εγκεκριμένες προτάσεις που μπορεί να εμφανίσει το Mode 5. Το κουμπί `🎲 Άλλο` επιλέγει μόνο παραλλαγές που υπάρχουν μέσα σε αυτή τη λίστα.",
    ""
  ];

  audit.sentenceBanks[5].forEach((entry, index) => {
    const sentence = audit.sentenceFromBankEntry(entry, 5);
    lines.push(`${index + 1}. ${audit.makeSentenceText(sentence)}`);
    lines.push(`   \`${entry.id}\` | ${entry.subject} + ${entry.verb} + ${entry.object} + ${entry.place} + ${entry.reason}`);
  });
  lines.push("");

  fs.writeFileSync(path.join(projectDirectory, "mode5-sentence-bank.md"), lines.join("\n"));
  console.log("Updated mode5-sentence-bank.md.");
}
