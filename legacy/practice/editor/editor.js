function loadSavedText() {
	document.getElementsByClassName('editor')[0].innerText = localStorage.getItem('saved_text');
}

function saveText() {
	localStorage.setItem('saved_text', document.getElementsByClassName('editor')[0].innerText);
}

loadSavedText();
document.addEventListener('keyup', saveText, false);