const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const crypto = require("crypto");
const path = require("path");

const app = express();

const storage = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, "uploads");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));  // Ensure unique name
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, callback) {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|avif)$/)) {
            return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
    }
});

var morgan = require('morgan')
app.use(morgan("combined"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')))

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/upload", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "upload.html"));
});

app.get("/verify", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "verify.html"));
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({
            success: false,
            message: "No file uploaded"
        });
    } else {
        // Process image and calculate hash
        const imagePath = path.join(__dirname, req.file.path);
        sharp(imagePath)
            .raw()
            .toBuffer({ resolveWithObject: true })
            .then(({ data, info }) => {
                const idAvgSize = 50;
                const halfIdAvgSize = 25;
                const locations = [
                    [halfIdAvgSize, halfIdAvgSize],
                    [info.width - halfIdAvgSize, halfIdAvgSize],
                    [halfIdAvgSize, info.height - halfIdAvgSize],
                    [info.width - halfIdAvgSize, info.height - halfIdAvgSize],
                    [Math.round(info.width / 2), Math.round(info.height / 2)],
                ];

                const averages = locations.map(location => calculateAvg(data, info.width, location[0], location[1], idAvgSize));
                return Promise.all(averages);
            })
            .then(averages => {
                return Promise.all(averages.map(avg => getSHA256Hash(avg.join(','))));
            })
            .then(hashes => {
                console.log('SHA256 hashes of the image:', hashes);
								res.sendFile(path.join(__dirname, "views", "success.html"));
            })
            .catch(err => {
                console.error(err);
                res.status(500).send({
                    success: false,
                    message: "Failed to process image"
                });
            });
    }
});

function calculateAvg(data, width, centerX, centerY, size) {
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
            if (x <= 0 || y <= 0 || x > width || y > data.length / width) {
                continue;
            }
            validcount++;
            const idx = ((width * y) + x) * 4;
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

function getSHA256Hash(input) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        hash.update(input);
        const hashedValue = hash.digest('hex');
        resolve(hashedValue);
    });
}

app.listen(3000, () => {
    console.log("Server listening on port 3000...");
});
