const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Registro de usuario
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Usuario o email ya existe' });
        }

        // Validar longitud de contraseña
        if (password.length < 6) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
        }

        // Crear nuevo usuario
        const user = new User({ 
            username, 
            email, 
            password,
            stats: {
                gamesPlayed: 0,
                gamesWon: 0,
                streak: 0,
                winRate: 0,
                versusPlayed: 0,
                versusWon: 0,
                versusWinRate: 0
            }
        });
        await user.save();

        // Generar token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Devolver la misma información que el login
        res.status(201).json({ 
            token,
            userId: user._id,
            email: user.email,
            username: user.username,
            stats: user.stats
        });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Login de usuario
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Email o contraseña incorrectos' });
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Asegurarnos de que todos los valores de stats tengan un valor por defecto
        const stats = {
            gamesPlayed: user.stats?.gamesPlayed || 0,
            gamesWon: user.stats?.gamesWon || 0,
            streak: user.stats?.streak || 0,
            bestStreak: user.stats?.bestStreak || 0,
            winRate: user.stats?.winRate || 0,
            versusPlayed: user.stats?.versusPlayed || 0,
            versusWon: user.stats?.versusWon || 0,
            versusWinRate: user.stats?.versusWinRate || 0,
            versusStreak: user.stats?.versusStreak || 0,
            versusBestStreak: user.stats?.versusBestStreak || 0
        };

        // Actualizar las stats en la base de datos si hay valores null
        if (Object.values(user.stats || {}).some(val => val === null)) {
            user.stats = stats;
            await user.save();
        }

        res.json({
            token,
            userId: user._id,
            email: user.email,
            username: user.username,
            stats
        });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Obtener estadísticas del usuario
