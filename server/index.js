// Import required modules
const express = require("express"); // Framework for Node.js
const multer = require('multer'); // Middleware for handling multipart/form-data
const sharp = require('sharp'); // High-performance image processing library
const crypto = require('crypto'); // Module for cryptographic functions
const path = require("path"); // Module for handling file paths

// Create an Express application
const app = express();

// Define storage settings for multer
const storage = multer.diskStorage({
   destination: function(req, file, callback) {
       callback(null, 'uploads'); // Destination folder for uploaded files
   },
   filename: function (req, file, cb) {
       cb(null, Date.now() + path.extname(file.originalname)); // Ensure unique file names
   }
});

// Initialize multer with defined storage settings
const upload = multer({ storage: storage });

// Set up middleware for parsing JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define route for serving index.html
app.get("/", (req, res) => {
   res.sendFile(path.join(__dirname, "views", "index.html")); // Send index.html file
});

// Define route for handling file uploads
app.post('/upload', upload.single('file'), async (req, res) => {
   if (!req.file) {
       console.log("No file received");
       return res.send({ success: false }); // No file received, send response indicating failure
   } else {
       console.log('File received');
       try {
           const imagePath = path.join(__dirname, req.file.path); // Get path to uploaded image
           const image = sharp(imagePath); // Create a sharp object for processing the image
           const metadata = await image.metadata(); // Get metadata of the image
           const buffer = await image.raw().ensureAlpha().toBuffer(); // Convert image to buffer with alpha channel
           

           // Define locations on the image for calculating average colors and hashes
           const idAvgSize = 25; // Define the radius of the block, adjust if needed
           const locations = [
               [idAvgSize, idAvgSize], // Top left corner
               [metadata.width - idAvgSize, idAvgSize], // Top right corner
               [idAvgSize, metadata.height - idAvgSize], // Bottom left corner
               [metadata.width - idAvgSize, metadata.height - idAvgSize], // Bottom right corner
               [Math.floor(metadata.width / 2), Math.floor(metadata.height / 2)] // Center
           ];

           // Calculate hashes for the specified locations on the image
           const hashes = await calculateAndHash(buffer, metadata.width, metadata.height, locations, idAvgSize);
           console.log('Calculated Hashes:', hashes);
           return res.send({ success: true, hashes }); // Send success response with calculated hashes
       } catch (error) {
           console.error('Error processing image:', error);
           return res.status(500).send({ success: false, message: 'Error processing image' }); // Send error response
       }
   }
});

// Start the server and listen on port 3000
app.listen(3000, () => {
   console.log("Server listening on port 3000...");
});

// Function to calculate average colors and hashes for specified locations on the image
async function calculateAndHash(buffer, width, height, locations, size) {
   const results = [];
   for (const [centerX, centerY] of locations) {
       let redTotal = 0, greenTotal = 0, blueTotal = 0, alphaTotal = 0, count = 0;
       let startX = Math.max(centerX - size, 0);
       let startY = Math.max(centerY - size, 0);
       let endX = Math.min(centerX + size, width - 1);
       let endY = Math.min(centerY + size, height - 1);

       // Iterate over pixels in the specified area and accumulate color totals
       for (let y = startY; y <= endY; y++) {
           for (let x = startX; x <= endX; x++) {
               count++;
               const idx = ((y * width) + x) * 4;
               redTotal += buffer[idx];
               greenTotal += buffer[idx + 1];
               blueTotal += buffer[idx + 2];
               alphaTotal += buffer[idx + 3];
           }
       }

       // Calculate average color for the specified area
       if (count > 0) {
           const avgColors = [
               Math.round(redTotal / count),
               Math.round(greenTotal / count),
               Math.round(blueTotal / count),
               Math.round(alphaTotal / count)
           ];
           const colorString = avgColors.join(',');
           const hash = await createSHA256Hash(colorString); // Generate SHA-256 hash of the average color
           results.push({ hash, avgColors, locations}); // Push hash and average colors to results array
       } else {
           results.push({ hash: 'No valid pixels in area', avgColors: [] }); // No valid pixels in area
       }
   }
   return results; // Return array of calculated hashes and average colors
}

// Function to generate SHA-256 hash of the input data
async function createSHA256Hash(data) {
   const hash = crypto.createHash('sha256'); // Create SHA-256 hash object
   hash.update(data); // Update hash with input data
   return hash.digest('hex'); // Return hexadecimal representation of the hash
}
