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
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const { gamesPlayed, gamesWon, streak, winRate } = req.body;
        
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
        
        await user.save();
        res.json(user.stats);
    } catch (error) {
        console.error('Error actualizando estadísticas:', error);
        res.status(500).json({ message: 'Error actualizando estadísticas' });
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

// Configuración de Passport Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' 
        ? process.env.GOOGLE_CALLBACK_URL 
        : 'http://localhost:5000/api/users/auth/google/callback'
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
        let user = await User.findOne({ email: profile.emails[0].value });
        
        if (!user) {
            // Crear nuevo usuario si no existe
            user = await User.create({
                username: profile.displayName,
                email: profile.emails[0].value,
                password: 'google-auth-' + Math.random().toString(36).substring(7),
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
        winRate: 0
    };

    const queryParams = new URLSearchParams({
        token,
        userId: req.user._id.toString(),
        email: req.user.email,
        username: req.user.username || '',
        stats: JSON.stringify(stats)
    });
    
    // Usar URL de desarrollo o producción según el entorno
    const frontendURL = process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : 'http://localhost:3000';
    
    res.redirect(`${frontendURL}/auth/callback?${queryParams}`);
  }
);

module.exports = router; 