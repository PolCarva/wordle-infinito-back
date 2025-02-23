const mongoose = require('mongoose');

const versusGameSchema = new mongoose.Schema({
    word: {
        type: String,
        required: true
    },
    wordLength: {
        type: Number,
        required: true,
        min: 1,
        max: 6
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    opponent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    creatorGuesses: [String],
    opponentGuesses: [String],
    status: {
        type: String,
        enum: ['waiting_opponent', 'ready_to_start', 'playing', 'finished'],
        default: 'waiting_opponent'
    },
    creatorReady: {
        type: Boolean,
        default: false
    },
    opponentReady: {
        type: Boolean,
        default: false
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    gameCode: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // El documento se eliminará después de 1 hora
    },
    creatorWantsRematch: { type: Boolean, default: false },
    opponentWantsRematch: { type: Boolean, default: false }
});

module.exports = mongoose.model('VersusGame', versusGameSchema); 