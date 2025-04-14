// Global variable holding the selected environment's name
let currentEnvName = null;
let allPackages = [];
let currentToastTimeout = null;
let packageToUninstall = null;
let selectedPackages = new Set(); // Store selected package names

// Bootstrap Toast instance
let toastEl;
let toastInstance;

// On window load, fetch the initial list of environments and set up UI
window.onload = function () {
    loadEnvironmentList();

    // Initialize toasts
    toastEl = document.getElementById('notificationToast');
    toastInstance = new bootstrap.Toast(toastEl);

    // Set up search functionality for packages
    document.getElementById('packageSearchInput').addEventListener('input', function () {
        filterPackages(this.value);
    });

    // Add event listener for bulk action dropdown
    document.getElementById('bulkActionBtn').addEventListener('click', function () {
        updateBulkActionState();
    });
};

// Show notification with toast
function showNotification(title, message, type = 'info') {
    // Clear any existing timeout
    if (currentToastTimeout) {
        clearTimeout(currentToastTimeout);
    }

    document.getElementById('toastTitle').innerText = title;
    document.getElementById('toastMessage').innerText = message;

    // Set toast color based on type
    toastEl.className = 'toast';
    if (type === 'success') {
        toastEl.classList.add('bg-success', 'text-white');
    } else if (type === 'error') {
        toastEl.classList.add('bg-danger', 'text-white');
    } else if (type === 'warning') {
        toastEl.classList.add('bg-warning');
    } else {
        toastEl.classList.add('bg-info', 'text-white');
    }

    toastInstance.show();

    // Auto-hide after 3 seconds
    currentToastTimeout = setTimeout(() => {
        toastInstance.hide();
    }, 3000);
}

function loadEnvironmentList() {
    showLoading(true);
    eel.list_envs()(function (envs) {
        const envListDiv = document.getElementById("envList");
        envListDiv.innerHTML = "";

        if (envs.length === 0) {
            envListDiv.innerHTML = `<div class="text-center text-muted p-3">No environments found.</div>`;
            showLoading(false);
            return;
        }

        envs.forEach(env => {
            const button = document.createElement("button");
            button.className = "list-group-item list-group-item-action";
            if (currentEnvName === env.name) {
                button.classList.add("active");
            }
            button.innerText = env.name;
            button.onclick = function () {
                selectEnvironment(env.name);
            };
            envListDiv.appendChild(button);
        });
        showLoading(false);
    });
}

function selectEnvironment(envName) {
    // Clear selected packages when changing environments
    selectedPackages.clear();

    currentEnvName = envName;

    // Update selected environment in sidebar
    const envButtons = document.querySelectorAll("#envList button");
    envButtons.forEach(btn => {
        btn.classList.remove("active");
        if (btn.innerText === envName) {
            btn.classList.add("active");
        }
    });

    document.getElementById("envTitle").innerText = envName;

    // Fetch environment path from Python
    eel.copy_env_path(envName)(function (path) {
        document.getElementById("envPath").innerText = "Path: " + path;
    });

    // Enable buttons
    document.getElementById("terminalBtn").disabled = false;
    document.getElementById("copyPathBtn").disabled = false;
    document.getElementById("deleteEnvBtn").disabled = false;
    document.getElementById("exportEnvBtn").disabled = false;
    document.getElementById("bulkActionBtn").disabled = true;

    // Populate library list
    updateLibraries();
}

function updateLibraries() {
    if (!currentEnvName) return;

    showLoading(true);
    eel.list_libraries(currentEnvName)(function (libs) {
        allPackages = libs;
        renderPackageList(libs);
        showLoading(false);
    });
}

