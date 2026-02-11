window.openModal = () => document.getElementById('modal').classList.remove('hidden');
const form = document.getElementById('preForm');
if(form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        localStorage.setItem('preData', JSON.stringify({ cargo: document.getElementById('cargo').value }));
        window.location.href = 'register.html';
    });
}