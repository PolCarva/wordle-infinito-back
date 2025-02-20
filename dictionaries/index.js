const WORD_LIST = require('./lists/word-list');
const ACCEPTED_WORDS = require('./accepted/accepted-words');
const WORD_LIST_4 = require('./lists/word-list-4');
const ACCEPTED_WORDS_4 = require('./accepted/accepted-words-4');

const DICTIONARIES = {
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
    }
};

const AVAILABLE_LENGTHS = Object.keys(DICTIONARIES).map(Number);

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