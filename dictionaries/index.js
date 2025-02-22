const WORD_LIST_1 = require('./lists/word-list-1');
const ACCEPTED_WORDS_1 = require('./accepted/accepted-words-1');
const WORD_LIST_2 = require('./lists/word-list-2');
const ACCEPTED_WORDS_2 = require('./accepted/accepted-words-2');
const WORD_LIST_3 = require('./lists/word-list-3');
const ACCEPTED_WORDS_3 = require('./accepted/accepted-words-3');
const WORD_LIST_4 = require('./lists/word-list-4');
const ACCEPTED_WORDS_4 = require('./accepted/accepted-words-4');
const WORD_LIST_6 = require('./lists/word-list-6');
const ACCEPTED_WORDS_6 = require('./accepted/accepted-words-6');
const WORD_LIST = require('./lists/word-list');
const ACCEPTED_WORDS = require('./accepted/accepted-words');
const boludle = require('./lists/word-list-boludle');
const WORD_LIST_BOLUDLE = boludle.getWordList();

// Asegurarnos de que todas las palabras del Boludle sean válidas para intentos
const ACCEPTED_WORDS_BOLUDLE = Array.from(new Set([
  ...ACCEPTED_WORDS, 
  ...WORD_LIST_BOLUDLE
]));

const DICTIONARIES = {
    1: {
        common: WORD_LIST_1,
        accepted: ACCEPTED_WORDS_1,
        config: {
            extraAttempts: 9,
        }
    },
    2: {
        common: WORD_LIST_2,
        accepted: ACCEPTED_WORDS_2,
        config: {
            extraAttempts: 8,
        }
    },
    3: {
        common: WORD_LIST_3,
        accepted: ACCEPTED_WORDS_3,
        config: {
            extraAttempts: 7,
        }
    },
    4: {
        common: WORD_LIST_4,
        accepted: ACCEPTED_WORDS_4,
        config: {
            extraAttempts: 6,
        }
    },
    5: {
        common: WORD_LIST,
        accepted: ACCEPTED_WORDS,
        config: {
            extraAttempts: 5,
        }
    },
    6: {
        common: WORD_LIST_6,
        accepted: ACCEPTED_WORDS_6,
        config: {
            extraAttempts: 5,
        }
    },
    'boludle': {
        common: WORD_LIST_BOLUDLE,
        accepted: ACCEPTED_WORDS_BOLUDLE,
        config: {
            extraAttempts: 5,
        }
    }
};

const AVAILABLE_LENGTHS = Object.keys(DICTIONARIES)
    .filter(key => !isNaN(Number(key)))
    .map(Number);

function getDictionary(length, useRare = false) {
    const dictionary = DICTIONARIES[length];
    if (!dictionary) {
        throw new Error(`No hay diccionario para palabras de ${length} letras`);
    }
    return useRare ? dictionary.accepted : dictionary.common;
}

function getGameConfig(length) {
    const dictionary = DICTIONARIES[length];
    if (!dictionary) {
        throw new Error(`No hay diccionario para palabras de ${length} letras`);
    }
    return dictionary.config;
}

module.exports = {
    DICTIONARIES,
    AVAILABLE_LENGTHS,
    getDictionary,
    getGameConfig,
    ACCEPTED_WORDS
}; 