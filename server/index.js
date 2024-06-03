const fs = require("fs");
const path = require("path");

// Cross-Origin Resource Sharing
const cors = require("cors");

// http server
const express = require("express");

// Server console logger
var morgan = require('morgan')

// Image upload and proccessing
const multer = require("multer");
const sharp = require("sharp");

// SHA256 hashing
const crypto = require("crypto");

// database connection
const { MongoClient } = require('mongodb');
// load db password from .env file
require('dotenv').config()



// --- Init server ---
const app = express();



// --- Set up mongoDB ---
const dbPassword = process.env.DB_PASSWORD;
const dbUri = "mongodb+srv://TrustEY:" + dbPassword + "@pictrust.kg3lirx.mongodb.net/?retryWrites=true&w=majority&appName=PicTrust";
const client = new MongoClient(dbUri);
const database = client.db("PicTrust");
const collection = database.collection("image_hashes");


/**
 * Writes the passed hashes to the "image_hashes" collection as a new document,
 * saving them under an "id_hashes" key.
 *
 * @param {Array} hashes The id hashes to write to db.
 */
async function writeDB(hashes) {
	await client.connect();
	collection.insertOne({"id_hashes": hashes});
}


/**
 * Fetches all documents in "image_hashes" collection.
 *
 * @return Array of all documents in "image_hashes collection.
 */
async function getDB() {
	await client.connect();
	let fg = await collection.find({}).toArray();
	return fg;
}



// --- Set up Mutler ---
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "uploads");
  },
	filename: (req, file, cb) => {
		// Ensure unique name
		cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
	storage: storage,
	fileFilter: (req, file, cb) => {
		console.log("asdfsdfsfsdfassd\nsdfasdas");
		// Accept only images
		if (!file.originalname.match(/\.(jpg|jpeg|png|gif|avif)$/)) {
			req.fileValidationError = "Image file required";
			return cb(null, false, req.fileValidationError);
		}
		cb(null, true);
	}
});



// --- Middle-ware ---
// Logs
app.use(morgan("combined"));

// File upload
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public folder
app.use(express.static(path.join(__dirname, 'public')))

// Cross-origin Resource sharing
app.use(cors());



// --- Routes ---
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/upload", (req, res) => {
	res.sendFile(path.join(__dirname, "views", "upload.html"));
});

app.post('/upload', upload.single('file'), async (req, res) => {
	// If a file was not uploaded or it isn't an image
	if (req.fileValidationError || !req.file) {
		res.sendFile(path.join(__dirname, "views", "failure.html"));
		return;
	}

	// Extract image data
	const imagePath = path.join(__dirname, req.file.path);
	const image = sharp(imagePath);

	// Contains WIDTH and HEIGHT
	const metadata = await image.metadata();
	// Contains RGBA VALUES
	const buffer = await image.raw().ensureAlpha().toBuffer();

	// Calculate id hashes and save them to db
	calculateID(metadata, buffer).then(id => {
		writeDB(id);
		// Remove uploaded file
		fs.unlink(imagePath, (err) => {});

		res.sendFile(path.join(__dirname, "views", "success.html"));
	});
});

app.post("/verify", async (req, res) => {
	// Extract id hashes from post request
	const hashes = req.body;
	// Fetch all image documents from db
	let images_hashes = await getDB();

	let known = 1;
	let identified = -1;

	// For every image document in db
	for (let j = 0; j < images_hashes.length; j++) {
		// Get its id_hashes Array
		let image_hashes = images_hashes[j]["id_hashes"];

		// For every one of its id hashes
		for (let i = 0; i < image_hashes.length; i++) {
			// Identify posted image hashes if one matches db id hash
			if(image_hashes[i] == hashes[i]) {
				identified = 1;
			}
			// If image already identified but a hash doesn't match its tampered
			else if((identified == 1) && (image_hashes[i] != hashes[i])) {
				res.send({"outcome": -1});
				return;
			}
			// Otherwise, mark image as unkown untill better known
			else {
				known = -1;
			}
		}

		// If image was never marked us unknown at this point, its verified
		if(known == 1) {
			res.send({"outcome": 1});
			return;
		}

		// Reset markers for comparision with next set of id_hashes in db
		identified = -1;
		known = 1;
	}
		
	res.send({"outcome": 0});
});

