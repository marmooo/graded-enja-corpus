const fs = require('fs');

function getWordLevel(word, mGSL, lemmatizationDict) {
  if (word in lemmatizationDict) {
    const newWord = lemmatizationDict[word];
    if (newWord in mGSL) {
      return mGSL[newWord];
    } else if (newWord.length == 1) {
      return 0;
    } else {
      console.log('x mGSL: ' + word + ' -> ' + newWord);
    }
  } else if (word in mGSL) {
    return mGSL[word];
  }
  switch (word) {
    case 'christmas': case 'oh': case 'jim': case 'sam': case 'japanese':
      console.log('fixed:  ' + word);
      return 0;
    default:
      // console.log('error:  ' + word);
  }
}

function getSentenceLevel(words, mGSL, lemmatizationDict, range) {
  let levels = words.map(word => {
    if (word.match(/[0-9A-Z]/)) {  // 可能な限り大文字/小文字を考慮してレベルを推定する
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
  levels = levels.filter(x => x != undefined);
  return Math.max(...levels);
}

function getWords(sentence) {
  sentence = sentence.trim()
    .replace(/n't/g, ' not')  // don't, isn't --> do not, is not
    .replace(/'/g, " '")  // he's, I'm --> he 's, I'm
    .replace(/[,.'"!?〜]/g, '')
    .replace(/-/g, ' ')  // left-hand --> left hand
    .replace(/[A-Z][a-z]*\. /g, '')   // Mr., Ms., Mt., etc.
    .trim();
  return sentence.split(/\s+/).filter(word => word && word.length > 1);
}

function includeBadWordsJa(ja) {  // TODO: slow & noisy
  const errorWords = [
    'リフレッシュ',  // リフレ
    'パチンコ',  // チンコ
    'クスコ',  // クスコ
  ];
  return inappropriateWordsJa.some(badWord => {
    if (ja.includes(badWord)) {
      if (!errorWords.some(errorWord => ja.includes(errorWord))) {
        console.log('bad-ja: ' + badWord);
        return true;
      }
    }
  });
}

function includeBadWordsEn(words) {
  return words.some(word => {
    if (word in badWords) {
      console.log('bad-en: ' + word);
      return true;
    } else if (word in profanityWords) {
      console.log('bad-en: ' + word);
      return true;
    }
  });
}

function readFileSync(filepath) {
  const arr = fs.readFileSync(filepath).toString().split('\n');
  if (arr[arr.length - 1] == '') {
    console.log('err');
    return arr.slice(0, -1);
  } else {
    console.log('ok');
    return arr;
  }
}

const badWords = {};
readFileSync('mGSL/vendor/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/en').forEach(word => {
  badWords[word] = true;
});

const profanityWords = {};
readFileSync('mGSL/vendor/Google-profanity-words/list.txt').forEach(word => {
  profanityWords[word] = true;
});

const inappropriateWordsJa = [];
readFileSync('inappropriate-words-ja/Sexual.txt').forEach(word => {
  if (!['イク', '催眠'].includes(word)) {
    inappropriateWordsJa.push(word);
  }
});
inappropriateWordsJa.push('性病');

const lemmatizationDict = { an:'a' };
readFileSync('mGSL/vendor/agid-2016.01.19/infl.txt').forEach(line => {
  // console.log(line);
  const [toStr, fromStr] = line.split(': ');
  if (!toStr.endsWith('?')) {
    const [to, toPos] = toStr.split(' ');
    let froms = [];
    fromStr.split(' | ').forEach(forms => {
      forms.split(', ').forEach(entry => {
        if (!entry.match(/[~<!?]/)) {
          const word = entry.split(' ')[0];
          froms.push(word);
        }
      });
    });
    froms.forEach(from => {
      lemmatizationDict[from] = to;
    });
  }
});
delete lemmatizationDict['danger'];

const range = [50, 100, 150, 200, 400, 600, 800, 1200, 1600, 2200, 3000, 5000];

let mGSL = {};
readFileSync('mGSL/dist/mGSL.lst').forEach((line, i) => {
  const [en, ja] = line.split('\t', 2);
  let level = range.findIndex(r => r > i);
  if (level == -1) { level = range.length; }
  mGSL[en] = level;
});
readFileSync('mGSL/filter-ngsl.lst').forEach((line, i) => {
  mGSL[line] = 0;
});


const problemList = [...Array(range.length + 1)].map(() => []);

readFileSync('jec.tsv').forEach(line => {
  const [id, ja, en, zh] = line.split('\t');
  if (!includeBadWordsJa(ja)) {
    const words = getWords(en);
    if (!includeBadWordsEn(words)) {
      const level = getSentenceLevel(words, mGSL, lemmatizationDict, range);
      const problem = en + '\t' + ja;
      if (isFinite(level)) {
        problemList[level].push(problem)
        // console.log(line);
        // console.log(words);
        // console.log(level);
      } else {
        // console.log(line);
        // console.log(words);
        // console.log(level);
      }
    } else {
      console.log('bad-en: ' + en);
      console.log(line);
    }
  } else {
    console.log('bad-ja: ' + ja);
    console.log(line);
  }
});
const tanaka = readFileSync('tanaka-corpus-plus/tanaka.txt').filter(line => line.startsWith('A:'));
tanaka.forEach(line => {
  const [jaTmp, enTmp] = line.split('\t');
  const ja = jaTmp.slice(3);
  const en = enTmp.split('#')[0];
  if (!includeBadWordsJa(ja)) {
    const words = getWords(en);
    if (!includeBadWordsEn(words)) {
      const level = getSentenceLevel(words, mGSL, lemmatizationDict, range);
      const problem = en + '\t' + ja;
      if (isFinite(level)) {
        problemList[level].push(problem)
        // console.log(line);
        // console.log(words);
        // console.log(level);
      } else {
        // console.log(line);
        // console.log(words);
        // console.log(level);
      }
    } else {
      console.log('bad-en: ' + en);
      console.log(line);
    }
  } else {
    console.log('bad-ja: ' + ja);
    console.log(line);
  }
});
problemList.forEach((problems, i) => {
  // fs.writeFileSync('dist/' + (i+1) + '.tsv', problems.join('\n'));
  problems.sort();
  const pos = Math.ceil(problems.length / 2);
  fs.writeFileSync('dist/easy/' + (i+3) + '.tsv', problems.slice(0, pos).join('\n'));
  fs.writeFileSync('dist/hard/' + (i+3) + '.tsv', problems.slice(pos).join('\n'));
});

