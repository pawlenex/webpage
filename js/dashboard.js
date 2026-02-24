/* ============================================================
   PawLenx — Dashboard Logic
   Enterprise Pet Management System
   ============================================================ */

// ─── Auth Guard ───
if (!PawLenx.requireAuth()) {
    // Will redirect to login
}

// ─── State ───
let userPets = [];
let userActivities = [];
let userMeals = [];
let userScans = [];
let editingPetId = null;

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('topbar-user').textContent = PawLenx.getUser();
    document.getElementById('welcome-text').textContent = `Welcome back, ${PawLenx.getUser()}!`;

    initSidebarNav();
    loadDashboard();
});

// ─── Sidebar Navigation ───
function initSidebarNav() {
    const navItems = document.querySelectorAll('.dash-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const panel = item.dataset.panel;
            switchPanel(panel);
        });
    });
}

function switchPanel(panelName) {
    // Update sidebar
    document.querySelectorAll('.dash-nav-item').forEach(i => i.classList.remove('active'));
    const navItem = document.querySelector(`[data-panel="${panelName}"]`);
    if (navItem) navItem.classList.add('active');

    // Update panels
    document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`panel-${panelName}`);
    if (panel) panel.classList.add('active');

    // Populate pet selects when entering relevant panels
    if (['health', 'nutrition', 'activity'].includes(panelName)) {
        populatePetSelects();
    }
}

