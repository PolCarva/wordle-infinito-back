const { ACCEPTED_WORDS } = require('../dictionaries/accepted-words');

function getRandomWords(count) {
    const words = [...ACCEPTED_WORDS];
    const result = [];
    
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * words.length);
        result.push(words[randomIndex]);
        words.splice(randomIndex, 1);
    }
    
    return result;
}

module.exports = {
    getRandomWords
}; 