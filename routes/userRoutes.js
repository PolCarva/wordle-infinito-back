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
        const user = new User({ username, email, password });
        await user.save();

        // Generar token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({ token, userId: user._id });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Login de usuario
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Buscar usuario
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // Verificar contraseña
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // Generar token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            token, 
            userId: user._id,
            email: user.email,
            username: user.username,
            stats: user.stats || {
                gamesPlayed: 0,
                gamesWon: 0,
                streak: 0,
                winRate: 0
            }
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
        const { gamesPlayed, gamesWon, streak } = req.body;
        const user = await User.findById(req.params.userId);
        
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        user.stats = {
            gamesPlayed,
            gamesWon,
            streak,
            winRate: gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0
        };

        await user.save();
        res.json(user.stats);
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
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
                winRate: user.stats?.winRate || 0
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Configuración de Passport Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
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
    
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${queryParams}`);
  }
);

module.exports = router; 