function renderPackageList(libs) {
    const libListDiv = document.getElementById("libList");
    libListDiv.innerHTML = "";

    if (libs.length === 0) {
        libListDiv.innerHTML = `<div class="text-center empty-package-message">
            <i class="bi bi-inbox-fill"></i>
            <p class="mt-2">No packages installed.</p>
        </div>`;
        updateBulkActionState();
        return;
    }

    libs.forEach(lib => {
        const libItem = document.createElement("div");
        libItem.className = "list-group-item library-entry";

        // Add checkbox for selection
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "form-check-input package-checkbox me-2";
        checkbox.dataset.packageName = lib.name;
        checkbox.checked = selectedPackages.has(lib.name);
        checkbox.addEventListener("change", function () {
            if (this.checked) {
                selectedPackages.add(lib.name);
            } else {
                selectedPackages.delete(lib.name);
            }
            updateBulkActionState();
        });

        const checkboxWrapper = document.createElement("div");
        checkboxWrapper.className = "d-flex align-items-center";
        checkboxWrapper.appendChild(checkbox);

        const libNameSpan = document.createElement("div");
        libNameSpan.innerHTML = `<strong>${lib.name}</strong> <span class="badge bg-light text-dark ms-2">${lib.version}</span>`;

        checkboxWrapper.appendChild(libNameSpan);
        libItem.appendChild(checkboxWrapper);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-sm btn-outline-danger";
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.onclick = function () {
            confirmUninstallLibrary(lib.name);
        };
        libItem.appendChild(deleteBtn);

        libListDiv.appendChild(libItem);
    });

    updateBulkActionState();
}

function updateBulkActionState() {
    const bulkActionBtn = document.getElementById('bulkActionBtn');
    const selectAllCheckbox = document.getElementById('selectAllPackages');

    if (selectedPackages.size > 0) {
        bulkActionBtn.disabled = false;
        document.getElementById('selectedPackageCount').textContent = selectedPackages.size;
    } else {
        bulkActionBtn.disabled = true;
        document.getElementById('selectedPackageCount').textContent = "0";
    }

    // Update "Select All" checkbox state
    if (allPackages.length > 0) {
        selectAllCheckbox.disabled = false;
        selectAllCheckbox.checked = selectedPackages.size === allPackages.length;
    } else {
        selectAllCheckbox.disabled = true;
        selectAllCheckbox.checked = false;
    }
}

function selectAllPackages(checkbox) {
    if (!allPackages.length) return;

    if (checkbox.checked) {
        // Select all packages
        allPackages.forEach(pkg => {
            selectedPackages.add(pkg.name);
        });
    } else {
        // Deselect all packages
        selectedPackages.clear();
    }

    // Re-render to update checkboxes
    renderPackageList(allPackages);
}

function filterPackages(query) {
    if (!allPackages.length) return;

    if (!query) {
        renderPackageList(allPackages);
        return;
    }

    const filteredPackages = allPackages.filter(pkg =>
        pkg.name.toLowerCase().includes(query.toLowerCase()));

    renderPackageList(filteredPackages);
}

function createNewEnv() {
    const envName = document.getElementById("newEnvName").value.trim();
    if (!envName) {
        showNotification("Error", "Please enter an environment name.", "error");
        return;
    }

    showLoading(true);
    eel.create_env(envName)(function (response) {
        showLoading(false);

        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('newEnvModal')).hide();

        // Clear input
        document.getElementById("newEnvName").value = "";

        if (response.includes("already exists")) {
            showNotification("Error", response, "error");
        } else {
            showNotification("Success", `Environment "${envName}" created successfully`, "success");
            loadEnvironmentList();
        }
    });
}

function confirmDeleteEnv() {
    if (!currentEnvName) return;

    // Set up modal
    document.getElementById("deleteEnvName").textContent = currentEnvName;

    // Show modal
    new bootstrap.Modal(document.getElementById('deleteEnvModal')).show();
}

