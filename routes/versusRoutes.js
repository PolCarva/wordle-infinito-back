const express = require('express');
const router = express.Router();
const VersusGame = require('../models/VersusGame');
const { v4: uuidv4 } = require('uuid');
const { getDictionary, AVAILABLE_LENGTHS } = require('../dictionaries');

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
        if (!userId) {
            return res.status(400).json({ message: 'userId es requerido' });
        }

        // Validar longitud usando AVAILABLE_LENGTHS
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
            creator: userId,
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
        res.status(500).json({ 
            message: 'Error creando la partida',
            error: error.message 
        });
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

        const isCreator = game.creator.toString() === userId;
        const guesses = isCreator ? game.creatorGuesses : game.opponentGuesses;
        guesses.push(guess);

        if (guess === game.word) {
            game.status = 'finished';
            game.winner = userId;
        }

        await game.save();
        res.json({ game });
    } catch (error) {
        res.status(500).json({ message: 'Error realizando el intento' });
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

module.exports = router; 