# TrustingEyesEars

NOTE: In the userscript, when imgData is said to be an Array, it is actually a 'Uint8ClampedArray'. This might be worth naming properly in the documentation at some point.


To run:

<code>cd server</code>

<code>node index.js </code>

---

To compile styles from Tailwind classes:

<code>npx tailwindcss -i ./public/input.css -o ./public/output.css --watch</code>

---

To connect to database:

Create .env file in /server and write this in it (replacing {} for actual password)

<code>DB_PASSWORD={}</code>