// ─── Load Dashboard Data ───
async function loadDashboard() {
    try {
        const data = await PawLenx.apiCall('/user/dashboard');
        if (!data) return;

        userPets = data.pets || [];

        // Load additional data from localStorage (client-side storage for activities/meals/scans)
        loadLocalData();

        // Update stats
        updateStats();

        // Render pets in overview
        renderPetGrid('overview-pet-grid', userPets.slice(0, 3));
        renderPetGrid('pets-grid', userPets);

        // Render activity feed
        renderActivityFeed();

        // Settings
        document.getElementById('settings-name').value = data.name || '';
        document.getElementById('settings-email').value = data.email || '';
        document.getElementById('settings-joined').value = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A';

    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

// ─── Local Data Management ───
function loadLocalData() {
    const userId = PawLenx.getUser();
    userActivities = JSON.parse(localStorage.getItem(`pawlenx_activities_${userId}`) || '[]');
    userMeals = JSON.parse(localStorage.getItem(`pawlenx_meals_${userId}`) || '[]');
    userScans = JSON.parse(localStorage.getItem(`pawlenx_scans_${userId}`) || '[]');
}

function saveLocalData() {
    const userId = PawLenx.getUser();
    localStorage.setItem(`pawlenx_activities_${userId}`, JSON.stringify(userActivities));
    localStorage.setItem(`pawlenx_meals_${userId}`, JSON.stringify(userMeals));
    localStorage.setItem(`pawlenx_scans_${userId}`, JSON.stringify(userScans));
}

// ─── Stats ───
function updateStats() {
    document.getElementById('stat-pets').textContent = userPets.length;
    document.getElementById('stat-scans').textContent = userScans.length;
    document.getElementById('stat-meals').textContent = userMeals.length;
    document.getElementById('stat-activities').textContent = userActivities.length;
}

// ─── Render Pet Grid ───
function renderPetGrid(containerId, pets) {
    const grid = document.getElementById(containerId);
    if (!grid) return;

    if (!pets || pets.length === 0) {
        grid.innerHTML = `
            <div class="dash-empty-state">
                <p style="font-size: 2rem; margin-bottom: 10px;">🐾</p>
                <p><strong>No pets registered yet</strong></p>
                <p>Click "Register New Pet" to add your furry friend.</p>
            </div>`;
        return;
    }

    const petEmojis = { Dog: '🐶', Cat: '🐱', Bird: '🐦', Fish: '🐠', Rabbit: '🐰', Other: '🐾' };
    const petColors = { Dog: '#e3f2fd', Cat: '#fce4ec', Bird: '#e8f5e9', Fish: '#e0f7fa', Rabbit: '#f3e5f5', Other: '#fff3e0' };

    grid.innerHTML = pets.map(pet => `
        <div class="pet-card">
            ${pet.photo && typeof pet.photo === 'string'
                ? `<img src="${pet.photo}" alt="${pet.name}" class="pet-card-photo">`
                : `<div class="pet-card-photo-placeholder" style="background: ${petColors[pet.type] || petColors.Other};">${petEmojis[pet.type] || petEmojis.Other}</div>`
            }
            <div class="pet-card-body">
                <span class="pet-badge ${(pet.type || 'other').toLowerCase()}">${pet.type || 'Pet'}</span>
                <h3>${pet.name}</h3>
                <p><strong>Breed:</strong> ${pet.breed}</p>
                <p><strong>Age:</strong> ${pet.age} years</p>
                ${pet.weight ? `<p><strong>Weight:</strong> ${pet.weight} lbs</p>` : ''}
                <div class="pet-card-actions">
                    <button class="pet-action-btn" onclick="quickScan('${pet.name}')">🔬 AI Scan</button>
                    <button class="pet-action-btn" onclick="quickMeal('${pet.name}')">🍖 Log Meal</button>
                    <button class="pet-action-btn" onclick="quickActivity('${pet.name}')">🏃 Activity</button>
                    <button class="pet-action-btn" onclick="openModal(${pet.id})">✏️ Edit</button>
                    <button class="pet-action-btn dash-danger-btn" onclick="deletePet(${pet.id})">🗑️ Delete</button>
                </div>
            </div>
        </div>
    `).join('');
// ─── Delete Pet ───
async function deletePet(petId) {
    if (!confirm('Are you sure you want to delete this pet? This cannot be undone.')) return;
    try {
        const data = await PawLenx.apiCall(`/user/pets/${petId}`, { method: 'DELETE' });
        if (data && data.success) {
            loadDashboard();
        } else {
            alert((data && data.error) || 'Failed to delete pet');
        }
    } catch (err) {
        alert('Failed to delete pet. Please try again.');
    }
}
}

// ─── Populate Pet Selects ───
function populatePetSelects() {
    const selects = ['health-pet-select', 'nutrition-pet-select', 'activity-pet-select'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const filteredPets = userPets.filter(p => p.type !== 'Bird' && p.type !== 'Rabbit');
        select.innerHTML = filteredPets.map(p => `<option value="${p.name}">${p.name} (${p.type})</option>`).join('');
        if (filteredPets.length === 0) {
            select.innerHTML = '<option value="">No pets registered</option>';
        }
    });
}

// ─── Quick Actions (from pet cards) ───
function quickScan(petName) {
    switchPanel('health');
    setTimeout(() => {
        const select = document.getElementById('health-pet-select');
        if (select) select.value = petName;
    }, 100);
}

function quickMeal(petName) {
    switchPanel('nutrition');
    setTimeout(() => {
        const select = document.getElementById('nutrition-pet-select');
        if (select) select.value = petName;
    }, 100);
}

function quickActivity(petName) {
    switchPanel('activity');
    setTimeout(() => {
        const select = document.getElementById('activity-pet-select');
        if (select) select.value = petName;
    }, 100);
}

// ─── AI Health Scanner ───
function runHealthScan() {
    const petSelect = document.getElementById('health-pet-select');
    const symptoms = document.getElementById('health-symptoms');
    const resultDiv = document.getElementById('health-result');

    if (!petSelect.value || !symptoms.value.trim()) {
        alert('Please select a pet and describe symptoms.');
        return;
    }

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p>🔄 Analyzing symptoms...</p>';

    // Simulated AI analysis (enterprise-ready placeholder for real AI integration)
    setTimeout(() => {
        const analysis = generateHealthAnalysis(petSelect.value, symptoms.value);
        resultDiv.innerHTML = analysis;

        // Save scan to history
        userScans.unshift({
            pet: petSelect.value,
            symptoms: symptoms.value,
            result: analysis,
            date: new Date().toISOString()
        });
        saveLocalData();
        updateStats();
        renderScanHistory();
        renderActivityFeed();
    }, 1500);
}

function generateHealthAnalysis(petName, symptoms) {
    const lowerSymptoms = symptoms.toLowerCase();
    let severity = 'Low';
    let recommendation = '';
    let analysis = '';

    if (lowerSymptoms.includes('vomit') || lowerSymptoms.includes('blood') || lowerSymptoms.includes('seizure')) {
        severity = 'High';
        recommendation = 'Seek immediate veterinary attention.';
        analysis = 'The symptoms described may indicate a serious medical condition.';
    } else if (lowerSymptoms.includes('scratch') || lowerSymptoms.includes('itch') || lowerSymptoms.includes('rash')) {
        severity = 'Medium';
        recommendation = 'Consider an allergy test. An oatmeal bath may provide temporary relief.';
        analysis = 'Symptoms suggest possible allergic reaction or dermatitis.';
    } else if (lowerSymptoms.includes('limp') || lowerSymptoms.includes('pain') || lowerSymptoms.includes('cry')) {
        severity = 'Medium';
        recommendation = 'Restrict activity and monitor. Schedule a vet visit within 24-48 hours.';
        analysis = 'Possible musculoskeletal issue or injury detected.';
    } else {
        severity = 'Low';
        recommendation = 'Monitor your pet over the next 24 hours. Keep them hydrated and comfortable.';
        analysis = 'Symptoms appear mild. Continue normal care routine.';
    }

    const severityColors = { High: '#d93025', Medium: '#f9a825', Low: '#2e7d32' };

    return `
        <h4>AI Health Assessment for ${petName}</h4>
        <p><strong>Severity:</strong> <span style="color: ${severityColors[severity]}; font-weight: 700;">${severity}</span></p>
        <p><strong>Analysis:</strong> ${analysis}</p>
        <p><strong>Recommendation:</strong> ${recommendation}</p>
        <p style="font-size: 0.8rem; color: #999; margin-top: 10px;">⚠️ This is an AI-assisted assessment. Always consult a licensed veterinarian for medical decisions.</p>
    `;
}

function renderScanHistory() {
    const container = document.getElementById('scan-history');
    if (!container) return;

    if (userScans.length === 0) {
        container.innerHTML = '<div class="dash-empty-state">No scans yet.</div>';
        return;
    }

    container.innerHTML = userScans.slice(0, 10).map(scan => `
        <div class="history-item">
            <div class="history-item-header">
                <strong>🔬 ${scan.pet}</strong>
                <span>${new Date(scan.date).toLocaleDateString()}</span>
            </div>
            <p>${scan.symptoms.substring(0, 80)}${scan.symptoms.length > 80 ? '...' : ''}</p>
        </div>
    `).join('');
}

// ─── Nutrition Logging ───
function logMeal() {
    const pet = document.getElementById('nutrition-pet-select').value;
    const type = document.getElementById('meal-type').value;
    const food = document.getElementById('meal-food').value;
    const portion = document.getElementById('meal-portion').value;

    if (!pet || !food) {
        alert('Please select a pet and enter food details.');
        return;
    }

    userMeals.unshift({
        pet,
        type,
        food,
        portion: portion || 'N/A',
        date: new Date().toISOString()
    });

    saveLocalData();
    updateStats();
    renderMealHistory();
    renderActivityFeed();

    // Clear form
    document.getElementById('meal-food').value = '';
    document.getElementById('meal-portion').value = '';
    alert(`Meal logged for ${pet}!`);
}

function renderMealHistory() {
    const container = document.getElementById('meal-history');
    if (!container) return;

    if (userMeals.length === 0) {
        container.innerHTML = '<div class="dash-empty-state">No meals logged yet.</div>';
        return;
    }

    container.innerHTML = userMeals.slice(0, 10).map(meal => `
        <div class="history-item">
            <div class="history-item-header">
                <strong>🍖 ${meal.pet} — ${meal.type}</strong>
                <span>${new Date(meal.date).toLocaleDateString()}</span>
            </div>
            <p>${meal.food} (${meal.portion}g)</p>
        </div>
    `).join('');
}

// ─── Activity Logging ───
function logActivity() {
    const pet = document.getElementById('activity-pet-select').value;
    const type = document.getElementById('activity-type').value;
    const duration = document.getElementById('activity-duration').value;
    const notes = document.getElementById('activity-notes').value;

    if (!pet || !duration) {
        alert('Please select a pet and enter duration.');
        return;
    }

    userActivities.unshift({
        pet,
        type,
        duration,
        notes,
        date: new Date().toISOString()
    });

    saveLocalData();
    updateStats();
    renderActivityHistory();
    renderActivityFeed();

    // Clear form
    document.getElementById('activity-duration').value = '';
    document.getElementById('activity-notes').value = '';
    alert(`Activity logged for ${pet}!`);
}

function renderActivityHistory() {
    const container = document.getElementById('activity-history');
    if (!container) return;

    if (userActivities.length === 0) {
        container.innerHTML = '<div class="dash-empty-state">No activities logged yet.</div>';
        return;
    }

    container.innerHTML = userActivities.slice(0, 10).map(act => `
        <div class="history-item">
            <div class="history-item-header">
                <strong>🏃 ${act.pet} — ${act.type}</strong>
                <span>${new Date(act.date).toLocaleDateString()}</span>
            </div>
            <p>${act.duration} minutes${act.notes ? ' — ' + act.notes : ''}</p>
        </div>
    `).join('');
}

// ─── Overview Activity Feed ───
function renderActivityFeed() {
    const container = document.getElementById('overview-activity');
    if (!container) return;

    // Combine all activities into one feed
    const allItems = [
        ...userActivities.map(a => ({ ...a, icon: '🏃', label: `${a.pet} — ${a.type} (${a.duration} min)` })),
        ...userMeals.map(m => ({ ...m, icon: '🍖', label: `${m.pet} — ${m.type}: ${m.food}` })),
        ...userScans.map(s => ({ ...s, icon: '🔬', label: `${s.pet} — Health Scan` }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allItems.length === 0) {
        container.innerHTML = '<div class="dash-empty-state">No recent activity yet. Start logging!</div>';
        return;
    }

    const bgColors = { '🏃': '#e8f5e9', '🍖': '#fff3e0', '🔬': '#e3f2fd' };

    container.innerHTML = allItems.slice(0, 8).map(item => `
        <div class="activity-item">
            <div class="activity-icon" style="background: ${bgColors[item.icon] || '#f5f5f5'};">${item.icon}</div>
            <div class="activity-text">
                <strong>${item.label}</strong>
            </div>
            <span class="activity-time">${timeAgo(item.date)}</span>
        </div>
    `).join('');
}

// ─── Time Ago Helper ───
function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

// ─── Modal ───
function openModal(petId) {
    const modal = document.getElementById('petModal');
    const header = modal.querySelector('.dash-modal-header h2');
    const submitBtn = modal.querySelector('.dash-modal-actions button[type="submit"]');
    const form = document.getElementById('pet-form');

    const preview = document.getElementById('photoPreview');
    const placeholder = document.getElementById('photoPlaceholder');
    const fileNameLabel = document.getElementById('photoFileName');

    if (petId) {
        // Edit mode
        editingPetId = petId;
        const pet = userPets.find(p => Number(p.id) === Number(petId));
        if (pet) {
            header.textContent = 'Edit Pet';
            submitBtn.textContent = 'Save Changes';

            form.petName.value = pet.name || '';
            form.petType.value = pet.type || 'Dog';
            form.petBreed.value = pet.breed || '';
            form.petAge.value = pet.age || '';
            form.petWeight.value = pet.weight || '';

            // Show existing photo if available
            if (pet.photo) {
                preview.src = pet.photo;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            } else {
                preview.style.display = 'none';
                placeholder.style.display = 'flex';
            }

            if (fileNameLabel) {
                fileNameLabel.textContent = '';
            }
        }
    } else {
        // Create mode
        editingPetId = null;
        header.textContent = 'Register Your Pet';
        submitBtn.textContent = 'Register Pet';
        form.reset();
        preview.style.display = 'none';
        placeholder.style.display = 'flex';
        if (fileNameLabel) {
            fileNameLabel.textContent = '';
        }
    }

    modal.classList.add('open');
}

function closeModal() {
    const modal = document.getElementById('petModal');
    const form = document.getElementById('pet-form');
    const preview = document.getElementById('photoPreview');
    const placeholder = document.getElementById('photoPlaceholder');
    const fileNameLabel = document.getElementById('photoFileName');

    editingPetId = null;
    form.reset();
    preview.style.display = 'none';
    placeholder.style.display = 'flex';

    if (fileNameLabel) {
        fileNameLabel.textContent = '';
    }

    modal.classList.remove('open');
}

// ─── Photo Preview ───
function previewPetPhoto(input) {
    const preview = document.getElementById('photoPreview');
    const placeholder = document.getElementById('photoPlaceholder');
    const fileNameLabel = document.getElementById('photoFileName');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);

        if (fileNameLabel) {
            fileNameLabel.textContent = input.files[0].name;
        }
    } else if (fileNameLabel) {
        fileNameLabel.textContent = '';
    }
}

// ─── Add / Edit Pet Form (with photo upload) ───
document.getElementById('pet-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = editingPetId ? 'Saving...' : 'Registering...';

    const formData = new FormData();
    formData.append('petName', document.getElementById('petName').value);
    formData.append('petType', document.getElementById('petType').value);
    formData.append('petBreed', document.getElementById('petBreed').value);
    formData.append('petAge', document.getElementById('petAge').value);
    formData.append('petWeight', document.getElementById('petWeight').value);

    const photoInput = document.getElementById('petPhoto');
    if (photoInput.files && photoInput.files[0]) {
        formData.append('petPhoto', photoInput.files[0]);
    }

    try {
        const endpoint = editingPetId ? `/user/pets/${editingPetId}` : '/user/pets';
        const method = editingPetId ? 'PUT' : 'POST';

        const data = await PawLenx.apiCall(endpoint, {
            method,
            body: formData
        });

        if (data && data.success) {
            closeModal();
            loadDashboard(); // Refresh everything
        } else {
            alert((data && data.error) || 'Failed to register pet');
        }
    } catch (err) {
        alert('Failed to register pet. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});