function deleteEnv() {
    if (!currentEnvName) return;

    showLoading(true);
    eel.delete_env(currentEnvName)(function (response) {
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('deleteEnvModal')).hide();

        showNotification("Success", `Environment "${currentEnvName}" deleted.`, "success");

        // Refresh the list of environments
        loadEnvironmentList();

        // Clear environment details
        currentEnvName = null;
        document.getElementById("envTitle").innerText = "Select an Environment";
        document.getElementById("envPath").innerText = "Path: Not selected";
        document.getElementById("libList").innerHTML = "";

        showLoading(false);
    });
}

function copyEnvPath() {
    if (!currentEnvName) return;

    eel.copy_env_path(currentEnvName)(function (path) {
        navigator.clipboard.writeText(path)
            .then(() => {
                showNotification("Copied", "Path copied to clipboard!", "success");
            })
            .catch(err => {
                showNotification("Error", "Failed to copy: " + err, "error");
            });
    });
}

function confirmInstallLibrary() {
    if (!currentEnvName) {
        showNotification("Error", "Please select an environment first.", "error");
        return;
    }

    const libName = document.getElementById("libraryName").value.trim();
    if (!libName) {
        showNotification("Error", "Please enter a package name.", "error");
        return;
    }

    // Set up modal
    document.getElementById("packageToInstall").textContent = libName;
    document.getElementById("envForInstall").textContent = currentEnvName;

    // Show modal
    new bootstrap.Modal(document.getElementById('installPackageModal')).show();
}

function installLibrary() {
    if (!currentEnvName) return;

    const libName = document.getElementById("libraryName").value.trim();
    if (!libName) return;

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('installPackageModal')).hide();

    showLoading(true);
    eel.install_library(currentEnvName, libName)(function (response) {
        if (response.includes("Installed")) {
            showNotification("Success", `Installed ${libName} successfully.`, "success");
            document.getElementById("libraryName").value = "";
        } else {
            showNotification("Error", response, "error");
        }

        // Refresh library list
        updateLibraries();
    });
}

function confirmUninstallLibrary(libName) {
    if (!currentEnvName) return;

    // Save package name for later use in uninstall function
    packageToUninstall = libName;

    // Set up modal
    document.getElementById("packageToUninstall").textContent = libName;
    document.getElementById("envForUninstall").textContent = currentEnvName;

    // Show modal
    new bootstrap.Modal(document.getElementById('uninstallPackageModal')).show();
}

function uninstallLibrary() {
    if (!currentEnvName || !packageToUninstall) return;

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('uninstallPackageModal')).hide();

    showLoading(true);
    eel.uninstall_library(currentEnvName, packageToUninstall)(function (response) {
        if (response.includes("Uninstalled")) {
            showNotification("Success", response, "success");
        } else {
            showNotification("Error", response, "error");
        }

        // Clear the package name
        packageToUninstall = null;

        // Refresh library list
        updateLibraries();
    });
}

function exportEnvironment() {
    if (!currentEnvName) return;

    // Show export modal
    document.getElementById("exportFileName").value = `${currentEnvName}_requirements.txt`;
    new bootstrap.Modal(document.getElementById('exportEnvModal')).show();
}

function exportEnv() {
    if (!currentEnvName) return;

    const fileName = document.getElementById("exportFileName").value.trim() || "requirements.txt";

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('exportEnvModal')).hide();

    showLoading(true);
    eel.export_environment(currentEnvName, fileName)(function (response) {
        if (response.includes("Error")) {
            showNotification("Error", response, "error");
        } else {
            showNotification("Success", response, "success");
        }
        showLoading(false);
    });
}

function confirmBulkUninstall() {
    if (!currentEnvName || selectedPackages.size === 0) return;

    // Set up modal
    document.getElementById("bulkPackageCount").textContent = selectedPackages.size;
    document.getElementById("bulkEnvForUninstall").textContent = currentEnvName;

    // Show modal
    new bootstrap.Modal(document.getElementById('bulkUninstallPackagesModal')).show();
}

