"""Adaptadores de persistencia."""

from .base import RouletteRepository
from .memory import InMemoryRouletteRepository
from .mongo import MongoRouletteRepository

__all__ = ["InMemoryRouletteRepository", "MongoRouletteRepository", "RouletteRepository"]
