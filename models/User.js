const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: {
        type: String,
        validate: {
            validator: function(v) {
                return v.length >= 6;
            },
            message: props => 'La contraseña debe tener al menos 6 caracteres'
        }
    },
    stats: {
        gamesPlayed: { type: Number, default: 0 },
        gamesWon: { type: Number, default: 0 },
        streak: { type: Number, default: 0 },
        bestStreak: { type: Number, default: 0 },
        winRate: { type: Number, default: 0 },
        versusPlayed: { type: Number, default: 0 },
        versusWon: { type: Number, default: 0 },
        versusWinRate: { type: Number, default: 0 },
        versusStreak: { type: Number, default: 0 },
        versusBestStreak: { type: Number, default: 0 }
    },
    lastStatsUpdate: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Método para encriptar contraseña antes de guardar
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema); 