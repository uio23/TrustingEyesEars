// ==UserScript==
// @name         Image Verification
// @namespace    http://tampermonkey.net/
// @version      2024-04-10
// @description  Performs client-side image verification by calculating color averages and generating SHA-256 hashes.
// @author       Oleksandr Kashpir
// @match        https://www.publicdomainpictures.net/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict'; // Enable strict mode

    // Class representing the image and its properties
    class SubjectImage {
        constructor(imgData, width, height) { // Constructor to initialize the image object
            this.imgData = imgData; // Image data
            this.rgbaArray = imgData.data; // RGBA array of the image
            this.width = width; // Width of the image
            this.height = height; // Height of the image
        }

       /**
		* Returns the specified color value of the pixel at the given location in this image
		* https://stackoverflow.com/questions/30453726/how-do-i-access-change-pixels-in-a-javascript-image-object
		*
		* @param {char} color The desired color.
		* @param {number} x Pixel x co-ordinate.
		* @param {number} y Pixel y co-ordinate.
		* @return Value of the specified color of the pixel.
		*/
        getColorValue(color, x, y) {
            const idx = ((this.width * y) + x) * 4; // Calculate the index of the pixel in the RGBA array
            switch (color) {
                case 'r': return this.rgbaArray[idx]; // Red value
                case 'g': return this.rgbaArray[idx + 1]; // Green value
                case 'b': return this.rgbaArray[idx + 2]; // Blue value
                case 'a': return this.rgbaArray[idx + 3]; // Alpha value
                default: throw new Error("Invalid color character used for identification.");
            }
        }

<<<<<<< HEAD
        /**
		* Calculates the color average of the surrounding pixels in a cube
		* of specified size around a given target pixel location.
		*
		* @param {number} centerX Target pixel x co-ordinate.
		* @param {number} centerY Target pixel y co-ordinate.
		* @param {number} size Size of area to average.
		* @return An array containing the average rgba value around target pixel.
=======
		/**
			* Calculates the color average of the surrounding pixels in a cube
			* of specified size around a given target pixel location.
			*
			* @param {number} centerX Target pixel x co-ordinate.
			* @param {number} centerY Target pixel y co-ordinate.
			* @param {number} size Size of area to average.
			* @return An array containing the average rgba value around target pixel.
>>>>>>> main
		*/
        calculateAvg(centerX, centerY, size) {
            let redTotal = 0, greenTotal = 0, blueTotal = 0, alphaTotal = 0; // Initialize totals for each color channel
            let validcount = 0; // Count of valid pixels
            const startingX = centerX - size; // Starting X coordinate of the region
            const startingY = centerY - size; // Starting Y coordinate of the region
            const targetX = centerX + size; // Ending X coordinate of the region
            const targetY = centerY + size; // Ending Y coordinate of the region

            // Iterate over the region and accumulate color totals
            for (let x = startingX; x < targetX; x++) {
                for (let y = startingY; y < targetY; y++) {
                    if (x >= 0 && y >= 0 && x < this.width && y < this.height) { // Check if pixel is within image bounds
                        validcount++;
                        redTotal += this.getColorValue('r', x, y); // Accumulate red values
                        greenTotal += this.getColorValue('g', x, y); // Accumulate green values
                        blueTotal += this.getColorValue('b', x, y); // Accumulate blue values
                        alphaTotal += this.getColorValue('a', x, y); // Accumulate alpha values
                    }
                }
            }

            if (validcount === 0) return [0, 0, 0, 0]; // If no valid pixels found, return default color
            return [
                Math.round(redTotal / validcount), // Average red value
                Math.round(greenTotal / validcount), // Average green value
                Math.round(blueTotal / validcount), // Average blue value
                Math.round(alphaTotal / validcount) // Average alpha value
            ];
        }
    }

