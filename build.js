import { readLines } from "https://deno.land/std/io/mod.ts";

function getWordLevel(word, mGSL, lemmatizationDict) {
  if (word in lemmatizationDict) {
    const newWord = lemmatizationDict[word];
    if (newWord in mGSL) {
      return mGSL[newWord];
    } else if (newWord.length == 1) {
      return 0;
    } else {
      console.log("x mGSL: " + word + " -> " + newWord);
    }
  } else if (word in mGSL) {
    return mGSL[word];
  }
  switch (word) {
    case "christmas":
    case "oh":
    case "jim":
    case "sam":
    case "japanese":
      console.log("fixed:  " + word);
      return 0;
    default:
      // console.log('error:  ' + word);
  }
}

function getSentenceLevel(words, mGSL, lemmatizationDict) {
  let levels = words.map((word) => {
    if (word.match(/[0-9A-Z]/)) { // 可能な限り大文字/小文字を考慮してレベルを推定する
      let level = getWordLevel(word, mGSL, lemmatizationDict);
      if (!level) {
        level = getWordLevel(word.toLowerCase(), mGSL, lemmatizationDict);
      }
      return level;
    } else {
      return getWordLevel(word, mGSL, lemmatizationDict);
    }
  });
  // console.log(levels);
  levels = levels.filter((x) => x != undefined);
  return Math.max(...levels);
}

function getWords(sentence) {
  sentence = sentence.trim()
    .replace(/n't/g, " not") // don't, isn't --> do not, is not
    .replace(/'/g, " '") // he's, I'm --> he 's, I'm
    .replace(/[,.'"!?〜]/g, "")
    .replace(/-/g, " ") // left-hand --> left hand
    .replace(/[A-Z][a-z]*\. /g, "") // Mr., Ms., Mt., etc.
    .trim();
  return sentence.split(/\s+/).filter((word) => word && word.length > 1);
}

function includeBadWordsJa(ja) { // TODO: slow & noisy
  const errorWords = [
    "リフレッシュ", // リフレ
    "パチンコ", // チンコ
    "クスコ", // クスコ
  ];
  return inappropriateWordsJa.some((badWord) => {
    if (ja.includes(badWord)) {
      if (!errorWords.some((errorWord) => ja.includes(errorWord))) {
        console.log("bad-ja: " + badWord);
        return true;
      }
    }
  });
}

function includeBadWordsEn(words) {
  return words.some((word) => {
    if (word in badWords) {
      console.log("bad-en: " + word);
      return true;
    } else if (word in profanityWords) {
      console.log("bad-en: " + word);
      return true;
    }
  });
}

async function readLineWithIndex(filepath, callback) {
  const fileReader = await Deno.open(filepath);
  let i = 0;
  for await (const word of readLines(fileReader)) {
    if (!word) continue;
    callback(word, i);
    i += 1;
  }
}

const badWords = {};
let fileReader = await Deno.open(
  "mGSL/vendor/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/en",
);
for await (const word of readLines(fileReader)) {
  if (!word) continue;
  badWords[word] = true;
}

const profanityWords = {};
fileReader = await Deno.open("mGSL/vendor/Google-profanity-words/data/list.txt");
for await (const word of readLines(fileReader)) {
  if (!word) continue;
  profanityWords[word] = true;
}

const inappropriateWordsJa = [];
fileReader = await Deno.open("inappropriate-words-ja/Sexual.txt");
for await (const word of readLines(fileReader)) {
  if (!word) continue;
  if (!["イク", "催眠"].includes(word)) {
    inappropriateWordsJa.push(word);
  }
}
inappropriateWordsJa.push("性病");

const lemmatizationDict = { an: "a" };
fileReader = await Deno.open("mGSL/vendor/agid-2016.01.19/infl.txt");
for await (const line of readLines(fileReader)) {
  if (!line) continue;
  const [toStr, fromStr] = line.split(": ");
  if (!toStr.endsWith("?")) {
    const [to, _toPos] = toStr.split(" ");
    const froms = [];
    fromStr.split(" | ").forEach((forms) => {
      forms.split(", ").forEach((entry) => {
        if (!entry.match(/[~<!?]/)) {
          const word = entry.split(" ")[0];
          froms.push(word);
        }
      });
    });
    froms.forEach((from) => {
      lemmatizationDict[from] = to;
    });
  }
}
delete lemmatizationDict["danger"];

const range = [50, 100, 150, 200, 400, 600, 800, 1200, 1600, 2200, 3000, 5000];

const mGSL = {};
await readLineWithIndex("mGSL/dist/mGSL.lst", (line, i) => {
  const [en, _ja] = line.split("\t", 2);
  let level = range.findIndex((r) => r > i);
  if (level == -1) level = range.length;
  mGSL[en] = level;
});
fileReader = await Deno.open("mGSL/filter-ngsl.lst");
for await (const word of readLines(fileReader)) {
  if (!word) continue;
  mGSL[word] = 0;
}

const problemList = [...Array(range.length + 1)].map(() => []);

fileReader = await Deno.open("jec.tsv");
for await (const line of readLines(fileReader)) {
  if (!line) continue;
  const [_id, ja, en, _zh] = line.split("\t");
  if (!includeBadWordsJa(ja)) {
    const words = getWords(en);
    if (!includeBadWordsEn(words)) {
      const level = getSentenceLevel(words, mGSL, lemmatizationDict);
      const problem = en + "\t" + ja;
      if (isFinite(level)) {
        problemList[level].push(problem);
        // console.log(line);
        // console.log(words);
        // console.log(level);
      } else {
        // console.log(line);
        // console.log(words);
        // console.log(level);
      }
    } else {
      console.log("bad-en: " + en);
      console.log(line);
    }
  } else {
    console.log("bad-ja: " + ja);
    console.log(line);
  }
}
fileReader = await Deno.open("tanaka-corpus-plus/tanaka.txt");
for await (const line of readLines(fileReader)) {
  if (!line) continue;
  if (!line.startsWith("A:")) {
    continue;
  }
  const [jaTmp, enTmp] = line.split("\t");
  const ja = jaTmp.slice(3);
  const en = enTmp.split("#")[0];
  if (!includeBadWordsJa(ja)) {
    const words = getWords(en);
    if (!includeBadWordsEn(words)) {
      const level = getSentenceLevel(words, mGSL, lemmatizationDict);
      const problem = en + "\t" + ja;
      if (isFinite(level)) {
        problemList[level].push(problem);
        // console.log(line);
        // console.log(words);
        // console.log(level);
      } else {
        // console.log(line);
        // console.log(words);
        // console.log(level);
      }
    } else {
      console.log("bad-en: " + en);
      console.log(line);
    }
  } else {
    console.log("bad-ja: " + ja);
    console.log(line);
  }
}
problemList.forEach((problems, i) => {
  // Deno.writeFileSync('dist/' + (i+1) + '.tsv', problems.join('\n'));
  problems.sort((a, b) => {
    if (a.length < b.length) return -1;
    if (a.length > b.length) return 1;
    return 0;
  });
  const pos = Math.ceil(problems.length / 2);
  Deno.writeTextFileSync(
    "dist/easy/" + (i + 3) + ".tsv",
    problems.slice(0, pos).join("\n"),
  );
  Deno.writeTextFileSync(
    "dist/hard/" + (i + 3) + ".tsv",
    problems.slice(pos).join("\n"),
  );
});
