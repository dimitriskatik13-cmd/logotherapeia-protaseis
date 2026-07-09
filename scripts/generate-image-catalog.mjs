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
globalThis.__imageCatalog = {
  subjects, verbs, objects, places, reasons, sentenceBanks
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

const data = context.__imageCatalog;
const categories = [
  { key: "subject", label: "ΠΟΙΟΣ", items: data.subjects },
  { key: "verb", label: "ΤΙ ΚΑΝΕΙ", items: data.verbs },
  { key: "object", label: "ΤΙ", items: data.objects },
  { key: "place", label: "ΠΟΥ", items: data.places },
  { key: "reason", label: "ΓΙΑΤΙ", items: data.reasons }
];

const usage = Object.fromEntries(categories.map(({ key }) => [key, new Map()]));
for (const mode of [3, 4, 5]) {
  for (const entry of data.sentenceBanks[mode]) {
    for (const { key } of categories) {
      if (!entry[key]) continue;
      const itemUsage = usage[key].get(entry[key]) || { 3: 0, 4: 0, 5: 0 };
      itemUsage[mode] += 1;
      usage[key].set(entry[key], itemUsage);
    }
  }
}

function imageStatus(item) {
  return item.image ? "Ειδική εικόνα" : "Emoji";
}

function priority(key, item, itemUsage) {
  if (item.image) return "Έτοιμη";
  if (itemUsage[5] && ["verb", "place", "reason"].includes(key)) return "Π1";
  if (itemUsage[5] && key === "object") return "Π2";
  if (itemUsage[5] && key === "subject") return "Π3";
  if (itemUsage[3] || itemUsage[4]) return "Π3";
  return "Αργότερα";
}

function imageFile(item) {
  if (!item.image) return "-";
  if (item.image.startsWith("assets/")) return `\`${item.image}\``;
  return "Inline εικόνα";
}

const allItems = categories.flatMap(({ key, label, items }) => items.map((item) => ({
  ...item,
  categoryKey: key,
  categoryLabel: label,
  usage: usage[key].get(item.id) || { 3: 0, 4: 0, 5: 0 }
})));
const usedInMode5 = allItems.filter((item) => item.usage[5] > 0);
const customImages = allItems.filter((item) => item.image);
const mode5CustomImages = usedInMode5.filter((item) => item.image);

const lines = [
  "# Κατάλογος Εικόνων Εφαρμογής",
  "",
  "Ο κατάλογος δημιουργείται αυτόματα από το `index.html`. Στόχος είναι κάθε έννοια να έχει καθαρή, σταθερή και μοναδική οπτική απόδοση.",
  "",
  "## Σύνοψη",
  "",
  `- Συνολικές έννοιες: **${allItems.length}**`,
  `- Έννοιες που χρησιμοποιούνται στο Mode 5: **${usedInMode5.length}**`,
  `- Συνολικές ειδικές εικόνες: **${customImages.length}**`,
  `- Ειδικές εικόνες μέσα στο Mode 5: **${mode5CustomImages.length}**`,
  `- Έννοιες του Mode 5 που παραμένουν emoji: **${usedInMode5.length - mode5CustomImages.length}**`,
  "",
  "## Κανόνες Εικόνων",
  "",
  "- ΠΟΙΟΣ: ένα καθαρό πρόσωπο ή ζώο, χωρίς άσχετα αντικείμενα.",
  "- ΤΙ ΚΑΝΕΙ: εμφανής δράση με έναν πρωταγωνιστή και ένα βασικό αντικείμενο.",
  "- ΤΙ: ένα απομονωμένο αντικείμενο, σε απλό φόντο.",
  "- ΠΟΥ: ολοκληρωμένη σκηνή με δύο αναγνωρίσιμα στοιχεία του χώρου.",
  "- ΓΙΑΤΙ: η αιτία ή η κατάσταση, όχι απλώς το αντικείμενο της πρότασης.",
  "- Δεν χρησιμοποιείται η ίδια εικόνα για διαφορετικές έννοιες, εκτός αν πρόκειται για την ίδια ακριβώς σημασία με διαφορετικό γένος ή πτώση.",
  "- Κάθε εικόνα πρέπει να αναγνωρίζεται χωρίς τη λέξη όταν εμφανίζεται στο πραγματικό μέγεθος της κάρτας.",
  "",
  "## Πρώτη Σειρά Παραγωγής - Ολοκληρώθηκε",
  "",
  "1. `search` - ψάχνει",
  "2. `find` - βρίσκει",
  "3. `water` - ποτίζει",
  "4. `wear` - φοράει",
  "5. `carry` - κουβαλάει",
  "6. `home` - στο σπίτι",
  "7. `classroom` - στην τάξη",
  "8. `yard` - στην αυλή",
  "9. `cannotFindIt` - γιατί δεν το βρίσκει",
  "10. `schoolWork` - γιατί έχει μάθημα",
  "",
  "## Επόμενη Σειρά Παραγωγής",
  "",
  "1. `read` - διαβάζει",
  "2. `draw` - ζωγραφίζει",
  "3. `write` - γράφει",
  "4. `pull` - τραβάει",
  "5. `hold` - κρατάει",
  "6. `school` - στο σχολείο",
  "7. `garden` - στον κήπο",
  "8. `supermarket` - στο σούπερ μάρκετ",
  "9. `hadLostIt` - γιατί το είχε χάσει",
  "10. `plantNeedsWater` - γιατί το φυτό χρειάζεται νερό",
  "",
  "## Πλήρης Κατάλογος",
  ""
];

for (const category of categories) {
  lines.push(`### ${category.label}`, "");
  lines.push("| ID | Λέξη/φράση | Τωρινό οπτικό | Χρήση 3/4/5 | Κατάσταση | Προτεραιότητα | Αρχείο |");
  lines.push("|---|---|---|---:|---|---|---|");
  for (const item of category.items) {
    const itemUsage = usage[category.key].get(item.id) || { 3: 0, 4: 0, 5: 0 };
    lines.push(`| \`${item.id}\` | ${item.text} | ${item.emoji || "-"} | ${itemUsage[3]}/${itemUsage[4]}/${itemUsage[5]} | ${imageStatus(item)} | ${priority(category.key, item, itemUsage)} | ${imageFile(item)} |`);
  }
  lines.push("");
}

const sharedImages = new Map();
for (const item of customImages) {
  if (!sharedImages.has(item.image)) sharedImages.set(item.image, []);
  sharedImages.get(item.image).push(item);
}

lines.push("## Κοινές Ειδικές Εικόνες", "");
const repeatedImages = [...sharedImages.entries()].filter(([, items]) => items.length > 1);
if (!repeatedImages.length) {
  lines.push("Δεν υπάρχουν κοινές ειδικές εικόνες.", "");
} else {
  for (const [image, items] of repeatedImages) {
    const labels = items.map((item) => `${item.categoryLabel} \`${item.id}\` (${item.text})`).join(" · ");
    lines.push(`- \`${image}\`: ${labels}`);
  }
  lines.push("");
}

while (lines.at(-1) === "") lines.pop();
fs.writeFileSync(path.join(projectDirectory, "image-catalog.md"), `${lines.join("\n")}\n`);
console.log(`Image catalog updated: ${allItems.length} concepts, ${usedInMode5.length} used in Mode 5.`);
