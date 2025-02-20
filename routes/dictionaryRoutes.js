const express = require('express');
const router = express.Router();
const { AVAILABLE_LENGTHS, getDictionary, getGameConfig } = require('../dictionaries');

// Obtener longitudes disponibles
router.get('/available-lengths', (req, res) => {
    res.json({ lengths: AVAILABLE_LENGTHS });
});

// Obtener configuración para una longitud específica
router.get('/config/:length', (req, res) => {
    try {
        const length = parseInt(req.params.length);
        const config = getGameConfig(length);
        res.json(config);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Obtener diccionario para una longitud específica
router.get('/words/:length', (req, res) => {
    try {
        const length = parseInt(req.params.length);
        const useRare = req.query.rare === 'true';
        const words = getDictionary(length, useRare);
        res.json({ words });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router; 