<<<<<<< HEAD
    /**
		* Calculates the SHA256 digest of a given string and returns its
		* hex string value.
=======
			// go across and down pixels in average square
			for (let x = startingX; x < targetX; x++) {
				for (let y = startingY; y < targetY; y++) {
					// skip if this pixel doesn't exit
					if (x <= 0 || y <= 0 || x > this.width || y > this.height) {
						continue;
					}
					// account for this pixels existence
					validcount++;

					// increment the rgba totals by the color values of this pixel
					redTotal += this.#getColorValue('r', x - 1, y - 1);
					greenTotal += this.#getColorValue('g', x - 1, y - 1);
					blueTotal += this.#getColorValue('b', x - 1, y - 1);
					alphaTotal += this.#getColorValue('a', x - 1, y - 1);
				}
			}

			// calc rgba averages to nearest whole
			let redAvg = Math.round(Number((redTotal / validcount)));
			let greenAvg = Math.round(Number((greenTotal / validcount)));
			let blueAvg = Math.round(Number((blueTotal / validcount)));
			let alphaAvg = Math.round(Number((alphaTotal / validcount)));

			// assemble the average pixel array
			let pixelAvg = [redAvg, greenAvg, blueAvg, alphaAvg];

			return pixelAvg ;
		}
	}

	const singleimg = document.querySelector("img");

	var canvas = document.createElement("canvas");
	var context = canvas.getContext('2d');

	/**
		* Calculates the SHA digest of a given String and returns its
		* hex String value.
>>>>>>> main
		*
		* @param {String} input The string to hash.
		* @return Hex string of the input's sha256 digest.
	*/
    async function getSHA256Hash(input) {
        const utf8 = new TextEncoder().encode(input); // Convert input to UTF-8 byte array
        const hashBuffer = await crypto.subtle.digest('SHA-256', utf8); // Compute SHA-256 hash
        return Array.from(new Uint8Array(hashBuffer)) // Convert hash buffer to array
                    .map(b => b.toString(16).padStart(2, '0')) // Convert bytes to hexadecimal and pad
                    .join(''); // Join hexadecimal strings
    }

    /**
		* Clones an image from the given source and a SubjectImage object of it once it loads. 
		*
		* @param {String} imgSrc URL of the relevant image.
		* @param {HtmlCanvasElement} canvas A canvas that the image can be drawn on.
		* @param {CanvasRenderingContext2D} context The drawing surface for the image. 
		*/
    function loadImage(imgSrc, canvas, context) {
        return new Promise((resolve, reject) => {
            const img = new Image(); // Create new image element
            img.crossOrigin = 'anonymous'; // Set crossOrigin attribute to anonymous
            img.src = imgSrc; // Set image source

            img.onload = () => { // Event listener for image load
                canvas.width = img.width; // Set canvas width to image width
                canvas.height = img.height; // Set canvas height to image height
                context.drawImage(img, 0, 0); // Draw image onto canvas
                const imgData = context.getImageData(0, 0, img.width, img.height); // Get image data
                resolve(new SubjectImage(imgData, img.width, img.height)); // Resolve promise with SubjectImage instance
            };

            img.onerror = reject; // Event listener for image load error
        });
    }

    /**
		* Calculates and returns the identification of the given subject image,
		* which consists of the corner and center pixel average hashes.
		*
		* @param {SubjectImage} subjectImg Subject image to calculate identification for.
		* @return The identification of the given subject image
<<<<<<< HEAD
		* */
    async function calculateID(subjectImg) {
        const idAvgSize = 25; // Size of the region for average color calculation
        const locations = [
            [idAvgSize, idAvgSize], // Top-left corner
            [subjectImg.width - idAvgSize, idAvgSize], // Top-right corner
            [idAvgSize, subjectImg.height - idAvgSize], // Bottom-left corner
            [subjectImg.width - idAvgSize, subjectImg.height - idAvgSize], // Bottom-right corner
            [Math.floor(subjectImg.width / 2), Math.floor(subjectImg.height / 2)] // Center
        ]; // Locations on the image to calculate the average colors
=======
		*
		*/
	async function calculateID(subjectImg) {
		let id = [];
>>>>>>> main

        const hashes = [];
        for (let location of locations) {
            const avgColors = subjectImg.calculateAvg(...location, idAvgSize); // Calculate average color at location
            const colorString = avgColors.join(','); // Convert average color array to string
            const hash = await getSHA256Hash(colorString); // Compute SHA-256 hash of color string
            hashes.push({ location, avgColors, hash }); // Push location, average colors, and hash to hashes array
        }

        console.log('Hashes and Average Colors:', hashes); // Log the hashes and average colors
        return hashes; // Return array of hashes
    }

    // Find the first image element on the page
    const singleImg = document.querySelector("img");
    const canvas = document.createElement("canvas"); // Create a canvas element
    const context = canvas.getContext('2d'); // Get 2D rendering context

    // If an image is found, load it and calculate its identification hashes
    if (singleImg) {
        loadImage(singleImg.src, canvas, context) // Load image
            .then(subjectImg => calculateID(subjectImg)) // Calculate identification hashes
            .catch(error => console.error('Image loading or processing failed:', error)); // Handle errors
    } else {
        console.log('No image found on the page to process.'); // Log if no image found
    }
})();
