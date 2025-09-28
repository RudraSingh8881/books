require('dotenv').config();
const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const rateLimit = require('express-rate-limit');

const app = express();

// Environment
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME;
const COLLECTION_NAME = process.env.MONGO_COLLECTION_NAME;

let collection;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limit middleware (for /api)
//const apiLimiter = rateLimit({
 // windowMs: 15 * 60 * 1000,
 // max: 100,
 // message: { error: 'Too many requests. Please try again later.' }
//});
//app.use('/api', apiLimiter);

// Connect to MongoDB
MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
  .then(client => {
    const db = client.db(DB_NAME);
    collection = db.collection(COLLECTION_NAME);
    console.log(`✅ Connected to MongoDB: ${DB_NAME}`);
    app.listen(PORT, () => {
      console.log(`🚀 Server running: http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// API Routes
app.get('/api/books', async (req, res) => {
  try {
    const books = await collection.find().toArray();
    res.json(books);
  } catch {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

app.post('/api/books', async (req, res) => {
  const { title, author, price, description, image } = req.body;
  if (!title || !author || !price) {
    return res.status(400).json({ error: 'Title, author, and price are required.' });
  }
  try {
    const result = await collection.insertOne({ title, author, price, description, image });
    res.status(201).json({ _id: result.insertedId, title, author, price, description, image });
  } catch {
    res.status(500).json({ error: 'Failed to create book.' });
  }
});

app.put('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  const { title, author, price, description, image } = req.body;
  try {
    await collection.updateOne({ _id: new ObjectId(id) }, { $set: { title, author, price, description, image } });
    res.json({ _id: id, title, author, price, description, image });
  } catch {
    res.status(500).json({ error: 'Failed to update book.' });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await collection.deleteOne({ _id: new ObjectId(id) });
    res.json({ _id: id });
  } catch {
    res.status(500).json({ error: 'Failed to delete book.' });
  }
});
