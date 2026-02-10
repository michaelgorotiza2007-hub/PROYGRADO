function openModal() { document.getElementById('modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

// Asignar a window para que el HTML pueda llamar a estas funciones
window.openModal = openModal;
window.closeModal = closeModal;

const form = document.getElementById('preRegisterForm');
if(form){
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = { 
            cargo: document.getElementById('cargoPre').value,
            tipo: document.getElementById('tipoPre').value
        };
        localStorage.setItem('preData', JSON.stringify(data));
        window.location.href = 'register.html';
    });
}