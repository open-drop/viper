import eel
import os
import subprocess
import sys
import shutil
import time
import argparse

# Directory where all virtual environments will be stored
ENV_ROOT = os.path.join(os.getcwd(), "environments")

# Ensure the environments directory exists
if not os.path.exists(ENV_ROOT):
    os.makedirs(ENV_ROOT)

@eel.expose
def list_envs():
    """
    Return a list of all available environments in ENV_ROOT.
    Each environment will be returned with basic info:
      - name
      - path
      - installed libraries (optional on-demand or partial)
    """
    envs_data = []
    for item in os.listdir(ENV_ROOT):
        env_path = os.path.join(ENV_ROOT, item)
        if os.path.isdir(env_path) and os.path.exists(os.path.join(env_path, 'pyvenv.cfg')):
            envs_data.append({
                "name": item,
                "path": env_path
            })
    return envs_data

@eel.expose
def create_env(env_name):
    """
    Create a new Python virtual environment under ENV_ROOT/env_name
    """
    env_path = os.path.join(ENV_ROOT, env_name)
    if os.path.exists(env_path):
        return f"Error: Environment '{env_name}' already exists."
    try:
        # Create environment
        subprocess.check_call(["python", "-m", "venv", env_path])
        # Add a small delay to ensure filesystem consistency
        time.sleep(0.5)
        return f"Created environment: {env_name}"
    except subprocess.CalledProcessError as e:
        return f"Error: {str(e)}"

@eel.expose
def delete_env(env_name):
    """
    Delete the environment folder
    """
    env_path = os.path.join(ENV_ROOT, env_name)
    if os.path.exists(env_path):
        try:
            shutil.rmtree(env_path)
            return f"Deleted environment: {env_name}"
        except Exception as e:
            return f"Error deleting environment: {str(e)}"
    else:
        return f"Error: Environment '{env_name}' does not exist."

@eel.expose
def copy_env_path(env_name):
    """
    Return the full path of the environment for copying to clipboard or other usage.
    """
    env_path = os.path.join(ENV_ROOT, env_name)
    if os.path.exists(env_path):
        return env_path
    else:
        return f"Environment '{env_name}' not found."

@eel.expose
def list_libraries(env_name):
    """
    List installed libraries in a given environment
    """
    env_path = os.path.join(ENV_ROOT, env_name)
    if not os.path.exists(env_path):
        return []
    # Scripts are in the Scripts folder
    python_path = os.path.join(env_path, "Scripts", "python.exe")

    try:
        result = subprocess.check_output([python_path, "-m", "pip", "freeze"], text=True)
        # Each line of pip freeze is something like 'library==version'
        libs = []
        for line in result.splitlines():
            if "==" in line:
                lib_name, lib_version = line.split("==")
                libs.append({"name": lib_name, "version": lib_version})
        return libs
    except subprocess.CalledProcessError:
        return []

@eel.expose
def install_library(env_name, library_name):
    """
    Install a library into the given environment
    """
    env_path = os.path.join(ENV_ROOT, env_name)
    if not os.path.exists(env_path):
        return f"Error: Environment '{env_name}' does not exist."

    python_exec = "python.exe"
    python_path = os.path.join(env_path, "Scripts", python_exec)

    try:
        subprocess.check_call([python_path, "-m", "pip", "install", library_name])
        return f"Installed {library_name} in {env_name}."
    except subprocess.CalledProcessError as e:
        return f"Error installing {library_name}: {str(e)}"

@eel.expose
def uninstall_library(env_name, library_name):
    """
    Uninstall a library from the given environment
    """
    env_path = os.path.join(ENV_ROOT, env_name)
    if not os.path.exists(env_path):
        return f"Error: Environment '{env_name}' does not exist."
        
    python_exec = "python.exe"
    python_path = os.path.join(env_path, "Scripts", python_exec)

    try:
        subprocess.check_call([python_path, "-m", "pip", "uninstall", "-y", library_name])
        return f"Uninstalled {library_name} from {env_name}."
    except subprocess.CalledProcessError as e:
        return f"Error uninstalling {library_name}: {str(e)}"

@eel.expose
def export_environment(env_name, file_name="requirements.txt"):
    """
    Export environment packages to requirements.txt file
    """
    env_path = os.path.join(ENV_ROOT, env_name)
    if not os.path.exists(env_path):
        return f"Error: Environment '{env_name}' does not exist."
    
    python_exec = "python.exe"
    python_path = os.path.join(env_path, "Scripts", python_exec)

    # Ensure file extension is .txt
    if not file_name.endswith('.txt'):
        file_name += '.txt'
    
    output_path = os.path.join(os.getcwd(), file_name)
    
    try:
        with open(output_path, 'w') as f:
            subprocess.check_call([python_path, "-m", "pip", "freeze"], stdout=f, text=True)
        return f"Exported environment to {file_name}"
    except subprocess.CalledProcessError as e:
        return f"Error exporting environment: {str(e)}"
    except Exception as e:
        return f"Error: {str(e)}"

@eel.expose
def save_selected_packages(content, file_name="selected_packages.txt"):
    """
    Save selected packages to a file
    """
    # Ensure file extension is .txt
    if not file_name.endswith('.txt'):
        file_name += '.txt'
    
    output_path = os.path.join(os.getcwd(), file_name)
    
    try:
        with open(output_path, 'w') as f:
            f.write(content)
        return f"Exported selected packages to {file_name}"
    except Exception as e:
        return f"Error exporting packages: {str(e)}"

@eel.expose
def launch_env_terminal(env_name):
    """
    Launch a terminal with the environment activated
    """
    env_path = os.path.join(ENV_ROOT, env_name)
    if not os.path.exists(env_path):
        return f"Error: Environment '{env_name}' does not exist."
    
    try:
        if os.name == "nt":  # Windows
            activate_script = os.path.join(env_path, "Scripts", "activate.bat")
            # Using cmd.exe to open a new terminal window with environment activated
            subprocess.Popen(f'start cmd.exe /K "{activate_script}" && cd /d "{os.path.dirname(env_path)}"', shell=True)        
        return f"Terminal opened with {env_name} activated"
    except Exception as e:
        return f"Error launching terminal: {str(e)}"

def start_app():
    """Start the Eel web application"""
    eel.init('web')
    eel.start('index.html', size=(1200, 800), mode='chrome')

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Viper Environment Manager')
    parser.add_argument('--manifest', action='store_true', help='Display the manifest file path for Auto PY to EXE')
    parser.add_argument('--version-file', action='store_true', help='Display the version file path for Auto PY to EXE')
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_arguments()
    
    if args.manifest:
        manifest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'viper.manifest')
        print(f"Manifest file path: {manifest_path}")
        sys.exit(0)
    
    if args.version_file:
        version_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'version_info.txt')
        print(f"Version file path: {version_file_path}")
        sys.exit(0)
    
    start_app()
