// ==UserScript==
// @name         Image verification
// @namespace    http://tampermonkey.net/
// @version      2024-04-10
// @description  client side to image verification
// @author       Oleksandr Kashpir 1637705
// @match        https://www.publicdomainpictures.net/*
// @grant        none
// ==/UserScript==

(function() {
	'use strict';
	class SubjectImage {
		constructor(imgData, width, height) {
			this.imgData = imgData;
			this.rgbaArray = imgData.data;
			this.width = width;
			this.height = height;
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
		#getColorValue(color, x, y) {
			switch (color) {
				case 'r':
					return this.rgbaArray[((this.width * y) + x) * 4];
				case 'g':
					return this.rgbaArray[((this.width * y) + x) * 4 + 1];
				case 'b':
					return this.rgbaArray[((this.width * y) + x) * 4 + 2];
				case 'a':
					return this.rgbaArray[((this.width * y) + x) * 4 + 3];
				default:
					throw new Error("Invalid color char used for color identification.");
			}
		}

		/**
		* Calculates the color average of the surrounding pixels in a cube
		* of specified size around a given target pixel location.
		*
		* @param {number} centerX Target pixel x co-ordinate.
		* @param {number} centerY Target pixel y co-ordinate.
		* @param {number} size Size of area to average.
		* @return An array containing the average rgba value around target pixel.
		*/
		calculateAvg(centerX, centerY, size) {
			var redTotal = 0;
			var greenTotal = 0;
			var blueTotal = 0;
			var alphaTotal = 0;

			// track how many pixel actually exist in the average-square
			var validcount = 0;

			// calc the top left 
			var startingX = centerX - size;
			var startingY = centerY - size;
			// and bottom right
			var targetX = centerX + size;
			var targetY = centerY + size;
			// ...corners of average square

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
		* Calculates the SHA256 digest of a given string and returns its
		* hex string value.
		*
		* @param {String} input The String to hash.
		* @return Hex String of the input's SHA256 digest.
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

	/**
		* Clones an image from the given source and a SubjectImage object of it once it loads. 
		*
		* @param {String} imgSrc URL of the relevant image.
		* @param {HtmlCanvasElement} canvas A canvas that the image can be drawn on.
		* @param {CanvasRenderingContext2D} context The drawing surface for the image. 
		*/
	function loadImage(imgSrc, canvas, context) {
		return new Promise((resolve, reject) => {
			var img = new Image()

			// Avoid CORS violations
			img.crossOrigin = 'anonymous';

			img.src = imgSrc;

			img.onload = function() {
				// Adjust the canvas to fit the image
				canvas.width = img.width;
				canvas.height = img.height;

				// Draw the image onto the canvas's context
				context.drawImage(img, 0, 0);

				// Extract the data of the image copy 
				const imgData = context.getImageData(0, 0, img.width, img.height);

				resolve(new SubjectImage(imgData, img.width, img.height));
			}
			img.onerror = reject
		});
	}

	/**
		* Calculates and returns the identification of the given subject image,
		* which consists of the corner and center pixel average hashes.
		*
		* @param {SubjectImage} subjectImg Subject image to calculate identification for.
		* @return The identification of the given subject image
		* */
	async function calculateID(subjectImg) {
		let id = [];

		const idAvgSize = 50;
		const halfIdAvgSize = 25;

		const locations = [
			[halfIdAvgSize, halfIdAvgSize],
			[subjectImg.width - halfIdAvgSize, halfIdAvgSize],
			[halfIdAvgSize, subjectImg.height - halfIdAvgSize],
			[subjectImg.width - halfIdAvgSize, subjectImg.height - halfIdAvgSize],
			[Math.round(subjectImg.width / 2), Math.round(subjectImg.height / 2)],
		]

		for (let i = 0; i < locations.length; i++) {
			let avg = subjectImg.calculateAvg(locations[i][0], locations[i][1], idAvgSize);
			console.log(avg);
			avg = avg.toString();
			console.log(avg);
			avg = await getSHA256Hash(avg);
			console.log(avg);

			id.push(avg);
		}

		return id;
	}

	loadImage(singleimg.src, canvas, context).then(subjectImg => {
		calculateID(subjectImg).then(id => {
			console.log(id);
		});
	});
})();
