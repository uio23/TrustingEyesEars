const otherPages = document.querySelectorAll('.other');
const currentPage = document.querySelector('#current');

otherPages.forEach(otherPage => {
    otherPage.addEventListener('mouseover', () => {
        currentPage.classList.remove('underline');
    });
    otherPage.addEventListener('mouseout', () => {
        currentPage.classList.add('underline');
    });
});
