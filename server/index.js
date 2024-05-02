const path = require("path");

// Create express app
const express = require("express");
const app = express();

// Setup image saving to ./uploads with multer
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function(req, file, callback) {
    callback(null, 'uploads');
  },
	filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({storage: storage});

app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Server simple img upload page
app.get("/", (request, response) => {
    response.sendFile(path.join(__dirname, "views", "index.html"));
});

// Save posted files
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    console.log("No file received");
    return res.send({
      success: false
    });

  } else {
    console.log('file received');
    return res.send({
      success: true
    })
  }
});

// Start server
app.listen(3000, () => {
    console.log("Listen on the port 3000...");
});
