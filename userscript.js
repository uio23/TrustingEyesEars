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

    function fetchStringFromRGBA(rgba) {
        let rgbaString = String(rgba[0]) + String(rgba[1]) + String(rgba[2]) + String(rgba[3]);

        return rgbaString;
    }

    // This could be done with async/await for better efficiency, maybe
    function getSHA256Hash(input) {
        // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#converting_a_digest_to_a_hex_string
        const utf8 = new TextEncoder().encode(input);
        return crypto.subtle.digest("SHA-256", utf8).then((hashBuffer) => {
           // convert resutling ArrayBuffer to Array
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            // convert resulting Array to string
            const hash = hashArray.map((item) => item.toString(16).padStart(2, "0")).join("");
            return hash;
        });
    };

    // https://stackoverflow.com/questions/30453726/how-do-i-access-change-pixels-in-a-javascript-image-object
    function getColorValue(imgWidth, rgbaArray, color, x, y) {
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


    function generateAvg(centerX, centerY, imgData, imgWidth, imgHeight) {
        var targetX = centerX + 24;
        var targetY = centerY + 24

        var redTotal = 0;
        var greenTotal = 0;
        var blueTotal = 0;
        var aTotal = 0;

        var redAvg, greenAvg, blueAvg, aAvg;
        var avgPixel;

        var validCount = 0;

        for (let x = centerX - 24; x < targetX; x++) {
            for (let y = centerY - 24; y < targetY; y++) {
                if (x <= 0 || y <= 0 || x > imgWidth || y > imgHeight) {
                    continue;
                }
                validCount++;

                redTotal += getColorValue(imgWidth, imgData, 'r', x - 1, y - 1);
                greenTotal += getColorValue(imgWidth, imgData, 'g', x - 1, y - 1);
                blueTotal += getColorValue(imgWidth, imgData, 'b', x - 1, y - 1);
                aTotal += getColorValue(imgWidth, imgData, 'a', x - 1, y - 1);
            }
        }

        redAvg = Number((redTotal / validCount).toPrecision(3));
        greenAvg = Number((greenTotal / validCount).toPrecision(3));
        blueAvg = Number((blueTotal / validCount).toPrecision(3));
        aAvg = Number((aTotal / validCount).toPrecision(3));

        avgPixel = [redAvg, greenAvg, blueAvg, aAvg];
        return avgPixel;
    }

    function initContext()
{
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext('2d');
    return [ctx, canvas];
}

function loadImage(imageSource, context, canvas)
{
    var imageObj = new Image();
    imageObj.crossOrigin = 'anonymous';
    imageObj.src = imageSource;
    imageObj.onload = function()
    {
        canvas.width = imageObj.width;
        canvas.height = imageObj.height;
        context.drawImage(imageObj, 0, 0);
        var imageData = context.getImageData(0,0,imageObj.width,imageObj.height);
        readImage(imageData, imageObj.width, imageObj.height);
    };


    return imageObj;
}

function readImage(imageData, w, h)
{
    var topLeft = generateAvg(1, 1, imageData.data, w, h);
    var topRight = generateAvg(w, 1, imageData.data, w, h);
    var bottomLeft = generateAvg(1, h, imageData.data, w, h);
    var bottomRight = generateAvg(w, h, imageData.data, w, h);

    console.log(topLeft);
    console.log(topRight);
    console.log(bottomLeft);
    console.log(bottomRight);

    var rgbaStringTL = fetchStringFromRGBA(topLeft);
    var rgbaStringTR = fetchStringFromRGBA(topRight);
    var rgbaStringBL = fetchStringFromRGBA(bottomLeft);
    var rgbaStringBR = fetchStringFromRGBA(bottomRight);

    console.log(rgbaStringTL);
    console.log(rgbaStringTR);
    console.log(rgbaStringBL);
    console.log(rgbaStringBR);

    getSHA256Hash(rgbaStringTL).then((result) => console.log(result));
    getSHA256Hash(rgbaStringTR).then((result) => console.log(result));
    getSHA256Hash(rgbaStringBL).then((result) => console.log(result));
    getSHA256Hash(rgbaStringBR).then((result) => console.log(result));
}

var c = initContext();
var imageObj = loadImage(singleImg.src, c[0], c[1]);



})();
