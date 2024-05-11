const fileUpload = document.querySelector('#fileUpload');
const uploadButton = document.querySelector('#uploadButton');
const uploadButtons = document.querySelector('#uploadButtons');
const submitButton = document.querySelector('#submitButton');
const otherPages = document.querySelectorAll('.other');
const currentPage = document.querySelector('#current');

fileUpload.onchange = () => {
  let src = URL.createObjectURL(fileUpload.files[0]);
  let img = document.getElementById('image');
  img.src = src;
  img.classList = "block mx-auto mb-4";
  uploadButtons.classList.add("justify-between");
  submitButton.classList.remove("hidden");
}
uploadButton.onclick = () => {
    fileUpload.click();
}

otherPages.forEach(otherPage => {
    otherPage.addEventListener('mouseover', () => {
        currentPage.classList.remove('underline');
    });
    otherPage.addEventListener('mouseout', () => {
        currentPage.classList.add('underline');
    });
});
