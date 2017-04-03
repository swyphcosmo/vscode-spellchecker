var SpellChecker = require('spellchecker');

//console.log('dictionaries:', SpellChecker.getAvailableDictionaries());

var dics = [ 'en', 'fr' ];
var words = [ 'j\'aime', 'statement' ];

const checkWord = word => {
  var miss = SpellChecker.isMisspelled(word);
  var corr = SpellChecker.getCorrectionsForMisspelling(word);
  console.log('word: "' + word + '" is',
    miss ? 'misspelled => suggestions:' : 'correct :-)',
    miss ? corr.join(' / ') : '');
};

const testWithDic = dic => {
  console.log(' === dictionary:', dic, '\n');
  SpellChecker.setDictionary(dic);
  words.forEach(checkWord);
  console.log();
};

dics.forEach(testWithDic);
