/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/*.html"],
  theme: {
    fontFamily: {
        main: ["Sedan"],
        secondary: ["Courier Prime"],
    },
    
    extend: {
    colors: {
        'blue': '#6DD3CE',
        'lblue': '#91DEDA',
        'lgreen': '#C8E9A0',
        'llgreen': '#D9EFBD',
        'dgreen': '#397367',
        'red': '#A13D63',
        'purple': '#351E29',
        'lpurple': '#412533'
    },
    },
  },
  plugins: [],
}

