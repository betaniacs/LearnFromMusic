import { Router } from "express";
import { listDecks, getDeck, deleteDeck } from "../db.js";

const router = Router();

// Library index for the signed-in (cookie-identified) visitor.
router.get("/decks", (req, res) => {
  res.json(listDecks(req.ownerId));
});

router.get("/decks/:id", (req, res) => {
  const deck = getDeck(req.ownerId, req.params.id);
  if (!deck) return res.status(404).json({ error: "Deck not found." });
  res.json(deck);
});

router.delete("/decks/:id", (req, res) => {
  const removed = deleteDeck(req.ownerId, req.params.id);
  if (!removed) return res.status(404).json({ error: "Deck not found." });
  res.status(204).end();
});

export default router;
