const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@wordle.faqeu.mongodb.net/gameStats`)
    .then(() => {
        console.log('Conexión exitosa a MongoDB');
    })
    .catch((error) => {
        console.error('Error conectando a MongoDB:', error);
    });

// Ruta básica
app.get('/', (req, res) => {
    res.json({ message: 'Bienvenido a la API del juego' });
});

// Rutas
const userRoutes = require('./routes/userRoutes');
const versusRoutes = require('./routes/versusRoutes');
const dictionaryRoutes = require('./routes/dictionaryRoutes');

app.use('/api/users', userRoutes);
app.use('/api/versus', versusRoutes);
app.use('/api/dictionary', dictionaryRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
}); 