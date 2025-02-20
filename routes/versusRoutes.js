const express = require('express');
const router = express.Router();
const VersusGame = require('../models/VersusGame');
const { v4: uuidv4 } = require('uuid');
const { getDictionary, AVAILABLE_LENGTHS } = require('../dictionaries');
const User = require('../models/User');

// Función para obtener palabra aleatoria según longitud
function getRandomWord(length = 5) {
    const words = getDictionary(length);
    const randomIndex = Math.floor(Math.random() * words.length);
    return words[randomIndex];
}

// Crear una nueva partida versus
router.post('/create', async (req, res) => {
    try {
        const { userId, wordLength = 5 } = req.body;
        // Ya no requerimos userId
        // if (!userId) {
        //     return res.status(400).json({ message: 'userId es requerido' });
        // }

        if (!AVAILABLE_LENGTHS.includes(wordLength)) {
            return res.status(400).json({ 
                message: `La longitud debe ser una de las siguientes: ${AVAILABLE_LENGTHS.join(', ')}` 
            });
        }

        const word = getRandomWord(wordLength).toUpperCase();
        const gameCode = uuidv4().slice(0, 8).toUpperCase();

        const game = await VersusGame.create({
            word,
            wordLength,
            creator: userId || null, // Permitir null si no hay usuario
            gameCode,
            status: 'waiting_opponent',
            creatorGuesses: [],
            opponentGuesses: [],
            creatorReady: false,
            opponentReady: false
        });

        res.json({ 
            gameCode: game.gameCode,
            gameId: game._id 
        });
    } catch (error) {
        console.error('Error creando partida:', error);
        res.status(500).json({ message: 'Error creando la partida' });
    }
});

// Unirse a una partida
router.post('/join', async (req, res) => {
    try {
        const { gameCode, userId } = req.body;
        
        console.log('Intentando unirse:', {
            gameCode,
            userId,
            gameCodeType: typeof gameCode
        });

        const normalizedGameCode = gameCode.toUpperCase();
        const game = await VersusGame.findOne({ gameCode: normalizedGameCode });
        
        console.log('Partida encontrada:', game);

        if (!game) {
            return res.status(404).json({ message: 'Partida no encontrada' });
        }

        if (game.status !== 'waiting_opponent') {
            // Si ya está en ready_to_start y el usuario es el oponente, permitir acceso
            if (game.status === 'ready_to_start' && game.opponent?.toString() === userId) {
                return res.json({ gameId: game._id });
            }
            return res.status(400).json({ 
                message: 'No puedes unirte a esta partida',
                status: game.status
            });
        }

        // Verificar que no sea el mismo usuario
        if (game.creator.toString() === userId) {
            return res.status(400).json({ message: 'No puedes unirte a tu propia partida' });
        }

        game.opponent = userId;
        game.status = 'ready_to_start';
        await game.save();

        console.log('Partida actualizada:', {
            id: game._id,
            status: game.status,
            creator: game.creator,
            opponent: game.opponent
        });

        res.json({ gameId: game._id });
    } catch (error) {
        console.error('Error en join:', error);
        res.status(500).json({ message: 'Error uniéndose a la partida' });
    }
});

// Marcar jugador como listo
router.post('/ready', async (req, res) => {
    try {
        const { gameId, userId } = req.body;
        const game = await VersusGame.findById(gameId);

        if (!game) {
            return res.status(404).json({ message: 'Partida no encontrada' });
        }

        const isCreator = game.creator.toString() === userId;
        
        if (isCreator) {
            game.creatorReady = true;
        } else if (game.opponent.toString() === userId) {
            game.opponentReady = true;
        } else {
            return res.status(403).json({ message: 'No eres parte de esta partida' });
        }

        // Si ambos están listos, comenzar el juego
        if (game.creatorReady && game.opponentReady) {
            game.status = 'playing';
        }

        await game.save();
        res.json(game);
    } catch (error) {
        console.error('Error marcando listo:', error);
        res.status(500).json({ message: 'Error actualizando el estado' });
    }
});

