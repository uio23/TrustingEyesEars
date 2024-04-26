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
	const singleImg = document.querySelector("img");

	var canvas = document.createElement("canvas");
	var context = canvas.getContext('2d');

	/**
		* Calculates the SHA256 digest of a given String and returns its
		* hex String value.
		*
		* @param {String} input The String to hash.
		* @return Hex String of the input's SHA256 digest.
		*/
	async function getSHA256Hash(input) {
		// Encode input as utf8
		const utf8 = new TextEncoder().encode(input);

		// Return digest converted to hex String
		return await crypto.subtle.digest("SHA-256", utf8).then((digestBuffer) => {
			// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#converting_a_digest_to_a_hex_string
			// convert resutling ArrayBuffer digest to Array
			const hashArray = Array.from(new Uint8Array(digestBuffer));
			// convert resulting Array to String
			const hash = hashArray.map((item) => item.toString(16).padStart(2, "0")).join("");

			return hash;
		});
	};


	// https://stackoverflow.com/questions/30453726/how-do-i-access-change-pixels-in-a-javascript-image-object
	/**
		* Returns the color value of a pixel at the given location in an image. 
		*
		* @param {Array} rgbaArray Array of all the rgba values in relevant image.
		* @param {number} imgWidth Width of the image. 
		* @param {char} color The desired color.
		* @param {number} x Pixel's x co-ordinate.
		* @param {number} y Pixel's y co-ordinate.
		* @return Value of the desired color of the pixel.
		*/
	function getColorValue(rgbaArray, imgWidth, color, x, y) {
		switch (color) {
			case 'r':
				return rgbaArray[((imgWidth * y) + x) * 4];
			case 'g':
				return rgbaArray[((imgWidth * y) + x) * 4 + 1];
			case 'b':
				return rgbaArray[((imgWidth * y) + x) * 4 + 2];
			case 'a':
				return rgbaArray[((imgWidth * y) + x) * 4 + 3];
			default:
				throw new Error();
		}
	}


	/**
		* Calculates the color average of the, at-most 2401 (49 x 49), pixels
		* in a cube around a given target pixel location.
		*
		* @param {Array} rgbaArray Array of all the rgba values in relevant image.
		* @param {number} imgWidth Width of the image.
		* @param {number} imgHeight Height of the image.
		* @param {number} centerX x co-ordinate of target pixel.
		* @param {number} centerY y co-ordinate of target pixel.
		* @return An Array containing the average rgba value around target pixel.
		*/
	function calculateAvg(rgbaArray, imgWidth, imgHeight, centerX, centerY) {
		var redAvg, greenAvg, blueAvg, alphaAvg;
		var avgPixel;

		var redTotal = 0;
		var greenTotal = 0;
		var blueTotal = 0;
		var alphaTotal = 0;

		// Track how many pixel actually exist in the average-square
		var validCount = 0;

		// Calc the top left 
		var startingX = centerX - 24;
		var startingY = centerY - 24
		// And bottom right
		var targetX = centerX + 24;
		var targetY = centerY + 24;
		// ...corners of average square

		// Go across and down pixels in average square
		for (let x = startingX; x < targetX; x++) {
			for (let y = startingY; y < targetY; y++) {
				// Skip if this pixel doesn't exit
				if (x <= 0 || y <= 0 || x > imgWidth || y > imgHeight) {
					continue;
				}
				// Account for this pixels existence
				validCount++;

				// increment the rgba totals by the color values of this pixel
				redTotal += getColorValue(rgbaArray, imgWidth, 'r', x - 1, y - 1);
				greenTotal += getColorValue(rgbaArray, imgWidth, 'g', x - 1, y - 1);
				blueTotal += getColorValue(rgbaArray, imgWidth, 'b', x - 1, y - 1);
				alphaTotal += getColorValue(rgbaArray, imgWidth, 'a', x - 1, y - 1);
			}
		}

		// Calc rgba averages to nearest whole
		redAvg = Math.round(Number((redTotal / validCount)));
		greenAvg = Math.round(Number((greenTotal / validCount)));
		blueAvg = Math.round(Number((blueTotal / validCount)));
		alphaAvg = Math.round(Number((alphaTotal / validCount)));

		// Assemble the average pixel Array
		avgPixel = [redAvg, greenAvg, blueAvg, alphaAvg];

		return avgPixel;
	}


	/**
		* Clones an image from the given source and calls subsequent examination
		* functions on it, once it loads.
		*
		* @param {String} imgSrc URL of the relevant image.
		* @param {HTMLCanvasElement} canvas A canvas that the image can be drawn on.
		* @param {CanvasRenderingContext2D} context The drawing surface for the image. 
		*/
	function loadImage(imgSrc, canvas, context) {
		var imgData;

		var img = new Image();

		// Avoid CORS violations
		img.crossOrigin = 'anonymous';
		
		img.src = imgSrc;
		img.onload = function() {
				// Adjust the canvas to fit the image
				canvas.width = img.width;
				canvas.height = img.height;

				// Draw the image onto the canvas's context
				context.drawImage(img, 0, 0);

				// extract the data of the image copy 
				imgData = context.getImageData(0, 0, img.width, img.height);

				// Calculate the averages and then verify them
				calculateAvgs(imgData.data, img.width, img.height).then((avgs) => {
					console.log("Verifying the following hashes, calculated from the averages:");
					console.log(avgs);
					//verifyAvgs(avgs);
				});
		}
	}


	/**
		* Calculates the average rgba values for the four corner pixels of the image
		* described by rgbaArray
		*
		* @param {Array} rgbaArray Array of all the rgba values in relevant image.
		* @param {number} imgWidth Width of the image.
		* @param {number} imgHeight Height of the image.
		* @return An Array containing the average rgba values around the image's
		*         corner pixels.
		*/
	async function calculateAvgs(rgbaArray, imgWidth, imgHeight) {
		var topLeft = calculateAvg(rgbaArray, imgWidth, imgHeight, 1, 1);
		var topRight = calculateAvg(rgbaArray, imgWidth, imgHeight, imgWidth, 1);
		var bottomLeft = calculateAvg(rgbaArray, imgWidth, imgHeight, 1, imgHeight);
		var bottomRight = calculateAvg(rgbaArray, imgWidth, imgHeight, imgWidth, imgHeight);

		console.log("The corner pixels average rgba values follow:");
		console.log(topLeft);
		console.log(topRight);
		console.log(bottomLeft);
		console.log(bottomRight);
		console.log("-----");

		topLeft = topLeft.toString();
		topRight = topRight.toString();
		bottomLeft = bottomLeft.toString();
		bottomRight = bottomRight.toString();

		console.log("Their string representations follow:");
		console.log("Top left: " + topLeft);
		console.log("Top right: " + topRight);
		console.log("Bottom left: " + bottomLeft);
		console.log("Bottom right: " + bottomRight);
		console.log("-----");

		topLeft = await getSHA256Hash(topLeft);
		topRight = await getSHA256Hash(topRight);
		bottomLeft = await getSHA256Hash(bottomLeft);
		bottomRight = await getSHA256Hash(bottomRight);

		return [topLeft, topRight, bottomLeft, bottomRight];
	}

	// Proccess the singular first image of on the webpage
	// Will get extended to loop through all images
	loadImage(singleImg.src, canvas, context);
})();
