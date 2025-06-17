const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const busRoutes = require("./routes/busRoutes");
const path = require('path');
const fs = require('fs');

const dotenv = require("dotenv");
dotenv.config();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

app.get("/", (req, res) => {
    res.send("Running");
});

mongoose.connect(process.env.MONGO_URL)
    .then(()=> console.log("Connected to MongoDB"))
    .catch((err)=> (console.log(err)));

app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/buses", busRoutes);

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

