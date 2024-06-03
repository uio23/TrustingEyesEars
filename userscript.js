// ==UserScript==
// @name         PicTrust Verifier
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Client-side to the PicTrust image verification ecosystem
// @author       Oleksandr Kashpir
// @include      https://*
// @include      http://*
// @grant        none
// ==/UserScript==

(function() {
	'use strict';
	/**
		* A custom image class that represents an `Image` object with some of its data,
		* also containing a set of functions for calculating pixel averages within that image.
		*/
	class SubjectImage {
		/**
			* Initializes this subjectImage's fields to the data extracted from an `Image` object.
			*
			* @param {Array} rgbaArray Pixel data of the image.
			* @param {number} width Width of the image.
			* @param {number} height Height of the image.
			*/
		constructor(rgbaArray, width, height) {
			this.rgbaArray = rgbaArray;
			this.width = width;
			this.height = height;
		}


		/**
			* Returns the specified color value of the pixel at the given location in this image
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
			* Calculates the color average of the surrounding pixels in a square
			* of specified size around a given target pixel location.
			*
			* @param {number} centerX Target pixel x co-ordinate.
			* @param {number} centerY Target pixel y co-ordinate.
			* @param {number} size Size of area square to average.
			* @return An array containing the average rgba value around target pixel (including target pixel).
			*/
		calculateAvg(centerX, centerY, size) {
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
					if (x <= 0 || y <= 0 || x > this.width || y > this.height) {
						continue;
					}
					// Account for this pixel's existence
					validcount++;

					// Increment the rgba totals by the color values of this pixel
					redTotal += this.#getColorValue('r', x - 1, y - 1);
					greenTotal += this.#getColorValue('g', x - 1, y - 1);
					blueTotal += this.#getColorValue('b', x - 1, y - 1);
					alphaTotal += this.#getColorValue('a', x - 1, y - 1);
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
	}



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

		// Return digest converted to hex string
		return await crypto.subtle.digest("sha-256", utf8).then((digestBuffer) => {
			// Convert resutling ArrayBuffer digest to an Array
			const hashArray = Array.from(new Uint8Array(digestBuffer));
			// Convert resulting Array to a String
			const hash = hashArray.map((item) => item.toString(16).padStart(2, "0")).join("");

			return hash;
		});
	};


	/**
		* Clones an image from the passed source and creates a SubjectImage object of it once it loads.
		*
		* @param {String} imgSrc URL of the relevant image.
		* @param {HtmlCanvasElement} canvas A canvas that the image can be drawn on.
		* @param {CanvasRenderingContext2D} context The drawing surface for the image.
    * @return A promise that resolves to a new SubjectImage created from passed source.
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

				resolve(new SubjectImage(imgData.data, img.width, img.height));
			}
			img.onerror = reject
		});
	}


    /**
    	* Verifies the passed Array of id hashes with the PicTrust server.
    	*
    	* @param {Array} hashes The Array of hashes to verify.
    	* @return A promise that resolves to the server's response body.
    	*/
    async function verifyID(hashes) {
        // The request specifications
        let options = {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            // Include hashes in body of request
            body: JSON.stringify({
                0: hashes[0],
                1: hashes[1],
                2: hashes[2],
                3: hashes[3],
                4: hashes[4]
            })
        };

        // Make request to the /verify endpoint
        let response = await fetch('http://localhost:3000/verify', options);

        // Return the response's data promise
        return response.json();
    }


	/**
		* Calculates and returns the 5 identifying hashes of the given SubjectImage,
		* which consist of 4 corner and 1 center rgba square average areas.
		*
		* @param {SubjectImage} subjectImg Subject image to calculate identification for.
		* @return The identification of the given subject image
		*/
	async function calculateID(subjectImg) {
		let id = [];

		// Define the id areas sizes
		const idAvgSize = 50;
		const halfIdAvgSize = 25;

		// Predefine x & y coordinates of the centers of the 5 id areas
		const locations = [
			[halfIdAvgSize, halfIdAvgSize],
			[subjectImg.width - halfIdAvgSize, halfIdAvgSize],
			[halfIdAvgSize, subjectImg.height - halfIdAvgSize],
			[subjectImg.width - halfIdAvgSize, subjectImg.height - halfIdAvgSize],
			[Math.round(subjectImg.width / 2), Math.round(subjectImg.height / 2)],
		]

		// Calculate the average rgba value around each id area
		for (let i = 0; i < locations.length; i++) {
			let avg = subjectImg.calculateAvg(locations[i][0], locations[i][1], idAvgSize);
      // Hash the average rgba value
			avg = avg.toString();
			avg = await getSHA256Hash(avg);

			// Add it to the id hashes Array
			id.push(avg);
		}

		return id;
	}


    /**
    	* Attaches a FontAwesome icon to the specified Image object on the page,
    	* the icon depends on the verification status of the image.
    	*
    	* @param {Image} image The relevant image from webpage.
    	* @param {number} status The image's verification status.
    	*/
    function attachIcon(image, status) {
        // Create a new i tag for the icon
        const icon = document.createElement("i");
        // ...and a new span to house the image and icon together
        const host = document.createElement("span");

        let color;

        switch(status) {
            // Tampered status grants a red X mark
            case -1:
                icon.classList="fa-solid fa-xl fa-square-xmark";
                color = "#A13D63";
                break;
            // Unidentified status grants a yellow ? mark
            case 0:
                icon.classList="fa-regular fa-xl fa-circle-question";
                color = "#F9DC5C";
                break;
            // Verified status grants a green Check mark
            case 1:
                icon.classList="fa-regular fa-xl fa-square-check";
                color = "#397367";
                break;
        }

        // Set the icon to be appropriately colored and positioned in the bottom right of the image
        icon.style=`color: ${color}; position: absolute; top: ${image.height - 20}px; left: ${image.width - 30}px `;
        // Position the hosting span relaively
        host.style ="position: relative;"

        // Append the hosting span to the parent of the image
        image.parentElement.append(host)

        // Append both icon and image to the span
        host.append(image);
        host.append(icon);
    }


    // Select all the images on the site
	const allImages = document.querySelectorAll("img");

    // Create a virtal canvas and context
	var canvas = document.createElement("canvas");
	var context = canvas.getContext('2d');

    // Create a new script tag for the FontAwesome resource
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.crossorigin = "anonymous";


    // Define callback to proccess all images once the script loads
    script.onload = function(){
        for(let i = 0; i < allImages.length; i++) {
            let image = allImages[i];
            if (image.height >= 112 && image.width >=112) {
                // For each reasonably sized image
                loadImage(image.src, canvas, context).then(subjectImg => {
                    // Calc its ID
                    calculateID(subjectImg).then(id => {
                        // Verify that ID
                        verifyID(id).then(res => {
                            // Attach a FontAwesome icon based on verification outcome
                            attachIcon(image, res.outcome);
                        });
                    });
                });
            }
        }
    };


    // Link script to FontAwsome kit
    script.src = 'https://kit.fontawesome.com/7dfc14ad36.js';
    // ...and append it to the head of the webpage
    document.getElementsByTagName('head')[0].appendChild(script);
})();