// Realizar un intento
router.post('/guess', async (req, res) => {
    try {
        const { gameId, userId, guess } = req.body;
        const game = await VersusGame.findById(gameId);

        if (!game) {
            return res.status(404).json({ message: 'Partida no encontrada' });
        }

        // Validar que la palabra existe en el diccionario
        const dictionary = getDictionary(game.wordLength, true);
        if (!dictionary.includes(guess.toUpperCase())) {
            return res.status(400).json({ message: 'Palabra no válida' });
        }

        const isCreator = game.creator.toString() === userId;
        const guesses = isCreator ? game.creatorGuesses : game.opponentGuesses;
        guesses.push(guess);

        // Si hay un ganador después del intento, actualizar estadísticas de ambos jugadores
        if (guess === game.word) {
            game.winner = userId;
            game.status = 'finished';

            // Actualizar estadísticas del creador
            const creator = await User.findById(game.creator);
            if (creator) {
                creator.stats.versusPlayed = (creator.stats.versusPlayed || 0) + 1;
                if (game.creator.toString() === userId) {
                    creator.stats.versusWon = (creator.stats.versusWon || 0) + 1;
                    creator.stats.versusStreak = (creator.stats.versusStreak || 0) + 1;
                    // Actualizar mejor racha solo si la actual la supera
                    if (creator.stats.versusStreak > (creator.stats.versusBestStreak || 0)) {
                        creator.stats.versusBestStreak = creator.stats.versusStreak;
                    }
                } else {
                    creator.stats.versusStreak = 0;
                }
                creator.stats.versusWinRate = Math.round((creator.stats.versusWon / creator.stats.versusPlayed) * 100);
                await creator.save();
            }

            // Actualizar estadísticas del oponente
            const opponent = await User.findById(game.opponent);
            if (opponent) {
                opponent.stats.versusPlayed = (opponent.stats.versusPlayed || 0) + 1;
                if (game.opponent.toString() === userId) {
                    opponent.stats.versusWon = (opponent.stats.versusWon || 0) + 1;
                    opponent.stats.versusStreak = (opponent.stats.versusStreak || 0) + 1;
                } else {
                    opponent.stats.versusStreak = 0; // Reset al perder
                }
                opponent.stats.versusWinRate = Math.round((opponent.stats.versusWon / opponent.stats.versusPlayed) * 100);
                await opponent.save();
            }
        }

        await game.save();
        res.json({ game });
    } catch (error) {
        res.status(500).json({ message: 'Error procesando el intento' });
    }
});

// Obtener estado del juego
router.get('/game/:gameId', async (req, res) => {
    try {
        const game = await VersusGame.findById(req.params.gameId);
        
        if (!game) {
            return res.status(404).json({ message: 'Partida no encontrada' });
        }

        res.json(game);
    } catch (error) {
        console.error('Error obteniendo partida:', error);
        res.status(500).json({ 
            message: 'Error obteniendo la partida',
            error: error.message 
        });
    }
});

// Verificar acceso a partida
router.get('/access/:gameId/:userId', async (req, res) => {
    try {
        const { gameId, userId } = req.params;
        const game = await VersusGame.findById(gameId);

        if (!game) {
            return res.status(404).json({ message: 'Partida no encontrada' });
        }

        const isCreator = game.creator.toString() === userId;
        const isOpponent = game.opponent?.toString() === userId;

        if (!isCreator && !isOpponent) {
            return res.status(403).json({ message: 'No tienes acceso a esta partida' });
        }

        res.json({ hasAccess: true });
    } catch (error) {
        console.error('Error verificando acceso:', error);
        res.status(500).json({ message: 'Error verificando acceso' });
    }
});

// Actualizar estadísticas cuando termina una partida
router.post('/game-over', async (req, res) => {
    try {
        const { gameId, winnerId } = req.body;
        const game = await VersusGame.findById(gameId);

        if (!game) {
            return res.status(404).json({ message: 'Partida no encontrada' });
        }

        // Actualizar estadísticas del creador
        if (game.creator) {
            const creator = await User.findById(game.creator);
            if (creator) {
                creator.stats.versusPlayed = (creator.stats.versusPlayed || 0) + 1;
                if (game.creator.toString() === winnerId) {
                    creator.stats.versusWon = (creator.stats.versusWon || 0) + 1;
                }
                creator.stats.versusWinRate = Math.round((creator.stats.versusWon / creator.stats.versusPlayed) * 100);
                await creator.save();
            }
        }

        // Actualizar estadísticas del oponente
        if (game.opponent) {
            const opponent = await User.findById(game.opponent);
            if (opponent) {
                opponent.stats.versusPlayed = (opponent.stats.versusPlayed || 0) + 1;
                if (game.opponent.toString() === winnerId) {
                    opponent.stats.versusWon = (opponent.stats.versusWon || 0) + 1;
                }
                opponent.stats.versusWinRate = Math.round((opponent.stats.versusWon / opponent.stats.versusPlayed) * 100);
                await opponent.save();
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error actualizando estadísticas' });
    }
});

module.exports = router; 