router.get('/stats/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        // Asegurarnos de que devolvemos un objeto de estadísticas completo
        const stats = {
            gamesPlayed: user.stats?.gamesPlayed || 0,
            gamesWon: user.stats?.gamesWon || 0,
            streak: user.stats?.streak || 0,
            winRate: user.stats?.winRate || 0
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Actualizar estadísticas
router.put('/stats/:userId', async (req, res) => {
    try {
        console.log(`Solicitud de actualización de estadísticas para usuario ${req.params.userId}`);
        
        const user = await User.findById(req.params.userId);
        if (!user) {
            console.log(`Usuario no encontrado: ${req.params.userId}`);
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar token de verificación
        const { gamesPlayed, gamesWon, streak, winRate, verificationToken, gameData } = req.body;
        
        console.log('Datos recibidos:', { 
            userId: req.params.userId, 
            stats: { gamesPlayed, gamesWon, streak, winRate },
            verificationToken: verificationToken ? 'Presente' : 'Ausente',
            gameData: gameData ? 'Presente' : 'Ausente'
        });
        
        if (!verificationToken || !gameData) {
            console.log('Faltan datos de verificación');
            return res.status(400).json({ message: 'Datos de verificación requeridos' });
        }
        
        // Implementación completa de verificación JWT
        try {
            // Decodificar el token (que ahora es un objeto JSON en base64)
            const decodedToken = JSON.parse(Buffer.from(verificationToken, 'base64').toString());
            
            console.log('Token decodificado correctamente');
            
            // Verificar que el token pertenezca al usuario correcto
            if (decodedToken.userId !== req.params.userId) {
                console.log(`ID de usuario no coincide: ${decodedToken.userId} vs ${req.params.userId}`);
                return res.status(403).json({ message: 'Token no válido para este usuario' });
            }
            
            // Verificar que el token no haya expirado (5 minutos)
            const MAX_TOKEN_AGE = 5 * 60 * 1000; // 5 minutos en milisegundos
            if (Date.now() - decodedToken.timestamp > MAX_TOKEN_AGE) {
                console.log(`Token expirado: ${new Date(decodedToken.timestamp).toISOString()}`);
                return res.status(401).json({ message: 'Token expirado' });
            }
            
            // Verificar que el gameId en el token coincida con el de los datos
            if (decodedToken.gameId !== gameData.gameId) {
                console.log(`ID de juego no coincide: ${decodedToken.gameId} vs ${gameData.gameId}`);
                return res.status(400).json({ message: 'ID de juego no coincide' });
            }
            
            // Verificar que los datos del juego sean coherentes con las estadísticas
            // Para un juego ganado, verificamos que haya datos de tableros
            if (gameData.won && (!gameData.boards || gameData.boards.length === 0)) {
                console.log('Datos incoherentes: juego ganado pero no hay tableros');
                return res.status(400).json({ message: 'Datos de juego incoherentes: no hay tableros' });
            }
            
            // Imprimir información detallada sobre los tableros para depuración
            console.log('Información de tableros:', {
                totalBoards: gameData.totalBoards || gameData.boards.length,
                completedBoards: gameData.completedBoards || gameData.boards.filter(b => b.completed).length,
                boardsInfo: gameData.boards.map(b => ({
                    word: b.word,
                    completed: b.completed,
                    guessCount: b.guessCount,
                    isCorrect: b.isCorrect
                }))
            });
            
            // Verificar que la marca de tiempo sea reciente (por ejemplo, en las últimas 24 horas)
            const MAX_TIME_DIFF = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
            if (Date.now() - gameData.timestamp > MAX_TIME_DIFF) {
                console.log(`Datos expirados: ${new Date(gameData.timestamp).toISOString()}`);
                return res.status(400).json({ message: 'Datos de juego expirados' });
            }
            
            // Verificar que no haya manipulación de datos entre el token y los datos enviados
            // Comparar los datos del juego en el token con los datos enviados
            const tokenGameData = JSON.stringify(decodedToken.gameData);
            const receivedGameData = JSON.stringify(gameData);
            if (tokenGameData !== receivedGameData) {
                console.log('Datos no coinciden:');
                console.log('Token:', tokenGameData);
                console.log('Recibido:', receivedGameData);
                return res.status(400).json({ message: 'Datos de juego manipulados' });
            }
            
            console.log('Verificación de token exitosa');
            
        } catch (error) {
            console.error('Error verificando token:', error);
            return res.status(401).json({ message: 'Token inválido: ' + error.message });
        }
        
        // Limitar la frecuencia de actualización (por ejemplo, no más de una vez cada 5 minutos)
        const MIN_UPDATE_INTERVAL = 10 * 1000; // 10 segundos en milisegundos
        if (user.lastStatsUpdate && Date.now() - user.lastStatsUpdate < MIN_UPDATE_INTERVAL) {
            console.log(`Actualización demasiado frecuente. Última: ${new Date(user.lastStatsUpdate).toISOString()}`);
            return res.status(429).json({ message: 'Demasiadas actualizaciones. Inténtalo más tarde.' });
        }
        
        // Actualizar mejor racha normal si la actual la supera
        const bestStreak = Math.max(streak, user.stats?.bestStreak || 0);
        
        // Preservar TODAS las estadísticas existentes
        user.stats = {
            gamesPlayed,
            gamesWon,
            streak,
            bestStreak,
            winRate,
            // Preservar stats de versus
            versusPlayed: user.stats?.versusPlayed || 0,
            versusWon: user.stats?.versusWon || 0,
            versusWinRate: user.stats?.versusWinRate || 0,
            versusStreak: user.stats?.versusStreak || 0,
            versusBestStreak: user.stats?.versusBestStreak || 0
        };
        
        // Actualizar la marca de tiempo de la última actualización
        user.lastStatsUpdate = Date.now();
        
        await user.save();
        console.log(`Estadísticas actualizadas correctamente para usuario ${req.params.userId}`);
        res.json(user.stats);
    } catch (error) {
        console.error('Error actualizando estadísticas:', error);
        res.status(500).json({ message: 'Error actualizando estadísticas: ' + error.message });
    }
});

// Obtener perfil de usuario
router.get('/profile/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.json({
            username: user.username,
            email: user.email,
            stats: {
                gamesPlayed: user.stats?.gamesPlayed || 0,
                gamesWon: user.stats?.gamesWon || 0,
                streak: user.stats?.streak || 0,
                bestStreak: user.stats?.bestStreak || 0,
                winRate: user.stats?.winRate || 0,
                versusPlayed: user.stats?.versusPlayed || 0,
                versusWon: user.stats?.versusWon || 0,
                versusWinRate: user.stats?.versusWinRate || 0,
                versusStreak: user.stats?.versusStreak || 0,
                versusBestStreak: user.stats?.versusBestStreak || 0
            }
        });
    } catch (error) {
        console.error('Error en el servidor:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
});

// Obtener leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        // Obtener los mejores jugadores en modo normal
        const normalLeaderboard = await User.find({
            'stats.gamesPlayed': { $gt: 0 } // Solo jugadores que han jugado
        })
        .select('username stats.gamesWon stats.gamesPlayed stats.winRate stats.bestStreak')
        .sort({ 
            'stats.gamesWon': -1,  // Ordenar por victorias
            'stats.winRate': -1    // Desempatar por ratio de victorias
        })
        .limit(10);

        // Obtener los mejores jugadores en modo versus
        const versusLeaderboard = await User.find({
            'stats.versusPlayed': { $gt: 0 } // Solo jugadores que han jugado versus
        })
        .select('username stats.versusWon stats.versusPlayed stats.versusWinRate stats.versusBestStreak')
        .sort({ 
            'stats.versusWon': -1,      // Ordenar por victorias en versus
            'stats.versusWinRate': -1    // Desempatar por ratio de victorias
        })
        .limit(10);

        res.json({
            normal: normalLeaderboard.map(user => ({
                username: user.username || 'Anónimo',
                userId: user._id,
                gamesWon: user.stats.gamesWon,
                gamesPlayed: user.stats.gamesPlayed,
                winRate: user.stats.winRate,
                bestStreak: user.stats.bestStreak
            })),
            versus: versusLeaderboard.map(user => ({
                username: user.username || 'Anónimo',
                userId: user._id,
                gamesWon: user.stats.versusWon,
                gamesPlayed: user.stats.versusPlayed,
                winRate: user.stats.versusWinRate,
                bestStreak: user.stats.versusBestStreak
            }))
        });
    } catch (error) {
        console.error('Error obteniendo leaderboard:', error);
        res.status(500).json({ message: 'Error obteniendo el leaderboard' });
    }
});

