const fs = require("fs");
const path = require("path");

// https server
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

async function writeDB(hashes) {
	await client.connect();
	const database = client.db("PicTrust");
	const collection = database.collection("image_hashes");
	// insert hashes and close connection
	collection.insertOne({"id_hashes": hashes}).then( () => {
	});
}

async function getDB() {
	const database = client.db("PicTrust");
	const collection = database.collection("image_hashes");
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
		// Accept only images
		if ((!file.originalname.match(/\.(jpg|jpeg|png|gif|avif)$/)) || !file) {
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


// --- Routes ---
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/upload", (req, res) => {
	res.sendFile(path.join(__dirname, "views", "upload.html"));
});

app.get("/verify", (req, res) => {
	res.sendFile(path.join(__dirname, "views", "verify.html"));
});

app.post("/verify", async (req, res) => {
	const hashes = req.body;
	let images_hashes = await getDB();

	let whole = 1;
	let identified = -1;

	for (let j = 0; j < images_hashes.length; j++) {
		let image_hashes = images_hashes[j]["id_hashes"];
		for (let i = 0; i < image_hashes.length; i++) {
			console.log(image_hashes[i] + "->" + hashes[i]);
			if(image_hashes[i] == hashes[i]) {
				identified = 1;
			}
			else if((identified == 1) && (image_hashes[i] != hashes[i])) {
				res.send({"outcome": -1});
				return;
			}
			else {
				whole = -1;
			}
		}
			if(whole == 1) {
				res.send({"outcome": 1});
				return;
			}
		identified = -1;
		whole = 1;
	}
		
	res.send({"outcome": 0});
});

app.post('/upload', upload.single('file'), async (req, res) => {
	// If an image was not uploaded
	if (req.fileValidationError) {
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



// -- Helper functions from userscript
/**
	* Calculates and returns the identification of given image,
	* which consists of the corner and center pixel average hashes.
	*
	* @param {Object} dimentions Metadata of image containing its width & height
	* @param {Array} data RGBA values of image
	* @return The identification of the given image
	*
	*/
async function calculateID(dimentions, data) {
	let id = [];

	const idAvgSize = 50;
	const halfIdAvgSize = 25;

	const locations = [
		[halfIdAvgSize, halfIdAvgSize],
		[dimentions.width - halfIdAvgSize, halfIdAvgSize],
		[halfIdAvgSize, dimentions.height - halfIdAvgSize],
		[dimentions.width - halfIdAvgSize, dimentions.height - halfIdAvgSize],
		[Math.round(dimentions.width / 2), Math.round(dimentions.height / 2)],
	]

	for (let i = 0; i < locations.length; i++) {
		let avg = calculateAvg(data, dimentions.width, dimentions.height, locations[i][0], locations[i][1], idAvgSize);
		console.log(avg);
		avg = avg.toString();
		console.log(avg);
		avg = await getSHA256Hash(avg);
		console.log(avg);

		id.push(avg);
	}

	return id;
}

/**
	* Calculates the color average of the surrounding pixels in a cube
	* of specified size around a given target pixel location, for an image.
	*
	* @param {Array} data RGBA values of image
	* @param {Number} width Width of image
	* @param {Number} height Height of image
	* @param {Number} centerX Target pixel x co-ordinate.
	* @param {Number} centerY Target pixel y co-ordinate.
	* @param {Number} size Size of area to average.
	* @return An array containing the average rgba value around target pixel.
*/
function calculateAvg(data, width, height, centerX, centerY, size) {
	var redTotal = 0;
	var greenTotal = 0;
	var blueTotal = 0;
	var alphaTotal = 0;

	var validcount = 0;

	var startingX = centerX - size;
	var startingY = centerY - size;

	var targetX = centerX + size;
	var targetY = centerY + size;

	for (let x = startingX; x < targetX; x++) {
		for (let y = startingY; y < targetY; y++) {
			if (x <= 0 || y <= 0 || x > width || y > height) {
				continue;
			}
			validcount++;

			const idx = ((width * (y - 1)) + (x - 1)) * 4;
			redTotal += data[idx];
			greenTotal += data[idx + 1];
			blueTotal += data[idx + 2];
			alphaTotal += data[idx + 3];
		}
	}

	let redAvg = Math.round(Number((redTotal / validcount)));
	let greenAvg = Math.round(Number((greenTotal / validcount)));
	let blueAvg = Math.round(Number((blueTotal / validcount)));
	let alphaAvg = Math.round(Number((alphaTotal / validcount)));

	// Assemble the average pixel array
	return [redAvg, greenAvg, blueAvg, alphaAvg];
}

/**
	* Calculates the SHA256 digest of a given String and returns its
	* hex String value.
	*
	* @param {String} input The string to hash.
	* @return Hex string of the input's sha256 digest.
*/
async function getSHA256Hash(input) {
	// encode input as utf8
	const utf8 = new TextEncoder().encode(input);

	// return digest converted to hex string
	return await crypto.subtle.digest("sha-256", utf8).then((digestBuffer) => {
		// https://developer.mozilla.org/en-us/docs/web/api/subtlecrypto/digest#converting_a_digest_to_a_hex_string
		// convert resutling ArrayBuffer digest to array
		const hashArray = Array.from(new Uint8Array(digestBuffer));
		// convert resulting Array to String
		const hash = hashArray.map((item) => item.toString(16).padStart(2, "0")).join("");

		return hash;
	});
};

 
// Lauch server
app.listen(3000, () => {
	console.log("Server listening on port 3000...");
});