function bulkUninstallPackages() {
    if (!currentEnvName || selectedPackages.size === 0) return;

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('bulkUninstallPackagesModal')).hide();

    showLoading(true);

    // Convert Set to Array for iteration
    const packages = Array.from(selectedPackages);
    let completedCount = 0;
    let successCount = 0;
    let errorMessages = [];

    // Process each package one by one
    function processNextPackage(index) {
        if (index >= packages.length) {
            // All packages processed
            selectedPackages.clear();
            updateLibraries();
            showNotification(
                "Bulk Uninstall",
                `Completed: ${successCount} of ${packages.length} packages uninstalled successfully.`,
                successCount === packages.length ? "success" : "warning"
            );
            return;
        }

        eel.uninstall_library(currentEnvName, packages[index])(function (response) {
            completedCount++;

            if (response.includes("Uninstalled")) {
                successCount++;
            } else {
                errorMessages.push(`Failed to uninstall ${packages[index]}: ${response}`);
            }

            // Process next package
            processNextPackage(index + 1);
        });
    }

    // Start processing packages
    processNextPackage(0);
}

function exportSelectedPackages() {
    if (!currentEnvName || selectedPackages.size === 0) return;

    // Show export selected modal
    document.getElementById("exportSelectedFileName").value = `${currentEnvName}_selected_packages.txt`;
    document.getElementById("selectedPackagesCount").textContent = selectedPackages.size;
    new bootstrap.Modal(document.getElementById('exportSelectedPackagesModal')).show();
}

function exportSelected() {
    if (!currentEnvName || selectedPackages.size === 0) return;

    const fileName = document.getElementById("exportSelectedFileName").value.trim() || "selected_packages.txt";

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('exportSelectedPackagesModal')).hide();

    showLoading(true);

    // Create content for the file
    const packages = Array.from(selectedPackages);
    let fileContent = "";

    // Look up versions from allPackages
    packages.forEach(pkgName => {
        const pkg = allPackages.find(p => p.name === pkgName);
        if (pkg) {
            fileContent += `${pkg.name}==${pkg.version}\n`;
        }
    });

    // Use a hidden form to submit the content to Python for saving
    const form = document.createElement('form');
    form.method = 'post';
    form.style.display = 'none';

    const contentInput = document.createElement('input');
    contentInput.name = 'content';
    contentInput.value = fileContent;
    form.appendChild(contentInput);

    const filenameInput = document.createElement('input');
    filenameInput.name = 'filename';
    filenameInput.value = fileName;
    form.appendChild(filenameInput);

    document.body.appendChild(form);

    // Use eel to save the file
    eel.save_selected_packages(fileContent, fileName)(function (response) {
        if (response.includes("Error")) {
            showNotification("Error", response, "error");
        } else {
            showNotification("Success", response, "success");
        }
        showLoading(false);
    });

    document.body.removeChild(form);
}

function showLoading(isLoading) {
    // Remove existing overlay if any
    const existingOverlay = document.querySelector(".spinner-overlay");
    if (existingOverlay) {
        existingOverlay.remove();
    }

    if (isLoading) {
        // Create overlay with spinner
        const overlay = document.createElement("div");
        overlay.className = "spinner-overlay animate__animated animate__fadeIn";

        const spinner = document.createElement("div");
        spinner.className = "spinner-border text-primary";
        spinner.setAttribute("role", "status");

        const srText = document.createElement("span");
        srText.className = "visually-hidden";
        srText.textContent = "Loading...";

        spinner.appendChild(srText);
        overlay.appendChild(spinner);
        document.body.appendChild(overlay);
    }
}

function openTerminal() {
    if (!currentEnvName) {
        showNotification("Error", "Please select an environment first.", "error");
        return;
    }

    showLoading(true);
    eel.launch_env_terminal(currentEnvName)(function (response) {
        showLoading(false);
        if (response.includes("Error")) {
            showNotification("Error", response, "error");
        } else {
            showNotification("Success", response, "success");
        }
    });
}