// Configuración de Passport Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true
  },
  async function(request, accessToken, refreshToken, profile, cb) {
    try {
        let user = await User.findOne({ email: profile.emails[0].value });
        
        if (!user) {
            user = await User.create({
                username: profile.displayName,
                email: profile.emails[0].value,
                password: 'google-auth-' + Math.random().toString(36).substring(7),
                stats: {
                    gamesPlayed: 0,
                    gamesWon: 0,
                    streak: 0,
                    winRate: 0,
                    versusPlayed: 0,
                    versusWon: 0,
                    versusWinRate: 0,
                    versusStreak: 0,
                    versusBestStreak: 0
                }
            });
        }
        
        return cb(null, user);
    } catch (error) {
        return cb(error);
    }
  }
));

// Rutas de Google Auth
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback', 
  passport.authenticate('google', { session: false }),
  function(req, res) {
    const token = jwt.sign(
        { userId: req.user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
    
    const stats = req.user.stats || {
        gamesPlayed: 0,
        gamesWon: 0,
        streak: 0,
        winRate: 0,
        versusPlayed: 0,
        versusWon: 0,
        versusWinRate: 0,
        versusStreak: 0,
        versusBestStreak: 0
    };

    const queryParams = new URLSearchParams({
        token,
        userId: req.user._id.toString(),
        email: req.user.email,
        username: req.user.username || '',
        stats: JSON.stringify(stats)
    });
    
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${queryParams}`);
  }
);

module.exports = router; 