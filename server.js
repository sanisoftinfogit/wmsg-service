require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const loginRoutes = require('./routes/loginRoutes');
const sessionRoutes = require('./routes/sessionRoutes');

app.use(cors()); // <-- allow all origins (for dev)
app.use(express.json());

// Routes
app.use('/api', loginRoutes);
app.use('/api', sessionRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});
