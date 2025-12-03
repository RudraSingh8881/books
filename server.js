require('dotenv').config();
const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();

// Environment
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME;
const COLLECTION_NAME = process.env.MONGO_COLLECTION_NAME;

let collection;
let usersCollection;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Explicit routes for frontend and API separation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/frontend', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to MongoDB
// Validate environment variables before attempting connection
if (!MONGO_URI || typeof MONGO_URI !== 'string' || !MONGO_URI.startsWith('mongodb')) {
  console.error('❌ Missing or invalid MONGO_URI environment variable. Set `MONGO_URI` to your MongoDB connection string.');
  process.exit(1);
}
if (!DB_NAME) {
  console.error('❌ Missing MONGO_DB_NAME environment variable.');
  process.exit(1);
}
if (!COLLECTION_NAME) {
  console.error('❌ Missing MONGO_COLLECTION_NAME environment variable.');
  process.exit(1);
}

MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
  .then(client => {
    const db = client.db(DB_NAME);
    collection = db.collection(COLLECTION_NAME);
    usersCollection = db.collection('users');
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

// User endpoints: store users in the `users` collection (passwords hashed)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

app.post('/api/users/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  try {
    const existing = await usersCollection.findOne({ username });
    if (existing) return res.status(409).json({ error: 'User already exists.' });
    const hashed = hashPassword(password);
    await usersCollection.insertOne({ username, password: hashed });
    res.status(201).json({ message: 'User created.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  try {
    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    const hashed = hashPassword(password);
    if (user.password !== hashed) return res.status(401).json({ error: 'Invalid credentials.' });
    res.json({ username });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' });
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