app.get("/demo", (req, res) => {
	res.sendFile(path.join(__dirname, "views", "demo.html"));
});



// --- Helper functions from userscript ---
/**
	* Calculates and returns the 5 identifying hashes of the given image,
	* which consist of 4 corner and 1 center rgba square average areas.
	*
	* @param {Object} dimentions Metadata of image containing its width & height
	* @param {Array} data RGBA values of image
	* @return The identification of the given image
	*/
async function calculateID(dimentions, data) {
	let id = [];

	// Define the id areas sizes
	const idAvgSize = 50;
	const halfIdAvgSize = 25;

	// Predefine x & y coordinates of the centers of the 5 id areas
	const locations = [
		[halfIdAvgSize, halfIdAvgSize],
		[dimentions.width - halfIdAvgSize, halfIdAvgSize],
		[halfIdAvgSize, dimentions.height - halfIdAvgSize],
		[dimentions.width - halfIdAvgSize, dimentions.height - halfIdAvgSize],
		[Math.round(dimentions.width / 2), Math.round(dimentions.height / 2)],
	]

	// Calculate the average rgba value around each id area
	for (let i = 0; i < locations.length; i++) {
		let avg = calculateAvg(data, dimentions.width, dimentions.height, locations[i][0], locations[i][1], idAvgSize);
		// Hash the average rgba value
		avg = avg.toString();
		avg = await getSHA256Hash(avg);

		// Add it to the id hashes Array
		id.push(avg);
	}

	return id;
}


/**
	* Calculates the color average of the surrounding pixels in a square
	* of specified size around a given target pixel location, for an image.
	*
	* @param {Array} data RGBA values of image
	* @param {Number} width Width of image
	* @param {Number} height Height of image
	* @param {Number} centerX Target pixel x co-ordinate.
	* @param {Number} centerY Target pixel y co-ordinate.
	* @param {Number} size Size of area to average.
	* @return An array containing the average rgba value around target pixel (including target pixel).
	*/
function calculateAvg(data, width, height, centerX, centerY, size) {
	var redTotal = 0;
	var greenTotal = 0;
	var blueTotal = 0;
	var alphaTotal = 0;

	// Track how many pixel actually exist in the average square
	var validcount = 0;

	// Calc top-left pixel
	var startingX = centerX - size;
	var startingY = centerY - size;
	// ...and bottom-right pixel
	var targetX = centerX + size;
	var targetY = centerY + size;
	// ...of the average square

	// Go across and down pixels in the average square
	for (let x = startingX; x < targetX; x++) {
		for (let y = startingY; y < targetY; y++) {
			// Skip if current pixel doesn't exit on the image
			if (x <= 0 || y <= 0 || x > width || y > height) {
				continue;
			}
			// Account for this pixel's existence
			validcount++;

			// Base value of pixel's rgba data
			const idx = ((width * (y - 1)) + (x - 1)) * 4;

			// Increment the rgba totals by the color values of this pixel
			redTotal += data[idx];
			greenTotal += data[idx + 1];
			blueTotal += data[idx + 2];
			alphaTotal += data[idx + 3];
		}
	}

	// Calc rgba averages to nearest whole
	let redAvg = Math.round(Number((redTotal / validcount)));
	let greenAvg = Math.round(Number((greenTotal / validcount)));
	let blueAvg = Math.round(Number((blueTotal / validcount)));
	let alphaAvg = Math.round(Number((alphaTotal / validcount)));

	// Assemble the average pixel array
	let pixelAvg = [redAvg, greenAvg, blueAvg, alphaAvg];

	return pixelAvg ;
}


/**
	* Calculates the SHA256 digest of a given String and returns its
	* hex String value.
	*
	* @param {String} input The String to hash.
	* @return Hex String of the input's SHA256 digest.
	*/
async function getSHA256Hash(input) {
	// encode input as utf8
	const utf8 = new TextEncoder().encode(input);

	// return digest converted to hex string
	return await crypto.subtle.digest("sha-256", utf8).then((digestBuffer) => {
		// convert resutling ArrayBuffer digest to an Array
		const hashArray = Array.from(new Uint8Array(digestBuffer));
		// convert resulting Array to a String
		const hash = hashArray.map((item) => item.toString(16).padStart(2, "0")).join("");

		return hash;
	});
};

 
// Lauch server
app.listen(3000, () => {
	console.log("Server listening on port 3000...");
});
